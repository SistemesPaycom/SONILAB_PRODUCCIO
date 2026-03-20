# -*- coding: utf-8 -*-
"""
diarization.py — Interlocutores (pyannote vía WhisperX)
- compat HF hub (use_auth_token -> token)
- extracción robusta de segmentos
- suavizado
- colapso de speakers raros/excesivos
- asignación de speaker a palabras (por solape)
- logging de errores a fichero
"""

from __future__ import annotations

import os
import sys
import csv
import traceback
from typing import Any, Dict, List, Optional, Tuple


def safe_float(x, default=None):
    try:
        return float(x)
    except Exception:
        return default


def patch_hf_hub_use_auth_token_compat() -> None:
    """
    Compatibilidad: algunas versiones de pyannote/WhisperX pasan use_auth_token=...
    pero huggingface_hub moderno usa token=...
    """
    try:
        import inspect
        import huggingface_hub
        from huggingface_hub import file_download as _fd  # type: ignore

        orig = huggingface_hub.hf_hub_download

        # Si ya soporta use_auth_token, no hace falta
        try:
            sig = inspect.signature(orig)
            if "use_auth_token" in sig.parameters:
                return
        except Exception:
            pass

        def hf_hub_download_compat(*args, use_auth_token=None, token=None, **kwargs):
            if token is None and use_auth_token is not None and use_auth_token is not False:
                token = use_auth_token if use_auth_token is not True else None
            kwargs.pop("use_auth_token", None)
            return orig(*args, token=token, **kwargs)

        huggingface_hub.hf_hub_download = hf_hub_download_compat  # type: ignore
        try:
            _fd.hf_hub_download = hf_hub_download_compat  # type: ignore
        except Exception:
            pass

        # Parchar refs ya importadas
        for m in list(sys.modules.values()):
            if not m or not hasattr(m, "hf_hub_download"):
                continue
            try:
                cur = getattr(m, "hf_hub_download")
                if cur is orig:
                    setattr(m, "hf_hub_download", hf_hub_download_compat)
            except Exception:
                pass

    except Exception:
        pass


def _extract_diarization_segments(diarization_result: Any) -> List[Dict]:
    """
    Devuelve lista [{start,end,speaker}] ordenada.
    Soporta:
      - pyannote Annotation (itertracks)
      - DataFrame (iterrows)
      - dict con 'segments'
      - list de dicts
    """
    segs: List[Dict] = []
    if diarization_result is None:
        return segs

    # pyannote Annotation-like
    if hasattr(diarization_result, "itertracks"):
        try:
            for segment, _, label in diarization_result.itertracks(yield_label=True):
                st = safe_float(getattr(segment, "start", None), None)
                en = safe_float(getattr(segment, "end", None), None)
                if st is None or en is None or en <= st:
                    continue
                segs.append({"start": float(st), "end": float(en), "speaker": str(label) if label is not None else None})
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs
        except Exception:
            pass

    # DataFrame-like
    if hasattr(diarization_result, "iterrows"):
        try:
            for _, row in diarization_result.iterrows():
                st = safe_float(getattr(row, "start", None) if hasattr(row, "start") else row.get("start", None), None)
                en = safe_float(getattr(row, "end", None) if hasattr(row, "end") else row.get("end", None), None)
                if st is None or en is None or en <= st:
                    continue

                if hasattr(row, "speaker"):
                    spk = getattr(row, "speaker")
                elif hasattr(row, "label"):
                    spk = getattr(row, "label")
                else:
                    spk = row.get("speaker", None) or row.get("label", None)

                segs.append({"start": float(st), "end": float(en), "speaker": str(spk) if spk is not None else None})
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs
        except Exception:
            pass

    # dict
    if isinstance(diarization_result, dict):
        items = diarization_result.get("segments") or diarization_result.get("diarization") or diarization_result.get("speaker_segments")
        if isinstance(items, list):
            for s in items:
                try:
                    st = safe_float(s.get("start", None), None)
                    en = safe_float(s.get("end", None), None)
                    spk = s.get("speaker", None) or s.get("label", None)
                    if st is None or en is None or en <= st:
                        continue
                    segs.append({"start": float(st), "end": float(en), "speaker": str(spk) if spk is not None else None})
                except Exception:
                    continue
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs

    # list
    if isinstance(diarization_result, list):
        for s in diarization_result:
            try:
                st = safe_float(s.get("start", None), None)
                en = safe_float(s.get("end", None), None)
                spk = s.get("speaker", None) or s.get("label", None)
                if st is None or en is None or en <= st:
                    continue
                segs.append({"start": float(st), "end": float(en), "speaker": str(spk) if spk is not None else None})
            except Exception:
                continue
        segs.sort(key=lambda x: (x["start"], x["end"]))
        return segs

    return segs


