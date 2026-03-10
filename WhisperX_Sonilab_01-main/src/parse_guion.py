"""
parse_guion.py  —  Parser de guions de doblatge SONILAB/CCMA
=============================================================
Extreu únicament el diàleg útil (les línies que es parlen a l'àudio)
d'un guió en format SONILAB, eliminant:
  - Capçalera (títol, traductor, ajustador, lingüista)
  - Separadors (---...)
  - Etiquetes TAKE i timecodes
  - Línies *INSERT* i el seu contingut (lletres de cançons, títols, etc.)
  - Indicadors d'escena: (OFF), (ON), (G), (GS), (RIU), (T), (LLUNY), ...
  - El format REPICAR és INCLÒS quan té diàleg real (ja que la línia
    es grava igualment a l'àudio d'aquest episodi)
"""

import re

# ── Patrons ──────────────────────────────────────────────────────────────────

SEPARATOR_RE    = re.compile(r'^-{6,}')
TAKE_RE         = re.compile(r'^TAKE\s*#?\s*\d+', re.IGNORECASE)
TIMECODE_RE     = re.compile(r'^\d{2}:\d{2}:\d{2}$')
REPICAR_RE      = re.compile(r'^\*REPICAR\*', re.IGNORECASE)
INSERT_RE       = re.compile(r'^\*INSERT\*', re.IGNORECASE)
TITOL_RE        = re.compile(r'^\*(T[ÍIÌÎ]TOL|NARRADOR|INSERT)\b', re.IGNORECASE)
CHAR_LINE_RE    = re.compile(r'^(\*[^*]+\*)+', re.IGNORECASE)  # línia que comença per *CHAR*

# Indicadors d'escena que NO cal conservar al text final
# (majúscules, paraula única o acrònims habituals)
_STAGE_WORDS = {
    'OFF', 'ON', 'G', 'GS', 'RIU', 'T', 'LLUNY', 'LLUNY', 'CRIDEN', 'CRIDANT',
    "D'E", 'REMOR', 'SOROLL', 'VEUS', 'RES', 'MRM',
}
# Pattern: (PARAULA_ESCENA) — ex. (OFF), (G), (GS), (RIU), (LLUNY)
_stage_opts  = '|'.join(re.escape(w) for w in sorted(_STAGE_WORDS, key=len, reverse=True))
STAGE_DIR_RE = re.compile(r'\(\s*(?:' + _stage_opts + r')\s*\)', re.IGNORECASE)

# Patrons que indiquen títols NO-dialog (en una REPICAR line)
_TITOL_SKIP_RE = re.compile(r'\(T[ÍIÌÎ]TOL\s+(S[EÈ]RIE|EPISODI)', re.IGNORECASE)

# Referència REPICAR dins parèntesis: (CHAR, EP 517, TC 04.14) o (EP 517, TC...)
EP_REF_RE = re.compile(r'\([^)]*\bEP\s+\d+[^)]*\)', re.IGNORECASE)

# Timecode intern entre parèntesis: (17) o (04:00) o (24.27)
OFFSET_RE = re.compile(r'^\s*\([\d:.]+\)\s*')


# ── Helpers ──────────────────────────────────────────────────────────────────

def _clean_dialog(text: str) -> str:
    """Elimina indicadors d'escena, refs d'episodi i normalitza espais."""
    text = STAGE_DIR_RE.sub('', text)
    text = EP_REF_RE.sub('', text)
    # Substituir '/' per espai (separador de línia dins el mateix cue)
    text = text.replace(' / ', ' ').replace('/', ' ')
    # Treure parèntesis buits que puguin quedar: ()
    text = re.sub(r'\(\s*\)', '', text)
    return re.sub(r'\s{2,}', ' ', text).strip()


def _is_only_stage(text: str) -> bool:
    """Retorna True si el text, un cop eliminats els indicadors, queda buit."""
    cleaned = _clean_dialog(text)
    # Si queda algun caràcter alfanumèric, hi ha diàleg real
    return not re.search(r'[A-Za-z0-9\u00C0-\u024F]', cleaned)


def _extract_from_repicar(raw: str) -> str | None:
    """
    Extreu el diàleg d'una línia REPICAR.
    Formats:
      *REPICAR*(NARRADOR, EP 517, TC 04.14) text...
      *REPICAR*(44) (GOLD ROGER, EP 517, TC 04.24) text...
      *REPICAR*(38) (CHOPPER, USOPP, EP 524, TC 23.27) (CRIDEN)  ← sense diàleg
      *REPICAR*(04:00) (TÍTOL SÈRIE, EP 517, TC 06.40) ONE PIECE  ← títol, skip
    """
    # Saltar línies de títol: (TÍTOL SÈRIE, ...) o (TÍTOL EPISODI, ...)
    if _TITOL_SKIP_RE.search(raw):
        return None

    # Treure el prefix *REPICAR*
    rest = re.sub(r'^\*REPICAR\*', '', raw, flags=re.IGNORECASE).strip()

    # Treure offset numèric inicial: (44), (04:00), (06)
    rest = re.sub(r'^\s*\([\d:.]+\)\s*', '', rest)

    # Treure refs d'episodi: (CHAR, EP xxx, TC ...)
    rest = EP_REF_RE.sub('', rest).strip()

    if not rest or _is_only_stage(rest):
        return None

    return _clean_dialog(rest) or None


