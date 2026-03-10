# -*- coding: utf-8 -*-
"""
script_align_engine.py — Motor de alineación forzada con guion conocido.

En lugar de transcribir el audio (ASR), toma el TEXTO del guion ya conocido
y lo alinea al audio para obtener word_segments con timestamps precisos a
nivel de palabra.

Flujo:
  1. ASR rápido con modelo "small" para detectar fronteras de segmentos.
  2. Mapeo proporcional del guion a esos segmentos (por duración de habla).
  3. Forced alignment con WhisperX para timestamps palabra a palabra.

Ideal para contenido doblado donde se conoce el guion exacto: la calidad
del texto es perfecta (viene del guion) y los timestamps son muy precisos.
"""

from __future__ import annotations

import gc
import re
from typing import Dict, List, Optional, Tuple


def align_script_to_audio(
    audio_path: str,
    script_text: str,
    language: Optional[str] = None,
    device: str = "cpu",
    compute_type: str = "int8",
    status_cb=None,
) -> Tuple[List[Dict], List[Dict], str]:
    """
    Alinea el texto del guion al audio y devuelve word_segments con timestamps.

    Parámetros:
        audio_path   : ruta al archivo de audio/vídeo
        script_text  : texto completo del guion
        language     : código de idioma ("ca", "es", "en") o None = auto-detect
        device       : "cpu" o "cuda"
        compute_type : "int8" (cpu), "float16" (cuda)
        status_cb    : callback(msg: str) para logging

    Retorna:
        (word_segments, segments, detected_language)
        word_segments: [{"word": str, "start": float, "end": float}, ...]
        segments:      [{"text": str, "start": float, "end": float}, ...]
    """
    import whisperx
    from faster_whisper import WhisperModel

    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    # ------------------------------------------------------------------ #
    # 1. ASR rápido — solo para detectar fronteras de segmentos de habla  #
    #    (el texto del ASR se descarta; usamos el del guion)               #
    # ------------------------------------------------------------------ #
    _status("Script-align: detectando segmentos de audio (model=small, solo fronteras)...")
    vad_model = WhisperModel("small", device=device, compute_type=compute_type)

    vad_kwargs: Dict = {
        "word_timestamps": False,
        "vad_filter": True,
        "vad_parameters": {
            "threshold": 0.35,
            "min_speech_duration_ms": 250,
            "max_speech_duration_s": 30.0,
            "min_silence_duration_ms": 200,
            "speech_pad_ms": 100,
        },
    }
    if language:
        vad_kwargs["language"] = language

    segments_iter, info = vad_model.transcribe(audio_path, **vad_kwargs)
    detected_lang = info.language

    asr_segments: List[Dict] = []
    for seg in segments_iter:
        asr_segments.append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
        })

    del vad_model
    gc.collect()

    _status(
        f"Script-align: {len(asr_segments)} segmentos detectados, "
        f"idioma_asr={detected_lang}"
    )

    # Fallback: si VAD no detectó habla, usar duración total del audio
    if not asr_segments:
        try:
            import soundfile as sf
            with sf.SoundFile(audio_path) as f:
                total_dur = len(f) / f.samplerate
        except Exception:
            try:
                audio_arr_tmp = whisperx.load_audio(audio_path)
                total_dur = len(audio_arr_tmp) / 16000
                del audio_arr_tmp
            except Exception:
                total_dur = 3600.0
        _status("Script-align: AVISO - VAD no detectó habla, usando duración total.")
        asr_segments = [{"start": 0.0, "end": total_dur, "text": ""}]

    # ------------------------------------------------------------------ #
    # 2. Mapear el guion a los segmentos ASR proporcionalmente            #
    # ------------------------------------------------------------------ #
    _status("Script-align: mapeando guion a segmentos de audio...")
    lang = language or detected_lang or "ca"
    script_segments = _map_script_to_segments(script_text, asr_segments)
    _status(f"Script-align: {len(script_segments)} segmentos del guion mapeados")

    # ------------------------------------------------------------------ #
    # 3. Forced alignment con WhisperX                                    #
    # ------------------------------------------------------------------ #
    _status(f"Script-align: cargando modelo de alineación WhisperX ({lang})...")
    model_a = None
    metadata = None

    # Intentar cargar el modelo para el idioma solicitado; fallback a "es"
    for try_lang in [lang, "es", "en"]:
        try:
            model_a, metadata = whisperx.load_align_model(
                language_code=try_lang, device=device
            )
            if try_lang != lang:
                _status(
                    f"Script-align: modelo de alineación para '{lang}' no disponible, "
                    f"usando '{try_lang}'"
                )
            lang = try_lang
            break
        except Exception as e:
            _status(f"Script-align: no se pudo cargar modelo '{try_lang}': {e}")

    if model_a is None:
        raise RuntimeError(
            "No se pudo cargar ningún modelo de alineación WhisperX. "
            "Comprueba la instalación de whisperx y los modelos de wav2vec2."
        )

    _status("Script-align: cargando audio...")
    audio_arr = whisperx.load_audio(audio_path)

    _status("Script-align: ejecutando forced alignment...")
    aligned = whisperx.align(
        transcript=script_segments,
        model=model_a,
        align_model_metadata=metadata,
        audio=audio_arr,
        device=device,
        return_char_alignments=False,
    )

    word_segments: List[Dict] = aligned.get("word_segments", [])
    aligned_segs: List[Dict] = aligned.get("segments", script_segments)

    del model_a, audio_arr
    gc.collect()

    _status(
        f"Script-align completado: {len(word_segments)} words, "
        f"{len(aligned_segs)} segments"
    )
    return word_segments, aligned_segs, lang


def _map_script_to_segments(
    script_text: str,
    asr_segments: List[Dict],
) -> List[Dict]:
    """
    Distribuye el texto del guion proporcionalmente en los segmentos de ASR.

    Estrategia: el guion tiene N palabras; los segmentos de habla tienen
    una duración total T. Cada segmento recibe las palabras del guion
    proporcionales a su duración relativa.
    """
    # Normalizar el guion: colapsar espacios/saltos múltiples
    cleaned = re.sub(r"[ \t]+", " ", script_text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = cleaned.strip()

    words = cleaned.split()

    if not words:
        end = asr_segments[-1]["end"] if asr_segments else 60.0
        return [{"text": "", "start": 0.0, "end": end}]

    if not asr_segments:
        return [{"text": cleaned, "start": 0.0, "end": 60.0}]

    total_speech_dur = sum(
        max(s["end"] - s["start"], 0.01) for s in asr_segments
    )
    total_words = len(words)

    result: List[Dict] = []
    word_idx = 0

    for i, seg in enumerate(asr_segments):
        seg_dur = max(seg["end"] - seg["start"], 0.01)

        if i == len(asr_segments) - 1:
            # Último segmento: toma todas las palabras restantes
            seg_words = words[word_idx:]
        else:
            ratio = seg_dur / total_speech_dur
            n_words = max(1, round(total_words * ratio))
            seg_words = words[word_idx: word_idx + n_words]

        if not seg_words:
            continue

        result.append({
            "text": " ".join(seg_words),
            "start": seg["start"],
            "end": seg["end"],
        })
        word_idx += len(seg_words)

    # Si sobraron palabras, añadirlas al último segmento
    if word_idx < len(words) and result:
        result[-1]["text"] += " " + " ".join(words[word_idx:])

    return result
