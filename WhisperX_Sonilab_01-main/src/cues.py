# -*- coding: utf-8 -*-
"""
cues.py — Construcción de cues (normativa VE/VCAT)
- saneado word_segments
- heurística de corte por pausas/puntuación
- split por frase interna (punto)
- merges de huérfanos / cues ultracortos
- timings finales + formateo (incl. diálogo con guiones)
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from rules import SubtitleRules, BAD_END_WORDS, DISCOURSE_MARKERS, ORPHAN_START_WORDS


def safe_float(x, default=None):
    try:
        return float(x)
    except Exception:
        return default


def normalize_token(t: str) -> str:
    return re.sub(r"[^\wáéíóúüñÁÉÍÓÚÜÑ]", "", (t or "")).lower().strip()


def text_len_for_cps(text: str) -> int:
    return len((text or "").replace("\n", ""))


def is_strong_punct(word: str) -> bool:
    return bool(re.search(r"[.!?…]+$", word or ""))


def is_soft_punct(word: str) -> bool:
    return bool(re.search(r"[,;:]+$", word or ""))


def looks_like_proper(word: str) -> bool:
    w = (word or "").strip()
    if not w:
        return False
    w = re.sub(r"^[\"'“”‘’¿¡(\[]+", "", w)
    w = re.sub(r"[\"'“”‘’)\].,;:!?…]+$", "", w)
    return bool(w) and w[0].isupper()


# ============================================================
# Word sanity
# ============================================================

def clean_word_segments(word_segments: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    - Elimina entradas inválidas
    - Fuerza start/end coherentes
    - CAP de duración de palabra si viene estirada
    - Preserva speaker si existe
    """
    out = []
    for ws in (word_segments or []):
        try:
            if not ws:
                continue
            w = str(ws.get("word", "")).strip()
            st = safe_float(ws.get("start", None), None)
            en = safe_float(ws.get("end", None), None)
            spk = ws.get("speaker", None)

            if not w or st is None or en is None:
                continue
            if en < st:
                en = st + 0.05

            dur = en - st
            if dur > rules.max_word_duration_sanity:
                en = st + rules.max_word_duration_sanity

            item = {"word": w, "start": float(st), "end": float(en)}
            if spk is not None:
                item["speaker"] = spk
            out.append(item)
        except Exception:
            continue

    out.sort(key=lambda x: (x["start"], x["end"]))
    return out


# ============================================================
# Speakers helpers
# ============================================================

def speaker_of_word(w: Dict) -> str:
    spk = w.get("speaker", None)
    return str(spk) if spk is not None else "UNK"


def split_words_by_speaker(words: List[Dict]) -> List[List[Dict]]:
    if not words:
        return []
    chunks: List[List[Dict]] = []
    cur = [words[0]]
    cur_spk = speaker_of_word(words[0])

    for w in words[1:]:
        spk = speaker_of_word(w)

        # UNK no debe forzar un cambio: lo pegamos al speaker actual si existe
        if spk == "UNK" and cur_spk != "UNK":
            cur.append(w)
            continue

        if spk != cur_spk:
            chunks.append(cur)
            cur = [w]
            cur_spk = spk
        else:
            cur.append(w)
    chunks.append(cur)
    return chunks


def cue_has_speaker_change(words: List[Dict]) -> bool:
    if not words:
        return False
    spks = {speaker_of_word(w) for w in words}
    non_unk = {s for s in spks if s != "UNK"}
    return len(non_unk) >= 2


def cue_dominant_speaker(words: List[Dict]) -> Optional[str]:
    if not words:
        return None
    counts: Dict[str, int] = {}
    for w in words:
        spk = speaker_of_word(w)
        counts[spk] = counts.get(spk, 0) + 1
    if len(counts) > 1 and "UNK" in counts:
        del counts["UNK"]
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: kv[1])[0]


def same_dom_speaker(a_words: List[Dict], b_words: List[Dict]) -> bool:
    sa = cue_dominant_speaker(a_words)
    sb = cue_dominant_speaker(b_words)
    if sa is None or sb is None:
        return True
    return sa == sb


# ============================================================
# Line breaking (piramidal)
# ============================================================

