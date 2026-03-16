# -*- coding: utf-8 -*-
"""
srt_postprocess.py — Aplica les regles internes SONILAB de subtitulat a un SRT existent.

Ús principal: reinjectar la sortida del purfview .exe (faster-whisper-xxl.exe)
a través del nostre pipeline de postprocessat per assegurar que compleix
les nostres regles (max chars, balance, casing, periods, etc.).

Ús:
  python srt_postprocess.py --input raw.srt --output processed.srt [--subtitle-edit-compat]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List

# Forzar UTF-8 en stdout/stderr
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from postprocessor import apply_postprocessing


# ─── SRT parser / writer ─────────────────────────────────────────────────────

_SRT_TC_RE = re.compile(
    r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})'
)


def _tc_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def _seconds_to_tc(t: float) -> str:
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms >= 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt(srt_text: str) -> List[Dict]:
    """Parseja un SRT a una llista de dicts amb start, end, text."""
    cues: List[Dict] = []
    blocks = re.split(r'\n\s*\n', srt_text.strip())
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 2:
            continue
        # Buscar línia de timecode
        tc_line_idx = -1
        for i, line in enumerate(lines):
            if _SRT_TC_RE.search(line):
                tc_line_idx = i
                break
        if tc_line_idx < 0:
            continue
        m = _SRT_TC_RE.search(lines[tc_line_idx])
        if not m:
            continue
        start = _tc_to_seconds(m.group(1), m.group(2), m.group(3), m.group(4))
        end = _tc_to_seconds(m.group(5), m.group(6), m.group(7), m.group(8))
        text = '\n'.join(lines[tc_line_idx + 1:]).strip()
        if text:
            cues.append({'start': start, 'end': end, 'text': text})
    return cues


def write_srt(cues: List[Dict]) -> str:
    """Escriu una llista de cues com a SRT formatat."""
    parts = []
    for i, cue in enumerate(cues, 1):
        start_tc = _seconds_to_tc(cue['start'])
        end_tc = _seconds_to_tc(cue['end'])
        text = cue.get('text') or cue.get('lines', '')
        if isinstance(text, list):
            text = '\n'.join(text)
        parts.append(f"{i}\n{start_tc} --> {end_tc}\n{text}")
    return '\n\n'.join(parts) + '\n'


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Aplica postprocessat SONILAB a un SRT")
    p.add_argument("--input", required=True, help="SRT d'entrada")
    p.add_argument("--output", required=True, help="SRT de sortida")
    p.add_argument("--subtitle-edit-compat", dest="subtitle_edit_compat",
                   action="store_true", default=False,
                   help="Mode compat Subtitle Edit: no merge lines")
    args = p.parse_args()

    inp = Path(args.input)
    if not inp.exists():
        print(f"[ERROR] No existeix input: {inp}", file=sys.stderr)
        sys.exit(1)

    srt_text = inp.read_text(encoding='utf-8')
    cues = parse_srt(srt_text)

    if not cues:
        print(f"[WARN] SRT buit o sense cues: {inp}", file=sys.stderr)
        Path(args.output).write_text(srt_text, encoding='utf-8')
        sys.exit(0)

    print(f"[srt_postprocess] Input: {len(cues)} cues", flush=True)

    do_merge = not args.subtitle_edit_compat

    cues = apply_postprocessing(
        cues,
        do_fix_casing=True,
        do_add_periods=True,
        do_merge_lines=do_merge,
        do_balance_lines=True,
        status_cb=lambda msg: print(msg, flush=True),
    )

    out_text = write_srt(cues)
    Path(args.output).write_text(out_text, encoding='utf-8')
    print(f"[srt_postprocess] Output: {len(cues)} cues -> {args.output}", flush=True)


if __name__ == "__main__":
    main()
