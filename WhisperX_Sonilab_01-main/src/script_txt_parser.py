# -*- coding: utf-8 -*-
"""
script_txt_parser.py — Parser de guions de doblatge SONILAB en format TXT.

Adaptat de Whisper_Sonilab/src/pipeline/P01_script_txt_parser.py per a ús
dins de WhisperX_Sonilab_01. Diferències clau:
  - Afegit is_txt_guion_format(text) per detectar automàticament el format.
  - parse_script_txt_from_text(text, rules) treballa amb strings, no fitxers.
  - Manté totes les mateixes estructures de dades (ScriptCue, ScriptParseRules).

Format esperat:
  TAKE #N  (o  TAKE #148 ---[CA-SE]---)
  HH:MM:SS
  *PERSONATGE*\ttext (17) més text (04:11) últim fragment

On (17) = segon 17 del minut del take, (04:11) = MM:SS absolut, etc.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import List, Optional, Sequence, Tuple


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------
TAKE_RE = re.compile(r"^\s*TAKE\s*#?\s*(\d+)(?:\s|$)", re.IGNORECASE)
BASE_TC_RE = re.compile(r"^\s*(\d{2}:\d{2}:\d{2})\s*$")

# Línia de diàleg TXT: *SPEAKER*\t(text...)
# La clau distintiva és el TAB entre el *SPEAKER* i el text.
SPEAKER_LINE_RE = re.compile(r"^\s*\*([^*]+)\*\s*\t\s*(.*)$")

PAREN_BLOCK_RE = re.compile(r"\(([^)]*)\)")
PAREN_HAS_ALPHA_RE = re.compile(r"[A-Za-zÀ-ÿ]")
TIME_MARK_RE = re.compile(r"\((\d+\.\d{2})s\)")
ALNUM_RE = re.compile(r"[0-9A-Za-zÀ-ÿ]")
WS_RE = re.compile(r"\s+")

# ---------------------------------------------------------------------------
# Classificació de speakers
# ---------------------------------------------------------------------------
TITLE_SPEAKERS = {"TITOL", "TÍTOL", "TITULO", "TÍTULO", "TITLE", "TITOL.", "TÍTOL."}
INSERT_SPEAKERS = {"INSERTO", "INSERT", "INSERT.", "INSERTO.", "INSERTS"}
IMAGE_SPEAKERS = {"IMATGE", "IMAGEN", "IMAGE"}
IGNORE_SPEAKERS = {"LLIBRERIA", "LIBRERIA", "LIBRARY"}


# ---------------------------------------------------------------------------
# Detecció de format
# ---------------------------------------------------------------------------
# El format TXT SONILAB és reconeixible pel patró *SPEAKER*\t (TAB!)
_TXT_SIGNATURE_RE = re.compile(r"^\s*\*[^*]+\*\s*\t", re.MULTILINE)


def is_txt_guion_format(text: str) -> bool:
    """
    Retorna True si el text sembla un guió SONILAB en format TXT
    (té línies *SPEAKER*\\t...).

    Diferencia el format TXT del format DOCX:
      TXT:  *PERSONATGE*\\t(offset) text      — TAB com a separador
      DOCX: *PERSONATGE*(offset) (OFF) text   — espai, sense TAB
    """
    if not text:
        return False
    return bool(_TXT_SIGNATURE_RE.search(text))


# ---------------------------------------------------------------------------
# Estructures de dades
# ---------------------------------------------------------------------------
@dataclass
class ScriptCue:
    take_num: int
    base_tc: str               # "HH:MM:SS"
    speaker: str
    text: str                  # text net amb time-markers normalitzats a (xxx.xx s)
    abs_time: Optional[float]  # temps principal del cue (bucket time)
    kind: str                  # "dialogue" | "insert" | "title" | "image"
    is_adlib: bool
    anchors: Tuple[float, ...]  # tots els anchors (segons absoluts)
    raw: str                   # línia original


@dataclass
class ScriptParseRules:
    ignore_speakers: Sequence[str] = tuple(IGNORE_SPEAKERS)


DEFAULT_RULES = ScriptParseRules()


# ---------------------------------------------------------------------------
# Helpers de temps
# ---------------------------------------------------------------------------
def _hms_to_seconds(hms: str) -> float:
    hms = (hms or "").strip()
    if not hms or not BASE_TC_RE.fullmatch(hms):
        return 0.0
    hh, mm, ss = hms.split(":")
    return float(int(hh) * 3600 + int(mm) * 60 + int(ss))


def _marker_to_abs_seconds(token: str, base_tc: str, base_seconds: float) -> Optional[float]:
    """
    Converteix un token de dins de parèntesis a segons absoluts.

    Suporta:
      - "HH:MM:SS" → absolut
      - "MM:SS"    → absolut usant hora base
      - "SS"       → segon dins del minut del take (amb heurística de wrap)
    """
    t = (token or "").strip()
    if not t:
        return None

    if re.fullmatch(r"\d{2}:\d{2}:\d{2}", t):
        hh, mm, ss = t.split(":")
        return float(int(hh) * 3600 + int(mm) * 60 + int(ss))

    if re.fullmatch(r"\d{1,2}:\d{2}", t):
        mm, ss = t.split(":")
        base_hh = 0
        if re.fullmatch(r"\d{2}:\d{2}:\d{2}", (base_tc or "")):
            base_hh = int(base_tc.split(":")[0])
        return float(base_hh * 3600 + int(mm) * 60 + int(ss))

    if re.fullmatch(r"\d{1,2}", t):
        sec = int(t)
        minute_start = (int(base_seconds) // 60) * 60
        candidate = float(minute_start + sec)
        base_ss = int(base_seconds) % 60
        if sec < base_ss and (base_ss - sec) > 15:
            candidate += 60.0
        return candidate

    return None


# ---------------------------------------------------------------------------
# Classificació de kind
# ---------------------------------------------------------------------------
def _classify_kind(speaker: str) -> str:
    sp = (speaker or "").strip().upper()
    if sp in TITLE_SPEAKERS:
        return "title"
    if sp in INSERT_SPEAKERS:
        return "insert"
    if sp in IMAGE_SPEAKERS:
        return "image"
    return "dialogue"


# ---------------------------------------------------------------------------
# Normalització de text de línia
# ---------------------------------------------------------------------------
def _is_verbal_after_strip(text_with_markers: str) -> bool:
    if not text_with_markers:
        return False
    t = TIME_MARK_RE.sub(" ", text_with_markers)
    t = WS_RE.sub(" ", t).strip()
    return bool(ALNUM_RE.search(t))


def _normalize_line_text(
    rest: str,
    base_tc: str,
    base_seconds: float,
) -> Tuple[str, Tuple[float, ...], bool, bool]:
    """
    Elimina tags alpha, converteix marcadors de temps a (xxx.xx s).

    Retorna:
      - text normalitzat
      - tuple d'anchors (segons absoluts)
      - is_adlib flag
      - has_prefix (hi ha text verbal ABANS del primer anchor)
    """
    raw = rest or ""

    out_parts: List[str] = []
    anchors: List[float] = []
    is_adlib = False
    first_anchor_pos_in_out: Optional[int] = None

    last = 0
    for m in PAREN_BLOCK_RE.finditer(raw):
        if m.start() > last:
            out_parts.append(raw[last:m.start()])

        inside = (m.group(1) or "").strip()

        if PAREN_HAS_ALPHA_RE.search(inside):
            if inside.strip().upper() in {"ADLIB", "ADLIBS", "AD LIB", "AD LIBS"}:
                is_adlib = True
            out_parts.append(" ")
        else:
            ts = _marker_to_abs_seconds(inside, base_tc=base_tc, base_seconds=base_seconds)
            if ts is not None:
                anchors.append(float(ts))
                if first_anchor_pos_in_out is None:
                    first_anchor_pos_in_out = len(out_parts)
                out_parts.append(f"({ts:.2f}s)")
            else:
                out_parts.append(" ")

        last = m.end()

    if last < len(raw):
        out_parts.append(raw[last:])

    norm = WS_RE.sub(" ", " ".join(out_parts)).strip()

    has_prefix = False
    if anchors and first_anchor_pos_in_out is not None:
        prefix = " ".join(out_parts[:first_anchor_pos_in_out])
        prefix = WS_RE.sub(" ", prefix).strip()
        has_prefix = bool(ALNUM_RE.search(prefix))

    return norm, tuple(anchors), is_adlib, has_prefix


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------
def parse_script_txt_from_text(
    text: str,
    rules: Optional[ScriptParseRules] = None,
) -> List[ScriptCue]:
    """
    Parseja un guió TXT SONILAB (com a string) i retorna una llista de ScriptCue.

    Aquesta funció és l'equivalent de parse_script_txt() però treballant
    directament sobre el text (sense necessitat d'un fitxer).

    El format esperat és:
      TAKE #N  [text extra ignorat]
      HH:MM:SS
      *PERSONATGE*\\ttext amb (marcadors de temps)
    """
    rules = rules or DEFAULT_RULES
    ignore_speakers = {s.strip().upper() for s in (rules.ignore_speakers or [])}
    ignore_speakers |= IGNORE_SPEAKERS

    cues: List[ScriptCue] = []

    current_take: Optional[int] = None
    base_tc: str = "00:00:00"
    base_seconds: float = 0.0
    expecting_base_tc = False
    last_anchor_time_in_take: Optional[float] = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip("\n")
        stripped = line.strip()

        if not stripped:
            continue

        # Separadors
        if set(stripped) <= {"-", "_"} and len(stripped) >= 3:
            continue

        # Capçalera TAKE
        m_take = TAKE_RE.match(stripped)
        if m_take:
            current_take = int(m_take.group(1))
            expecting_base_tc = True
            last_anchor_time_in_take = None
            continue

        # Esperem el timecode base
        if expecting_base_tc:
            m_tc = BASE_TC_RE.match(stripped)
            if m_tc:
                base_tc = m_tc.group(1)
                base_seconds = _hms_to_seconds(base_tc)
                expecting_base_tc = False
                last_anchor_time_in_take = float(base_seconds)
            # Ignorar tot fins trobar el TC
            continue

        # Processar línies de speaker
        m_sp = SPEAKER_LINE_RE.match(line)
        if not m_sp:
            continue

        if current_take is None:
            continue

        speaker = (m_sp.group(1) or "").strip()
        rest = (m_sp.group(2) or "").strip()
        if not speaker:
            continue

        sp_u = speaker.upper().strip()
        if sp_u in ignore_speakers:
            continue

        kind = _classify_kind(speaker)

        norm_text, anchors, is_adlib, has_prefix = _normalize_line_text(
            rest, base_tc=base_tc, base_seconds=base_seconds
        )

        if not _is_verbal_after_strip(norm_text):
            continue

        anchors_u = tuple(sorted(set(float(a) for a in anchors)))

        if last_anchor_time_in_take is None:
            last_anchor_time_in_take = float(base_seconds)

        # Càlcul de abs_time (bucket)
        if anchors_u:
            abs_time = float(last_anchor_time_in_take) if has_prefix else float(min(anchors_u))
            last_anchor_time_in_take = float(max(anchors_u))
        else:
            abs_time = float(last_anchor_time_in_take)

        cues.append(
            ScriptCue(
                take_num=int(current_take),
                base_tc=str(base_tc),
                speaker=speaker,
                text=norm_text,
                abs_time=abs_time,
                kind=kind,
                is_adlib=bool(is_adlib),
                anchors=anchors_u,
                raw=line,
            )
        )

    return cues
