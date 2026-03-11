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

# Models LLM suportats (Ollama)
LLM_MODELS = {
    "llama3.1": "Meta Llama 3.1 8B",
    "qwen2.5": "Qwen 2.5 7B",
    "mistral": "Mistral 7B",
}


def _call_ollama(model: str, prompt: str, timeout: int = 15) -> Optional[str]:
    """Crida Ollama API (http://127.0.0.1:11434). Retorna la resposta o None si error."""
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode()
    req = urllib.request.Request(
        _OLLAMA_BASE, data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
            return data.get("response", "").strip() or None
    except Exception:
        return None


def _correct_with_llm(model: str, transcript_text: str, guion_text: str) -> Optional[str]:
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
    raw = _call_ollama(model, prompt)
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
    method: str        # "fuzzy_replace" / "no_change" / ...


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
    """Serialitza segments a format SRT."""
    parts = []
    for i, seg in enumerate(segments, 1):
        parts.append(f"{i}\n{seg.start} --> {seg.end}\n{seg.text}")
    return '\n\n'.join(parts) + '\n'


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
            result.append(GuionCue(
                speaker=c.speaker,
                text=clean_text,
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
            if clean:
                cues.append(GuionCue(
                    speaker=speaker,
                    text=clean,
                    abs_time=abs_t,
                    take_num=take_num,
                ))

    return cues


# ─────────────────────── Normalització de text ─────────────────────────────────

def _normalize(text: str) -> str:
    """Normalitza per a comparació: minúscules, sense puntuació extra, espais simples."""
    t = text.lower()
    t = re.sub(r"[^\w\sàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]", " ", t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _similarity(a: str, b: str) -> float:
    """
    Retorna similitud [0.0, 1.0] entre dos textos.
    Usa rapidfuzz si disponible (token_set_ratio, més robust per a reordenament).
    """
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if _HAS_RAPIDFUZZ:
        # token_set_ratio: robust davant inserions/reordenaments
        return _rfuzz.token_set_ratio(na, nb) / 100.0
    else:
        return SequenceMatcher(None, na, nb).ratio()


# ─────────────────────── Motor d'alineament ────────────────────────────────────

def _find_best_guion_match(
    seg: SrtSegment,
    guion_cues: List[GuionCue],
    seg_index: int,
    guion_cursor: int,
    window: int,
) -> Tuple[Optional[int], float]:
    """
    Cerca el millor cue del guió per al segment de transcripció donat.

    Estratègia:
      - Busca dins una finestra [guion_cursor - window//2, guion_cursor + window]
      - Puntua per similitud de text
      - Afegeix un petit bonus si el temps del guió s'apropa al del segment

    Retorna (índex_cue_guió, score) o (None, 0.0)
    """
    if not guion_cues:
        return None, 0.0

    lo = max(0, guion_cursor - window // 2)
    hi = min(len(guion_cues), guion_cursor + window + 1)

    best_idx: Optional[int] = None
    best_score = -1.0

    for i in range(lo, hi):
        cue = guion_cues[i]
        text_score = _similarity(seg.text, cue.text)

        # Bonus temporal: si el temps del guió és proper al segment de transcripció
        # (no penalitzem massa si no hi ha timestamps fiables al guió)
        time_diff = abs(cue.abs_time - seg.start_s)
        time_bonus = max(0.0, 1.0 - time_diff / 60.0) * 0.05  # màxim 5% bonus

        combined = text_score + time_bonus

        if combined > best_score:
            best_score = combined
            best_idx = i

    return best_idx, best_score


def align_and_correct(
    transcription_segs: List[SrtSegment],
    guion_cues: List[GuionCue],
    threshold: float = 0.45,
    window: int = 8,
    llm_mode: str = "off",
    llm_model: str = "llama3.1",
) -> Tuple[List[SrtSegment], List[ChangeRecord]]:
    """
    Alinea segments de transcripció amb cues del guió i corregeix el text.

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

    for seg in transcription_segs:
        best_idx, best_score = _find_best_guion_match(
            seg, guion_cues, len(corrected), guion_cursor, window
        )

        # Determinar si cal substituir via fuzzy
        fuzzy_match = (
            best_idx is not None
            and best_score >= threshold
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
    Formata el text corregit adaptant-lo al layout del segment original:
    - Si l'original era multilineal (2 línies), intentem mantenir 2 línies
    - Preserva el prefix de guió "- " si l'original el tenia
    """
    original_lines = original_text.strip().splitlines()
    has_dash_prefix = any(l.strip().startswith('- ') for l in original_lines)

    # Netejar el text del guió
    clean = guion_text.strip()

    # Si l'original tenia 2 línies, intentem dividir el text del guió
    if len(original_lines) >= 2:
        words = clean.split()
        if len(words) >= 4:
            mid = len(words) // 2
            # Busca un punt de tall natural a prop del mig
            best_mid = mid
            for delta in range(0, min(4, mid)):
                # Preferim tallar after puntuació
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
) -> dict:
    """
    Pipeline complet: llegeix SRT + guió, corregeix, escriu outputs.

    Returns: resum {'total_segments', 'changed', 'unchanged', 'changes_json_path', 'srt_path'}
    """
    # --- Llegir inputs ---
    srt_text = Path(srt_path).read_text(encoding='utf-8', errors='replace')
    guion_text = Path(guion_path).read_text(encoding='utf-8', errors='replace')

    segments = parse_srt(srt_text)
    guion_cues = _parse_guion_txt(guion_text)

    if verbose:
        print(f'[corrector] Segments transcripció: {len(segments)}', file=sys.stderr)
        print(f'[corrector] Cues guió: {len(guion_cues)}', file=sys.stderr)
        print(f'[corrector] Threshold: {threshold}, window: {window}', file=sys.stderr)
        print(f'[corrector] LLM mode: {llm_mode}, model: {llm_model}', file=sys.stderr)
        if not _HAS_RAPIDFUZZ:
            print('[corrector] AVÍS: rapidfuzz no disponible, usant difflib (menys precís)', file=sys.stderr)

    if not segments:
        raise ValueError(f'No s\'han trobat segments al SRT: {srt_path}')
    if not guion_cues:
        raise ValueError(f'No s\'han trobat cues al guió: {guion_path}')

    # --- Alinear i corregir ---
    corrected_segs, changes = align_and_correct(
        segments, guion_cues,
        threshold=threshold, window=window,
        llm_mode=llm_mode, llm_model=llm_model,
    )

    # Verificació de seguretat: mai eliminem ni afegim segments
    assert len(corrected_segs) == len(segments), (
        f'ERROR CRÍTIC: nombre de segments diferent! '
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
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