def merge_adjacent_same_speaker(segs: List[Dict], gap_tol: float = 0.05) -> List[Dict]:
    if not segs:
        return segs
    segs = sorted(segs, key=lambda x: (float(x["start"]), float(x["end"])))
    out = [dict(segs[0])]
    for s in segs[1:]:
        prev = out[-1]
        if prev.get("speaker") == s.get("speaker") and float(s["start"]) <= float(prev["end"]) + gap_tol:
            prev["end"] = max(float(prev["end"]), float(s["end"]))
        else:
            out.append(dict(s))
    return out


def smooth_diarization_segments(segs: List[Dict], min_seg: float) -> List[Dict]:
    """
    Suaviza parpadeos sin comerse interjecciones reales:
    - merge contiguos mismo speaker
    - si un segmento corto está ENTRE el mismo speaker (A B A) -> se absorbe
    - si es ultra-corto -> se absorbe al vecino más fuerte
    """
    if not segs:
        return segs

    segs = merge_adjacent_same_speaker(segs)
    if len(segs) <= 1:
        return segs

    hard_min = min(0.12, max(0.06, min_seg * 0.5))

    out: List[Dict] = []
    i = 0
    while i < len(segs):
        s = dict(segs[i])
        dur = float(s["end"]) - float(s["start"])

        prev = out[-1] if out else None
        nxt = segs[i + 1] if i + 1 < len(segs) else None

        if dur >= min_seg:
            out.append(s)
            i += 1
            continue

        # Caso flicker A B A: absorbemos B
        if prev and nxt and prev.get("speaker") == nxt.get("speaker") and prev.get("speaker") is not None:
            prev["end"] = max(float(prev["end"]), float(nxt["end"]))
            i += 2
            continue

        # Ultra-corto: absorbemos al vecino “más fuerte”
        if dur < hard_min:
            if prev and nxt:
                dprev = float(prev["end"]) - float(prev["start"])
                dnxt = float(nxt["end"]) - float(nxt["start"])
                if dprev >= dnxt:
                    prev["end"] = max(float(prev["end"]), float(s["end"]))
                else:
                    nn = dict(nxt)
                    nn["start"] = min(float(nn["start"]), float(s["start"]))
                    segs[i + 1] = nn
            elif prev:
                prev["end"] = max(float(prev["end"]), float(s["end"]))
            elif nxt:
                nn = dict(nxt)
                nn["start"] = min(float(nn["start"]), float(s["start"]))
                segs[i + 1] = nn
            i += 1
            continue

        # Segmento corto pero podría ser real -> lo conservamos
        out.append(s)
        i += 1

    return merge_adjacent_same_speaker(out)


def merge_rare_speakers(
    segs: List[Dict],
    *,
    min_total_dur_s: float = 8.0,
    min_total_ratio: float = 0.01,
    max_speakers_keep: Optional[int] = 12,
    max_neighbor_gap: float = 0.35,
) -> List[Dict]:
    """
    Heurística para diarización ruidosa:
    - Calcula duración total por speaker.
    - Marca “rare” los speakers con poca presencia, y/o los fuera del top-K si hay demasiados.
    - Reasigna segmentos “rare” al vecino no-rare más cercano (prev/next) si está cerca.
    - Finalmente, mergea adyacentes del mismo speaker.
    """
    if not segs:
        return segs

    segs = sorted(segs, key=lambda x: (float(x["start"]), float(x["end"])))

    dur_by: Dict[str, float] = {}
    total = 0.0
    for s in segs:
        spk = str(s.get("speaker") or "UNK")
        st = float(s["start"]); en = float(s["end"])
        d = max(0.0, en - st)
        dur_by[spk] = dur_by.get(spk, 0.0) + d
        total += d

    if total <= 0:
        return segs

    keep = set(dur_by.keys())
    if max_speakers_keep is not None and len(dur_by) > max_speakers_keep:
        top = sorted(dur_by.items(), key=lambda kv: kv[1], reverse=True)[:max_speakers_keep]
        keep = {k for k, _ in top}

    rare = set()
    for spk, d in dur_by.items():
        if spk == "UNK":
            continue
        if (d < min_total_dur_s) or ((d / total) < min_total_ratio) or (spk not in keep):
            rare.add(spk)

    if not rare:
        return segs

    def prev_good(idx: int) -> Optional[Tuple[int, Dict]]:
        j = idx - 1
        while j >= 0:
            spk = str(segs[j].get("speaker") or "UNK")
            if spk != "UNK" and spk not in rare:
                return j, segs[j]
            j -= 1
        return None

    def next_good(idx: int) -> Optional[Tuple[int, Dict]]:
        j = idx + 1
        while j < len(segs):
            spk = str(segs[j].get("speaker") or "UNK")
            if spk != "UNK" and spk not in rare:
                return j, segs[j]
            j += 1
        return None

    out: List[Dict] = []
    for i, s in enumerate(segs):
        spk = str(s.get("speaker") or "UNK")
        if spk == "UNK" or spk not in rare:
            out.append(dict(s))
            continue

        st = float(s["start"]); en = float(s["end"])
        p = prev_good(i)
        n = next_good(i)

        cand = None
        if p is not None:
            _, ps = p
            gap_p = st - float(ps["end"])
            if gap_p <= max_neighbor_gap:
                cand = ("prev", gap_p, ps)

        if n is not None:
            _, ns = n
            gap_n = float(ns["start"]) - en
            if gap_n <= max_neighbor_gap:
                if cand is None:
                    cand = ("next", gap_n, ns)
                else:
                    _, gap_p, ps = cand
                    spk_p = str(ps.get("speaker") or "UNK")
                    spk_n = str(ns.get("speaker") or "UNK")
                    if (gap_n < gap_p) or (gap_n == gap_p and dur_by.get(spk_n, 0.0) > dur_by.get(spk_p, 0.0)):
                        cand = ("next", gap_n, ns)

        if cand is None:
            out.append(dict(s))
        else:
            _, _, ns = cand
            new_spk = str(ns.get("speaker") or "UNK")
            ss = dict(s)
            ss["speaker"] = new_spk
            out.append(ss)

    return merge_adjacent_same_speaker(out, gap_tol=max_neighbor_gap)


