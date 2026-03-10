# -*- coding: utf-8 -*-
"""
pipeline.py — WhisperX pipeline (v2 — con mejoras de timestamps):
- extracción WAV
- transcripción + align (word_segments) — ahora con cadena de fallbacks
- (opcional) motor Faster-Whisper como alternativa a WhisperX
- (opcional) diarización pyannote
- construcción de cues + timings + SRT
- (NUEVO) post-procesado de timings por forma de onda (WhisperTimingFixer)
- debugs: _words.csv/_words.txt, _cues_debug.csv, _subs_speakers.csv, _diarization_error.txt

Cambios v2:
- Integración de timing_fixer.py (port de SubtitleEdit WhisperTimingFixer)
- Soporte para motor Faster-Whisper (faster_whisper_engine.py)
- Cadena de fallbacks de alineación mejorada para catalán y otros idiomas
- Parámetro engine="whisperx"|"faster-whisper" para elegir motor
- Parámetro enable_timing_fix para activar/desactivar el ajuste por forma de onda
"""

import os
import gc
import tempfile
import shutil
from typing import Optional

import whisperx

# MoviePy import changed in 2.x; keep compatibility
try:
    from moviepy import VideoFileClip, AudioFileClip  # MoviePy >= 2.x
except Exception:
    from moviepy.editor import VideoFileClip, AudioFileClip  # MoviePy 1.x

from torch_patch import patch_torch_safe_globals
from hf_env import (
    configure_local_caches,
    configure_offline_mode,
    apply_hf_token,
    report_cache_status,
)
from whisperx_ops import load_whisperx_model, transcribe_audio, align_words
from rules import SubtitleRules

from diarization import (
    try_run_diarization,
    smooth_diarization_segments,
    merge_rare_speakers,
    map_speakers_to_interlocutors,
    assign_speakers_to_words,
    write_speakers_map,
)

from cues import (
    clean_word_segments,
    build_cues,
    split_cues_on_internal_sentence_punct,
    move_carryover_after_strong_punct,
    merge_orphans_and_ultrashort,
    split_overlong_cues,
    apply_timings_and_format,
)

from debug_io import (
    cues_to_srt,
    write_words_debug,
    write_cues_debug,
    write_subs_speakers_csv,
)

# NUEVO: timing fixer (port de SubtitleEdit)
from timing_fixer import fix_timings_with_waveform

# ------------------------------------------------------------
# Paths (proyecto)
# ------------------------------------------------------------
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SRC_DIR, os.pardir))

OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
CACHE_ROOT = os.path.join(PROJECT_DIR, "hf_cache")


# ------------------------------------------------------------
# Opcionales (si existen en tu proyecto)
# ------------------------------------------------------------
try:
    from diarization import smooth_word_speakers  # opcional
except Exception:
    def smooth_word_speakers(word_segments, *args, **kwargs):
        return word_segments

try:
    from cues import explode_cues_by_speaker_turns  # opcional
except Exception:
    def explode_cues_by_speaker_turns(cues, rules):
        return cues


# ============================================================
# Helpers
# ============================================================

def get_device_and_compute_type(device_pref: str):
    import torch

    device_pref = (device_pref or "auto").lower().strip()

    if device_pref == "cuda":
        if torch.cuda.is_available():
            return "cuda", "float16"
        return "cpu", "int8"

    if device_pref == "cpu":
        return "cpu", "int8"

    if torch.cuda.is_available():
        return "cuda", "float16"

    return "cpu", "int8"


# ============================================================
# Transcripción con Faster-Whisper (alternativa a WhisperX)
# ============================================================

def _transcribe_faster_whisper(
    wav_path: str,
    model_size: str,
    device: str,
    compute_type: str,
    language: Optional[str],
    rules: SubtitleRules,
    status_cb=None,
):
    """
    Usa Faster-Whisper como motor de transcripción.
    Devuelve (word_segments, segments, detected_language).
    """
    from faster_whisper_engine import (
        transcribe_with_faster_whisper,
        get_initial_prompt_for_language,
    )

    initial_prompt = get_initial_prompt_for_language(language)

    word_segments, segments, detected_lang = transcribe_with_faster_whisper(
        audio_path=wav_path,
        model_size=model_size,
        device=device,
        compute_type=compute_type,
        language=language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=initial_prompt,
        status_cb=status_cb,
    )

    return word_segments, segments, detected_lang


# ============================================================
# Pipeline principal
# ============================================================