def wrap_two_lines_smart(words: List[str], rules: SubtitleRules) -> Optional[str]:
    if not words:
        return None

    full = " ".join(words).strip()
    if not full:
        return None

    should_try_split = (len(full) >= rules.prefer_split_min_chars and len(words) >= rules.prefer_split_min_words)

    if len(full) <= rules.max_chars_per_line and not should_try_split:
        return full

    if len(full) <= rules.soft_max_chars_per_line and not should_try_split:
        return full

    def score_split(l1: str, l2: str, w_left: str, w_right: str) -> float:
        s = abs(len(l1) - len(l2))

        # pirámide: penaliza si arriba > abajo
        if len(l1) > len(l2):
            s += 80

        # penaliza que línea 1 termine con palabra “función”
        if normalize_token(w_left) in BAD_END_WORDS:
            s += 120

        # penaliza separar “de|algo”, etc.
        if normalize_token(w_left) in ORPHAN_START_WORDS:
            s += 70

        # bonus si el corte cae tras puntuación
        if is_soft_punct(w_left) or is_strong_punct(w_left):
            s -= 10

        # bonus si línea 2 empieza con palabra función
        if normalize_token(w_right) in BAD_END_WORDS:
            s -= 15

        return s

    for maxc in (rules.max_chars_per_line, rules.soft_max_chars_per_line):
        best = None
        best_score = 1e18
        for i in range(1, len(words)):
            l1 = " ".join(words[:i]).strip()
            l2 = " ".join(words[i:]).strip()
            if len(l1) <= maxc and len(l2) <= maxc:
                s = score_split(l1, l2, words[i - 1], words[i])
                if s < best_score:
                    best_score = s
                    best = (l1, l2)
        if best is not None:
            return best[0] + "\n" + best[1]

    if len(full) <= rules.soft_max_chars_per_line:
        return full

    return None


# ============================================================
# Formateo con interlocutores
# ============================================================

def format_dialogue_text(words: List[Dict], rules: SubtitleRules, prev_last_speaker: Optional[str]) -> Optional[Tuple[str, str, str]]:
    """
    - 1 speaker => wrap normal
    - 2 speakers => 2 líneas SIEMPRE, con guión:
        - línea 2 siempre con guión
        - línea 1 con guión solo si NO es continuidad
    Devuelve (text, first_spk, last_spk) o None
    """
    if not words:
        return None

    chunks = split_words_by_speaker(words)

    if len(chunks) == 1 or not cue_has_speaker_change(words):
        spk = speaker_of_word(words[0])
        text = wrap_two_lines_smart([w["word"] for w in words], rules)
        if text is None:
            return None
        return text, spk, spk

    if len(chunks) > rules.dialogue_max_speakers_per_cue:
        return None

    ch1, ch2 = chunks[0], chunks[1]
    spk1 = speaker_of_word(ch1[0])
    spk2 = speaker_of_word(ch2[0])

    t1 = " ".join([w["word"] for w in ch1]).strip()
    t2 = " ".join([w["word"] for w in ch2]).strip()
    if not t1 or not t2:
        return None

    dash = rules.dialogue_dash or "- "
    needs_dash_1 = (prev_last_speaker is None) or (spk1 != prev_last_speaker)
    line1 = (dash + t1) if needs_dash_1 else t1
    line2 = dash + t2

    if len(line1) > rules.max_chars_per_line or len(line2) > rules.max_chars_per_line:
        return None

    return f"{line1}\n{line2}", spk1, spk2


# ============================================================
# Cue building
# ============================================================

def split_by_pause(words: List[Dict], max_pause: Optional[float]) -> List[List[Dict]]:
    if not words:
        return []
    if max_pause is None or max_pause <= 0:
        return [words]

    groups: List[List[Dict]] = []
    cur = [words[0]]
    for w in words[1:]:
        gap = w["start"] - cur[-1]["end"]
        if gap > max_pause:
            groups.append(cur)
            cur = [w]
        else:
            cur.append(w)
    groups.append(cur)
    return groups


def can_format_words(words: List[Dict], rules: SubtitleRules) -> Tuple[bool, Optional[str]]:
    """
    Si hay 2 speakers, exigimos 2 líneas (una por speaker) y hard 38.
    """
    if not words:
        return False, None

    if cue_has_speaker_change(words):
        chunks = split_words_by_speaker(words)
        if len(chunks) != 2:
            return False, None
        dash = rules.dialogue_dash or "- "
        t1 = dash + " ".join([w["word"] for w in chunks[0]]).strip()
        t2 = dash + " ".join([w["word"] for w in chunks[1]]).strip()
        if len(t1) > rules.max_chars_per_line or len(t2) > rules.max_chars_per_line:
            return False, None
        return True, f"{t1}\n{t2}"

    text = wrap_two_lines_smart([w["word"] for w in words], rules)
    if text is None:
        return False, None
    return True, text


