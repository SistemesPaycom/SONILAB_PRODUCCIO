# Subtítols Sonilab (WhisperX) — VE/VCAT + Interlocutores

Herramienta interna para generar subtítulos `.srt` a partir de vídeo o audio usando **WhisperX**, aplicando reglas de subtitulado (VE/VCAT) y, opcionalmente, **diarización** para interlocutores.

> Objetivo: acelerar el trabajo del subtitulador humano con un primer borrador de alta calidad.

---

## Características

- Genera **SRT** (`*_subs.srt`) en `output/`.
- Reglas configurables:
  - Máx. líneas
  - Máx. caracteres por línea
  - CPS máx.
  - Duración mínima / máxima
  - Pausa mínima entre subtítulos
  - (Opcional) pausa máx. entre palabras dentro del cue
- Perfiles: **VE** / **VCAT**
- Idioma de transcripción seleccionable (o autodetección si se usa `None`).
- Diarización opcional (pyannote) para asignar **InterlocutorXX**.
- Modo **offline por defecto** (no se comunica con internet salvo que lo habilites explícitamente en tu integración futura).

---

## Estructura del proyecto

- `src/gui.py` — Interfaz Tkinter (usuario final).
- `src/pipeline.py` — Pipeline principal (extracción audio, transcripción, align, cues, SRT).
- `src/whisperx_ops.py` — Wrappers de compatibilidad para distintas versiones de WhisperX.
- `src/rules.py` — Reglas y perfiles (VE/VCAT).
- `src/cues.py` — Lógica de cues (split/merge/timings/formato).
- `src/diarization.py` — Diarización y mapeo de speakers (opcional).
- `src/debug_io.py` — Salidas de debug (CSV/TXT) (actualmente desactivadas en el pipeline).

---

## Requisitos

- Windows 10/11 recomendado (probado con PowerShell).
- Python 3.10+ (recomendado).  
- FFmpeg accesible por sistema (o instalado por dependencia según tu setup).
- GPU NVIDIA opcional (CUDA) para acelerar transcripción/alineado.

> Nota: si usas diarización con pyannote y estás en offline, los modelos deben estar ya cacheados.

---

## Instalación (ejemplo)

1) Crear y activar un entorno virtual:

```bash
python -m venv .venv
.\.venv\Scripts\activate
