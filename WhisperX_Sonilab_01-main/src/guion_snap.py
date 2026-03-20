# -*- coding: utf-8 -*-
"""
guion_snap.py — Re-segmentació d'un SRT existent usant els ancoratges
temporals del guió SONILAB (format TXT).

Idea: el guió TXT té timecodes per a cada diàleg (HH:MM:SS).
Quan fem transcripció amb faster-whisper / purfview / whisperx, el resultat
és correcte en TEXT però les fronteres de segment no coincideixen amb les
del guió. Aquest script re-segmenta el SRT d'entrada perquè els talls
corresponguin als ancoratges del guió.

Funcionament:
  1. Parseja el guió TXT → llista de (abs_time, speaker, text) ancoratges.
  2. Parseja el SRT d'entrada → llista de cues amb (start, end, text).
  3. Per a cada ancoratge del guió:
       - Troba el cue de l'SRT que conté o és més proper a abs_time.
       - Si el cue no comença exactament a abs_time i el desfasament és
         petit (< snap_tolerance), snap el start del cue a abs_time.
       - Si abs_time cau enmig d'un cue, parteix el cue en dos en aquell punt.
  4. Renumera i escriu el SRT de sortida.

Ús:
  python guion_snap.py --srt input.srt --guion guio.txt --output snapped.srt
  python guion_snap.py --srt input.srt --guion guio.txt --output snapped.srt
                       --snap-tolerance 1.5 --split-tolerance 0.5

Paràmetres:
  --snap-tolerance : temps màxim (s) per desplaçar el inici d'un cue fins
                     a un ancoratge. Default: 2.0 s
  --split-tolerance: si abs_time cau dins d'un cue amb marge > split_tolerance,
                     parteix el cue. Default: 0.3 s (per evitar partir cues curts)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Forzar UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# ─── SRT parse/write (idèntic a srt_postprocess.py) ──────────────────────────

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


def _parse_srt(srt_text: str) -> List[Dict]:
    cues: List[Dict] = []
    blocks = re.split(r'\n\s*\n', srt_text.strip())
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 2:
            continue
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


def _write_srt(cues: List[Dict]) -> str:
    parts = []
    for i, cue in enumerate(cues, 1):
        start_tc = _seconds_to_tc(cue['start'])
        end_tc = _seconds_to_tc(cue['end'])
        text = cue.get('text', '')
        parts.append(f"{i}\n{start_tc} --> {end_tc}\n{text}")
    return '\n\n'.join(parts) + '\n'


# ─── Guió TXT parse ───────────────────────────────────────────────────────────

def _load_guion_anchors(guion_text: str) -> List[Tuple[float, str, str]]:
    """
    Extreu ancoratges del guió TXT SONILAB.

    Retorna llista de (abs_time_seconds, speaker, text_net).
    Ordena per abs_time.
    """
    try:
        from script_txt_parser import parse_script_txt_from_text
        cues = parse_script_txt_from_text(guion_text)
        anchors: List[Tuple[float, str, str]] = []
        for c in cues:
            if c.abs_time is None:
                continue
            if c.kind not in ('dialogue', 'insert', 'title'):
                continue
            text_net = re.sub(r'\s+', ' ', c.text or '').strip()
            # Eliminar marcadors de temps interns (xxx.xxs)
            text_net = re.sub(r'\(\d+\.\d+s\)', '', text_net).strip()
            anchors.append((float(c.abs_time), c.speaker or '', text_net))
        anchors.sort(key=lambda x: x[0])
        return anchors
    except ImportError:
        print("[guion_snap] AVÍS: script_txt_parser no disponible. Usant parser mínim.", file=sys.stderr)
        return _load_guion_anchors_minimal(guion_text)


def _load_guion_anchors_minimal(guion_text: str) -> List[Tuple[float, str, str]]:
    """
    Parser mínim de guió TXT (fallback si script_txt_parser no disponible).
    Busca línies *SPEAKER*\\t text amb base_tc HH:MM:SS prèvia.
    """
    anchors: List[Tuple[float, str, str]] = []
    base_tc_re = re.compile(r'^\s*(\d{2}:\d{2}:\d{2})\s*$')
    speaker_re = re.compile(r'^\s*\*([^*]+)\*\s*\t\s*(.*)\s*$')

    current_base_sec: Optional[float] = None
    lines = guion_text.splitlines()
    for line in lines:
        m_tc = base_tc_re.match(line)
        if m_tc:
            hms = m_tc.group(1).split(':')
            current_base_sec = int(hms[0]) * 3600 + int(hms[1]) * 60 + int(hms[2])
            continue
        m_sp = speaker_re.match(line)
        if m_sp and current_base_sec is not None:
            speaker = m_sp.group(1).strip()
            text = m_sp.group(2).strip()
            text = re.sub(r'\(\d+\.\d+s\)', '', text)
            text = re.sub(r'\([^)]*\)', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            if text:
                anchors.append((current_base_sec, speaker, text))

    anchors.sort(key=lambda x: x[0])
    return anchors


# ─── Guion Snap ───────────────────────────────────────────────────────────────

def _snap_srt_to_guion(
    cues: List[Dict],
    anchors: List[Tuple[float, str, str]],
    snap_tolerance: float = 2.0,
    split_tolerance: float = 0.3,
    min_cue_dur: float = 0.5,
    status_cb=None,
) -> List[Dict]:
    """
    Re-segmenta cues aplicant els ancoratges del guió.

    Per a cada ancoratge (abs_time, speaker, text):
      1. Troba el cue que conté abs_time o és el més proper.
      2. Si abs_time és molt proper al inici del cue (≤ snap_tolerance),
         ajusta el start del cue a abs_time.
      3. Si abs_time cau enmig del cue (> split_tolerance des del start),
         parteix el cue en dos.

    Retorna la llista de cues resultant (pot tenir més cues que l'entrada).
    """
    def _st(msg: str):
        if callable(status_cb):
            status_cb(msg)

    if not cues or not anchors:
        return cues

    # Treballem amb còpia mutable
    result: List[Dict] = [dict(c) for c in cues]
    snaps = 0
    splits = 0

    for anchor_time, speaker, anchor_text in anchors:
        # Ignorar ancoratges fora del rang de l'SRT
        if anchor_time < result[0]['start'] - snap_tolerance:
            continue
        if anchor_time > result[-1]['end'] + snap_tolerance:
            continue

        # Trobar el cue que conté anchor_time o és el més proper
        best_idx = -1
        best_dist = float('inf')

        for i, cue in enumerate(result):
            # Si anchor_time és dins del cue
            if cue['start'] <= anchor_time <= cue['end']:
                dist = anchor_time - cue['start']
                if dist < best_dist:
                    best_dist = dist
                    best_idx = i
            else:
                # Distància al punt més proper (start o end)
                d = min(abs(anchor_time - cue['start']), abs(anchor_time - cue['end']))
                if d < best_dist:
                    best_dist = d
                    best_idx = i

        if best_idx < 0:
            continue

        cue = result[best_idx]
        dist_from_start = anchor_time - cue['start']
        dist_to_end = cue['end'] - anchor_time

        # Cas 1: anchor_time és molt proper al INICI del cue → snap
        if abs(dist_from_start) <= snap_tolerance and abs(dist_from_start) < dist_to_end:
            if abs(dist_from_start) > 0.05:  # evitar toques trivials
                old_start = cue['start']
                result[best_idx]['start'] = anchor_time
                _st(f"[guion_snap] SNAP {_seconds_to_tc(old_start)} → {_seconds_to_tc(anchor_time)} ({anchor_text[:30]})")
                snaps += 1
            continue

        # Cas 2: anchor_time cau DINS del cue i n'hi ha marge suficient → split
        if (cue['start'] < anchor_time < cue['end']
                and dist_from_start >= split_tolerance
                and dist_to_end >= min_cue_dur):
            # Partir el cue en dos a anchor_time
            text = cue.get('text', '')
            words = text.replace('\n', ' ').split()
            total_dur = cue['end'] - cue['start']
            ratio = dist_from_start / total_dur if total_dur > 0 else 0.5
            split_word = max(1, min(len(words) - 1, int(round(ratio * len(words)))))

            text1 = ' '.join(words[:split_word]).strip()
            text2 = ' '.join(words[split_word:]).strip()

            if not text1:
                text1 = text
                text2 = ''
            if not text2:
                # No es pot partir — snap el start en comptes
                result[best_idx]['start'] = anchor_time
                snaps += 1
                continue

            cue1 = dict(cue)
            cue1['end'] = anchor_time - 0.001
            cue1['text'] = text1

            cue2 = dict(cue)
            cue2['start'] = anchor_time
            cue2['text'] = text2

            result = result[:best_idx] + [cue1, cue2] + result[best_idx + 1:]
            _st(f"[guion_snap] SPLIT a {_seconds_to_tc(anchor_time)} ({anchor_text[:30]})")
            splits += 1

    _st(f"[guion_snap] Resultat: {snaps} snaps, {splits} splits → {len(result)} cues (entrada: {len(cues)})")
    return result


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Re-segmenta un SRT usant els ancoratges temporals del guió TXT SONILAB"
    )
    p.add_argument("--srt", required=True, help="SRT d'entrada")
    p.add_argument("--guion", required=True, help="Guió TXT SONILAB")
    p.add_argument("--output", required=True, help="SRT de sortida")
    p.add_argument("--snap-tolerance", type=float, default=2.0,
                   help="Temps màxim (s) per fer snap d'un start a un ancoratge. Default: 2.0")
    p.add_argument("--split-tolerance", type=float, default=0.3,
                   help="Marge mínim (s) des del start per partir un cue. Default: 0.3")
    args = p.parse_args()

    srt_path = Path(args.srt)
    guion_path = Path(args.guion)
    out_path = Path(args.output)

    if not srt_path.exists():
        print(f"[ERROR] SRT no trobat: {srt_path}", file=sys.stderr)
        sys.exit(1)
    if not guion_path.exists():
        print(f"[ERROR] Guió no trobat: {guion_path}", file=sys.stderr)
        sys.exit(1)

    srt_text = srt_path.read_text(encoding='utf-8')
    guion_text = guion_path.read_text(encoding='utf-8')

    cues = _parse_srt(srt_text)
    if not cues:
        print(f"[WARN] SRT buit: {srt_path}", file=sys.stderr)
        out_path.write_text(srt_text, encoding='utf-8')
        sys.exit(0)

    anchors = _load_guion_anchors(guion_text)
    if not anchors:
        print(f"[WARN] Guió sense ancoratges TXT detectats: {guion_path}", file=sys.stderr)
        out_path.write_text(srt_text, encoding='utf-8')
        sys.exit(0)

    print(f"[guion_snap] Input SRT: {len(cues)} cues | Ancoratges guió: {len(anchors)}", flush=True)

    snapped = _snap_srt_to_guion(
        cues,
        anchors,
        snap_tolerance=args.snap_tolerance,
        split_tolerance=args.split_tolerance,
        status_cb=lambda msg: print(msg, flush=True),
    )

    out_path.write_text(_write_srt(snapped), encoding='utf-8')
    print(f"[guion_snap] Output: {len(snapped)} cues → {out_path}", flush=True)


if __name__ == "__main__":
    main()
