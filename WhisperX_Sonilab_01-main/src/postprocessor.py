# -*- coding: utf-8 -*-
"""
postprocessor.py — Post-procesado de subtítulos al estilo SubtitleEdit
(inspirado en AudioToTextPostProcessor de Purfview's Faster-Whisper-XXL)

Operaciones:
  - fix_casing:        capitaliza primer carácter de cada subtítulo
  - add_periods:       añade punto al final de frases con pausa larga
  - merge_short_lines: fusiona subtítulos muy cortos y consecutivos
  - balance_lines:     equilibra el texto en dos líneas si es largo
  - split_long_lines:  divide subtítulos demasiado largos

Se aplica sobre la lista de cues DESPUÉS del pipeline normal.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional


# ─── Constantes ──────────────────────────────────────────────────────────────

MAX_LINE_CHARS = 42          # máx. caracteres por línea (norma VE/VCAT)
MAX_CUE_CHARS = 84           # máx. totales (2 líneas × 42)
MIN_DURATION_MS = 800        # duración mínima tras merge (ms)
PERIOD_GAP_MS = 600          # pausa mínima para añadir punto
PERIOD_GAP_ALWAYS_MS = 1250  # pausa donde siempre se añade punto
# MERGE_MAX_GAP_MS: umbral de gap entre cues para fusionarlos en merge_short_lines.
# SubtitleEdit AudioToTextPostProcessor usa ~40ms. 120ms era demasiado agresivo
# y causaba que se fundiesen cues que SE dejaría separados (366 vs 235 cues).
MERGE_MAX_GAP_MS = 40        # gap máximo entre dos cues para fusionarlos (como SE)


# ─── Corrección de artefactos de tokenización ────────────────────────────────

def fix_text_artifacts(cues: List[Dict]) -> List[Dict]:
    """
    Corrige artefactos de tokenización de Whisper en el texto ensamblado.

    Problemas que soluciona:
    - Apóstrofes con espacio (catalán/español):
        "l 'Illa"    -> "l'Illa"
        "d 'aquí"    -> "d'aquí"
        "m 'ha"      -> "m'ha"
        "N 'he"      -> "N'he"
    - Números con espacio antes de separador decimal/miles:
        "3 .000"     -> "3.000"
        "12 ,5"      -> "12,5"
    - Clíticos verbales pospuestos con espacio:
        "quedar -se" -> "quedar-se"
        "anar -hi"   -> "anar-hi"

    Se aplica para TODOS los motores (no solo purfview-xxl).
    """
    # Clíticos pospuestos comunes del catalán y español
    _VERB_CLITICS = (
        "se", "te", "me", "nos", "vos", "us",  # reflexivos
        "hi", "ne", "en",                        # catalán
        "li", "los", "les", "la", "lo",          # pronominales
    )
    _clitic_pattern = re.compile(
        r"(\w) -(" + "|".join(_VERB_CLITICS) + r")\b",
        re.IGNORECASE,
    )

    result = []
    for cue in cues:
        text = cue.get("text") or cue.get("lines", "")
        if isinstance(text, list):
            text = "\n".join(text)
        text = text.strip()

        if text:
            # 1) Apóstrofes catalanes/españoles con espacio o salto de línea
            #    "l 'Illa" -> "l'Illa"   (clíticos: l, d, m, s, n, t)
            text = re.sub(r"\b([lLdDmMsSnNtT])[ \n]'", r"\1'", text)

            # 2) Números con espacio antes de punto decimal o separador de miles
            #    "3 .000" -> "3.000",  "12 ,5" -> "12,5"
            text = re.sub(r"(\d) \.(\d)", r"\1.\2", text)
            text = re.sub(r"(\d) ,(\d)", r"\1,\2", text)

            # 3) Clíticos verbales pospuestos: "quedar -se" -> "quedar-se"
            text = _clitic_pattern.sub(r"\1-\2", text)

        new_cue = dict(cue)
        if "text" in cue:
            new_cue["text"] = text
        elif "lines" in cue:
            new_cue["lines"] = text
        result.append(new_cue)
    return result


# ─── Helpers internos ────────────────────────────────────────────────────────

def _ends_sentence(text: str) -> bool:
    return bool(re.search(r"[.!?…]+$", text.rstrip()))


def _ends_with_comma(text: str) -> bool:
    return bool(re.search(r"[,;:]+$", text.rstrip()))


def _first_word(text: str) -> str:
    m = re.match(r"[\w]+", re.sub(r"^[\"'¿¡(«]+", "", text.strip()))
    return m.group(0).lower() if m else ""


def _last_word(text: str) -> str:
    words = re.findall(r"[\w]+", re.sub(r"[\"'.!?,;:)»]+$", "", text.strip()))
    return words[-1].lower() if words else ""


def _char_count(text: str) -> int:
    """Cuenta caracteres sin contar el salto de línea."""
    return len(text.replace("\n", ""))


def _auto_break(text: str, max_chars: int = MAX_LINE_CHARS) -> str:
    """
    Divide un texto largo en dos líneas intentando equilibrar el peso.
    Devuelve el texto con \\n si conviene, o el original si cabe en una línea.
    """
    text = text.replace("\n", " ").strip()
    if len(text) <= max_chars:
        return text

    words = text.split()
    if len(words) < 2:
        return text

    # Buscar punto de corte que equilibre mejor las dos mitades
    best_split = len(words) // 2
    best_diff = float("inf")

    for i in range(1, len(words)):
        part1 = " ".join(words[:i])
        part2 = " ".join(words[i:])
        diff = abs(len(part1) - len(part2))
        if diff < best_diff and len(part1) <= max_chars and len(part2) <= max_chars:
            best_diff = diff
            best_split = i

    line1 = " ".join(words[:best_split])
    line2 = " ".join(words[best_split:])
    return f"{line1}\n{line2}"


# ─── Operaciones principales ─────────────────────────────────────────────────

def fix_casing(cues: List[Dict]) -> List[Dict]:
    """
    Capitaliza el primer carácter de cada cue si empieza en minúscula
    (a menos que sea una continuación marcada con coma/guión al cue anterior).
    """
    result = []
    for i, cue in enumerate(cues):
        text = cue.get("text") or cue.get("lines", "")
        if isinstance(text, list):
            text = "\n".join(text)
        text = text.strip()

        if text:
            # Capitalizar primera letra real
            def _cap_first(s: str) -> str:
                s = s.strip()
                # Saltar signos de apertura
                m = re.match(r"^([\"'¿¡(«\-–—]+)(.*)", s, re.DOTALL)
                if m:
                    prefix, rest = m.group(1), m.group(2)
                    if rest:
                        return prefix + rest[0].upper() + rest[1:]
                    return s
                return s[0].upper() + s[1:] if s else s

            text = _cap_first(text)

        new_cue = dict(cue)
        if "text" in cue:
            new_cue["text"] = text
        elif "lines" in cue:
            new_cue["lines"] = text
        result.append(new_cue)
    return result


def add_periods(cues: List[Dict], gap_ms: float = PERIOD_GAP_MS,
                gap_always_ms: float = PERIOD_GAP_ALWAYS_MS) -> List[Dict]:
    """
    Añade punto al final de un cue si:
    - El cue siguiente empieza después de gap_ms ms de silencio
    - El cue no termina ya en puntuación final
    - No termina en coma/guión (que indica continuación)
    Idiomas: español / catalán.

    skip_last_words: palabras que no tienen sentido terminar en punto.
    """
    skip_last_words = {"con", "sin", "para", "por", "y", "o", "ni", "que",
                       "però", "i", "o", "amb", "per", "que", "si"}
    skip_first_words_next = {"y", "o", "pero", "sino", "aunque", "que",
                              "i", "o", "però", "sinó", "que", "si", "amb"}

    result = []
    for i, cue in enumerate(cues):
        text = cue.get("text") or cue.get("lines", "")
        if isinstance(text, list):
            text = "\n".join(text)
        text = text.strip()

        add_dot = False
        if i < len(cues) - 1 and text:
            next_cue = cues[i + 1]
            cur_end_ms = float(cue.get("end", cue.get("end_ms", 0))) * (
                1 if cue.get("end", 0) < 10000 else 0.001)  # normalizar a segundos
            nxt_start_ms = float(next_cue.get("start", next_cue.get("start_ms", 0))) * (
                1 if next_cue.get("start", 0) < 10000 else 0.001)

            # Calcular gap en ms
            gap = (nxt_start_ms - cur_end_ms) * 1000

            if gap >= gap_ms and not _ends_sentence(text) and not _ends_with_comma(text):
                last_w = _last_word(text)
                next_first_w = _first_word(next_cue.get("text") or next_cue.get("lines", ""))

                if gap >= gap_always_ms:
                    add_dot = True
                elif last_w not in skip_last_words and next_first_w not in skip_first_words_next:
                    add_dot = True

        # Último cue: añadir punto si no tiene
        if i == len(cues) - 1 and text and not _ends_sentence(text) and not _ends_with_comma(text):
            add_dot = True

        if add_dot:
            text = text.rstrip() + "."

        new_cue = dict(cue)
        if "text" in cue:
            new_cue["text"] = text
        elif "lines" in cue:
            new_cue["lines"] = text
        result.append(new_cue)
    return result


def merge_short_lines(cues: List[Dict], max_gap_ms: float = MERGE_MAX_GAP_MS,
                      max_chars: int = MAX_CUE_CHARS) -> List[Dict]:
    """
    Fusiona dos cues consecutivos si:
    - El gap entre ellos es ≤ max_gap_ms ms
    - El resultado cabe en max_chars caracteres
    - El primer cue no termina en puntuación fuerte
    """
    if not cues:
        return cues

    result: List[Dict] = []
    i = 0
    while i < len(cues):
        cue = dict(cues[i])
        if i + 1 < len(cues):
            next_cue = cues[i + 1]
            text = cue.get("text") or cue.get("lines", "")
            next_text = next_cue.get("text") or next_cue.get("lines", "")
            if isinstance(text, list):
                text = "\n".join(text)
            if isinstance(next_text, list):
                next_text = "\n".join(next_text)
            text = text.strip()
            next_text = next_text.strip()

            # calcular gap en ms
            cur_end = float(cue.get("end", 0))
            nxt_start = float(next_cue.get("start", 0))
            # detectar si son segundos o ms
            if cur_end < 10000:
                gap_ms_val = (nxt_start - cur_end) * 1000
            else:
                gap_ms_val = nxt_start - cur_end

            combined = (text + " " + next_text).strip()
            combined_chars = _char_count(combined.replace("\n", " "))

            if (gap_ms_val <= max_gap_ms
                    and combined_chars <= max_chars
                    and not _ends_sentence(text)):
                # Fusionar
                merged_text = _auto_break(combined.replace("\n", " "))
                new_end = next_cue.get("end", cue.get("end"))
                if "text" in cue:
                    cue["text"] = merged_text
                elif "lines" in cue:
                    cue["lines"] = merged_text
                cue["end"] = new_end
                # Tomar words del siguiente también si existen
                if "words" in next_cue:
                    cue.setdefault("words", [])
                    cue["words"] = list(cue.get("words", [])) + list(next_cue.get("words", []))
                result.append(cue)
                i += 2
                continue

        result.append(cue)
        i += 1
    return result


def balance_lines(cues: List[Dict], max_chars: int = MAX_LINE_CHARS) -> List[Dict]:
    """
    Para cada cue cuyo texto supera max_chars en una línea, aplica auto_break
    para dividirlo en dos líneas equilibradas.
    """
    result = []
    for cue in cues:
        text = cue.get("text") or cue.get("lines", "")
        if isinstance(text, list):
            text = "\n".join(text)
        text = text.strip()

        # Si ya tiene salto de línea, verificar cada parte
        if "\n" not in text and len(text) > max_chars:
            text = _auto_break(text, max_chars)

        new_cue = dict(cue)
        if "text" in cue:
            new_cue["text"] = text
        elif "lines" in cue:
            new_cue["lines"] = text
        result.append(new_cue)
    return result


def split_long_lines(cues: List[Dict], max_chars: int = MAX_CUE_CHARS) -> List[Dict]:
    """
    Divide cues cuyo texto total supera max_chars en dos cues separados,
    distribuyendo el tiempo proporcionalmente al número de palabras.
    """
    result = []
    for cue in cues:
        text = cue.get("text") or cue.get("lines", "")
        if isinstance(text, list):
            text = "\n".join(text)
        text = text.strip()

        if _char_count(text) <= max_chars:
            result.append(cue)
            continue

        # Intentar dividir por puntuación interna
        # Buscar coma/punto/etc. en el medio
        words = text.replace("\n", " ").split()
        mid = len(words) // 2
        split_idx = mid

        # Buscar la puntuación más cercana al centro
        best = float("inf")
        for j, w in enumerate(words):
            if re.search(r"[,;:.!?]$", w):
                if abs(j - mid) < best:
                    best = abs(j - mid)
                    split_idx = j + 1

        part1 = " ".join(words[:split_idx]).strip()
        part2 = " ".join(words[split_idx:]).strip()

        if not part2:
            # No se puede dividir, dejar como está
            result.append(cue)
            continue

        # Distribuir tiempo proporcionalmente
        start = float(cue.get("start", 0))
        end = float(cue.get("end", 0))
        total_words = max(len(words), 1)
        t_split = start + (end - start) * (split_idx / total_words)

        cue1 = dict(cue)
        cue2 = dict(cue)
        if "text" in cue:
            cue1["text"] = _auto_break(part1)
            cue2["text"] = _auto_break(part2)
        elif "lines" in cue:
            cue1["lines"] = _auto_break(part1)
            cue2["lines"] = _auto_break(part2)

        cue1["end"] = t_split - 0.001
        cue2["start"] = t_split
        result.append(cue1)
        result.append(cue2)

    return result


# ─── Margen mínimo entre cues ─────────────────────────────────────────────────

def enforce_min_gap(cues: List[Dict], min_gap_ms: float = 160.0) -> List[Dict]:
    """
    Assegura que el gap entre cues consecutius sigui almenys min_gap_ms ms.

    Estratègia: retallar el FINAL (end) del cue anterior — mai moure el START
    del cue següent.  Això preserva l'entrada a temps del subtítol següent.

    Garanties de no-regressió:
    - Mai genera durades negatives (start < end): preserva almenys 1 ms de durada.
    - Mai modifica el start de cap cue.
    - Mai modifica cues que ja tenen prou gap.
    - Si min_gap_ms <= 0, retorna la llista sense canvis.
    """
    if not cues or min_gap_ms <= 0:
        return cues

    min_gap_s = min_gap_ms / 1000.0
    result = [dict(c) for c in cues]

    for i in range(len(result) - 1):
        prev_end = float(result[i].get("end", 0))
        next_start = float(result[i + 1].get("start", 0))
        gap = next_start - prev_end

        if gap < min_gap_s:
            # Retallar el OUT del cue anterior
            new_end = next_start - min_gap_s
            prev_start = float(result[i].get("start", 0))
            # Garantir durada mínima de 1 ms per al cue anterior
            if new_end <= prev_start:
                new_end = prev_start + 0.001
            result[i]["end"] = round(new_end, 3)

    return result


# ─── Función principal ────────────────────────────────────────────────────────

def apply_postprocessing(
    cues: List[Dict],
    do_fix_casing: bool = True,
    do_add_periods: bool = True,
    do_merge_lines: bool = True,
    do_balance_lines: bool = True,
    do_split_long_lines: bool = True,
    do_enforce_min_gap: bool = False,
    min_gap_ms: int = 160,
    status_cb=None,
) -> List[Dict]:
    """
    Aplica el post-procesado completo al estilo SubtitleEdit AudioToTextPostProcessor.

    Parámetros
    ----------
    cues                : lista de cues del pipeline (dicts con start/end/text o lines)
    do_fix_casing       : capitalizar primer letra
    do_add_periods      : añadir puntos en pausas largas
    do_merge_lines      : fusionar cues muy cortos y consecutivos
    do_balance_lines    : equilibrar texto en dos líneas
    do_enforce_min_gap  : aplicar margen mínimo entre cues consecutivos
    min_gap_ms          : margen mínimo en ms (solo si do_enforce_min_gap=True)
    status_cb           : callback opcional para logging
    """
    def _st(msg: str):
        if callable(status_cb):
            status_cb(msg)

    if not cues:
        return cues

    original_count = len(cues)
    _st(f"[postprocessor] Inicio: {original_count} cues")

    # Siempre: corregir artefactos de tokenización (apóstrofes, números, clíticos)
    cues = fix_text_artifacts(cues)
    _st("[postprocessor] fix_text_artifacts: OK")

    if do_merge_lines:
        cues = merge_short_lines(cues)
        _st(f"[postprocessor] merge_short_lines: {original_count} -> {len(cues)} cues")

    if do_balance_lines:
        cues = balance_lines(cues)
        _st("[postprocessor] balance_lines: OK")

    if do_split_long_lines:
        cues = split_long_lines(cues)
        _st(f"[postprocessor] split_long_lines: {len(cues)} cues")

    if do_fix_casing:
        cues = fix_casing(cues)
        _st("[postprocessor] fix_casing: OK")

    if do_add_periods:
        cues = add_periods(cues)
        _st("[postprocessor] add_periods: OK")

    if do_enforce_min_gap:
        cues = enforce_min_gap(cues, min_gap_ms)
        _st(f"[postprocessor] enforce_min_gap({min_gap_ms}ms): OK")

    _st(f"[postprocessor] Finalizado: {len(cues)} cues")
    return cues