def _extract_from_char_line(raw: str) -> str | None:
    """
    Extreu el diàleg d'una línia de personatge.
    Formats:
      *NARRADOR*(17) (OFF) Ara, a milers de metres...
      *RUFFY*(06) Ho heu fet molt bé, nois!
      *CHOPPER**USOPP*(38) (G)   ← sense diàleg
    """
    # Treure tots els *CHAR* inicials
    rest = re.sub(r'^(\*[^*]+\*)+', '', raw).strip()
    # Treure offset
    rest = re.sub(r'^\s*\([\d:.]+\)\s*', '', rest)

    if not rest or _is_only_stage(rest):
        return None

    return _clean_dialog(rest) or None


# ── API pública ───────────────────────────────────────────────────────────────

def parse_guion_for_alignment(guion_text: str) -> str:
    """
    Rep el text complet d'un guió SONILAB i retorna únicament les línies
    de diàleg nets, adequades per al motor de forced-alignment (script-align).

    Cada línia del resultat correspon a una intervenció parlada.
    """
    lines        = guion_text.splitlines()
    dialog_lines = []
    in_insert    = False   # dins d'un bloc INSERT (lletres cançó o similar)
    found_first_take = False

    for raw in lines:
        stripped = raw.strip()

        # ── Separadors i línies buides ──────────────────────────────────────
        # Línies buides: saltar, però NO tancar el bloc INSERT
        if not stripped:
            continue

        # Separadors (---...): tanquen blocs INSERT i salten
        if SEPARATOR_RE.match(stripped):
            in_insert = False
            continue

        # ── Capçalera: saltar tot el que hi ha abans del primer TAKE ────────
        if not found_first_take:
            if TAKE_RE.match(stripped):
                found_first_take = True
            continue   # saltar capçalera

        # ── Etiquetes estructurals ───────────────────────────────────────────
        if TAKE_RE.match(stripped) or TIMECODE_RE.match(stripped):
            continue

        # ── Bloc INSERT (lletres de cançó, títols) ───────────────────────────
        if INSERT_RE.match(stripped):
            in_insert = True
            continue

        # El contingut del bloc INSERT pot estar entre parèntesis grans.
        # Considerem que el bloc s'acaba quan trobem una línia de personatge
        # o un separador (gestionat amunt).
        if in_insert:
            # Si la línia comença per * és una línia de personatge → fi bloc
            if stripped.startswith('*'):
                in_insert = False
                # continua per processar-la a baix
            else:
                continue  # seguim dins el bloc INSERT

        # ── Línies REPICAR ────────────────────────────────────────────────────
        if REPICAR_RE.match(stripped):
            dialog = _extract_from_repicar(stripped)
            if dialog:
                dialog_lines.append(dialog)
            continue

        # ── Línies *TÍTOL EPISODI*, *TÍTOL SÈRIE*, *NARRADOR* sense offset ───
        # Nota: *NARRADOR*(offset) text SÍ es processa com línia de personatge
        # però *TÍTOL SÈRIE* (sense offset) s'omet
        if TITOL_RE.match(stripped):
            # Comprova si és NARRADOR amb offset (és diàleg) o títol pur
            rest_after_star = re.sub(r'^(\*[^*]+\*)+', '', stripped).strip()
            has_offset = bool(re.match(r'^\([\d:.]+\)', rest_after_star))
            if not has_offset:
                continue  # títol sense offset → saltar

        # ── Línies de personatge: *CHAR*(offset) text ────────────────────────
        if stripped.startswith('*') and CHAR_LINE_RE.match(stripped):
            dialog = _extract_from_char_line(stripped)
            if dialog:
                dialog_lines.append(dialog)
            continue

        # ── Línies de text pla (continuació o nota de direcció) ──────────────
        # Normalment no hi ha línies de text pla en el format SONILAB, però per
        # robustesa les incloem si semblen diàleg real.
        if stripped and not _is_only_stage(stripped):
            cleaned = _clean_dialog(stripped)
            if cleaned and re.search(r'[A-Za-z0-9\u00C0-\u024F]{3}', cleaned):
                dialog_lines.append(cleaned)

    return '\n'.join(dialog_lines)


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print('Ús: python parse_guion.py <guion.txt>', file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], encoding='utf-8', errors='replace') as fh:
        guion_text = fh.read()

    result = parse_guion_for_alignment(guion_text)
    print(result)