def build_cues_from_group(group: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    Greedy con puntos de corte:
    - fuerte/soft punct
    - conjunción y/e/i
    - cambios de speaker
    """
    cues: List[Dict] = []
    i = 0
    n = len(group)

    while i < n:
        cur_words: List[Dict] = []
        candidate_cuts: List[int] = []
        last_spk = None

        j = i
        while j < n:
            cur_words.append(group[j])

            wtxt = group[j]["word"]
            wnorm = normalize_token(wtxt)

            if is_strong_punct(wtxt) or is_soft_punct(wtxt):
                candidate_cuts.append(len(cur_words) - 1)
            elif wnorm in {"y", "e", "i"} and len(cur_words) >= 2:
                candidate_cuts.append(len(cur_words) - 2)

            spk = group[j].get("speaker", None)
            if spk is not None:
                if last_spk is None:
                    last_spk = spk
                elif spk != last_spk and len(cur_words) >= 2:
                    candidate_cuts.append(len(cur_words) - 2)
                    last_spk = spk

            start_t = cur_words[0]["start"]
            end_t = cur_words[-1]["end"]
            dur = end_t - start_t

            ok_fmt, _ = can_format_words(cur_words, rules)
            too_long = dur > rules.max_duration

            if (not ok_fmt) or too_long:
                cut_idx = None

                # candidate cuts de atrás hacia delante
                for k in reversed(candidate_cuts):
                    if k < 0:
                        continue
                    cue_words = cur_words[:k + 1]
                    if not cue_words:
                        continue
                    st = cue_words[0]["start"]
                    en = cue_words[-1]["end"]
                    if (en - st) > rules.max_duration:
                        continue
                    ok_k, _ = can_format_words(cue_words, rules)
                    if ok_k:
                        cut_idx = k
                        break

                # si ninguno funciona, reducimos hasta que sea formateable (o 1 palabra)
                if cut_idx is None:
                    k = len(cur_words) - 2
                    while k >= 0:
                        cue_words = cur_words[:k + 1]
                        ok_k, _ = can_format_words(cue_words, rules)
                        if ok_k:
                            cut_idx = k
                            break
                        k -= 1

                if cut_idx is None:
                    cues.append({"words": [cur_words[0]]})
                    i += 1
                else:
                    cues.append({"words": cur_words[:cut_idx + 1]})
                    i = i + (cut_idx + 1)

                break

            if j == n - 1:
                cues.append({"words": cur_words})
                i = n
                break

            j += 1

    return cues


def build_cues(words: List[Dict], rules: SubtitleRules) -> List[Dict]:
    groups = split_by_pause(words, rules.max_pause_within_cue)
    cues: List[Dict] = []
    for g in groups:
        cues.extend(build_cues_from_group(g, rules))
    return cues


# ============================================================
# Split extra por puntuación fuerte interna
# ============================================================

def split_cues_on_internal_sentence_punct(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    Si un cue contiene un punto fuerte y luego hay cola suficiente,
    intentamos partirlo en 2 cues formateables.
    """
    if not cues or not rules.split_on_internal_sentence_punct:
        return cues

    out: List[Dict] = []
    for c in cues:
        ws = c["words"]
        if not ws or len(ws) < 4:
            out.append(c)
            continue

        # Evitar splits en cues con cambio de speaker
        if cue_has_speaker_change(ws):
            out.append(c)
            continue

        split_idx = None
        for k in range(len(ws) - 2):
            if is_strong_punct(ws[k]["word"]):
                tail_words = ws[k + 1:]
                if len(tail_words) >= rules.split_sentence_min_tail_words:
                    if looks_like_proper(tail_words[0]["word"]) or normalize_token(tail_words[0]["word"]) in DISCOURSE_MARKERS:
                        split_idx = k

        if split_idx is None:
            out.append(c)
            continue

        a = ws[:split_idx + 1]
        b = ws[split_idx + 1:]

        ok_a, _ = can_format_words(a, rules)
        ok_b, _ = can_format_words(b, rules)
        if ok_a and ok_b:
            out.append({"words": a})
            out.append({"words": b})
        else:
            out.append(c)

    return out


# ============================================================
# Postprocess: huérfanos / ultracortos
# ============================================================

def is_orphan_cue_words(cue_words: List[Dict], rules: SubtitleRules) -> bool:
    toks = [normalize_token(w["word"]) for w in cue_words if normalize_token(w["word"])]
    if not toks:
        return False

    last = cue_words[-1]["word"]

    if len(toks) <= 2 and toks[0] in ORPHAN_START_WORDS:
        return True

    if len(toks) <= rules.carry_max_words and toks[0] in DISCOURSE_MARKERS:
        if is_soft_punct(last) or len(toks) == 1:
            return True

    if len(toks) <= rules.carry_max_words and is_soft_punct(last) and (not is_strong_punct(last)):
        return True

    return False


def move_carryover_after_strong_punct(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    Si dentro de un cue hay un '.' y luego un trocito corto tipo “Además,”,
    lo movemos al siguiente cue (sin mezclar speakers).
    """
    if not cues:
        return cues

    out = cues[:]
    i = 0
    while i < len(out) - 1:
        cw = out[i]["words"]
        nxt = out[i + 1]["words"]

        if cue_has_speaker_change(cw) or cue_has_speaker_change(nxt) or (not same_dom_speaker(cw, nxt)):
            i += 1
            continue

        last_strong = None
        for k, w in enumerate(cw):
            if is_strong_punct(w["word"]):
                last_strong = k

        if last_strong is not None and last_strong < len(cw) - 1:
            tail = cw[last_strong + 1:]
            if len(tail) <= rules.carry_max_words and is_orphan_cue_words(tail, rules):
                out[i]["words"] = cw[:last_strong + 1]
                out[i + 1]["words"] = tail + nxt
        i += 1

    return out


def merge_orphans_and_ultrashort(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    - cues huérfanos => pegar al vecino si está cerca (sin mezclar speakers)
    - cues enanos => pegar al siguiente si está cerca (sin mezclar speakers)

    Mode subtitle_edit_compat: thresholds molt conservadors per obtenir més cues
    i sortida similar a Subtitle Edit (menys merges agressius).
    """
    if not cues:
        return cues

    # Thresholds efectius: en mode subtitle_edit_compat, quasi cap merge
    if getattr(rules, 'subtitle_edit_compat', False):
        eff_orphan_gap = 0.20    # 200ms vs 1.0s default
        eff_small_gap = 0.20     # 200ms vs 0.85s default
        eff_small_words = 1      # 1 paraula (ex: "Ei!") vs 3 default
        eff_small_chars = 5      # 5 chars vs 18 default
    else:
        eff_orphan_gap = rules.orphan_merge_gap
        eff_small_gap = rules.small_merge_gap
        eff_small_words = rules.small_cue_max_words
        eff_small_chars = rules.small_cue_max_chars

    def cue_start(c): return c["words"][0]["start"]
    def cue_end_speech(c): return c["words"][-1]["end"]

    def words_to_chars(ws: List[Dict]) -> int:
        return len(" ".join([w["word"] for w in ws]).strip())

    def merged_ok(ws: List[Dict]) -> bool:
        if not ws:
            return False
        speech_dur = ws[-1]["end"] - ws[0]["start"]
        if speech_dur > rules.max_duration:
            return False
        ok, _ = can_format_words(ws, rules)
        return ok

    out = cues[:]
    i = 0
    while i < len(out) - 1:
        c = out[i]
        n = out[i + 1]

        gap = cue_start(n) - cue_end_speech(c)
        dur_c = cue_end_speech(c) - cue_start(c)

        if cue_has_speaker_change(c["words"]) or cue_has_speaker_change(n["words"]) or (not same_dom_speaker(c["words"], n["words"])):
            i += 1
            continue

        # NEXT huérfano -> pegar hacia atrás
        if gap <= eff_orphan_gap and is_orphan_cue_words(n["words"], rules):
            merged = c["words"] + n["words"]
            if merged_ok(merged):
                out[i]["words"] = merged
                out.pop(i + 1)
                continue

        # CURRENT huérfano -> pegar hacia delante
        if gap <= eff_orphan_gap and is_orphan_cue_words(c["words"], rules):
            merged = c["words"] + n["words"]
            if merged_ok(merged):
                out[i + 1]["words"] = merged
                out.pop(i)
                continue

        # CURRENT enano -> pegar al siguiente
        c_toks = [normalize_token(w["word"]) for w in c["words"] if normalize_token(w["word"])]
        c_chars = words_to_chars(c["words"])
        is_small = (
            len(c_toks) <= eff_small_words
            or c_chars <= eff_small_chars
            or dur_c < (rules.min_duration * rules.ultra_short_ratio)
        )

        if is_small and gap <= eff_small_gap:
            merged = c["words"] + n["words"]
            if merged_ok(merged):
                out[i]["words"] = merged
                out.pop(i + 1)
                continue

        i += 1

    return out


# ============================================================
# Timings + format final
# ============================================================

def split_overlong_cues(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    Si tras merges queda un cue que no se puede formatear, lo re-spliteamos.
    """
    out: List[Dict] = []
    for c in cues:
        ok, _ = can_format_words(c["words"], rules)
        if ok:
            out.append(c)
        else:
            out.extend(build_cues_from_group(c["words"], rules))
    return out


def apply_timings_and_format(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    start = start palabra 1
    speech_end = end última palabra
    end = speech_end, luego extender para min_duration/cps si hay hueco

    Mejora: si hay cambio de speaker y NO se puede formatear como diálogo (2 líneas),
    partimos el cue por speakers (para no mezclar nunca líneas).
    """
    if not cues:
        return []

    # init timings base
    for c in cues:
        c["start"] = c["words"][0]["start"]
        c["speech_end"] = c["words"][-1]["end"]
        c["end"] = c["speech_end"]

    prev_last_speaker: Optional[str] = None
    idx = 0

    while idx < len(cues):
        c = cues[idx]
        ws = c["words"]

        fmt = format_dialogue_text(ws, rules, prev_last_speaker)

        # Si hay speakers múltiples pero no se puede formatear, SPLIT por speakers y reintentar
        if fmt is None and cue_has_speaker_change(ws):
            chunks = split_words_by_speaker(ws)

            # sustituimos este cue por N cues (uno por chunk)
            cues.pop(idx)
            for ch in reversed(chunks):
                cues.insert(idx, {"words": ch})

            # inicializar timings para los cues insertados
            for j in range(idx, idx + len(chunks)):
                cues[j]["start"] = cues[j]["words"][0]["start"]
                cues[j]["speech_end"] = cues[j]["words"][-1]["end"]
                cues[j]["end"] = cues[j]["speech_end"]

            # re-procesa el primer chunk en el mismo idx
            continue

        # fallback “normal” si no hay cambio de speaker (o wrap imposible)
        if fmt is None:
            text = wrap_two_lines_smart([w["word"] for w in ws], rules)
            if text is None:
                text = " ".join([w["word"] for w in ws]).strip()
            c["text"] = text
            spk_dom = cue_dominant_speaker(ws)
            if spk_dom and spk_dom != "UNK":
                c["spk_first"] = spk_dom
                c["spk_last"] = spk_dom
                prev_last_speaker = spk_dom
        else:
            text, spk_first, spk_last = fmt
            c["text"] = text
            c["spk_first"] = spk_first
            c["spk_last"] = spk_last
            if spk_last and spk_last != "UNK":
                prev_last_speaker = spk_last

        # timings finales por CPS/min_duration
        chars = text_len_for_cps(c["text"])
        required = max(rules.min_duration, chars / max(rules.max_cps, 1e-6))
        required = min(required, rules.max_duration)

        desired_end = c["start"] + required

        if idx < len(cues) - 1:
            desired_end = min(desired_end, cues[idx + 1]["start"] - rules.min_gap)

        desired_end = min(desired_end, c["speech_end"] + rules.max_tail_after_speech)

        c["end"] = max(c["end"], desired_end)
        c["end"] = min(c["end"], c["start"] + rules.max_duration)
        if c["end"] < c["start"] + 0.05:
            c["end"] = c["start"] + 0.05

        idx += 1

    # enforce min_gap recortando
    for idx in range(len(cues) - 1):
        max_end = cues[idx + 1]["start"] - rules.min_gap
        if cues[idx]["end"] > max_end:
            cues[idx]["end"] = max(cues[idx]["start"] + 0.05, max_end)

    return cues

def explode_cues_by_speaker_turns(cues: List[Dict], rules: SubtitleRules) -> List[Dict]:
    """
    Garantiza normativa:
    - Solo hacemos cue de 2 speakers si se puede formatear en 2 líneas (hard 38).
    - Si no, se separa en cues individuales por turno.
    """
    if not cues:
        return cues

    out: List[Dict] = []
    for c in cues:
        ws = c.get("words") or []
        if not ws or not cue_has_speaker_change(ws):
            out.append(c)
            continue

        turns = split_words_by_speaker(ws)

        i = 0
        while i < len(turns):
            # intentar emparejar 2 turnos
            if i + 1 < len(turns):
                pair = turns[i] + turns[i + 1]
                ok, _ = can_format_words(pair, rules)
                if ok:
                    out.append({"words": pair})
                    i += 2
                    continue

            # si no se puede emparejar, turno solo
            out.append({"words": turns[i]})
            i += 1

    return out
