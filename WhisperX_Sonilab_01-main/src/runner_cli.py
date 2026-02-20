import argparse
import json
import os
import shutil
from pathlib import Path

from pipeline import pipeline_generate
from rules import SubtitleRules


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Ruta del video/audio")
    p.add_argument("--output_dir", default="", help="Carpeta donde COPIAR el SRT final (opcional)")
    p.add_argument("--model", default="small", help="Modelo whisper: small/medium/large-v2...")
    p.add_argument("--profile", default="VE", help="Perfil: VE / VCAT (según vuestro pipeline)")
    p.add_argument("--language", default="", help="Idioma (ej: es). Vacío = auto")
    p.add_argument("--batch_size", type=int, default=8, help="Batch size (CPU: mejor 4-8)")
    p.add_argument("--device", default="cpu", help="cpu o cuda")
    p.add_argument("--hf_token", default="", help="HuggingFace token (necesario para diarización online)")
    p.add_argument("--offline", action="store_true", help="Forzar modo offline (usar caché local HF)")
    # Python 3.9+: permite --diarization / --no-diarization
    p.add_argument("--diarization", action=argparse.BooleanOptionalAction, default=True, help="Activar diarización")
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
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
