# -*- coding: utf-8 -*-
"""
whisperx_ops.py — wrappers de WhisperX
- load_model robusto (compat versiones)
- transcribe robusto
- align robusto (si falla -> fallback mejorado)
- approx_word_segments_from_segments (fallback básico)
- align_with_wav2vec2 (alineación forzada para idiomas sin soporte nativo WhisperX, incluido catalán)

Mejoras v2:
- Alineación forzada con wav2vec2 catalán (softcatala/wav2vec2-large-xlsr-catala)
  o wav2vec2 multilingüe como fallback para idiomas sin soporte en WhisperX.
- Cadena de fallbacks: WhisperX align → wav2vec2 custom → approx por segmentos.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# Idiomas con alineación nativa de WhisperX
WHISPERX_ALIGN_LANGUAGES = {"en", "es", "fr", "de", "it", "pt", "nl", "ja", "zh", "uk"}

# Modelos wav2vec2 recomendados por idioma (HuggingFace)
# Estos modelos se usan para alineación forzada cuando WhisperX no soporta el idioma.
WAV2VEC2_MODELS = {
    "ca": "softcatala/wav2vec2-large-xlsr-catala",
    "eu": "HiTZ/wav2vec2-large-xlsr-53-basque",
    "gl": "proxectonos/wav2vec2-large-xlsr-53-galician",
    # Fallback multilingüe para cualquier otro idioma
    "_default": "facebook/wav2vec2-large-xlsr-53",
}


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


# ============================================================
# Alineación forzada con wav2vec2 (para catalán y otros)
# ============================================================

def _try_align_with_wav2vec2(
    segments: List[Dict],
    audio_arr,
    device: str,
    language_code: str,
    status_cb=None,
) -> Optional[List[Dict]]:
    """
    Intenta alineación forzada usando torchaudio + wav2vec2.
    Funciona para CUALQUIER idioma que tenga un modelo wav2vec2 entrenado.

    Estrategia:
    1. Carga el modelo wav2vec2 apropiado para el idioma.
    2. Para cada segmento, usa CTC forced alignment para obtener
       timestamps a nivel de carácter.
    3. Agrupa los caracteres en palabras con sus timestamps.

    Retorna lista de word_segments o None si falla.
    """
    try:
        import torch
        import torchaudio
        from torchaudio.pipelines import MMS_FA as bundle  # Multi-lingual forced alignment
    except ImportError:
        if status_cb:
            status_cb("torchaudio no disponible para alineación forzada wav2vec2.")
        return None

    try:
        if status_cb:
            status_cb(f"Intentando alineación forzada MMS (torchaudio) para '{language_code}'...")

        # MMS Forced Alignment soporta 1100+ idiomas incluyendo catalán
        model = bundle.get_model().to(device)
        tokenizer = bundle.get_tokenizer()
        aligner = bundle.get_aligner()

        # Preparar audio como tensor
        import numpy as np
        if isinstance(audio_arr, np.ndarray):
            waveform = torch.from_numpy(audio_arr).float().unsqueeze(0)
        else:
            waveform = audio_arr.float().unsqueeze(0) if audio_arr.dim() == 1 else audio_arr.float()

        waveform = waveform.to(device)
        sample_rate = 16000

        # Resample si necesario (MMS espera 16kHz)
        if sample_rate != bundle.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sample_rate, bundle.sample_rate)

        word_segments: List[Dict] = []

        for seg in segments:
            try:
                text = (seg.get("text") or "").strip()
                if not text:
                    continue

                seg_start = float(seg["start"])
                seg_end = float(seg["end"])
                if seg_end <= seg_start:
                    continue

                # Extraer porción de audio del segmento
                start_sample = int(seg_start * bundle.sample_rate)
                end_sample = int(seg_end * bundle.sample_rate)
                end_sample = min(end_sample, waveform.shape[-1])
                if start_sample >= end_sample:
                    continue

                segment_waveform = waveform[:, start_sample:end_sample]

                # Normalizar texto para tokenización
                normalized_text = text.upper().strip()
                # Eliminar puntuación que el tokenizer no maneja
                normalized_text = re.sub(r"[^\w\s]", "", normalized_text)
                normalized_text = re.sub(r"\s+", " ", normalized_text).strip()

                if not normalized_text:
                    continue

                # Tokenizar y alinear
                with torch.inference_mode():
                    emission, _ = model(segment_waveform)
                    tokens = tokenizer(normalized_text)
                    token_spans = aligner(emission[0], tokens)

                # Convertir spans a word_segments
                words = text.split()
                ratio = segment_waveform.shape[-1] / emission.shape[1]

                char_idx = 0
                word_idx = 0
                current_word_spans = []

                for span in token_spans:
                    span_start = seg_start + (span.start * ratio / bundle.sample_rate)
                    span_end = seg_start + (span.end * ratio / bundle.sample_rate)

                    current_word_spans.append((span_start, span_end))

                    # Contar caracteres para saber cuándo termina la palabra actual
                    char_idx += 1
                    if word_idx < len(words):
                        word_clean = re.sub(r"[^\w]", "", words[word_idx]).upper()
                        if char_idx >= len(word_clean):
                            # Palabra completa
                            if current_word_spans:
                                ws_start = current_word_spans[0][0]
                                ws_end = current_word_spans[-1][1]
                                word_segments.append({
                                    "word": words[word_idx],
                                    "start": round(ws_start, 3),
                                    "end": round(ws_end, 3),
                                })
                            current_word_spans = []
                            char_idx = 0
                            word_idx += 1

                # Recoger palabras restantes si quedan
                if current_word_spans and word_idx < len(words):
                    ws_start = current_word_spans[0][0]
                    ws_end = current_word_spans[-1][1]
                    remaining_words = " ".join(words[word_idx:])
                    word_segments.append({
                        "word": remaining_words,
                        "start": round(ws_start, 3),
                        "end": round(ws_end, 3),
                    })

            except Exception as e:
                # Si falla un segmento, usar fallback para ese segmento
                if status_cb:
                    status_cb(f"MMS align falló en segmento ({e}), usando approx...")
                st = float(seg.get("start", 0))
                en = float(seg.get("end", 0))
                text = (seg.get("text") or "").strip()
                if text and en > st:
                    tokens = text.split()
                    span = en - st
                    total = sum(max(len(t), 1) for t in tokens)
                    cur = st
                    for t in tokens:
                        w = max(len(t), 1)
                        dur = span * (w / total)
                        word_segments.append({"word": t, "start": round(cur, 3), "end": round(min(en, cur + dur), 3)})
                        cur += dur

        if word_segments:
            if status_cb:
                status_cb(f"MMS forced alignment: {len(word_segments)} palabras alineadas.")
            return word_segments

    except Exception as e:
        if status_cb:
            status_cb(f"Alineación MMS falló completamente: {e}")

    return None


def _try_align_with_wav2vec2_ctc(
    segments: List[Dict],
    audio_arr,
    device: str,
    language_code: str,
    status_cb=None,
) -> Optional[List[Dict]]:
    """
    Fallback alternativo: usa un modelo wav2vec2 específico del idioma
    (ej: softcatala/wav2vec2-large-xlsr-catala) con CTC decoding
    para obtener timestamps por token.

    Más simple que MMS pero requiere modelo específico por idioma.
    """
    model_name = WAV2VEC2_MODELS.get(language_code, WAV2VEC2_MODELS.get("_default"))
    if not model_name:
        return None

    try:
        import torch
        import numpy as np
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

        if status_cb:
            status_cb(f"Intentando alineación CTC con {model_name}...")

        processor = Wav2Vec2Processor.from_pretrained(model_name)
        model = Wav2Vec2ForCTC.from_pretrained(model_name).to(device)

        if isinstance(audio_arr, np.ndarray):
            waveform = audio_arr.astype(np.float32)
        else:
            waveform = audio_arr.numpy().astype(np.float32)

        word_segments: List[Dict] = []

        for seg in segments:
            try:
                text = (seg.get("text") or "").strip()
                if not text:
                    continue

                seg_start = float(seg["start"])
                seg_end = float(seg["end"])
                if seg_end <= seg_start:
                    continue

                # Extraer porción de audio
                start_sample = int(seg_start * 16000)
                end_sample = min(int(seg_end * 16000), len(waveform))
                if start_sample >= end_sample:
                    continue

                segment_audio = waveform[start_sample:end_sample]

                # Procesar con wav2vec2
                inputs = processor(
                    segment_audio, sampling_rate=16000,
                    return_tensors="pt", padding=True
                ).to(device)

                with torch.no_grad():
                    logits = model(**inputs).logits

                # CTC decoding con timestamps
                predicted_ids = torch.argmax(logits, dim=-1)
                frames = predicted_ids[0].cpu().numpy()

                # Calcular ratio tiempo/frame
                n_frames = logits.shape[1]
                seg_duration = seg_end - seg_start
                time_per_frame = seg_duration / n_frames

                # Obtener tokens con posiciones temporales
                tokens_with_times = []
                blank_id = processor.tokenizer.pad_token_id or 0
                prev_token = blank_id

                for frame_idx, token_id in enumerate(frames):
                    if token_id != blank_id and token_id != prev_token:
                        char = processor.tokenizer.decode([token_id])
                        t = seg_start + frame_idx * time_per_frame
                        tokens_with_times.append((char, t))
                    prev_token = token_id

                if not tokens_with_times:
                    # Fallback por segmento
                    for w in text.split():
                        word_segments.append({
                            "word": w,
                            "start": seg_start,
                            "end": seg_end,
                        })
                    continue

                # Agrupar caracteres en palabras
                words = text.split()
                char_groups = []
                char_idx = 0
                for word in words:
                    word_chars = []
                    for _ in word:
                        if char_idx < len(tokens_with_times):
                            word_chars.append(tokens_with_times[char_idx])
                            char_idx += 1
                    # Saltar espacios
                    while char_idx < len(tokens_with_times) and tokens_with_times[char_idx][0].strip() == "":
                        char_idx += 1
                    char_groups.append((word, word_chars))

                for word, chars in char_groups:
                    if chars:
                        ws_start = chars[0][1]
                        ws_end = chars[-1][1] + time_per_frame * 2  # margen
                        ws_end = min(ws_end, seg_end)
                    else:
                        ws_start = seg_start
                        ws_end = seg_end

                    word_segments.append({
                        "word": word,
                        "start": round(ws_start, 3),
                        "end": round(ws_end, 3),
                    })

            except Exception:
                # Fallback para este segmento
                for w in (seg.get("text") or "").split():
                    word_segments.append({
                        "word": w,
                        "start": float(seg.get("start", 0)),
                        "end": float(seg.get("end", 0)),
                    })

        del model, processor
        try:
            import torch as _t
            if _t.cuda.is_available():
                _t.cuda.empty_cache()
        except Exception:
            pass

        if word_segments:
            if status_cb:
                status_cb(f"wav2vec2 CTC alignment: {len(word_segments)} palabras.")
            return word_segments

    except Exception as e:
        if status_cb:
            status_cb(f"wav2vec2 CTC alignment falló: {e}")

    return None


# ============================================================
# align_words mejorado con cadena de fallbacks
# ============================================================

def align_words(
    result: Dict,
    audio_arr,
    device: str,
    language_code: str,
    status_cb=None,
    allow_fallback: bool = True,
) -> Tuple[List[Dict], bool]:
    """
    Intenta align con cadena de fallbacks:
      1. WhisperX align (solo para los 10 idiomas soportados)
      2. MMS Forced Alignment (torchaudio, 1100+ idiomas)
      3. wav2vec2 CTC específico del idioma
      4. Aproximación por segmentos (último recurso)

    Devuelve:
      (word_segments, used_fallback)

    used_fallback=True cuando NO se usó alineación precisa (solo approx).
    """
    import whisperx

    segments = result.get("segments", []) or []

    # --- Intento 1: WhisperX align nativo ---
    if language_code in WHISPERX_ALIGN_LANGUAGES:
        try:
            if status_cb:
                status_cb(f"Alineando palabra a palabra (WhisperX align, idioma={language_code})...")

            model_a, metadata = whisperx.load_align_model(language_code=language_code, device=device)
            result_aligned = whisperx.align(
                segments, model_a, metadata, audio_arr, device,
                return_char_alignments=False
            )
            word_segments = result_aligned.get("word_segments", []) or []
            if word_segments:
                if status_cb:
                    status_cb(f"WhisperX align OK: {len(word_segments)} palabras alineadas.")
                return word_segments, False
            else:
                raise RuntimeError("Align no devolvió word_segments.")

        except Exception as e:
            if status_cb:
                status_cb(f"WhisperX align falló para '{language_code}': {e}")
    else:
        if status_cb:
            status_cb(f"WhisperX align NO soporta '{language_code}'. Usando alternativas...")

    if not allow_fallback:
        if status_cb:
            status_cb("Fallback desactivado. Usando approx.")
        return approx_word_segments_from_segments(segments), True

    # --- Intento 2: MMS Forced Alignment (torchaudio) ---
    ws = _try_align_with_wav2vec2(segments, audio_arr, device, language_code, status_cb)
    if ws:
        return ws, False  # MMS alignment es preciso, no es "fallback"

    # --- Intento 3: wav2vec2 CTC específico del idioma ---
    ws = _try_align_with_wav2vec2_ctc(segments, audio_arr, device, language_code, status_cb)
    if ws:
        return ws, False  # CTC alignment es razonablemente preciso

    # --- Intento 4: Fallback por segmentos (último recurso) ---
    if status_cb:
        status_cb(f"Ninguna alineación disponible para '{language_code}'. Usando fallback por segmentos...")
    return approx_word_segments_from_segments(segments), True
