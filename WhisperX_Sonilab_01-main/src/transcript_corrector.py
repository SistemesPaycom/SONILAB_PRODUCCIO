"""
transcript_corrector.py — Corregeix el text d'un SRT de transcripció
usant un guió de doblatge com a font de text correcte.

Regles fonamentals:
  - MAI eliminar línies del SRT de transcripció
  - MAI afegir línies noves
  - Només reemplaçar text dins de línies existents
  - Opcionalment partir una línia si hi ha canvi de personatge (futur)
  - Generar JSON de traçabilitat per a cada línia modificada

Estratègia d'alineament:
  1. Parseja SRT de transcripció  → llista de segments {idx, start, end, text}
  2. Parseja guió TXT (SONILAB)   → llista de cues {speaker, text, abs_time}
  3. Per cada segment de transcripció, cerca el millor cue del guió per
     similitud de text (difflib / rapidfuzz si disponible) i opcionalment LLM local
  4. Si similitud >= threshold, substitueix el text amb el del guió
  5. Genera SRT corregit + JSON de canvis

Ús CLI:
    python transcript_corrector.py \\
        --srt transcripcio.srt \\
        --guion guio.txt \\
        --out-srt corregit.srt \\
        --out-json canvis.json \\
        [--threshold 0.45] [--window 8] [--dry-run] \\
        [--llm-mode off|fast|smart] [--llm-model llama3.1]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import List, Optional, Tuple

# Intentar importar rapidfuzz (opcional, millora la velocitat i qualitat del matching)
try:
    from rapidfuzz import fuzz as _rfuzz  # type: ignore
    _HAS_RAPIDFUZZ = True
except ImportError:
    _HAS_RAPIDFUZZ = False

# ── Ollama (LLM local) ────────────────────────────────────────────────────────
import urllib.request
import urllib.error

_OLLAMA_BASE = "http://127.0.0.1:11434/api/generate"
_OLLAMA_HEALTH = "http://127.0.0.1:11434/api/tags"

# Models LLM suportats (Ollama)
LLM_MODELS = {
    "llama3.1": "Meta Llama 3.1 8B",
    "qwen2.5": "Qwen 2.5 7B",
    "mistral": "Mistral 7B",
}


def _check_ollama_available(model: str, timeout: int = 5) -> Tuple[bool, str]:
    """
    Comprova si Ollama està accessible i si el model sol·licitat existeix.

    Retorna (available: bool, message: str).
    Si no disponible, message descriu el problema concret.

    INSTAL·LACIÓ:
      1. Descarrega Ollama: https://ollama.com/download
      2. Inicia el servei: ollama serve  (o instal·la com a servei Windows)
      3. Descarrega el model: ollama pull llama3.1
      4. Verifica: curl http://localhost:11434/api/tags
    """
    try:
        req = urllib.request.Request(_OLLAMA_HEALTH)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
    except urllib.error.URLError as e:
        return False, (
            f"Ollama no és accessible a {_OLLAMA_HEALTH}: {e.reason}. "
            "Verifica que el servei Ollama estigui en marxa: "
            "'ollama serve' o el tauler de serveis de Windows."
        )
    except Exception as e:
        return False, f"Error connectant amb Ollama: {e}"

    # Comprovar si el model concret existeix
    available_models = [m.get('name', '').split(':')[0] for m in data.get('models', [])]
    model_base = model.split(':')[0]
    if model_base not in available_models:
        available_str = ', '.join(available_models) if available_models else '(cap)'
        return False, (
            f"Model '{model}' no disponible a Ollama. "
            f"Models instal·lats: {available_str}. "
            f"Per instal·lar-lo: 'ollama pull {model}'"
        )
    return True, f"Ollama OK — model '{model}' disponible."


def _call_ollama(model: str, prompt: str, timeout: int = 60,
                 verbose: bool = False) -> Optional[str]:
    """
    Crida Ollama API (http://127.0.0.1:11434).
    Retorna la resposta o None si error.
    Si verbose=True, imprimeix estat a stderr.
    """
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode()
    req = urllib.request.Request(
        _OLLAMA_BASE, data=payload,
        headers={"Content-Type": "application/json"},
    )
    if verbose:
        print(f"[LLM] Enviant prompt a Ollama (model={model}, {len(prompt)} chars)...",
              file=sys.stderr, flush=True)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
            response = data.get("response", "").strip() or None
            if verbose:
                snippet = (response or '')[:80].replace('\n', ' ')
                print(f"[LLM] Resposta rebuda ({len(response or '')} chars): {snippet!r}",
                      file=sys.stderr, flush=True)
            return response
    except Exception as e:
        if verbose:
            print(f"[LLM] ERROR cridant Ollama: {e}", file=sys.stderr, flush=True)
        return None


def _correct_with_llm(model: str, transcript_text: str, guion_text: str,
                      verbose: bool = False) -> Optional[str]:
    """
    Pregunta al LLM local (Ollama) per corregir el text de la transcripció
    usant el text del guió com a referència.
    Retorna ÚNICAMENT el text corregit (string net) o None si LLM no disponible.
    """
    prompt = (
        "Ets un corrector de subtítols de doblatge. "
        "Corregeix el text de la transcripció automàtica fent-lo coincidir amb el guió. "
        "Conserva la longitud aproximada i la naturalitat. "
        "Respon ÚNICAMENT amb el text corregit, sense explicacions ni cometes.\n\n"
        f"Transcripció: {transcript_text}\n"
        f"Guió: {guion_text}\n"
        "Text corregit:"
    )
    raw = _call_ollama(model, prompt, verbose=verbose)
    if not raw:
        return None
    # Neteja: elimina cometes/guillemets habituals de resposta LLM
    cleaned = raw.strip().strip('«»"\'`').strip()
    # Rebutja si el LLM ha afegit explicació (línies múltiples o molt llarg)
    if '\n' in cleaned and len(cleaned) > len(transcript_text) * 3:
        return None
    return cleaned if cleaned else None


# ─────────────────────── Estructures de dades ─────────────────────────────────

@dataclass
class SrtSegment:
    idx: int           # número de cue SRT (1-based)
    start: str         # "HH:MM:SS,mmm"
    end: str           # "HH:MM:SS,mmm"
    text: str          # text original
    start_s: float     # start en segons (per ordering)
    end_s: float       # end en segons


@dataclass
class GuionCue:
    speaker: str
    text: str
    abs_time: float    # temps absolut en segons (del anchor/base TC)
    take_num: int = 0


@dataclass
class ChangeRecord:
    seg_idx: int       # número de cue SRT
    start: str
    end: str
    original: str      # text abans
    corrected: str     # text desprès
    guion_speaker: str
    guion_text: str    # text del guió assignat
    score: float       # similitud [0.0, 1.0]
    method: str        # "fuzzy_replace" / "no_change" / "take_llm" / ...
    take_num: int = 0  # TAKE del guió al qual pertany la correcció


# ─────────────────────── Parser SRT ───────────────────────────────────────────

_TC_RE = re.compile(
    r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})'
)


def _tc_to_seconds(tc: str) -> float:
    m = _TC_RE.match(tc.strip())
    if not m:
        return 0.0
    h, mn, s, ms = int(m[1]), int(m[2]), int(m[3]), int(m[4])
    return h * 3600 + mn * 60 + s + ms / 1000.0


def parse_srt(srt_text: str) -> List[SrtSegment]:
    """Parseja un SRT i retorna una llista de SrtSegment."""
    segments: List[SrtSegment] = []
    blocks = re.split(r'\n\s*\n', srt_text.strip())
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 2:
            continue
        # línia 0: número
        try:
            idx = int(lines[0].strip())
        except ValueError:
            continue
        # línia 1: timecode "HH:MM:SS,mmm --> HH:MM:SS,mmm"
        tc_line = lines[1]
        tc_parts = tc_line.split('-->')
        if len(tc_parts) != 2:
            continue
        start_tc = tc_parts[0].strip()
        end_tc = tc_parts[1].strip()
        # resta: text (pot ser multilineal)
        text = '\n'.join(lines[2:]).strip()
        if not text:
            continue
        segments.append(SrtSegment(
            idx=idx,
            start=start_tc,
            end=end_tc,
            text=text,
            start_s=_tc_to_seconds(start_tc),
            end_s=_tc_to_seconds(end_tc),
        ))
    return segments


def serialize_srt(segments: List[SrtSegment]) -> str:
    """Serialitza segments a format SRT. Renumera els cues seqüencialment."""
    parts = []
    for i, seg in enumerate(segments, 1):
        parts.append(f"{i}\n{seg.start} --> {seg.end}\n{seg.text}")
    return '\n\n'.join(parts) + '\n'


def _seconds_to_tc(seconds: float) -> str:
    """Converteix segons a format SRT 'HH:MM:SS,mmm'."""
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ─────────────────────── Parser Guió SONILAB ──────────────────────────────────

def _parse_guion_txt(guion_text: str) -> List[GuionCue]:
    """
    Parseja el guió TXT SONILAB si script_txt_parser és disponible.
    Fallback: extreu línies SPEAKER\ttext i estima temps amb TAKE base.
    """
    # Intentar usar script_txt_parser del mateix paquet
    try:
        from script_txt_parser import parse_script_txt_from_text, ScriptCue  # type: ignore
        cues_raw = parse_script_txt_from_text(guion_text)
        result = []
        for c in cues_raw:
            if c.kind != 'dialogue':
                continue
            # Netejar anchors del text: (10.00s), (00:01:30), etc.
            clean_text = re.sub(r'\(\d[\d:.]*s?\)', '', c.text).strip()
            if not clean_text:
                continue
            # Dividir per ' / ' (canvi de veu dins del cue)
            for part in _split_slash_cue(clean_text):
                if part:
                    result.append(GuionCue(
                        speaker=c.speaker,
                        text=part,
                        abs_time=c.abs_time,
                        take_num=c.take_num,
                    ))
        return result
    except Exception:
        pass

    # Fallback: parser mínim inline
    return _parse_guion_fallback(guion_text)


def _parse_guion_fallback(text: str) -> List[GuionCue]:
    """
    Parser mínim per guió SONILAB sense dependències.
    Reconeix línies SPEAKER<TAB>text i TAKE #N HH:MM:SS
    """
    cues: List[GuionCue] = []
    base_tc = 0.0
    take_num = 0

    take_re = re.compile(
        r'^TAKE\s+#?(\d+)\s+(\d{2}:\d{2}:\d{2})',
        re.IGNORECASE
    )
    # Detecta línia de diàleg: speaker (no buit, no "TAKE") seguit de TAB
    dialog_re = re.compile(r'^(\S[^\t]*?)\t(.+)$')
    anchor_re = re.compile(r'\(\d[\d:.]*s?\)')

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue

        m_take = take_re.match(line)
        if m_take:
            take_num = int(m_take.group(1))
            parts = m_take.group(2).split(':')
            h, mn, s = int(parts[0]), int(parts[1]), int(parts[2])
            base_tc = h * 3600 + mn * 60 + s
            continue

        m_dialog = dialog_re.match(line)
        if m_dialog:
            speaker = m_dialog.group(1).strip()
            dialog_text = m_dialog.group(2).strip()
            # Llegir primer anchor per temps absolut
            anchor_m = re.search(r'\((\d{2}:\d{2}:\d{2})\)', dialog_text)
            abs_t = base_tc
            if anchor_m:
                p = anchor_m.group(1).split(':')
                abs_t = int(p[0]) * 3600 + int(p[1]) * 60 + int(p[2])
            # Netejar anchors del text
            clean = anchor_re.sub('', dialog_text).strip()
            if not clean:
                continue
            # Dividir per ' / ' (canvi de veu dins del mateix cue)
            for part in _split_slash_cue(clean):
                if part:
                    cues.append(GuionCue(
                        speaker=speaker,
                        text=part,
                        abs_time=abs_t,
                        take_num=take_num,
                    ))

    return cues


# ─────────────────────── Normalització de text ─────────────────────────────────

def _normalize(text: str) -> str:
    """Normalitza per a comparació: minúscules, sense puntuació extra, espais simples.
    La barra ' / ' es tracta com a separador de paraula (no de diàleg aquí)."""
    t = text.lower()
    # Normalitzem '/' com a espai (per a la comparació; la divisió es fa a _split_slash_cue)
    t = re.sub(r'\s*/\s*', ' ', t)
    t = re.sub(r"[^\w\sàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]", " ", t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _word_overlap(a: str, b: str) -> float:
    """Jaccard de conjunts de paraules. Útil com a segunda opinió quan els textos
    difereixen molt en longitud però comparteixen la majoria de paraules."""
    wa = set(_normalize(a).split())
    wb = set(_normalize(b).split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def _similarity(a: str, b: str) -> float:
    """
    Retorna similitud [0.0, 1.0] entre dos textos.
    Usa rapidfuzz si disponible (token_set_ratio, robust per a reordenament).
    Fallback: combina SequenceMatcher de caràcters + Jaccard de paraules.
    """
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if _HAS_RAPIDFUZZ:
        # token_set_ratio ignora l'ordre i les paraules duplicades
        char_score = _rfuzz.token_set_ratio(na, nb) / 100.0
    else:
        # Combinem ratio de seqüència + solapament de paraules per a millor coverage
        char_score = SequenceMatcher(None, na, nb).ratio()
        word_score = _word_overlap(a, b)
        char_score = char_score * 0.6 + word_score * 0.4

    return char_score


def _split_slash_cue(text: str) -> List[str]:
    """
    Divideix un text de guió que conté ' / ' en parts separades.
    ' / ' en un guió de doblatge sol indicar que dues veus parlen en seqüència
    (o és un canvi de personatge dins del mateix cue).

    Exemples:
      "Hola, com estàs? / Bé, gràcies."  → ["Hola, com estàs?", "Bé, gràcies."]
      "Sí. / No. / Potser."               → ["Sí.", "No.", "Potser."]
      "Velocitat / potència"              → ["Velocitat", "potència"]

    Si no hi ha ' / ', retorna llista amb l'element original.
    Nota: '/' sense espais (ex: "AC/DC") NO es divideix.
    """
    # Detectem '/' envoltat d'espais (o al principi/final de la paraula)
    _SLASH_SEP = re.compile(r'\s/\s')
    if not _SLASH_SEP.search(text):
        return [text]
    parts = [p.strip() for p in _SLASH_SEP.split(text)]
    return [p for p in parts if p]


# ─────────────────────── Estructura TAKE del guió ─────────────────────────────

def _build_take_structure(
    guion_cues: List[GuionCue],
) -> Tuple[dict, List[Tuple[int, float, float]], List[int]]:
    """
    Construeix l'estructura de TAKES a partir de les cues del guió.

    Returns:
      take_cue_indices  — {take_num: [índexos de cue dins guion_cues]}
      take_time_ranges  — [(take_num, start_s, end_s), ...] ordenat per take_num
      guion_cue_take    — [take_num, ...] paral·lel a guion_cues (índex → take)
    """
    take_cue_indices: dict = {}
    for i, cue in enumerate(guion_cues):
        take_cue_indices.setdefault(cue.take_num, []).append(i)

    sorted_tns = sorted(take_cue_indices.keys())
    take_time_ranges: List[Tuple[int, float, float]] = []
    for j, tn in enumerate(sorted_tns):
        t_start = min(guion_cues[i].abs_time for i in take_cue_indices[tn])
        if j + 1 < len(sorted_tns):
            t_end = min(guion_cues[i].abs_time for i in take_cue_indices[sorted_tns[j + 1]])
        else:
            t_end = float('inf')
        take_time_ranges.append((tn, t_start, t_end))

    guion_cue_take = [cue.take_num for cue in guion_cues]
    return take_cue_indices, take_time_ranges, guion_cue_take


def _seg_take_num(
    seg: SrtSegment,
    take_time_ranges: List[Tuple[int, float, float]],
    margin_s: float = 10.0,
) -> int:
    """Retorna el take_num del TAKE al qual pertany el segment per timecode."""
    for tn, t_start, t_end in take_time_ranges:
        if seg.start_s >= t_start - margin_s and seg.start_s < t_end:
            return tn
    return 0


def _take_allowed_indices(
    take_num: int,
    take_cue_indices: dict,
    sorted_take_nums: Optional[List[int]] = None,
    border_takes: int = 1,
) -> Optional[set]:
    """
    Retorna el conjunt d'índexos de cue permesos per a un TAKE, incloent-hi
    els TAKEs veïns (±border_takes) per gestionar segments als límits.
    Retorna None si no hi ha informació de TAKE (cerca oberta).
    """
    if take_num == 0 or not take_cue_indices:
        return None

    tns = sorted_take_nums or sorted(take_cue_indices.keys())
    try:
        pos = tns.index(take_num)
    except ValueError:
        return None

    lo = max(0, pos - border_takes)
    hi = min(len(tns), pos + border_takes + 1)

    allowed: set = set()
    for i in range(lo, hi):
        allowed.update(take_cue_indices.get(tns[i], []))
    return allowed if allowed else None


# ─────────────────────── Motor d'alineament ────────────────────────────────────

def _has_voice(seg: SrtSegment) -> bool:
    """
    Heurística: determina si un segment probablement conté veu real.
    Criteris: text no buit, >= 2 paraules, no és un marcador tècnic.
    """
    text = seg.text.strip()
    if not text:
        return False
    words = text.split()
    if len(words) < 2:
        return False
    # Exclou marcadors tècnics típics (♪, -, ...)
    clean = text.strip('-♪ .')
    return bool(clean)


def _find_best_guion_match(
    seg: SrtSegment,
    guion_cues: List[GuionCue],
    seg_index: int,
    guion_cursor: int,
    window: int,
    allowed_indices: Optional[set] = None,
) -> Tuple[Optional[int], float]:
    """
    Cerca el millor cue del guió per al segment de transcripció donat.

    Estratègia:
      - Busca dins una finestra [guion_cursor - window//2, guion_cursor + window]
      - Si allowed_indices no és None, restringeix la cerca als índexos permesos (TAKE-aware)
      - Puntua per similitud de text (token-level + word overlap)
      - Afegeix un petit bonus temporal si el guió té timestamps fiables
      - Intenta també solapament parcial per segments llargs vs cues curts

    Retorna (índex_cue_guió, score) o (None, 0.0)
    """
    if not guion_cues:
        return None, 0.0

    lo = max(0, guion_cursor - window // 2)
    hi = min(len(guion_cues), guion_cursor + window + 1)

    # Si no hi ha candidats permesos en la finestra estàndard, ampliar la finestra
    # per incloure tots els índexos permesos (evita quedar-se sense candidats)
    if allowed_indices is not None:
        candidates_in_window = [i for i in range(lo, hi) if i in allowed_indices]
        if not candidates_in_window:
            # Ampliar la cerca a tots els índexos permesos
            candidates = list(allowed_indices)
        else:
            candidates = candidates_in_window
    else:
        candidates = list(range(lo, hi))

    best_idx: Optional[int] = None
    best_score = -1.0

    seg_words = set(_normalize(seg.text).split())

    for i in candidates:
        if i < 0 or i >= len(guion_cues):
            continue
        cue = guion_cues[i]
        text_score = _similarity(seg.text, cue.text)

        # Bonus de solapament de paraules (ajuda quan un segment és subconjunt del cue)
        cue_words = set(_normalize(cue.text).split())
        if seg_words and cue_words:
            overlap = len(seg_words & cue_words) / max(len(seg_words), len(cue_words))
            text_score = max(text_score, text_score * 0.7 + overlap * 0.3)

        # Bonus temporal: si el temps del guió és proper al segment
        time_diff = abs(cue.abs_time - seg.start_s)
        time_bonus = max(0.0, 1.0 - time_diff / 60.0) * 0.05  # màxim 5% bonus

        # Bonus TAKE: si el cue és del mateix TAKE estimat del segment (sense TAKE_info: 0)
        take_bonus = 0.0
        if allowed_indices is not None and i in allowed_indices:
            take_bonus = 0.03  # lleuger bonus per estar al TAKE correcte

        combined = text_score + time_bonus + take_bonus

        if combined > best_score:
            best_score = combined
            best_idx = i

    return best_idx, best_score


def _try_split_segment(
    seg: SrtSegment,
    guion_cues: List[GuionCue],
    best_idx: int,
    threshold: float,
) -> Optional[Tuple["SrtSegment", "SrtSegment", "GuionCue", "GuionCue"]]:
    """
    Intenta dividir un segment ASR en dos quan conté veus de DOS personatges
    consecutius del guió. Retorna (seg_a, seg_b, cue_a, cue_b) o None.

    Condicions per dividir:
      1. El cue 'best_idx+1' existeix i és d'un PERSONATGE DIFERENT
      2. El segment ASR té >= 4 paraules (massa curt = no dividim)
      3. Existeix una divisió on part_a sim(cue_a) >= threshold*0.3
         i part_b sim(cue_b) >= threshold*0.3  (evidència acústica mínima)

    La divisió es fa al punt de paraula que maximitza la suma de similituds.
    Els timecodes es divideixen proporcionalment al nombre de caràcters.

    NOTA: No divisem si el text del segment és un marcador tècnic o (G).
    """
    if best_idx + 1 >= len(guion_cues):
        return None

    cue_a = guion_cues[best_idx]
    cue_b = guion_cues[best_idx + 1]

    # Només dividim si els personatges son DIFERENTS
    if cue_a.speaker.lower() == cue_b.speaker.lower():
        return None

    # Mínim de paraules per poder dividir
    words = seg.text.split()
    if len(words) < 4:
        return None

    min_score = threshold * 0.30  # evidència acústica mínima per cada part

    best_split_pos = -1
    best_combined = -1.0

    # Provem totes les divisions possibles (al menys 1 paraula a cada part)
    for split_pos in range(1, len(words)):
        part_a_text = ' '.join(words[:split_pos])
        part_b_text = ' '.join(words[split_pos:])

        score_a = _similarity(part_a_text, cue_a.text)
        score_b = _similarity(part_b_text, cue_b.text)

        # Ambdues parts han de tenir evidència acústica mínima
        if score_a < min_score or score_b < min_score:
            continue

        combined = score_a + score_b
        if combined > best_combined:
            best_combined = combined
            best_split_pos = split_pos

    if best_split_pos < 0:
        return None

    part_a_text = ' '.join(words[:best_split_pos])
    part_b_text = ' '.join(words[best_split_pos:])

    # Dividir timecodes proporcionalment als caràcters
    total_chars = len(seg.text.replace(' ', ''))
    chars_a = len(part_a_text.replace(' ', ''))
    ratio = chars_a / total_chars if total_chars > 0 else 0.5
    duration = seg.end_s - seg.start_s
    mid_s = seg.start_s + duration * ratio
    mid_tc = _seconds_to_tc(mid_s)

    seg_a = SrtSegment(
        idx=seg.idx,
        start=seg.start,
        end=mid_tc,
        text=part_a_text,
        start_s=seg.start_s,
        end_s=mid_s,
    )
    seg_b = SrtSegment(
        idx=seg.idx,   # renumerat per serialize_srt
        start=mid_tc,
        end=seg.end,
        text=part_b_text,
        start_s=mid_s,
        end_s=seg.end_s,
    )
    return seg_a, seg_b, cue_a, cue_b


def align_and_correct(
    transcription_segs: List[SrtSegment],
    guion_cues: List[GuionCue],
    threshold: float = 0.45,
    window: int = 8,
    llm_mode: str = "off",
    llm_model: str = "llama3.1",
    allow_split: bool = False,
) -> Tuple[List[SrtSegment], List[ChangeRecord]]:
    """
    Alinea segments de transcripció amb cues del guió i corregeix el text.

    Millora TAKE-aware (v2): si el guió té take_num definit, la cerca es restringeix
    als cues del mateix TAKE (±1 TAKE als límits). Evita errors de cross-TAKE.

    Args:
      llm_mode: "off" (només fuzzy), "fast" (LLM per casos ambigus), "smart" (LLM sempre)
      llm_model: identificador del model Ollama (ex: "llama3.1", "qwen2.5", "mistral")

    Returns:
      - corrected_segments: llista de SrtSegment (amb text potencialment substituït)
      - changes: llista de ChangeRecord (per a traçabilitat)
    """
    corrected: List[SrtSegment] = []
    changes: List[ChangeRecord] = []

    guion_cursor = 0  # índex d'avançament pel guió (monotònic)
    used_guion: set[int] = set()  # cues del guió ja usats

    # Rang "ambigu" per al mode "fast": entre threshold*0.65 i threshold
    fast_lo = threshold * 0.65

    # ── Precomputar estructura de TAKEs ───────────────────────────────────────
    has_take_info = any(c.take_num > 0 for c in guion_cues)
    take_cue_indices: dict = {}
    take_time_ranges: List[Tuple[int, float, float]] = []
    sorted_take_nums: List[int] = []

    if has_take_info:
        take_cue_indices, take_time_ranges, _ = _build_take_structure(guion_cues)
        sorted_take_nums = sorted(take_cue_indices.keys())

    for seg in transcription_segs:
        # Determinar els índexos permesos per a aquest segment (TAKE-aware)
        allowed_indices: Optional[set] = None
        seg_take = 0
        if has_take_info and take_time_ranges:
            seg_take = _seg_take_num(seg, take_time_ranges)
            allowed_indices = _take_allowed_indices(
                seg_take, take_cue_indices, sorted_take_nums, border_takes=1
            )

        best_idx, best_score = _find_best_guion_match(
            seg, guion_cues, len(corrected), guion_cursor, window,
            allowed_indices=allowed_indices,
        )

        # Umbral dinàmic: si el segment té veu clara, acceptem un 10% menys de confiança
        # (la transcripció pot errar paraules però la veu és real i val la pena corregir)
        effective_threshold = threshold * 0.90 if _has_voice(seg) else threshold

        # Determinar si cal substituir via fuzzy
        fuzzy_match = (
            best_idx is not None
            and best_score >= effective_threshold
            and best_idx not in used_guion
        )

        # Mode LLM: decidir si es consulta el LLM
        llm_corrected_text: Optional[str] = None
        method = 'no_change'

        if fuzzy_match:
            method = 'fuzzy_replace'
        elif llm_mode != "off" and best_idx is not None and best_idx not in used_guion:
            cue_candidate = guion_cues[best_idx]
            use_llm = (
                llm_mode == "smart"
                or (llm_mode == "fast" and best_score >= fast_lo)
            )
            if use_llm:
                llm_result = _correct_with_llm(llm_model, seg.text, cue_candidate.text)
                if llm_result and llm_result != seg.text:
                    llm_corrected_text = llm_result
                    method = f'llm_{llm_mode}'

        should_replace = fuzzy_match or llm_corrected_text is not None

        # ── Detecció de fusió de personatges (allow_split) ────────────────────
        # Si el segment ASR ha capturat dues veus consecutives de personatges
        # DIFERENTS del guió en un sol subtítol, el dividim en dos.
        # Exemple: "Enduriment! Què." → [RUFFY: "Enduriment!"] + [USOPP: "Que carai?"]
        # Requisit: evidència acústica mínima a cada part (l'ASR ha captat fragments
        # d'ambdós personatges). No s'afegeix contingut que no estigui a l'ASR.
        if allow_split and best_idx is not None and best_idx not in used_guion:
            split_result = _try_split_segment(seg, guion_cues, best_idx, threshold)
            if split_result is not None:
                seg_a, seg_b, cue_a, cue_b = split_result
                # Corregim el text de cada part amb el seu cue corresponent
                text_a = _format_corrected_text(cue_a.text, seg_a.text)
                text_b = _format_corrected_text(cue_b.text, seg_b.text)
                seg_a = SrtSegment(idx=seg_a.idx, start=seg_a.start, end=seg_a.end,
                                   text=text_a, start_s=seg_a.start_s, end_s=seg_a.end_s)
                seg_b = SrtSegment(idx=seg_b.idx, start=seg_b.start, end=seg_b.end,
                                   text=text_b, start_s=seg_b.start_s, end_s=seg_b.end_s)
                # Registre de canvi per al segment dividit
                changes.append(ChangeRecord(
                    seg_idx=seg.idx,
                    start=seg.start,
                    end=seg.end,
                    original=seg.text,
                    corrected=f"{text_a} | {text_b}",
                    guion_speaker=f"{cue_a.speaker} / {cue_b.speaker}",
                    guion_text=f"{cue_a.text} / {cue_b.text}",
                    score=round(_similarity(seg.text, cue_a.text + ' ' + cue_b.text), 4),
                    method='split_speaker',
                    take_num=seg_take,
                ))
                used_guion.add(best_idx)
                used_guion.add(best_idx + 1)
                if best_idx >= guion_cursor:
                    guion_cursor = best_idx + 2
                corrected.append(seg_a)
                corrected.append(seg_b)
                continue  # següent segment

        if should_replace:
            cue = guion_cues[best_idx]
            if llm_corrected_text is not None:
                new_text = llm_corrected_text
            else:
                new_text = _format_corrected_text(cue.text, seg.text)

            record = ChangeRecord(
                seg_idx=seg.idx,
                start=seg.start,
                end=seg.end,
                original=seg.text,
                corrected=new_text,
                guion_speaker=cue.speaker,
                guion_text=cue.text,
                score=round(best_score, 4),
                method=method,
                take_num=seg_take,
            )
            changes.append(record)
            used_guion.add(best_idx)

            # Avançar cursor del guió (monòton)
            if best_idx >= guion_cursor:
                guion_cursor = best_idx + 1

            new_seg = SrtSegment(
                idx=seg.idx,
                start=seg.start,
                end=seg.end,
                text=new_text,
                start_s=seg.start_s,
                end_s=seg.end_s,
            )
            corrected.append(new_seg)
        else:
            # No change: copiar el segment original intacte
            corrected.append(SrtSegment(
                idx=seg.idx,
                start=seg.start,
                end=seg.end,
                text=seg.text,
                start_s=seg.start_s,
                end_s=seg.end_s,
            ))

    return corrected, changes


def _format_corrected_text(guion_text: str, original_text: str) -> str:
    """
    Formata el text corregit adaptant-lo al layout del segment original.

    Regles:
    1. Si el text del guió conté ' / ', es converteix a salt de línia (\n).
       Ex: "Hola / Adéu" → "Hola\nAdéu" (subtítol de 2 línies)
    2. Si l'original era multilineal (2 línies), intentem mantenir 2 línies
       buscant un punt de tall natural.
    3. Cas general: retorna el text net en una línia.
    """
    # Netejar el text del guió
    clean = guion_text.strip()

    # Regla 1: ' / ' en el guió → salt de línia explícit al subtítol
    _SLASH_SEP = re.compile(r'\s/\s')
    if _SLASH_SEP.search(clean):
        parts = [p.strip() for p in _SLASH_SEP.split(clean) if p.strip()]
        if len(parts) >= 2:
            # Limitem a 2 línies (el format SRT estàndard no recomana més)
            return '\n'.join(parts[:2])

    original_lines = original_text.strip().splitlines()

    # Regla 2: si l'original tenia 2 línies, intentem mantenir 2 línies
    if len(original_lines) >= 2:
        words = clean.split()
        if len(words) >= 4:
            mid = len(words) // 2
            best_mid = mid
            for delta in range(0, min(4, mid)):
                for d in [delta, -delta]:
                    pos = mid + d
                    if 0 < pos < len(words):
                        if re.search(r'[,;.!?]$', words[pos - 1]):
                            best_mid = pos
                            break
            line1 = ' '.join(words[:best_mid])
            line2 = ' '.join(words[best_mid:])
            if line1 and line2:
                return f"{line1}\n{line2}"

    return clean


# ─────────────────────── Mode IA per TAKE ─────────────────────────────────────

def _correct_take_with_llm(
    model: str,
    take_num: int,
    guion_cues: List[GuionCue],
    srt_segs: List[SrtSegment],
    timeout: int = 120,
    verbose: bool = False,
) -> dict:
    """
    Envia el guió d'un TAKE i els seus subtítols al LLM per corregir-los en context.
    El LLM compara tot el TAKE alhora: detecta errors, paraules mal transcrites,
    canvis de personatge, etc.

    Retorna {global_seg_idx: text_corregit} o {} si LLM no disponible/error.

    IMPORTANT (v2):
    - Usa índexs LOCALS (1..N) al prompt, no globals (els LLMs petits com llama3.1:8b
      quasi sempre responen amb 1,2,3... independentment dels índexs mostrats)
    - Demana TOTS els subtítols en la resposta (no només els canvis): el filtratge
      de "realment canviat" es fa al Python, no al LLM
    - Prompt en anglès: millor seguiment de les instruccions de format JSON
    - Parsing robust: elimina code fences, accepta camps alternatius, doble fallback
      local→global
    """
    if not guion_cues or not srt_segs:
        return {}

    n = len(srt_segs)

    # Bloc del guió
    guion_block = '\n'.join(
        f"  {c.speaker}: {c.text}"
        for c in guion_cues
    )

    # Índexs LOCALS (1..N) — molt més fiables per al LLM que índexs globals arbitraris
    # local_to_global: {local_1based → global seg.idx}
    local_to_global: dict = {}
    srt_lines: list = []
    for local_i, seg in enumerate(srt_segs, start=1):
        local_to_global[local_i] = seg.idx
        srt_lines.append(f"  [{local_i}] {seg.text}")
    srt_block = '\n'.join(srt_lines)

    # Mapa inversa: global idx → segment (per poder verificar canvis reals)
    global_segs_map = {s.idx: s for s in srt_segs}

    prompt = (
        f"You are a dubbing subtitle editor. "
        f"Correct the auto-transcription of TAKE {take_num} to match the official script.\n\n"
        f"OFFICIAL SCRIPT:\n{guion_block}\n\n"
        f"AUTO-TRANSCRIPTION (subtitles 1..{n}):\n{srt_block}\n\n"
        f"TASK: Rewrite each subtitle using the EXACT wording from the official script.\n"
        f"RULES:\n"
        f"1. The official script is the ground truth — copy its exact words\n"
        f"2. Match script lines to subtitles by order and meaning\n"
        f"3. Keep subtitle numbers 1..{n} unchanged\n"
        f"4. Output ALL {n} subtitles (include unchanged ones too)\n"
        f"5. Reply ONLY with a JSON array, no explanation or extra text\n\n"
        f"RESPONSE FORMAT:\n"
        f"[{{\"idx\": 1, \"text\": \"subtitle 1 text\"}}, "
        f"{{\"idx\": 2, \"text\": \"subtitle 2 text\"}}, "
        f"..., {{\"idx\": {n}, \"text\": \"subtitle {n} text\"}}]"
    )

    if verbose:
        print(f"[LLM-TAKE] TAKE #{take_num}: {len(guion_cues)} cues guió, "
              f"{n} segments (locals 1..{n}) → enviant al LLM (timeout={timeout}s)...",
              file=sys.stderr, flush=True)

    response = _call_ollama(model, prompt, timeout=timeout, verbose=verbose)
    if not response:
        if verbose:
            print(f"[LLM-TAKE] TAKE #{take_num}: sense resposta LLM → sense canvis",
                  file=sys.stderr, flush=True)
        return {}

    # ── Parsing robust ─────────────────────────────────────────────────────────
    try:
        # 1. Eliminar code fences que el LLM pot afegir: ```json ... ```
        clean = re.sub(r'```[a-zA-Z]*\n?', '', response).strip('`').strip()

        # 2. Trobar el JSON array (greedy per capturar arrays multi-línia)
        json_match = re.search(r'\[[\s\S]*\]', clean)
        if not json_match:
            # Fallback: potser la resposta és un objecte JSON en lloc d'array
            obj_match = re.search(r'\{[\s\S]*\}', clean)
            if obj_match:
                raw_json = f"[{obj_match.group()}]"
            else:
                if verbose:
                    print(f"[LLM-TAKE] TAKE #{take_num}: no s'ha trobat JSON a la resposta",
                          file=sys.stderr, flush=True)
                return {}
        else:
            raw_json = json_match.group()

        data = json.loads(raw_json)
        if not isinstance(data, list):
            data = [data]

        result: dict = {}
        for item in data:
            if not isinstance(item, dict):
                continue
            # Acceptar camps: 'idx', 'index', 'id', 'num', 'n', 'subtitle', 'sub'
            raw_idx = (item.get('idx') or item.get('index') or item.get('id') or
                       item.get('num') or item.get('n') or item.get('subtitle') or
                       item.get('sub'))
            if raw_idx is None:
                continue
            try:
                local_idx = int(raw_idx)
            except (ValueError, TypeError):
                continue

            # Intent 1: l'idx és LOCAL (1..N) — cas habitual per a llama3.1:8b
            global_idx = local_to_global.get(local_idx)

            # Intent 2: l'idx és GLOBAL — el LLM ha recordat els índexs originals
            if global_idx is None and local_idx in global_segs_map:
                global_idx = local_idx

            if global_idx is None:
                continue

            text = str(item.get('text', '')).strip()
            if text:
                result[global_idx] = text

        if verbose:
            n_changed = sum(
                1 for gidx, txt in result.items()
                if txt.strip() != global_segs_map.get(gidx, SrtSegment(0, '', '', '', 0, 0)).text.strip()
            )
            print(f"[LLM-TAKE] TAKE #{take_num}: {len(result)}/{n} subtítols rebuts del LLM, "
                  f"{n_changed} realment canviats",
                  file=sys.stderr, flush=True)
        return result

    except Exception as e:
        if verbose:
            print(f"[LLM-TAKE] TAKE #{take_num}: error parsejant JSON: {e}",
                  file=sys.stderr, flush=True)
        return {}


def align_and_correct_by_take(
    transcription_segs: List[SrtSegment],
    guion_cues: List[GuionCue],
    llm_model: str = "llama3.1",
    allow_split: bool = False,
    verbose: bool = False,
) -> Tuple[List[SrtSegment], List[ChangeRecord]]:
    """
    Mode IA per TAKE: agrupa els cues del guió per take_num, assigna
    els segments SRT a cada TAKE per temps, i deixa que el LLM faci
    la comparació completa de cada TAKE.

    Molt més simple per a l'usuari: no cal ajustar threshold ni finestra.
    El LLM veu el context complet del TAKE (com faria un humà).

    IMPORTANT: Si Ollama no és accessible, LLANÇA ERROR (no silent fallback).
    Verificar disponibilitat de Ollama amb _check_ollama_available() abans de cridar.
    """
    # ── 1. Agrupar cues per TAKE ──────────────────────────────────────────────
    takes_cues: dict = {}  # take_num → List[GuionCue]
    for cue in guion_cues:
        takes_cues.setdefault(cue.take_num, []).append(cue)

    # ── 2. Calcular rang temporal de cada TAKE a partir dels abs_time ─────────
    # (take_start és el mínim abs_time del TAKE, take_end és el mínim del TAKE següent)
    sorted_take_nums = sorted(takes_cues.keys())
    take_time_ranges: List[Tuple[int, float, float]] = []  # (take_num, start_s, end_s)

    for i, tn in enumerate(sorted_take_nums):
        cues_for_take = takes_cues[tn]
        t_start = min(c.abs_time for c in cues_for_take)
        if i + 1 < len(sorted_take_nums):
            next_cues = takes_cues[sorted_take_nums[i + 1]]
            t_end = min(c.abs_time for c in next_cues)
        else:
            t_end = float('inf')
        take_time_ranges.append((tn, t_start, t_end))

    if verbose:
        print(f"[LLM-TAKE] {len(sorted_take_nums)} TAKEs al guió: {sorted_take_nums}",
              file=sys.stderr, flush=True)

    # ── 3. Assignar segments SRT al seu TAKE per temps ────────────────────────
    seg_to_take: dict = {}  # seg.idx → take_num
    for seg in transcription_segs:
        for tn, t_start, t_end in take_time_ranges:
            # Marge de 10s per a les discrepàncies entre guió i transcripció
            if seg.start_s >= t_start - 10 and seg.start_s < t_end:
                seg_to_take[seg.idx] = tn
                break

    unassigned = sum(1 for s in transcription_segs if s.idx not in seg_to_take)
    if verbose and unassigned:
        print(f"[LLM-TAKE] AVÍS: {unassigned} segments SRT sense TAKE assignat",
              file=sys.stderr, flush=True)

    # ── 4. Per cada TAKE, cridar el LLM ──────────────────────────────────────
    corrected_map: dict = {}  # seg.idx → text nou
    changes: List[ChangeRecord] = []
    llm_calls = 0
    llm_errors = 0

    for tn, t_start, t_end in take_time_ranges:
        take_segs = [s for s in transcription_segs if seg_to_take.get(s.idx) == tn]
        cues = takes_cues.get(tn, [])
        if not take_segs or not cues:
            continue

        llm_calls += 1
        llm_result = _correct_take_with_llm(
            llm_model, tn, cues, take_segs,
            verbose=verbose,
        )
        if not llm_result:
            llm_errors += 1

        for seg in take_segs:
            new_text = llm_result.get(seg.idx)
            if new_text and new_text.strip() != seg.text.strip():
                corrected_map[seg.idx] = new_text.strip()
                # Inferir speaker del primer cue del TAKE
                speaker = cues[0].speaker if cues else ''
                changes.append(ChangeRecord(
                    seg_idx=seg.idx,
                    start=seg.start,
                    end=seg.end,
                    original=seg.text,
                    corrected=new_text.strip(),
                    guion_speaker=speaker,
                    guion_text=', '.join(c.text for c in cues[:3]),
                    score=1.0,
                    method='take_llm',
                    take_num=tn,
                ))

    if verbose:
        print(f"[LLM-TAKE] Resum: {llm_calls} crides LLM, {llm_errors} errors/sense resposta, "
              f"{len(changes)} canvis totals", file=sys.stderr, flush=True)
    # Si totes les crides LLM han fallat, significa que Ollama no estava accessible
    if llm_calls > 0 and llm_errors == llm_calls:
        raise RuntimeError(
            f"Ollama no ha respost per cap dels {llm_calls} TAKEs. "
            "Verifica que el servei Ollama estigui actiu: 'ollama serve'. "
            f"Comprova el model amb: 'ollama pull {llm_model}'"
        )

    # ── 5. Construir llista final de segments ─────────────────────────────────
    corrected: List[SrtSegment] = []
    for seg in transcription_segs:
        new_text = corrected_map.get(seg.idx, seg.text)
        corrected.append(SrtSegment(
            idx=seg.idx,
            start=seg.start,
            end=seg.end,
            text=new_text,
            start_s=seg.start_s,
            end_s=seg.end_s,
        ))

    return corrected, changes


# ─────────────────────── Generació JSON de canvis ─────────────────────────────

def build_changes_json(changes: List[ChangeRecord]) -> dict:
    """Genera el diccionari JSON de traçabilitat de canvis."""
    return {
        'version': '1.0',
        'total_changes': len(changes),
        'changes': [asdict(c) for c in changes],
    }


# ─────────────────────── Pipeline principal ───────────────────────────────────

def correct_transcript(
    srt_path: str,
    guion_path: str,
    out_srt_path: str,
    out_json_path: str,
    threshold: float = 0.45,
    window: int = 8,
    dry_run: bool = False,
    verbose: bool = False,
    llm_mode: str = "off",
    llm_model: str = "llama3.1",
    allow_split: bool = False,
    method: str = "fuzzy",   # "fuzzy" | "take-llm"
) -> dict:
    """
    Pipeline complet: llegeix SRT + guió, corregeix, escriu outputs.

    method="fuzzy"    → corrector per segment amb similitud (threshold/window)
    method="take-llm" → LLM compara TAKE complet (sense threshold/window manual)

    Returns: resum {'total_segments', 'changed', 'unchanged'}
    """
    # --- Llegir inputs ---
    srt_text = Path(srt_path).read_text(encoding='utf-8', errors='replace')
    guion_text = Path(guion_path).read_text(encoding='utf-8', errors='replace')

    segments = parse_srt(srt_text)
    guion_cues = _parse_guion_txt(guion_text)

    if verbose:
        print(f'[corrector] Segments transcripció: {len(segments)}', file=sys.stderr)
        print(f'[corrector] Cues guió: {len(guion_cues)}', file=sys.stderr)
        print(f'[corrector] Mètode: {method}', file=sys.stderr)
        if method == 'fuzzy':
            print(f'[corrector] Threshold: {threshold}, window: {window}', file=sys.stderr)
            print(f'[corrector] LLM mode: {llm_mode}, model: {llm_model}', file=sys.stderr)
        else:
            print(f'[corrector] LLM model (take): {llm_model}', file=sys.stderr)
        if not _HAS_RAPIDFUZZ:
            print('[corrector] AVÍS: rapidfuzz no disponible, usant difflib (menys precís)', file=sys.stderr)

    if not segments:
        raise ValueError(f'No s\'han trobat segments al SRT: {srt_path}')
    if not guion_cues:
        raise ValueError(f'No s\'han trobat cues al guió: {guion_path}')

    if verbose and allow_split:
        print('[corrector] Divisió per canvi de personatge: ACTIVADA', file=sys.stderr)

    # --- Alinear i corregir ---
    if method == 'take-llm':
        # Mode IA per TAKE: SEMPRE requereix Ollama. Verificar ABANS d'executar.
        ollama_ok, ollama_msg = _check_ollama_available(llm_model)
        print(f'[corrector] Ollama check: {ollama_msg}', file=sys.stderr, flush=True)
        if not ollama_ok:
            # Retornar error explícit al JSON de sortida (no silent fallback a fuzzy)
            raise RuntimeError(
                f"Mode 'IA per TAKE' requereix Ollama. {ollama_msg}"
            )
        corrected_segs, changes = align_and_correct_by_take(
            segments, guion_cues,
            llm_model=llm_model,
            allow_split=allow_split,
            verbose=True,  # sempre verbose per a take-llm (les crides LLM han de ser traçables)
        )
    else:
        # Mode fuzzy: comparació per segment amb threshold/window
        corrected_segs, changes = align_and_correct(
            segments, guion_cues,
            threshold=threshold, window=window,
            llm_mode=llm_mode, llm_model=llm_model,
            allow_split=allow_split,
        )

    # Verificació de seguretat: mai eliminar segments
    assert len(corrected_segs) >= len(segments), (
        f'ERROR CRÍTIC: segments eliminats! '
        f'Original={len(segments)}, Corregit={len(corrected_segs)}'
    )

    if verbose:
        print(f'[corrector] Canvis aplicats: {len(changes)}/{len(segments)}', file=sys.stderr)

    # --- Escriure outputs ---
    if not dry_run:
        corrected_srt = serialize_srt(corrected_segs)
        Path(out_srt_path).write_text(corrected_srt, encoding='utf-8')

        changes_data = build_changes_json(changes)
        Path(out_json_path).write_text(
            json.dumps(changes_data, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
    else:
        if verbose:
            print('[corrector] DRY-RUN: no s\'escriuen fitxers', file=sys.stderr)

    return {
        'total_segments': len(segments),
        'changed': len(changes),
        'unchanged': len(segments) - len(changes),
        'changes_json_path': out_json_path if not dry_run else None,
        'srt_path': out_srt_path if not dry_run else None,
    }


# ─────────────────────── CLI ──────────────────────────────────────────────────

def main() -> None:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    parser = argparse.ArgumentParser(
        description='Corregeix text de transcripció SRT usant un guió de doblatge.'
    )
    parser.add_argument('--srt', required=True, help='SRT de transcripció (input)')
    parser.add_argument('--guion', required=True, help='Guió TXT SONILAB (input)')
    parser.add_argument('--out-srt', required=True, dest='out_srt', help='SRT corregit (output)')
    parser.add_argument('--out-json', required=True, dest='out_json', help='JSON de canvis (output)')
    parser.add_argument(
        '--threshold', type=float, default=0.45,
        help='Similitud mínima per substituir text [0.0-1.0] (default: 0.45)'
    )
    parser.add_argument(
        '--window', type=int, default=8,
        help='Finestra de cerca al guió per cada segment (default: 8)'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Simula la correcció sense escriure fitxers. Imprimeix resum per stdout.'
    )
    parser.add_argument(
        '--verbose', '-v', action='store_true',
        help='Mostra informació de debug per stderr.'
    )
    parser.add_argument(
        '--llm-mode', dest='llm_mode', default='off',
        choices=['off', 'fast', 'smart'],
        help=(
            'Mode LLM local (Ollama): '
            '"off" = només fuzzy matching (default), '
            '"fast" = LLM per casos ambigus (score entre threshold*0.65 i threshold), '
            '"smart" = LLM per a tots els segments candidats (lent, màxima qualitat)'
        )
    )
    parser.add_argument(
        '--llm-model', dest='llm_model', default='llama3.1',
        help='Model Ollama a usar (default: llama3.1). Altres: qwen2.5, mistral'
    )
    parser.add_argument(
        '--allow-split', dest='allow_split', action='store_true', default=False,
        help=(
            'Permet dividir un segment ASR en dos quan detecta que conté veus de '
            'dos personatges DIFERENTS del guió. Útil quan el transcriptor ha fusionat '
            'dues rèpliques en un sol subtítol. Per defecte desactivat (conservador).'
        )
    )
    parser.add_argument(
        '--method', dest='method', default='fuzzy',
        choices=['fuzzy', 'take-llm'],
        help=(
            'Mètode de correcció: '
            '"fuzzy" = comparació per segment (threshold/window, default), '
            '"take-llm" = LLM analitza el TAKE complet de guió + SRT d\'un cop '
            '(no requereix ajustar threshold/window, requereix Ollama)'
        )
    )

    args = parser.parse_args()

    try:
        result = correct_transcript(
            srt_path=args.srt,
            guion_path=args.guion,
            out_srt_path=args.out_srt,
            out_json_path=args.out_json,
            threshold=args.threshold,
            window=args.window,
            dry_run=args.dry_run,
            verbose=args.verbose,
            llm_mode=args.llm_mode,
            llm_model=args.llm_model,
            allow_split=args.allow_split,
            method=args.method,
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
