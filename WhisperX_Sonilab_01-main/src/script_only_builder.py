# -*- coding: utf-8 -*-
"""
script_only_builder.py — Construeix un SRT a partir d'un guió TXT SONILAB.

Adaptat de Whisper_Sonilab/src/pipeline/P01_script_only_builder.py per a ús
dins de WhisperX_Sonilab_01. Diferències:
  - Segment és autodefinit (no depèn de P01_srt_io).
  - ScriptCue importat des de script_txt_parser (local).
  - API pública: build_srt_only_from_script(cues, cfg) -> List[Segment].

Ús típic:
  from script_txt_parser import parse_script_txt_from_text, is_txt_guion_format
  from script_only_builder import build_srt_only_from_script, ScriptOnlyConfig, Segment

  cues = parse_script_txt_from_text(txt_text)
  segments = build_srt_only_from_script(cues)
  transcript = [{"text": s.text, "start": s.start_sec, "end": s.end_sec} for s in segments]
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import List, Optional, Sequence, Tuple

from script_txt_parser import ScriptCue


# ---------------------------------------------------------------------------
# Segment (equivalent al de P01_srt_io, però autònom)
# ---------------------------------------------------------------------------
@dataclass
class Segment:
    index: int
    start_sec: float
    end_sec: float
    text: str


# ---------------------------------------------------------------------------
# Regex
# ---------------------------------------------------------------------------
TIME_MARK_RE = re.compile(r"\((\d+\.\d{2})s\)")
PAREN_ALPHA_RE = re.compile(r"\(([^)]*[A-Za-zÀ-ÿ][^)]*)\)")
STRAY_PAREN_CHARS_RE = re.compile(r"[()]+")
WS_RE = re.compile(r"\s+")
SLASH_RE = re.compile(r"\s*/\s*")
ALNUM_RE = re.compile(r"[0-9A-Za-zÀ-ÿ]")


# ---------------------------------------------------------------------------
# Configuració
# ---------------------------------------------------------------------------
@dataclass
class ScriptOnlyConfig:
    max_chars_per_line: int = 42
    max_lines: int = 2

    min_segment_dur: float = 0.90    # s — evitar micro-subtítols
    min_gap_to_next: float = 0.04    # s — gap mínim entre segments

    tail_duration: float = 2.5       # durada final si no hi ha cue posterior

    cps_target: float = 14.0         # caràcters/s per estimar hold
    hold_extra: float = 0.35         # marge extra
    max_hold_duration: float = 4.5   # durada màxima per a un segment normal

    merge_max_start_delta: float = 1.20  # s — per a "- A\n- B"

    ignore_adlib: bool = True
    include_kinds: Tuple[str, ...] = ("dialogue", "insert", "title")

    merge_two_speakers: bool = True
    merge_max_chars_each: int = 22
    merge_max_gap: float = 0.45      # s entre segments per fusionar-los


# ---------------------------------------------------------------------------
# Estructura temporal interna
# ---------------------------------------------------------------------------
@dataclass
class _TmpSeg:
    seq: int
    start: float
    end: float
    text: str
    speaker: str
    kind: str


# ---------------------------------------------------------------------------
# Helpers de text
# ---------------------------------------------------------------------------
def _sanitize_text(text: str) -> str:
    """Neteja: treu time-markers, parèntesis amb lletres i parèntesis solts.
    NOTE: El "/" NO s'elimina aquí — es gestiona com a punt de divisió
    a _split_into_blocks ABANS de cridar a _sanitize_text.
    """
    if not text:
        return ""

    text = text.replace("…", "...")
    # SLASH_RE: NO substituïm "/" per espai. El "/" és un indicador de tall
    # gestionat a _split_into_blocks. Aquí el deixem passar.
    text = TIME_MARK_RE.sub(" ", text)
    text = PAREN_ALPHA_RE.sub(" ", text)
    text = STRAY_PAREN_CHARS_RE.sub(" ", text)
    # Eliminar qualsevol "/" residual que no s'hagi processat com a punt de tall
    # (e.g., si arriba directament a _sanitize_text sense passar per _split_into_blocks)
    text = SLASH_RE.sub(" ", text)
    text = WS_RE.sub(" ", text).strip()
    text = re.sub(r"\.{2,}", "...", text).strip()

    if not text or not ALNUM_RE.search(text):
        return ""
    return text


def _norm_for_compare(text: str) -> str:
    t = (text or "").lower()
    t = re.sub(r"[^0-9a-zà-ÿ]+", " ", t)
    return WS_RE.sub(" ", t).strip()


def _estimate_hold(text: str, cfg: ScriptOnlyConfig) -> float:
    t = (text or "").strip()
    if not t:
        return cfg.min_segment_dur
    n = len(re.sub(r"\s+", "", t))
    hold = (n / max(1.0, float(cfg.cps_target))) + float(cfg.hold_extra)
    if n <= 8:
        hold = max(1.10, hold)
    elif n <= 18:
        hold = max(1.40, hold)
    return max(cfg.min_segment_dur, min(float(cfg.max_hold_duration), float(hold)))


def _wrap_lines(text: str, max_chars: int) -> List[str]:
    text = text.strip()
    if not text:
        return []
    lines_out: List[str] = []
    for para in text.split("\n"):
        words = para.split()
        if not words:
            continue
        line = words[0]
        for w in words[1:]:
            if len(line) + 1 + len(w) <= max_chars:
                line += " " + w
            else:
                lines_out.append(line)
                line = w
        lines_out.append(line)
    return lines_out


def _force_2_lines(text: str, cfg: ScriptOnlyConfig) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    lines = _wrap_lines(t, cfg.max_chars_per_line)
    if 1 <= len(lines) <= cfg.max_lines:
        return "\n".join(lines).strip()

    words = t.split()
    if not words:
        return ""

    l1: List[str] = []
    cur_len = 0
    i = 0
    while i < len(words):
        w = words[i]
        add = len(w) + (1 if l1 else 0)
        if l1 and (cur_len + add) > cfg.max_chars_per_line:
            break
        l1.append(w)
        cur_len += add
        i += 1

    l2 = words[i:]
    if not l2:
        return " ".join(l1).strip()
    return (" ".join(l1).strip() + "\n" + " ".join(l2).strip()).strip()


def _fits_2_lines(text: str, cfg: ScriptOnlyConfig) -> bool:
    lines = _wrap_lines(text, cfg.max_chars_per_line)
    return 1 <= len(lines) <= cfg.max_lines


def _split_into_blocks(text: str, cfg: ScriptOnlyConfig) -> List[str]:
    text = text.strip()
    if not text:
        return []

    # "/" en el guió significa "talla aquí" (diàleg llarg que necessita divisió).
    # Es tracta PRIMER, abans del particionat per frases.
    # Cada part del "/" es processa de forma independent i recursiva.
    if SLASH_RE.search(text):
        slash_parts = [p.strip() for p in SLASH_RE.split(text) if p.strip()]
        if len(slash_parts) > 1:
            result: List[str] = []
            for sp in slash_parts:
                # Cridem recursivament per gestionar frases dins de cada part
                result.extend(_split_into_blocks(sp, cfg))
            return result

    sent = re.split(r"(?<=[\.\?\!])\s+", text)
    sent = [s.strip() for s in sent if s.strip()]

    blocks: List[str] = []
    cur = ""

    for s in sent:
        if not cur:
            cur = s
            continue
        cand = cur + " " + s
        if _fits_2_lines(cand, cfg):
            cur = cand
        else:
            blocks.append(cur)
            cur = s

    if cur:
        blocks.append(cur)

    final: List[str] = []
    for b in blocks:
        if _fits_2_lines(b, cfg):
            final.append(b)
            continue
        words = b.split()
        tmp = ""
        for w in words:
            cand = (tmp + " " + w).strip()
            if not tmp:
                tmp = w
                continue
            if _fits_2_lines(cand, cfg):
                tmp = cand
            else:
                final.append(tmp)
                tmp = w
        if tmp:
            final.append(tmp)

    return [x for x in final if x.strip()]


def _merge_tight_pieces(
    pieces: List[Tuple[float, str]],
    cfg: ScriptOnlyConfig,
) -> List[Tuple[float, str]]:
    if len(pieces) <= 1:
        return pieces

    out: List[Tuple[float, str]] = []
    cur_start, cur_text = pieces[0]

    for nxt_start, nxt_text in pieces[1:]:
        dt = float(nxt_start) - float(cur_start)
        if dt < (cfg.min_segment_dur + cfg.min_gap_to_next):
            cur_text = (cur_text + " " + nxt_text).strip()
            continue
        out.append((float(cur_start), cur_text.strip()))
        cur_start, cur_text = float(nxt_start), nxt_text

    out.append((float(cur_start), cur_text.strip()))
    final: List[Tuple[float, str]] = []
    for st, tx in out:
        tx2 = _sanitize_text(tx)
        if tx2:
            final.append((float(st), tx2))
    return final


def _split_by_time_markers(
    text: str,
    default_start: float,
) -> List[Tuple[float, str]]:
    """
    Converteix text amb markers (xxx.xxs) en llista de (start_sec, text).
    Exemple: "Hola. (10.00s) Adeu." → [(default, "Hola."), (10.0, "Adeu.")]
    """
    if not text:
        return []

    parts: List[Tuple[float, str]] = []
    cur_start = float(default_start)
    cur_buf: List[str] = []

    tokens: List[str] = []
    last = 0
    for m in TIME_MARK_RE.finditer(text):
        if m.start() > last:
            tokens.append(text[last:m.start()])
        tokens.append(m.group(0))
        last = m.end()
    if last < len(text):
        tokens.append(text[last:])

    for tok in tokens:
        m = TIME_MARK_RE.fullmatch(tok.strip())
        if m:
            chunk = _sanitize_text(" ".join(cur_buf))
            if chunk:
                parts.append((cur_start, chunk))
            cur_buf = []
            cur_start = float(m.group(1))
        else:
            cur_buf.append(tok)

    tail = _sanitize_text(" ".join(cur_buf))
    if tail:
        parts.append((cur_start, tail))

    out: List[Tuple[float, str]] = []
    for st, tx in parts:
        if not tx:
            continue
        if out and abs(st - out[-1][0]) < 0.01 and tx == out[-1][1]:
            continue
        out.append((st, tx))
    return out


def _allocate_times(
    start: float,
    end: float,
    blocks: List[str],
    cfg: ScriptOnlyConfig,
) -> List[Tuple[float, float, str]]:
    start = float(start)
    end = float(end)

    if end <= start:
        end = start + cfg.min_segment_dur

    span = end - start
    if len(blocks) <= 1:
        return [(start, end, blocks[0])] if blocks else []

    if span < cfg.min_segment_dur * len(blocks):
        joined = " ".join(blocks).strip()
        return [(start, end, joined)]

    weights = [max(1, len(b)) for b in blocks]
    total_w = float(sum(weights))
    durs = [span * (w / total_w) for w in weights]
    durs = [max(cfg.min_segment_dur, d) for d in durs]
    scale = span / sum(durs)
    durs = [d * scale for d in durs]

    out: List[Tuple[float, float, str]] = []
    t = start
    for i, b in enumerate(blocks):
        dur = durs[i]
        t2 = t + dur
        out.append((t, t2, b))
        t = t2

    if out:
        out[-1] = (out[-1][0], end, out[-1][2])
    return out


# ---------------------------------------------------------------------------
# Funció principal
# ---------------------------------------------------------------------------
def build_srt_only_from_script(
    cues: Sequence[ScriptCue],
    cfg: Optional[ScriptOnlyConfig] = None,
) -> List[Segment]:
    """
    Genera un SRT des del guió TXT SONILAB.

    Els timings es basen en els anchors/time-markers del guió i en les
    distàncies entre cues. El text és net (sense OFF/ON, etc.).

    Paràmetres:
        cues : llista de ScriptCue (sortida de parse_script_txt_from_text)
        cfg  : configuració (per defecte ScriptOnlyConfig())

    Retorna:
        Llista de Segment, cada un amb index, start_sec, end_sec, text.
    """
    if cfg is None:
        cfg = ScriptOnlyConfig()

    filt: List[ScriptCue] = []
    for c in cues:
        if c.kind not in cfg.include_kinds:
            continue
        if cfg.ignore_adlib and c.is_adlib:
            continue
        if not (c.text or "").strip():
            continue
        if c.abs_time is None:
            continue
        filt.append(c)

    if not filt:
        return []

    # Ordre temporal estable (empats mantenen ordre d'entrada)
    filt = [c for _, c in sorted(enumerate(filt), key=lambda x: (float(x[1].abs_time), x[0]))]

    tmp: List[_TmpSeg] = []
    seq = 0

    for i, cue in enumerate(filt):
        cue_abs = float(cue.abs_time or 0.0)
        default_start = float(cue_abs)

        next_cue_time = (
            float(filt[i + 1].abs_time)
            if i + 1 < len(filt)
            else cue_abs + cfg.tail_duration
        )

        hard_end_upper = max(
            default_start + cfg.min_segment_dur,
            next_cue_time - cfg.min_gap_to_next,
        )

        pieces = _split_by_time_markers(cue.text, default_start)
        pieces = _merge_tight_pieces(pieces, cfg)
        if not pieces:
            continue

        for p_i, (p_start, p_txt) in enumerate(pieces):
            p_start = float(p_start)
            p_next = float(pieces[p_i + 1][0]) if p_i + 1 < len(pieces) else hard_end_upper

            end_limit = p_next - cfg.min_gap_to_next
            hold_cap = p_start + _estimate_hold(p_txt, cfg)
            p_end = min(end_limit, hold_cap)

            if p_end < p_start + cfg.min_segment_dur:
                if end_limit >= p_start + cfg.min_segment_dur:
                    p_end = p_start + cfg.min_segment_dur
                else:
                    p_end = max(p_start, end_limit)

            blocks = _split_into_blocks(p_txt, cfg)
            timed = _allocate_times(p_start, p_end, blocks, cfg)

            for st, en, btxt in timed:
                btxt = _sanitize_text(btxt)
                if not btxt:
                    continue
                out_txt = _force_2_lines(btxt, cfg)
                if not out_txt:
                    continue

                if tmp:
                    prev = tmp[-1]
                    if (
                        _norm_for_compare(prev.text) == _norm_for_compare(out_txt)
                        and abs(prev.start - float(st)) < 0.60
                    ):
                        continue

                seq += 1
                tmp.append(
                    _TmpSeg(
                        seq=seq,
                        start=float(st),
                        end=float(en),
                        text=out_txt,
                        speaker=cue.speaker,
                        kind=cue.kind,
                    )
                )

    # Ordena per temps (ordre estable en empats)
    tmp = sorted(tmp, key=lambda s: (s.start, s.seq))

    # Passa de resolució de solapaments
    fixed: List[_TmpSeg] = []
    for seg in tmp:
        if not fixed:
            fixed.append(seg)
            continue

        prev = fixed[-1]
        need_start = prev.end + cfg.min_gap_to_next
        st = seg.start
        en = seg.end

        if st < need_start:
            new_prev_end = st - cfg.min_gap_to_next
            if new_prev_end >= prev.start + cfg.min_segment_dur:
                fixed[-1] = _TmpSeg(
                    seq=prev.seq, start=prev.start, end=new_prev_end,
                    text=prev.text, speaker=prev.speaker, kind=prev.kind,
                )
                fixed.append(seg)
            else:
                st = need_start
                en = max(en, st + cfg.min_segment_dur)
                fixed.append(
                    _TmpSeg(
                        seq=seg.seq, start=st, end=en,
                        text=seg.text, speaker=seg.speaker, kind=seg.kind,
                    )
                )
        else:
            fixed.append(seg)

    # Fusió de 2 speakers curts consecutius en "- A\n- B"
    if cfg.merge_two_speakers:
        merged: List[_TmpSeg] = []
        j = 0
        while j < len(fixed):
            a = fixed[j]
            if j + 1 < len(fixed):
                b = fixed[j + 1]
                if (
                    a.kind == "dialogue"
                    and b.kind == "dialogue"
                    and a.speaker.strip().upper() != b.speaker.strip().upper()
                    and (b.start - a.end) <= cfg.merge_max_gap
                    and (b.start - a.start) <= cfg.merge_max_start_delta
                    and len(a.text.replace("\n", " ")) <= cfg.merge_max_chars_each
                    and len(b.text.replace("\n", " ")) <= cfg.merge_max_chars_each
                    and _norm_for_compare(a.text) != _norm_for_compare(b.text)
                ):
                    comb = f"- {a.text.replace(chr(10), ' ')}\n- {b.text.replace(chr(10), ' ')}"
                    wrapped = _wrap_lines(comb, cfg.max_chars_per_line)
                    if len(wrapped) > cfg.max_lines:
                        wrapped = []
                    comb2 = "\n".join(wrapped).strip() if wrapped else ""
                    if comb2:
                        merged.append(
                            _TmpSeg(
                                seq=a.seq, start=a.start, end=b.end,
                                text=comb2, speaker="", kind="dialogue",
                            )
                        )
                        j += 2
                        continue
            merged.append(a)
            j += 1
        fixed = merged

    return [
        Segment(index=idx, start_sec=float(s.start), end_sec=float(s.end), text=s.text)
        for idx, s in enumerate(fixed, start=1)
    ]
