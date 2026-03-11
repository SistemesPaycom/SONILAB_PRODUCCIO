"""
guion_converter.py — Converteix guions DOCX/RTF/TXT a text pla preservant
l'estructura SONILAB (tabuladors SPEAKER\ttext, SALTs de línia, anchors).

Ús CLI:
    python guion_converter.py <fitxer>          → stdout
    python guion_converter.py <fitxer> --out f  → escriu a fitxer

Estratègia per format:
  DOCX → python-docx (preferit) o XML manual amb <w:tab/> suport
  RTF  → striprtf (si disponible) o conversor regex robust inline
  TXT  → lectura directa UTF-8 (o latin-1 fallback)
"""

from __future__ import annotations
import argparse
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


# ─────────────────────────── DOCX ────────────────────────────────────────────

def _docx_via_python_docx(path: str) -> str:
    """Extracció DOCX amb python-docx (millor fidelitat de tabs i runs)."""
    import docx  # type: ignore
    doc = docx.Document(path)
    lines = []
    for para in doc.paragraphs:
        parts = []
        for run in para.runs:
            if run.text:
                parts.append(run.text)
        # python-docx no exposa tabs directament via run.text;
        # fem servir l'XML del paràgraf per recuperar-los.
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        for elem in para._element.iter():
            pass  # ja processat via runs
        # Usa fallback XML per assegurar tabs
        lines.append(_xml_para_to_text(para._element))
    return _join_lines(lines)


def _xml_para_to_text(para_elem) -> str:
    """Extreu text d'un element <w:p> preservant <w:tab/>."""
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    parts: list[str] = []
    for elem in para_elem.iter():
        tag = elem.tag
        if tag == f'{ns}t':
            parts.append(elem.text or '')
        elif tag == f'{ns}tab':
            parts.append('\t')
        elif tag == f'{ns}br':
            # salt de línia dins el paràgraf
            br_type = elem.get(f'{ns}type', '')
            if br_type in ('', 'textWrapping'):
                parts.append('\n')
    return ''.join(parts)


def _docx_via_xml(path: str) -> str:
    """Fallback: extracció DOCX sense python-docx, parsejant l'XML directament."""
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    with zipfile.ZipFile(path) as zf:
        xml_bytes = zf.read('word/document.xml')
    root = ET.fromstring(xml_bytes)
    lines: list[str] = []
    for para in root.iter(f'{ns}p'):
        lines.append(_xml_para_to_text(para))
    return _join_lines(lines)


def convert_docx(path: str) -> str:
    """Converteix DOCX a TXT preservant tabuladors i estructura SONILAB."""
    try:
        import docx  # noqa: F401
        return _docx_via_xml(path)   # usem sempre el mètode XML per fidelitat de tabs
    except ImportError:
        pass
    return _docx_via_xml(path)


# ─────────────────────────── RTF ─────────────────────────────────────────────

def _rtf_via_striprtf(path: str) -> str:
    """Conversor RTF usant striprtf (pip install striprtf)."""
    from striprtf.striprtf import rtf_to_text  # type: ignore
    raw = Path(path).read_bytes().decode('utf-8', errors='replace')
    return rtf_to_text(raw, errors='replace')


def _rtf_regex(rtf_text: str) -> str:
    """
    Conversor RTF inline (sense dependències) prou robust per a guions SONILAB.

    Preserva:
      \\par  → salt de paràgraf
      \\tab  → tabulador  ← crucial per SPEAKER\ttext
      \\line → salt de línia
      text   → text literal

    Elimina:
      grups ignorables {\\* ...}
      seqüències de control  \\keyword<n>
      caràcters de control  \\'XX
    """
    # 1. Eliminar grups ignorables
    text = re.sub(r'\{\\\*[^}]*\}', '', rtf_text, flags=re.DOTALL)
    # 2. Caràcters escapats \' HH → unicode
    def _decode_char(m: re.Match) -> str:
        try:
            return bytes.fromhex(m.group(1)).decode('cp1252', errors='replace')
        except Exception:
            return ''
    text = re.sub(r"\\'([0-9a-fA-F]{2})", _decode_char, text)
    # 3. Control words estructurals (ordre important)
    text = re.sub(r'\\pard\b[^\\\n{]*', '', text)       # reset paràgraf (eliminar paràmetres)
    text = re.sub(r'\\par\b\s*', '\n', text)             # paràgraf → newline
    text = re.sub(r'\\line\b\s*', '\n', text)            # salt línia dins paràgraf
    text = re.sub(r'\\tab\b\s*', '\t', text)             # tab → tabulador
    text = re.sub(r'\\[a-z]+[-]?\d*\b\s*', '', text)    # resta control words
    text = re.sub(r'\\[^a-z\s]', '', text)              # control symbols
    # 4. Eliminar claus i neteja
    text = re.sub(r'[{}]', '', text)
    return text.strip()


def convert_rtf(path: str) -> str:
    """Converteix RTF a TXT preservant tabuladors."""
    try:
        result = _rtf_via_striprtf(path)
        return _join_lines(result.splitlines())
    except ImportError:
        pass
    raw = Path(path).read_bytes().decode('utf-8', errors='replace')
    result = _rtf_regex(raw)
    return _join_lines(result.splitlines())


# ─────────────────────────── TXT ─────────────────────────────────────────────

def convert_txt(path: str) -> str:
    """Llegeix TXT provat amb UTF-8, fallback latin-1."""
    try:
        return Path(path).read_text(encoding='utf-8')
    except UnicodeDecodeError:
        return Path(path).read_text(encoding='latin-1')


# ─────────────────────────── utils ───────────────────────────────────────────

def _join_lines(lines: list[str]) -> str:
    """
    Uneix línies col·lapsant múltiples línies buides seguides → una sola,
    i eliminant les buides al principi/final.
    """
    result: list[str] = []
    prev_empty = False
    for line in lines:
        if not line.strip():
            if not prev_empty and result:
                result.append('')
            prev_empty = True
        else:
            result.append(line)
            prev_empty = False
    return '\n'.join(result).strip()


# ─────────────────────────── API pública ─────────────────────────────────────

def convert_file(path: str) -> str:
    """
    Converteix qualsevol fitxer suportat a text pla.

    Formats suportats: .docx, .rtf, .txt
    Retorna el text extret preservant tabuladors i estructura SONILAB.
    """
    ext = Path(path).suffix.lower()
    if ext == '.docx':
        return convert_docx(path)
    elif ext == '.rtf':
        return convert_rtf(path)
    elif ext == '.txt':
        return convert_txt(path)
    else:
        raise ValueError(f'Format no suportat: {ext!r}. Usa .docx, .rtf o .txt')


# ─────────────────────────── CLI ─────────────────────────────────────────────

def main() -> None:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    parser = argparse.ArgumentParser(
        description='Converteix DOCX/RTF/TXT a text pla (preserva tabuladors SONILAB)'
    )
    parser.add_argument('input', help='Fitxer d\'entrada (.docx, .rtf o .txt)')
    parser.add_argument('--out', default='', help='Fitxer de sortida (per defecte: stdout)')
    args = parser.parse_args()

    try:
        text = convert_file(args.input)
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)

    if args.out:
        Path(args.out).write_text(text, encoding='utf-8')
    else:
        print(text)


if __name__ == '__main__':
    main()