def map_speakers_to_interlocutors(segs: List[Dict]) -> Tuple[List[Dict], Dict[str, str]]:
    """
    Mapea labels del diarizador a Interlocutor01/02/... por orden de primera aparición.
    """
    if not segs:
        return segs, {}

    segs = sorted(segs, key=lambda x: (float(x["start"]), float(x["end"])))
    mapping: Dict[str, str] = {}
    next_id = 1

    for s in segs:
        lab = str(s.get("speaker") or "UNK")
        if lab not in mapping:
            mapping[lab] = f"Interlocutor{next_id:02d}"
            next_id += 1

    out = []
    for s in segs:
        lab = str(s.get("speaker") or "UNK")
        ss = dict(s)
        ss["speaker"] = mapping.get(lab, lab)
        out.append(ss)

    return out, mapping


def assign_speakers_to_words(
    word_segments: List[Dict],
    diarization_segments: List[Dict],
    fill_nearby_gap: float = 0.20
) -> List[Dict]:
    """
    Asigna speaker a cada palabra por MÁXIMO SOLAPE (más robusto que midpoint).
    Si no hay solape, intenta heredar el speaker anterior si el gap es pequeño (fill_nearby_gap).
    """
    if not word_segments or not diarization_segments:
        return word_segments

    diar = sorted(diarization_segments, key=lambda x: (float(x["start"]), float(x["end"])))
    wout: List[Dict] = []

    j = 0
    m = len(diar)
    prev_spk = None
    prev_word_end = None

    for w in word_segments:
        st = safe_float(w.get("start", None), None)
        en = safe_float(w.get("end", None), None)
        if st is None or en is None or en <= st:
            wout.append(w)
            continue

        st = float(st); en = float(en)

        while j < m and float(diar[j]["end"]) <= st:
            j += 1

        best_spk = None
        best_ov = 0.0

        k = j
        while k < m and float(diar[k]["start"]) < en:
            ov = min(en, float(diar[k]["end"])) - max(st, float(diar[k]["start"]))
            if ov > best_ov:
                best_ov = ov
                best_spk = diar[k].get("speaker")
            k += 1

        if best_spk is None and prev_spk is not None:
            if prev_word_end is not None and (st - prev_word_end) <= fill_nearby_gap:
                best_spk = prev_spk

        ww = dict(w)
        if best_spk is not None:
            ww["speaker"] = best_spk
            prev_spk = best_spk
        prev_word_end = en
        wout.append(ww)

    return wout


def write_speakers_map(mapping: Dict[str, str], out_base: str) -> str:
    path = out_base + "_speakers_map.csv"
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        wcsv = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        wcsv.writerow(["original_label", "interlocutor"])
        for k, v in mapping.items():
            wcsv.writerow([k, v])
    return path


