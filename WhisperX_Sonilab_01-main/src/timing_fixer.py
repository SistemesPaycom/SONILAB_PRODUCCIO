# -*- coding: utf-8 -*-
"""
timing_fixer.py — Port de WhisperTimingFixer de SubtitleEdit a Python.

Ajusta los tiempos de inicio/fin de cada subtítulo buscando silencios reales
en la forma de onda del audio (waveform). Esto corrige el desfase típico
de Whisper/WhisperX donde los timestamps no coinciden con los bordes
reales del habla.

Algoritmo (basado en SubtitleEdit ShortenViaWavePeaks):
1. Para cada subtítulo, mira si el punto de inicio cae en silencio o sonido.
2. Si hay sonido, busca el silencio más cercano (±250ms) y ajusta.
3. Si hay silencio, avanza hasta encontrar el inicio real del habla.
4. Repite para el punto de fin (busca el fin real del habla).
5. Garantiza duración mínima (600ms) — si se recorta demasiado, revierte.

Requiere: numpy (para leer el WAV y calcular energía por ventanas).
"""

from __future__ import annotations

import numpy as np
from typing import Dict, List, Optional, Tuple


# ============================================================
# WavePeakData: calcula peaks absolutos del audio
# ============================================================

class WavePeakData:
    """
    Almacena los valores absolutos de las muestras de audio
    y permite consultar la "energía" (porcentaje del pico global)
    en cualquier rango de tiempo.
    """

    def __init__(self, samples: np.ndarray, sample_rate: int):
        """
        samples: array 1D de float32/int16 con las muestras mono.
        sample_rate: frecuencia de muestreo (normalmente 16000).
        """
        # Convertir a float y valor absoluto
        self.peaks = np.abs(samples.astype(np.float64))
        self.sample_rate = sample_rate
        self.highest_peak = float(np.max(self.peaks)) if len(self.peaks) > 0 else 1.0
        if self.highest_peak < 1e-10:
            self.highest_peak = 1.0  # evitar div/0 en audio mudo

    @classmethod
    def from_wav_file(cls, wav_path: str) -> "WavePeakData":
        """Carga un WAV mono 16kHz y crea WavePeakData."""
        import wave
        with wave.open(wav_path, "rb") as wf:
            sr = wf.getframerate()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64)
        return cls(samples, sr)

    @classmethod
    def from_numpy_audio(cls, audio_arr: np.ndarray, sample_rate: int = 16000) -> "WavePeakData":
        """
        Crea WavePeakData desde un array numpy (como el que devuelve whisperx.load_audio).
        audio_arr suele ser float32 normalizado a [-1, 1].
        """
        # Escalar a rango int16 para compatibilidad con el algoritmo de SubtitleEdit
        if audio_arr.dtype in (np.float32, np.float64):
            scaled = (audio_arr * 32768.0).astype(np.float64)
        else:
            scaled = audio_arr.astype(np.float64)
        return cls(scaled, sample_rate)


def _seconds_to_sample_index(seconds: float, sample_rate: int) -> int:
    return int(round(seconds * sample_rate))


def _find_percentage(start_seconds: float, end_seconds: float, wave_peaks: WavePeakData) -> float:
    """
    Calcula el porcentaje de energía sonora en un rango de tiempo.
    Devuelve un valor 0-100 donde < 7% se considera silencio.
    Devuelve -1 si el rango está fuera del audio.

    Fórmula (de SubtitleEdit):
        pct = (promedio + 2*máximo) / 3
    donde ambos valores son porcentajes respecto al pico global.
    """
    idx_min = max(0, _seconds_to_sample_index(start_seconds, wave_peaks.sample_rate))
    idx_max = min(len(wave_peaks.peaks), _seconds_to_sample_index(end_seconds, wave_peaks.sample_rate))

    if idx_min >= idx_max or idx_min >= len(wave_peaks.peaks):
        return -1.0

    chunk = wave_peaks.peaks[idx_min:idx_max]
    if len(chunk) == 0:
        return -1.0

    avg_val = float(np.mean(chunk))
    max_val = float(np.max(chunk))

    pct_avg = (avg_val * 100.0) / wave_peaks.highest_peak
    pct_max = (max_val * 100.0) / wave_peaks.highest_peak

    return (pct_avg + pct_max + pct_max) / 3.0


# ============================================================
# Ajuste de START de cada subtítulo
# ============================================================

