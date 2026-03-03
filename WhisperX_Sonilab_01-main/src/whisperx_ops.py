# -*- coding: utf-8 -*-
"""
whisperx_ops.py — wrappers de WhisperX
- load_model robusto (compat versiones)
- transcribe robusto
- align robusto (si falla -> fallback)
- approx_word_segments_from_segments (fallback)
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple


def approx_word_segments_from_segments(segments: List[Dict]) -> List[Dict]:
    """
    Fallback: crea word_segments aproximados si align no está disponible.
    """
    out: List[Dict] = []
    for seg in (segments or []):
        try:
            st = float(seg.get("start"))
            en = float(seg.get("end"))
            text = (seg.get("text") or "").strip()
            if not text or en <= st:
                continue

            tokens = re.findall(r"\S+", text)
            if not tokens:
                continue

            if len(tokens) == 1:
                out.append({"word": tokens[0], "start": st, "end": en})
                continue

            total = sum(max(len(t), 1) for t in tokens)
            cur = st
            span = en - st

            for t in tokens:
                w = max(len(t), 1)
                dur = span * (w / total)
                out.append({"word": t, "start": cur, "end": min(en, cur + dur)})
                cur += dur

            out[-1]["end"] = en
        except Exception:
            continue

    return out


def load_whisperx_model(model_size: str, device: str, compute_type: str, language: Optional[str] = None):
    import whisperx
    try:
        return whisperx.load_model(model_size, device, compute_type=compute_type, language=language, vad_method="silero")
    except TypeError:
        # versiones que no aceptan language o vad_method
        try:
            return whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
        except TypeError:
            return whisperx.load_model(model_size, device, compute_type=compute_type)


def transcribe_audio(model, audio_arr, batch_size: int, language: Optional[str], chunk_size: int = 15):
    transcribe_kwargs = {"batch_size": int(batch_size)}
    if language:
        transcribe_kwargs["language"] = language

    # chunk_size reduce deriva y problemas con VAD/música
    transcribe_kwargs["chunk_size"] = int(chunk_size)

    try:
        return model.transcribe(audio_arr, vad_method="silero", **transcribe_kwargs)
    except TypeError:
        # compat: versiones viejas que no aceptan vad_method/chunk_size
        transcribe_kwargs.pop("chunk_size", None)
        return model.transcribe(audio_arr, **transcribe_kwargs)


def align_words(
    result: Dict,
    audio_arr,
    device: str,
    language_code: str,
    status_cb=None
) -> Tuple[List[Dict], bool]:
    """
    Intenta align. Devuelve:
      (word_segments, used_fallback)

    used_fallback=True cuando NO hay align y generamos word_segments aproximados.
    """
    import whisperx

    try:
        if status_cb:
            status_cb("Alineando palabra a palabra (align)...")

        model_a, metadata = whisperx.load_align_model(language_code=language_code, device=device)
        result_aligned = whisperx.align(
            result["segments"], model_a, metadata, audio_arr, device,
            return_char_alignments=False
        )
        word_segments = result_aligned.get("word_segments", []) or []
        if not word_segments:
            raise RuntimeError("Align no devolvió word_segments.")
        return word_segments, False

    except Exception:
        if status_cb:
            status_cb(f"Align no disponible para '{language_code}'. Usando fallback por segmentos...")
        return approx_word_segments_from_segments(result.get("segments", []) or []), True