def smooth_word_speakers(
    word_segments: List[Dict],
    min_run_words: int = 1,
    min_run_dur: float = 0.15,
) -> List[Dict]:
    """
    Suaviza asignaciones de speaker a nivel de palabra.
    Agrupa palabras consecutivas del mismo speaker en "runs".
    Si un run es demasiado corto (< min_run_words palabras Y < min_run_dur segundos),
    lo absorbe al run vecino más largo.

    min_run_words=1 preserva interjecciones de una sola palabra (Sí/No/Vale).
    min_run_words=2 es más agresivo (absorbe palabras sueltas).
    """
    if not word_segments:
        return word_segments

    # Agrupar en runs consecutivos del mismo speaker
    runs: List[Dict] = []
    for w in word_segments:
        spk = w.get("speaker")
        if runs and runs[-1]["speaker"] == spk:
            runs[-1]["words"].append(w)
            runs[-1]["end"] = safe_float(w.get("end"), runs[-1]["end"])
        else:
            runs.append({
                "speaker": spk,
                "words": [w],
                "start": safe_float(w.get("start"), 0.0),
                "end": safe_float(w.get("end"), 0.0),
            })

    if len(runs) <= 1:
        return word_segments

    # Absorber runs cortos al vecino más largo
    changed = True
    while changed:
        changed = False
        new_runs = []
        i = 0
        while i < len(runs):
            r = runs[i]
            dur = (r["end"] or 0.0) - (r["start"] or 0.0)
            nwords = len(r["words"])

            if nwords < min_run_words and dur < min_run_dur and len(runs) > 1:
                # Determinar vecinos
                prev_run = new_runs[-1] if new_runs else None
                next_run = runs[i + 1] if i + 1 < len(runs) else None

                if prev_run and next_run:
                    prev_dur = (prev_run["end"] or 0.0) - (prev_run["start"] or 0.0)
                    next_dur = (next_run["end"] or 0.0) - (next_run["start"] or 0.0)
                    absorb_into = prev_run if prev_dur >= next_dur else next_run
                elif prev_run:
                    absorb_into = prev_run
                elif next_run:
                    absorb_into = next_run
                else:
                    new_runs.append(r)
                    i += 1
                    continue

                # Re-etiquetar palabras del run corto con el speaker del vecino
                new_spk = absorb_into["speaker"]
                for w in r["words"]:
                    ww = dict(w)
                    if new_spk is not None:
                        ww["speaker"] = new_spk
                    new_runs.append(ww) if False else None  # placeholder
                    absorb_into["words"].append(ww)
                absorb_into["start"] = min(absorb_into["start"] or 0.0, r["start"] or 0.0)
                absorb_into["end"] = max(absorb_into["end"] or 0.0, r["end"] or 0.0)
                changed = True
                i += 1
                continue

            new_runs.append(r)
            i += 1
        runs = new_runs

    # Reconstruir lista de palabras
    out = []
    for r in runs:
        out.extend(r["words"])
    return out


def try_run_diarization(
    wav_path: str,
    audio_arr,
    device: str,
    hf_token: str,
    offline_mode: bool,
    status_cb,
    log_path: str,
    min_speakers: Optional[int] = None,
    max_speakers: Optional[int] = None,
) -> Optional[List[Dict]]:
    """
    Devuelve segmentos [{start,end,speaker}] o None.
    - Online: normalmente necesitas token (modelos gated).
    - Offline: intentamos aunque token esté vacío SI el modelo ya está cacheado.
    - min_speakers/max_speakers: constrains de pyannote para mejorar detección.
      Si se conoce el número exacto de speakers, pasar min=max=N.
    """
    if (not offline_mode) and (not hf_token):
        return None

    try:
        patch_hf_hub_use_auth_token_compat()

        import whisperx  # local import para evitar dependencias en import-time

        n_hint = ""
        if min_speakers is not None or max_speakers is not None:
            n_hint = f" (min_speakers={min_speakers}, max_speakers={max_speakers})"
        status_cb(f"Diarizando interlocutores (pyannote){n_hint}...")

        DP = getattr(whisperx, "DiarizationPipeline", None)
        if DP is None:
            from whisperx.diarize import DiarizationPipeline as DP  # type: ignore

        diarize_pipeline = DP(use_auth_token=(hf_token or None), device=device)

        # Construir kwargs opcionales para el pipeline
        diar_kwargs: dict = {}
        if min_speakers is not None:
            diar_kwargs["min_speakers"] = int(min_speakers)
        if max_speakers is not None:
            diar_kwargs["max_speakers"] = int(max_speakers)

        diar_res = None
        try:
            if isinstance(wav_path, str) and os.path.isfile(wav_path):
                diar_res = diarize_pipeline(wav_path, **diar_kwargs)
            else:
                diar_res = diarize_pipeline(audio_arr, **diar_kwargs)
        except Exception:
            diar_res = diarize_pipeline(audio_arr, **diar_kwargs)

        segs = _extract_diarization_segments(diar_res)
        if not segs:
            status_cb("Diarización: no se han obtenido segmentos.")
            return None

        return segs

    except Exception as e:
        try:
            with open(log_path, "w", encoding="utf-8") as f:
                f.write("Diarization failed:\n")
                f.write(str(e) + "\n\n")
                f.write(traceback.format_exc())
            status_cb(f"Diarización falló. Revisa: {log_path}")
        except Exception:
            status_cb(f"Diarización falló ({e}). Continuando sin interlocutores...")
        return None