def _adjust_start_time(
    start: float,
    end: float,
    prev_end: float,
    wave_peaks: WavePeakData,
    pct_threshold: float = 7.0,
    search_range_ms: int = 255,
    step_ms: int = 50,
    fine_step: float = 0.025,
) -> float:
    """
    Ajusta el tiempo de inicio de un subtítulo basándose en la forma de onda.

    Fase 1: Si el inicio cae en sonido (>threshold), busca el silencio más
            cercano hacia atrás y hacia adelante (hasta search_range_ms).
    Fase 2: Si el inicio cae en silencio (<threshold), avanza hasta
            encontrar el inicio real del sonido.
    """
    original_start = start

    # --- Fase 1: buscar silencio cercano si estamos en sonido ---
    pct_here = _find_percentage(start - 0.05, start + 0.05, wave_peaks)
    if abs(pct_here - (-1.0)) < 0.01:
        return start  # fuera de rango

    if pct_here > pct_threshold:
        start_back = start
        start_forward = start

        for ms in range(step_ms, search_range_ms, step_ms):
            # Buscar hacia atrás
            pct_back = _find_percentage(start_back - 0.05, start_back + 0.05, wave_peaks)
            if abs(pct_back - (-1.0)) < 0.01:
                return start

            if pct_back < pct_threshold + 1.0 and (end - start) < 5.0:
                # Afinar con paso fino
                test_pos = start_back - fine_step
                pct2 = _find_percentage(test_pos - 0.05, test_pos + 0.05, wave_peaks)
                if pct2 < pct_back and pct2 >= 0:
                    candidate = max(0.0, test_pos)
                else:
                    candidate = max(0.0, test_pos + fine_step)

                if candidate > prev_end:
                    start = candidate
                break

            start_back -= 0.05

            # Buscar hacia adelante
            pct_fwd = _find_percentage(start_forward - 0.05, start_forward + 0.05, wave_peaks)
            if abs(pct_fwd - (-1.0)) < 0.01:
                return start

            if pct_fwd < pct_threshold:
                test_pos = start_forward - fine_step
                pct2 = _find_percentage(test_pos - 0.05, test_pos + 0.05, wave_peaks)
                if pct2 < pct_fwd and pct2 >= 0:
                    start = test_pos
                else:
                    start = test_pos + fine_step
                break

            start_forward += 0.05

    # --- Fase 2: si estamos en silencio, avanzar hasta el sonido ---
    pct_here = _find_percentage(start - 0.05, start + 0.05, wave_peaks)
    if abs(pct_here - (-1.0)) < 0.01:
        return start

    if pct_here < pct_threshold:
        pos_forward = start
        while pct_here < pct_threshold and pos_forward < end - 1.0:
            pct_here = _find_percentage(pos_forward - 0.05, pos_forward + 0.05, wave_peaks)
            if abs(pct_here - (-1.0)) < 0.01:
                return original_start

            start = pos_forward
            if pct_here >= pct_threshold:
                # Afinar: retroceder un poco para "morder" el inicio
                test_pos = pos_forward - fine_step
                pct2 = _find_percentage(test_pos - 0.05, test_pos + 0.05, wave_peaks)
                if pct2 < pct_here and pct2 >= 0:
                    start -= fine_step
                    pct3 = _find_percentage(start - fine_step - 0.05, start - fine_step + 0.05, wave_peaks)
                    if pct3 < pct2 and pct3 >= 0:
                        start -= fine_step
                break

            pos_forward += 0.05

    return start


# ============================================================
# Ajuste de END de cada subtítulo
# ============================================================

def _adjust_end_time(
    start: float,
    end: float,
    next_start: float,
    wave_peaks: WavePeakData,
    pct_threshold: float = 7.0,
    search_range_ms: int = 255,
    step_ms: int = 50,
    fine_step: float = 0.025,
) -> float:
    """
    Ajusta el tiempo de fin de un subtítulo: busca el último punto con
    sonido real y recorta el silencio sobrante al final.
    """
    original_end = end

    # Comprobar si hay silencio en el punto de fin actual
    pct_here = _find_percentage(end - 0.05, end + 0.05, wave_peaks)
    if abs(pct_here - (-1.0)) < 0.01:
        return end

    if pct_here < pct_threshold:
        # Hay silencio al final → retroceder hasta encontrar sonido
        pos_back = end
        for ms in range(step_ms, search_range_ms + step_ms, step_ms):
            pos_back -= 0.05
            if pos_back <= start + 0.3:
                break  # no recortar demasiado

            pct_back = _find_percentage(pos_back - 0.05, pos_back + 0.05, wave_peaks)
            if abs(pct_back - (-1.0)) < 0.01:
                return end

            if pct_back >= pct_threshold:
                # Encontramos sonido: afinar
                test_pos = pos_back + fine_step
                pct2 = _find_percentage(test_pos - 0.05, test_pos + 0.05, wave_peaks)
                if pct2 >= pct_threshold:
                    end = test_pos + fine_step  # un poco de margen
                else:
                    end = pos_back + fine_step
                break

    # No dejar que el end invada el siguiente subtítulo
    if next_start > 0 and end > next_start - 0.08:
        end = min(end, next_start - 0.08)

    # Margen mínimo: no recortar por debajo de start + 0.3
    end = max(end, start + 0.3)

    return end


# ============================================================
# API pública: shorten_via_wave_peaks
# ============================================================

