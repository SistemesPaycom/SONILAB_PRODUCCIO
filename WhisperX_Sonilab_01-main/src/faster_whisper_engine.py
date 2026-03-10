# -*- coding: utf-8 -*-
"""
faster_whisper_engine.py — Motor de transcripción alternativo usando faster-whisper.

Faster-Whisper (basado en CTranslate2) ofrece:
- Timestamps nativos a nivel de palabra (word_timestamps=True) para TODOS los idiomas
  (no depende de un modelo de alineación externo como WhisperX).
- Soporte para large-v3-turbo (mejor balance velocidad/calidad).
- Timestamps generalmente más precisos que el fallback de WhisperX para idiomas
  sin modelo de alineación (como catalán).

Este módulo proporciona una API compatible con el pipeline existente:
- transcribe_with_faster_whisper() → devuelve word_segments como WhisperX.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple


def transcribe_with_faster_whisper(
    audio_path: str,
    model_size: str = "large-v3-turbo",
    device: str = "cpu",
    compute_type: str = "int8",
    language: Optional[str] = None,
    beam_size: int = 5,
    word_timestamps: bool = True,
    vad_filter: bool = True,
    vad_parameters: Optional[Dict] = None,
    initial_prompt: Optional[str] = None,
    status_cb=None,
) -> Tuple[List[Dict], List[Dict], str]:
    """
    Transcribe audio usando faster-whisper y devuelve word_segments compatibles
    con el pipeline de cues.py.

    Parámetros:
        audio_path: ruta al archivo de audio (WAV, MP3, etc.)
        model_size: nombre del modelo (tiny, base, small, medium,
                    large-v2, large-v3, large-v3-turbo)
        device: "cpu" o "cuda"
        compute_type: "int8", "float16", "float32"
        language: código de idioma (ej: "es", "ca") o None para auto-detect
        beam_size: tamaño del beam search
        word_timestamps: activar timestamps a nivel de palabra
        vad_filter: usar filtro VAD de Silero para segmentar
        vad_parameters: parámetros personalizados para VAD
        initial_prompt: prompt inicial para guiar la transcripción
        status_cb: callback para logging

    Retorna:
        (word_segments, segments, detected_language)
        - word_segments: lista de {"word": str, "start": float, "end": float}
        - segments: lista de {"start": float, "end": float, "text": str}
        - detected_language: código de idioma detectado
    """
    from faster_whisper import WhisperModel

    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    # VAD por defecto optimizado para subtítulos
    if vad_parameters is None:
        vad_parameters = {
            "threshold": 0.35,
            "min_speech_duration_ms": 250,
            "max_speech_duration_s": 30.0,
            "min_silence_duration_ms": 200,
            "speech_pad_ms": 100,
        }

    _status(f"Cargando modelo Faster-Whisper ({model_size}) en {device}...")
    model = WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
    )

    _status(f"Transcribiendo con Faster-Whisper (word_timestamps={word_timestamps})...")

    transcribe_kwargs = {
        "beam_size": beam_size,
        "word_timestamps": word_timestamps,
        "vad_filter": vad_filter,
        "vad_parameters": vad_parameters,
    }
    if language:
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    segments_iter, info = model.transcribe(audio_path, **transcribe_kwargs)

    detected_language = info.language
    _status(f"Idioma detectado: {detected_language} (prob: {info.language_probability:.2f})")

    # Recopilar segmentos y word_segments
    segments: List[Dict] = []
    word_segments: List[Dict] = []

    for segment in segments_iter:
        seg_dict = {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip(),
        }
        segments.append(seg_dict)

        if word_timestamps and segment.words:
            for word_info in segment.words:
                ws = {
                    "word": word_info.word.strip(),
                    "start": float(word_info.start),
                    "end": float(word_info.end),
                }
                # Filtrar palabras vacías o con timestamps inválidos
                if ws["word"] and ws["end"] > ws["start"]:
                    word_segments.append(ws)

    _status(f"Faster-Whisper: {len(segments)} segmentos, {len(word_segments)} palabras")

    # Si no hay word_segments (no se pidieron o fallo), generar fallback
    if not word_segments and segments:
        _status("Generando word_segments aproximados desde segmentos...")
        word_segments = _approx_words_from_segments(segments)

    # Limpiar modelo de memoria
    del model
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    import gc
    gc.collect()

    return word_segments, segments, detected_language


def _approx_words_from_segments(segments: List[Dict]) -> List[Dict]:
    """
    Fallback: genera word_segments aproximados desde segmentos.
    Misma lógica que approx_word_segments_from_segments en whisperx_ops.py
    pero con mejor distribución temporal.
    """
    out: List[Dict] = []
    for seg in segments:
        st = float(seg.get("start", 0))
        en = float(seg.get("end", 0))
        text = (seg.get("text") or "").strip()
        if not text or en <= st:
            continue

        tokens = re.findall(r"\S+", text)
        if not tokens:
            continue

        if len(tokens) == 1:
            out.append({"word": tokens[0], "start": st, "end": en})
            continue

        total_chars = sum(max(len(t), 1) for t in tokens)
        cur = st
        span = en - st

        for t in tokens:
            w = max(len(t), 1)
            dur = span * (w / total_chars)
            out.append({"word": t, "start": cur, "end": min(en, cur + dur)})
            cur += dur
        out[-1]["end"] = en

    return out


def get_initial_prompt_for_language(language: Optional[str]) -> Optional[str]:
    """
    Devuelve un prompt inicial que ayuda a Whisper a generar
    puntuación correcta y estilo adecuado para el idioma.
    """
    prompts = {
        "es": "Transcripción de subtítulos en español de España, con puntuación correcta.",
        "ca": "Transcripció de subtítols en català, amb la puntuació correcta.",
        "en": "Subtitle transcription in English, with correct punctuation.",
    }
    return prompts.get(language)