def pipeline_generate(
    video_path: str,
    rules: SubtitleRules,
    profile: str,
    language: Optional[str],
    model_size: str,
    batch_size: int,
    hf_token: str,
    device_pref: str,
    offline_mode: bool = False,
    status_cb=None,
    # NUEVOS parámetros v2
    engine: str = "whisperx",         # "whisperx" o "faster-whisper"
    enable_timing_fix: bool = True,   # activar ajuste de timings por forma de onda
    timing_fix_threshold: float = 7.0, # umbral de silencio para el timing fixer
):
    offline_mode = bool(offline_mode)

    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    hf_token = (hf_token or os.getenv("HUGGINGFACE_HUB_TOKEN", "")).strip()

    patch_torch_safe_globals()
    configure_local_caches(CACHE_ROOT)
    configure_offline_mode(offline_mode)
    _status(f"offline_mode={offline_mode} HF_HUB_OFFLINE={os.getenv('HF_HUB_OFFLINE')}")
    report_cache_status(_status)
    apply_hf_token(hf_token)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(video_path))[0]
    out_base = os.path.join(OUTPUT_DIR, f"{base_name}_{profile}")

    out_srt = out_base + "_subs.srt"
    out_cues_debug = out_base + "_cues_debug.csv"
    diar_log_path = out_base + "_diarization_error.txt"

    tmp_dir = None

    speakers_map_path = None
    subs_speakers_csv = None
    model = None

    audio_arr = None
    result = None
    word_segments_raw = None
    diar_segs = None
    words = None
    cues = None

    try:
        tmp_dir = tempfile.mkdtemp(prefix="wisp_")
        wav_path = os.path.join(tmp_dir, "audio.wav")

        _status("Extrayendo audio (WAV 16kHz)...")
        ext = os.path.splitext(video_path)[1].lower()
        media_clip = None
        audio_clip = None

        try:
            if ext in {".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg", ".wma", ".aiff", ".aif", ".aifc"}:
                audio_clip = AudioFileClip(video_path)
            else:
                media_clip = VideoFileClip(video_path)
                audio_clip = media_clip.audio

            if audio_clip is None:
                raise RuntimeError("El archivo no contiene pista de audio.")

            audio_clip.write_audiofile(
                wav_path,
                fps=16000,
                codec="pcm_s16le",
                ffmpeg_params=["-ac", "1"],
                logger=None
            )
        finally:
            try:
                if audio_clip is not None:
                    audio_clip.close()
            except Exception:
                pass
            try:
                if media_clip is not None:
                    media_clip.close()
            except Exception:
                pass

        _status("Detectando device (GPU/CPU)...")
        device, compute_type = get_device_and_compute_type(device_pref)

        import torch
        _status(f"CUDA avail: {torch.cuda.is_available()}")
        _status(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU'}")
        _status(f"Device seleccionado: {device} (compute_type={compute_type})")

        # Decide idioma ANTES de cargar el modelo
        profile = (profile or "").strip().upper()
        language = (language or "").strip().lower() or None
        if language is None:
            language = {"VE": "es", "VCAT": "ca"}.get(profile)

        _status(f"Idioma transcripción: {language or 'auto'}")
        _status(f"Motor de transcripción: {engine}")

        # ================================================================
        # TRANSCRIPCIÓN + ALINEACIÓN
        # ================================================================

        if engine == "faster-whisper":
            # ----- Motor: Faster-Whisper -----
            _status(f"Usando Faster-Whisper con modelo {model_size}...")
            word_segments_raw, segments, detected_lang = _transcribe_faster_whisper(
                wav_path=wav_path,
                model_size=model_size,
                device=device,
                compute_type=compute_type,
                language=language,
                rules=rules,
                status_cb=_status,
            )
            _used_fallback = False  # Faster-Whisper da word timestamps nativos

            # Cargar audio como numpy para diarización y timing fixer
            audio_arr = whisperx.load_audio(wav_path)

            # Si no hay suficientes word_segments, usar fallback
            if not word_segments_raw or len(word_segments_raw) < 3:
                _status("Faster-Whisper no generó suficientes word_segments. Fallback.")
                _used_fallback = True

        else:
            # ----- Motor: WhisperX (por defecto) -----
            _status(f"Cargando WhisperX ({model_size}) en {device}...")
            model = load_whisperx_model(model_size, device, compute_type, language=language)

            audio_arr = whisperx.load_audio(wav_path)

            _status("Transcribiendo (WhisperX)...")
            result = transcribe_audio(model, audio_arr, batch_size, language, chunk_size=15)
            segs = result.get("segments", []) or []
            if segs:
                max_dur = max(float(s["end"]) - float(s["start"]) for s in segs)
                _status(f"VAD segments: {len(segs)} | max_dur={max_dur:.2f}s")

            lang_for_align = language or result.get("language") or ("es" if profile == "VE" else "ca")

            word_segments_raw, _used_fallback = align_words(
                result=result,
                audio_arr=audio_arr,
                device=device,
                language_code=lang_for_align,
                status_cb=_status,
                allow_fallback=True,  # NUEVO: permite cadena completa de fallbacks
            )

            if _used_fallback:
                _status("AVISO: Alineación word-level usó fallback por segmentos. "
                        "Los timestamps pueden ser menos precisos. "
                        "El ajuste por forma de onda (timing_fixer) intentará compensar.")

        # ------------------------
        # Diarización (opcional)
        # ------------------------
        diar_segs = None
        mapping = {}

        if rules.enable_diarization:
            diar_segs = try_run_diarization(
                wav_path,
                audio_arr,
                device=device,
                hf_token=(hf_token or "").strip(),
                offline_mode=offline_mode,
                status_cb=_status,
                log_path=diar_log_path
            )

        if diar_segs:
            _status(f"Diarización OK: {len(diar_segs)} segmentos (raw). Suavizando...")
            diar_segs = smooth_diarization_segments(diar_segs, min_seg=rules.min_speaker_segment)

            _status("Colapsando speakers raros/excesivos (merge_rare_speakers)...")
            diar_segs = merge_rare_speakers(
                diar_segs,
                min_total_dur_s=8.0,
                min_total_ratio=0.01,
                max_speakers_keep=12,
                max_neighbor_gap=0.35,
            )

            diar_segs, mapping = map_speakers_to_interlocutors(diar_segs)
            _status(f"Diarización: {len(mapping)} interlocutores detectados (InterlocutorXX).")

            _status("Asignando interlocutores a palabras...")
            word_segments_raw = assign_speakers_to_words(word_segments_raw, diar_segs)

            # opcional (si lo tienes implementado)
            word_segments_raw = smooth_word_speakers(word_segments_raw, min_run_words=2, min_run_dur=0.25)

        else:
            if rules.enable_diarization:
                _status("Diarización NO activa (falló / no devolvió segmentos).")

        # ------------------------
        # Cues + formato
        # ------------------------
        _status("Sanitizando timestamps + generando cues...")
        words = clean_word_segments(word_segments_raw, rules)

        # Debug01
        # write_words_debug(words, out_base)

        cues = build_cues(words, rules)
        cues = split_cues_on_internal_sentence_punct(cues, rules)
        cues = move_carryover_after_strong_punct(cues, rules)
        cues = merge_orphans_and_ultrashort(cues, rules)
        cues = split_overlong_cues(cues, rules)

        # opcional (si lo tienes implementado)
        cues = explode_cues_by_speaker_turns(cues, rules)

        cues = apply_timings_and_format(cues, rules)

        # ================================================================
        # NUEVO: Ajuste de timings por forma de onda (WhisperTimingFixer)
        # ================================================================
        if enable_timing_fix and audio_arr is not None:
            _status("Aplicando ajuste de timings por forma de onda (WhisperTimingFixer)...")
            cues = fix_timings_with_waveform(
                cues=cues,
                audio_arr=audio_arr,
                sample_rate=16000,
                min_duration_ms=max(rules.min_duration * 1000, 600.0),
                max_duration_ms=rules.max_duration * 1000,
                pct_threshold=timing_fix_threshold,
                status_cb=_status,
            )
            _status("Ajuste de timings por forma de onda completado.")
        elif enable_timing_fix:
            _status("AVISO: No se pudo aplicar timing_fixer (audio_arr no disponible).")

        # Debug02
        # write_cues_debug(cues, out_base, rules)
        # Debug03
        # subs_speakers_csv = write_subs_speakers_csv(cues, out_base)

        _status("Escribiendo SRT...")
        with open(out_srt, "w", encoding="utf-8") as f:
            f.write(cues_to_srt(cues))

        return (
            out_srt,
            out_base + "_words.txt",
            out_base + "_words.csv",
            out_cues_debug,
            subs_speakers_csv,
            speakers_map_path
        )

    finally:
        # 1) Soltar referencias grandes
        model = None
        audio_arr = None
        result = None
        word_segments_raw = None
        diar_segs = None
        words = None
        cues = None

        # 2) Forzar GC (RAM)
        try:
            gc.collect()
        except Exception:
            pass

        # 3) Liberar caché GPU (si aplica)
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

        # 4) Borrar temporales
        try:
            if tmp_dir:
                shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
