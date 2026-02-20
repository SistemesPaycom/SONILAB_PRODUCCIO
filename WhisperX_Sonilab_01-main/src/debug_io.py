# -*- coding: utf-8 -*-
"""
debug_io.py — Salidas:
- SRT
- _words.csv / _words.txt
- _cues_debug.csv
- _subs_speakers.csv (tipo HappyScribe)

Mejoras:
- CSV con BOM para Excel: utf-8-sig
- Separador ';' (más robusto con textos que contienen comas y con Excel ES)
"""

from __future__ import annotations

import csv
from typing import Dict, List

from cues import (
    cue_has_speaker_change,
    split_words_by_speaker,
    speaker_of_word,
    cue_dominant_speaker,
    text_len_for_cps,
)
from rules import SubtitleRules

CSV_ENCODING = "utf-8-sig"   # BOM -> Excel abre bien acentos
CSV_DELIM = ";"              # separador seguro (Excel ES / no choca con comas del texto)


def _csv_writer(f):
    return csv.writer(f, delimiter=CSV_DELIM, quoting=csv.QUOTE_MINIMAL)


def seconds_to_srt_time(seconds: float) -> str:
    seconds = max(seconds, 0.0)
    hours = int(seconds // 3600)
    seconds -= hours * 3600
    minutes = int(seconds // 60)
    seconds -= minutes * 60
    sec = int(seconds)
    ms = int(round((seconds - sec) * 1000))
    if ms >= 1000:
        sec += 1
        ms -= 1000
    return f"{hours:02}:{minutes:02}:{sec:02},{ms:03}"


def cues_to_srt(cues: List[Dict]) -> str:
    out_lines = []
    for i, c in enumerate(cues, start=1):
        out_lines.append(str(i))
        out_lines.append(f"{seconds_to_srt_time(c['start'])} --> {seconds_to_srt_time(c['end'])}")
        out_lines.append((c.get("text") or "").strip())
        out_lines.append("")
    return "\n".join(out_lines)


def write_words_debug(words: List[Dict], out_base: str):
    csv_path = out_base + "_words.csv"
    txt_path = out_base + "_words.txt"

    # CSV
    with open(csv_path, "w", encoding=CSV_ENCODING, newline="") as f:
        wcsv = _csv_writer(f)
        wcsv.writerow(["idx", "start", "end", "dur", "gap_prev", "gap_flag", "speaker", "word"])

        prev_end = None
        for i, w in enumerate(words, start=1):
            st = float(w["start"])
            en = float(w["end"])
            dur = en - st

            gap_prev = "" if prev_end is None else (st - prev_end)
            gap_flag = ""
            if prev_end is not None and gap_prev > 1.0:
                gap_flag = "PAUSE>1s"

            spk = w.get("speaker", "")
            wcsv.writerow([
                i,
                f"{st:.3f}",
                f"{en:.3f}",
                f"{dur:.3f}",
                f"{gap_prev:.3f}" if gap_prev != "" else "",
                gap_flag,
                spk,
                w.get("word", ""),
            ])
            prev_end = en

    # TXT
    with open(txt_path, "w", encoding="utf-8") as f:
        for w in words:
            spk = w.get("speaker", "")
            f.write(f"{float(w['start']):.3f}\t{float(w['end']):.3f}\t{spk}\t{w.get('word','')}\n")


def write_cues_debug(cues: List[Dict], out_base: str, rules: SubtitleRules):
    path = out_base + "_cues_debug.csv"
    with open(path, "w", encoding=CSV_ENCODING, newline="") as f:
        wcsv = _csv_writer(f)
        wcsv.writerow([
            "idx", "start", "end", "dur", "chars", "cps", "max_line", "lines",
            "spk_first", "spk_last", "flags", "text"
        ])

        for i, c in enumerate(cues, start=1):
            text = c.get("text") or ""
            st = float(c["start"])
            en = float(c["end"])
            dur = max(en - st, 1e-6)

            chars = text_len_for_cps(text)
            cps = chars / dur

            lines = text.split("\n")
            max_line = max((len(x) for x in lines), default=0)

            flags = []
            if dur < rules.min_duration:
                flags.append("dur<min")
            if cps > rules.max_cps:
                flags.append("cps>max")
            if max_line > rules.max_chars_per_line:
                flags.append(f"line>{rules.max_chars_per_line}(hard)")

            wcsv.writerow([
                i,
                f"{st:.3f}",
                f"{en:.3f}",
                f"{dur:.3f}",
                chars,
                f"{cps:.2f}",
                max_line,
                len(lines),
                c.get("spk_first", ""),
                c.get("spk_last", ""),
                "|".join(flags),
                text.replace("\n", "\\n"),
            ])


def write_subs_speakers_csv(cues: List[Dict], out_base: str) -> str:
    """
    CSV: 1 fila por interlocutor dentro de cada cue.
    Columnas: tc_in ; tc_out ; speaker ; text
    """
    path = out_base + "_subs_speakers.csv"
    with open(path, "w", encoding=CSV_ENCODING, newline="") as f:
        wcsv = _csv_writer(f)
        wcsv.writerow(["tc_in", "tc_out", "speaker", "text"])

        for c in cues:
            tc_in = seconds_to_srt_time(float(c["start"]))
            tc_out = seconds_to_srt_time(float(c["end"]))

            ws = c.get("words") or []
            if not ws:
                continue

            if cue_has_speaker_change(ws):
                chunks = split_words_by_speaker(ws)
                for ch in chunks:
                    spk = speaker_of_word(ch[0])
                    text = " ".join([w["word"] for w in ch]).strip()
                    if text:
                        wcsv.writerow([tc_in, tc_out, spk, text])
            else:
                spk = cue_dominant_speaker(ws) or ""
                text = " ".join([w["word"] for w in ws]).strip()
                if text:
                    wcsv.writerow([tc_in, tc_out, spk, text])

    return path
