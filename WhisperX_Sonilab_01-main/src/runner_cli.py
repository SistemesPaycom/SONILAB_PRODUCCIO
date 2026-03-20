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

    p.add_argument(
        "--subtitle-edit-compat",
        dest="subtitle_edit_compat",
        action="store_true",
        default=False,
        help=(
            "Mode compatible Subtitle Edit: redueix l'agressivitat dels merges de cues "
            "per obtenir una sortida amb més cues i més curts, similar a Subtitle Edit. "
            "Desactiva el merge d'orfes i redueix el merge de cues petits a gap < 0.25s. "
            "Recomanat amb engine=purfview-xxl i model large-v3."
        )
    )

    p.add_argument(
        "--guion-snap",
        dest="guion_snap",
        action="store_true",
        default=False,
        help=(
            "Aplica guion_snap.py al SRT final usant el fitxer --script-file com a guió. "
            "Re-segmenta les fronteres del SRT per coincidir amb els ancoratges temporals "
            "del guió TXT SONILAB. Actiu per a qualsevol engine quan es passa --script-file."
        )
    )

    p.add_argument(
        "--guion-snap-tolerance",
        dest="guion_snap_tolerance",
        type=float,
        default=2.0,
        help="Temps màxim (s) per fer snap d'un start de cue a un ancoratge del guió. Default: 2.0"
    )

    p.add_argument(
        "--min-speakers",
        dest="min_speakers",
        type=int,
        default=None,
        help=(
            "Número mínim d'interlocutors per a la diarització pyannote. "
            "Si es coneix el nombre exacte, passar min=max=N. Default: auto-detecció."
        )
    )
    p.add_argument(
        "--max-speakers",
        dest="max_speakers",
        type=int,
        default=None,
        help=(
            "Número màxim d'interlocutors per a la diarització pyannote. "
            "Si es coneix el nombre exacte, passar min=max=N. Default: auto-detecció."
        )
    )

    args = p.parse_args()

    inp = Path(args.input).resolve()
    if not inp.exists():
        raise FileNotFoundError(f"No existe input: {inp}")

    # Reglas
    rules = SubtitleRules()
    rules.enable_diarization = bool(args.diarization)
    subtitle_edit_compat = getattr(args, 'subtitle_edit_compat', False)
    if subtitle_edit_compat:
        rules.subtitle_edit_compat = True

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

    # Mode subtitle_edit_compat: desactiva merge de línies al post-procesador
    # (el merge de cues ja es controla via rules.subtitle_edit_compat a cues.py)
    if subtitle_edit_compat:
        postprocess_merge = False

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
        min_speakers=getattr(args, 'min_speakers', None),
        max_speakers=getattr(args, 'max_speakers', None),
    )

    # Vuestro pipeline devuelve tupla de paths:
    # (out_srt, words_txt, words_csv, cues_debug_csv, subs_speakers_csv, speakers_map_path)
    out_srt, words_txt, words_csv, cues_debug_csv, subs_speakers_csv, speakers_map_path = outputs

    # ── GUION SNAP (opcional) ────────────────────────────────────────────────
    # Si s'ha passat --guion-snap i hi ha un --script-file, apliquem guion_snap.py
    # per re-segmentar el SRT final usant els ancoratges del guió TXT.
    # Només s'aplica per a engines que NO fan forced alignment (no script-align):
    # faster-whisper, purfview-xxl, whisperx.
    guion_snap = getattr(args, 'guion_snap', False)
    guion_snap_tolerance = getattr(args, 'guion_snap_tolerance', 2.0)
    do_guion_snap = (
        guion_snap
        and engine != 'script-align'
        and script_file
        and out_srt
        and Path(out_srt).exists()
    )

    if do_guion_snap:
        try:
            from guion_snap import _parse_srt, _load_guion_anchors, _snap_srt_to_guion, _write_srt as _ws

            print(f"[STATUS] Guion-snap: re-segmentant SRT amb ancoratges del guió...", flush=True)

            srt_raw_path = Path(out_srt)
            srt_snapped_path = srt_raw_path.with_suffix('.snapped.srt')

            srt_text_in = srt_raw_path.read_text(encoding='utf-8')
            cues_in = _parse_srt(srt_text_in)

            guion_text_for_snap = Path(script_file).read_text(encoding='utf-8')
            anchors = _load_guion_anchors(guion_text_for_snap)

            if anchors and cues_in:
                snapped = _snap_srt_to_guion(
                    cues_in,
                    anchors,
                    snap_tolerance=guion_snap_tolerance,
                    status_cb=status_cb,
                )
                srt_snapped_path.write_text(_ws(snapped), encoding='utf-8')
                # Substituir el SRT final pel snapped
                import shutil as _shutil
                _shutil.copy2(str(srt_snapped_path), out_srt)
                print(f"[STATUS] Guion-snap OK: {len(cues_in)} → {len(snapped)} cues", flush=True)
            else:
                print(f"[STATUS] Guion-snap: cap ancoratge detectat, SRT sense canvis", flush=True)

        except Exception as _snap_err:
            print(f"[WARN] Guion-snap ha fallat ({_snap_err}). SRT original mantingut.", flush=True)

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
        "subtitle_edit_compat": subtitle_edit_compat,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