def shorten_via_wave_peaks(
    cues: List[Dict],
    wave_peaks: WavePeakData,
    min_duration_ms: float = 600.0,
    pct_threshold: float = 7.0,
) -> List[Dict]:
    """
    Ajusta los tiempos de inicio y fin de cada cue basándose en
    la forma de onda del audio (detección de silencios reales).

    Port fiel del WhisperTimingFixer.ShortenViaWavePeaks de SubtitleEdit.

    Parámetros:
        cues: lista de dicts con al menos 'start' y 'end' (en segundos).
        wave_peaks: datos de picos de la forma de onda.
        min_duration_ms: duración mínima de un subtítulo (ms). Si al ajustar
                         queda más corto, se revierte al original.
        pct_threshold: umbral de "silencio" (porcentaje del pico global).
                       Por defecto 7.0 (como SubtitleEdit).

    Retorna:
        Lista de cues con start/end ajustados.
    """
    if not cues or wave_peaks is None:
        return cues

    result = []
    for idx, cue in enumerate(cues):
        c = dict(cue)  # copia
        old_start = float(c["start"])
        old_end = float(c["end"])

        prev_end = float(result[-1]["end"]) if result else -1.0
        next_start = float(cues[idx + 1]["start"]) if idx + 1 < len(cues) else -1.0

        # Ajustar START
        new_start = _adjust_start_time(
            old_start, old_end, prev_end, wave_peaks, pct_threshold
        )

        # Ajustar END
        new_end = _adjust_end_time(
            new_start, old_end, next_start, wave_peaks, pct_threshold
        )

        # Validar duración mínima
        duration_ms = (new_end - new_start) * 1000.0
        if duration_ms < min_duration_ms:
            # Revertir: los timestamps originales son mejores que un subtítulo demasiado corto
            new_start = old_start
            new_end = old_end

        # Sanity checks
        if new_end <= new_start:
            new_start = old_start
            new_end = old_end

        # No solapar con el anterior
        if result and new_start < float(result[-1]["end"]):
            new_start = float(result[-1]["end"]) + 0.01

        c["start"] = round(new_start, 3)
        c["end"] = round(new_end, 3)
        result.append(c)

    return result


def shorten_long_duration(
    cues: List[Dict],
    max_duration_ms: float = 7000.0,
) -> List[Dict]:
    """
    Recorta subtítulos que excedan la duración máxima.
    A diferencia de SubtitleEdit (que recorta el inicio), nosotros recortamos
    el final ya que el inicio suele estar mejor alineado tras shorten_via_wave_peaks.
    """
    result = []
    for cue in cues:
        c = dict(cue)
        duration_ms = (float(c["end"]) - float(c["start"])) * 1000.0
        if duration_ms > max_duration_ms:
            c["end"] = round(float(c["start"]) + max_duration_ms / 1000.0, 3)
        result.append(c)
    return result


# ============================================================
# Función de conveniencia: aplicar todo el post-procesado de timing
# ============================================================

def fix_timings_with_waveform(
    cues: List[Dict],
    wav_path: Optional[str] = None,
    audio_arr: Optional[np.ndarray] = None,
    sample_rate: int = 16000,
    min_duration_ms: float = 600.0,
    max_duration_ms: float = 7000.0,
    pct_threshold: float = 7.0,
    status_cb=None,
) -> List[Dict]:
    """
    Función principal: carga el audio y aplica el ajuste de timings.

    Parámetros:
        cues: lista de subtítulos con 'start', 'end', 'text', etc.
        wav_path: ruta al archivo WAV (se usa si audio_arr es None).
        audio_arr: array numpy del audio (como whisperx.load_audio).
        sample_rate: frecuencia de muestreo del audio_arr.
        min_duration_ms: duración mínima de subtítulo.
        max_duration_ms: duración máxima de subtítulo.
        pct_threshold: umbral de silencio (0-100).
        status_cb: callback para logging.

    Retorna:
        Lista de cues con tiempos ajustados.
    """
    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    if not cues:
        return cues

    _status("Cargando datos de forma de onda para ajuste de timings...")

    if audio_arr is not None:
        wave_peaks = WavePeakData.from_numpy_audio(audio_arr, sample_rate)
    elif wav_path is not None:
        wave_peaks = WavePeakData.from_wav_file(wav_path)
    else:
        _status("No se proporcionó audio para ajuste de timings. Saltando.")
        return cues

    _status(f"Forma de onda: {len(wave_peaks.peaks)} muestras, "
            f"pico máximo={wave_peaks.highest_peak:.0f}, "
            f"sample_rate={wave_peaks.sample_rate}")

    _status("Ajustando tiempos de inicio/fin contra silencios reales...")
    cues = shorten_via_wave_peaks(cues, wave_peaks, min_duration_ms, pct_threshold)

    _status("Recortando subtítulos con duración excesiva...")
    cues = shorten_long_duration(cues, max_duration_ms)

    _status(f"Ajuste de timings completado para {len(cues)} subtítulos.")
    return cues
