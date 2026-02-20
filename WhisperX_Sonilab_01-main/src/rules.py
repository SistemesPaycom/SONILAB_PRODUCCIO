# -*- coding: utf-8 -*-
"""
rules.py — Normativa VE/VCAT, constantes de wrapping y opciones de idioma.
"""

from dataclasses import dataclass
from typing import Optional

# ------------------------------------------------------------
# Idiomas (GUI)
# ------------------------------------------------------------
_PREFERRED_LANGS = [
    ("Auto (detectar)", None),
    ("Català (CA)", "ca"),
    ("Español (ES)", "es"),
    ("English (EN)", "en"),
    ("Español (LatAm)", "es"),  # Whisper/WhisperX usa "es" igualmente
]

_OTHER_LANGS = [
    ("Arabic (AR)", "ar"),
    ("Deutsch (DE)", "de"),
    ("Français (FR)", "fr"),
    ("Italiano (IT)", "it"),
    ("Português (PT)", "pt"),
    ("Русский (RU)", "ru"),
    ("日本語 (JA)", "ja"),
    ("中文 (ZH)", "zh"),
    ("한국어 (KO)", "ko"),
    ("Nederlands (NL)", "nl"),
    ("Polski (PL)", "pl"),
    ("Svenska (SV)", "sv"),
    ("Türkçe (TR)", "tr"),
    ("Українська (UK)", "uk"),
]
_OTHER_LANGS.sort(key=lambda x: x[0].lower())

LANG_OPTIONS = _PREFERRED_LANGS + _OTHER_LANGS
LANG_LABELS = [lbl for lbl, _ in LANG_OPTIONS]
LANG_LABEL_TO_CODE = {lbl: code for lbl, code in LANG_OPTIONS}

DEFAULT_LANG_LABEL_VE = "Español (ES)"
DEFAULT_LANG_LABEL_VCAT = "Català (CA)"


# ============================================================
# CONFIG
# ============================================================

@dataclass
class SubtitleRules:
    # Hard specs
    max_lines: int = 2
    max_chars_per_line: int = 38
    max_cps: float = 20.0
    min_duration: float = 1.0
    max_duration: float = 7.0
    min_gap: float = 0.16

    # Si el silencio entre palabras supera esto -> NO agrupar
    max_pause_within_cue: Optional[float] = 1.0

    # Permite “cola” (silencio) para llegar a min_duration si hay hueco
    max_tail_after_speech: float = 0.90

    # Soft para legibilidad
    soft_max_chars_per_line: int = 45

    # Si un subtítulo es “largo” en 1 línea, intentamos partir en 2 por legibilidad
    prefer_split_min_chars: int = 32
    prefer_split_min_words: int = 6

    # Sanity: arregla palabras “estiradas”
    max_word_duration_sanity: float = 1.20

    # Postprocesado
    orphan_merge_gap: float = 1.00
    ultra_short_ratio: float = 0.60

    # Evitar cues “enanos”
    small_cue_max_words: int = 3
    small_cue_max_chars: int = 18
    small_merge_gap: float = 0.85

    # Heurística “Además,” / “Pero,” colgando tras punto:
    carry_max_words: int = 3

    # ----------------------------
    # Diálogo / Interlocutores
    # ----------------------------
    enable_diarization: bool = True  # si no hay token (y no estás en offline con cache), no habrá interlocutores
    dialogue_dash: str = "- "
    dialogue_max_speakers_per_cue: int = 2  # si hay más, forzamos split
    min_speaker_segment: float = 0.35  # suavizado diarización (segundos)

    # ----------------------------
    # Split extra por puntuación fuerte (mejora casos tipo "Nankatsu. Tsubasa...")
    # ----------------------------
    split_on_internal_sentence_punct: bool = True
    split_sentence_min_tail_words: int = 2  # min palabras tras el punto para considerar split


# Palabras “función” (preferimos que NO queden al final de la línea 1)
BAD_END_WORDS = {
    # ES
    "de", "del", "el", "la", "los", "las", "al", "a", "en", "con", "por", "para",
    "y", "e", "o", "u", "que", "se", "me", "te", "lo", "un", "una", "unos", "unas",
    "mi", "tu", "su", "mis", "tus", "sus",
    # CA (mínimo útil)
    "els", "les", "amb", "per", "i",
}

DISCOURSE_MARKERS = {
    # ES
    "además", "pero", "oye", "entonces", "bueno", "pues", "mira", "vale", "venga", "claro",
    # CA
    "això", "però", "doncs", "vaja",
}

ORPHAN_START_WORDS = {
    # artículos/preposiciones/conjunciones típicas que NO deben ir solas
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "al", "a", "en", "con", "por", "para",
    "y", "e", "o", "u", "que", "lo",
    # catalán
    "els", "les", "i", "per", "amb",
}