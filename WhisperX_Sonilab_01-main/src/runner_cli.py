import argparse
import json
import os
import shutil
import sys
from pathlib import Path

# Forzar UTF-8 en stdout/stderr para evitar UnicodeEncodeError en consolas cp1252 (Windows)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from pipeline import pipeline_generate
from rules import SubtitleRules


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Ruta del video/audio")
    p.add_argument("--output_dir", default="", help="Carpeta donde COPIAR el SRT final (opcional)")
    p.add_argument("--model", default="small", help="Modelo whisper: small/medium/large-v2/large-v3/large-v3-turbo...")
    p.add_argument("--profile", default="VE", help="Perfil: VE / VCAT (según vuestro pipeline)")
    p.add_argument("--language", default="", help="Idioma (ej: es). Vacío = auto")
    p.add_argument("--batch_size", type=int, default=8, help="Batch size (CPU: mejor 4-8)")
    p.add_argument("--device", default="cpu", help="cpu o cuda")
    p.add_argument("--hf_token", default="", help="HuggingFace token (necesario para diarización online)")
    p.add_argument("--offline", action="store_true", help="Forzar modo offline (usar caché local HF)")
    # Python 3.9+: permite --diarization / --no-diarization
    p.add_argument("--diarization", action=argparse.BooleanOptionalAction, default=True, help="Activar diarización")

    # =============== NUEVOS PARÁMETROS v2 ===============
    p.add_argument(
        "--engine",
        default="faster-whisper",
        choices=["whisperx", "faster-whisper", "purfview-xxl", "script-align"],
        help=(
            "Motor de transcripción:\n"
            "  whisperx      — WhisperX + align pyannote\n"
            "  faster-whisper — Faster-Whisper con word timestamps nativos\n"
            "  purfview-xxl  — Faster-Whisper + post-procesado SubtitleEdit\n"
            "  script-align  — Forced alignment con guion conocido (requiere --script-file)"
        )
    )
    p.add_argument(
        "--script-file",
        default="",
        help=(
            "Ruta al archivo de texto con el guion completo. "
            "Solo se usa con --engine script-align."
        )
    )
    p.add_argument(
        "--postprocess",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Activar post-procesado de texto (fix casing, periods, merge lines). "
             "Se activa automáticamente con engine=purfview-xxl."
    )
    p.add_argument(
        "--no-postprocess-casing",
        dest="postprocess_casing",
        action="store_false",
        default=True,
        help="Desactivar fix casing en el post-procesado."
    )
    p.add_argument(
        "--no-postprocess-periods",
        dest="postprocess_periods",
        action="store_false",
        default=True,
        help="Desactivar add_periods en el post-procesado."
    )
    p.add_argument(
        "--no-postprocess-merge",
        dest="postprocess_merge",
        action="store_false",
        default=True,
        help="Desactivar merge_short_lines en el post-procesado."
    )
    p.add_argument(
        "--no-postprocess-balance",
        dest="postprocess_balance",
        action="store_false",
        default=True,
        help="Desactivar balance_lines en el post-procesado."
    )
    p.add_argument(
        "--timing-fix",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Activar ajuste de timings por forma de onda (WhisperTimingFixer). "
             "Analiza el audio real para alinear inicio/fin de subtítulos a silencios."
    )
    p.add_argument(
        "--timing-fix-threshold",
        type=float,
        default=7.0,
        help="Umbral de silencio para timing fixer (0-100). Menor = más agresivo. Defecto: 7.0"
    )

    args = p.parse_args()

    inp = Path(args.input).resolve()
    if not inp.exists():
        raise FileNotFoundError(f"No existe input: {inp}")

    # Reglas
    rules = SubtitleRules()
    rules.enable_diarization = bool(args.diarization)

    profile = (args.profile or "").strip().upper()
    language = (args.language or "").strip().lower() or None
    model_size = (args.model or "small").strip()
    batch_size = int(args.batch_size)
    hf_token = (args.hf_token or os.getenv("HUGGINGFACE_HUB_TOKEN", "")).strip()
    device_pref = (args.device or "cpu").strip().lower()
    offline_mode = bool(args.offline)

    # Parámetros de motor y post-procesado
    engine = (args.engine or "faster-whisper").strip().lower()
    enable_timing_fix = bool(args.timing_fix)
    timing_fix_threshold = float(args.timing_fix_threshold)
    postprocess = bool(args.postprocess) or engine == "purfview-xxl"
    postprocess_casing = bool(args.postprocess_casing)
    postprocess_periods = bool(args.postprocess_periods)
    postprocess_merge = bool(args.postprocess_merge)
    postprocess_balance = bool(args.postprocess_balance)

    # Guion (para engine=script-align)
    script_text = ""
    script_file = (args.script_file or "").strip()
    if script_file:
        script_file_path = Path(script_file).resolve()
        if not script_file_path.exists():
            raise FileNotFoundError(f"No existe script-file: {script_file_path}")
        script_text = script_file_path.read_text(encoding="utf-8")
        print(f"[STATUS] Guion cargado desde {script_file_path} ({len(script_text)} chars)", flush=True)

    def status_cb(msg: str):
        # Esto lo puede leer Node luego si quieres (logs)
        print(f"[STATUS] {msg}", flush=True)

    outputs = pipeline_generate(
        str(inp),
        rules,
        profile,
        language,
        model_size,
        batch_size,
        hf_token,
        device_pref,
        offline_mode=offline_mode,
        status_cb=status_cb,
        engine=engine,
        script_text=script_text or None,
        enable_timing_fix=enable_timing_fix,
        timing_fix_threshold=timing_fix_threshold,
        postprocess=postprocess,
        postprocess_fix_casing=postprocess_casing,
        postprocess_add_periods=postprocess_periods,
        postprocess_merge_lines=postprocess_merge,
        postprocess_balance_lines=postprocess_balance,
    )

    # Vuestro pipeline devuelve tupla de paths:
    # (out_srt, words_txt, words_csv, cues_debug_csv, subs_speakers_csv, speakers_map_path)
    out_srt, words_txt, words_csv, cues_debug_csv, subs_speakers_csv, speakers_map_path = outputs

    copied = {}
    if args.output_dir:
        out_dir = Path(args.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        def _copy(path):
            if not path:
                return ""
            src = Path(path)
            if src.exists():
                dst = out_dir / src.name
                shutil.copy2(src, dst)
                return str(dst)
            return ""

        copied = {
            "srt": _copy(out_srt),
            "words_txt": _copy(words_txt),
            "words_csv": _copy(words_csv),
            "cues_debug_csv": _copy(cues_debug_csv),
            "subs_speakers_csv": _copy(subs_speakers_csv),
            "speakers_map_path": _copy(speakers_map_path),
        }

    # JSON final para integración con Nest
    result = {
        "out_srt": out_srt,
        "words_txt": words_txt,
        "words_csv": words_csv,
        "cues_debug_csv": cues_debug_csv,
        "subs_speakers_csv": subs_speakers_csv,
        "speakers_map_path": speakers_map_path,
        "copied": copied,
        "profile": profile,
        "language": language,
        "model": model_size,
        "device": device_pref,
        "offline": offline_mode,
        "diarization": bool(args.diarization),
        "engine": engine,
        "script_file": script_file,
        "timing_fix": enable_timing_fix,
        "timing_fix_threshold": timing_fix_threshold,
        "postprocess": postprocess,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
