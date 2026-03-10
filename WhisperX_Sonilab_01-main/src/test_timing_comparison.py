#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_timing_comparison.py — Script de test para comparar calidad de timestamps.

Ejecuta el pipeline con diferentes configuraciones y compara los resultados:
1. WhisperX sin timing fix (baseline)
2. WhisperX con timing fix (mejora 1)
3. Faster-Whisper con timing fix (mejora 2)

Para cada configuración genera un SRT y métricas de calidad.

Uso:
    python test_timing_comparison.py --input video.mp4 --language es --profile VE

    # Solo WhisperX con/sin timing fix:
    python test_timing_comparison.py --input video.mp4 --language ca --profile VCAT --skip-faster-whisper

    # Con referencia SRT manual para calcular precisión:
    python test_timing_comparison.py --input video.mp4 --reference manual.srt
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Añadir src al path
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)


# ============================================================
# Parser de SRT
# ============================================================

def parse_srt(srt_text: str) -> List[Dict]:
    """Parsea un archivo SRT y devuelve lista de cues."""
    cues = []
    blocks = re.split(r"\n\n+", srt_text.strip())

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue

        # Buscar línea de timecode
        tc_line = None
        text_lines = []
        for i, line in enumerate(lines):
            if "-->" in line:
                tc_line = line.strip()
                text_lines = lines[i + 1:]
                break

        if not tc_line:
            continue

        match = re.match(
            r"(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})",
            tc_line,
        )
        if not match:
            continue

        start = _srt_time_to_seconds(match.group(1))
        end = _srt_time_to_seconds(match.group(2))
        text = "\n".join(text_lines).strip()

        cues.append({"start": start, "end": end, "text": text})

    return cues


def _srt_time_to_seconds(tc: str) -> float:
    tc = tc.replace(",", ".")
    parts = tc.split(":")
    h = int(parts[0])
    m = int(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s


# ============================================================
# Métricas de calidad de timestamps
# ============================================================

def compute_metrics(cues: List[Dict]) -> Dict:
    """
    Calcula métricas de calidad de timestamps para un SRT.
    """
    if not cues:
        return {"error": "No cues"}

    durations = [c["end"] - c["start"] for c in cues]
    gaps = []
    overlaps = 0
    for i in range(len(cues) - 1):
        gap = cues[i + 1]["start"] - cues[i]["end"]
        gaps.append(gap)
        if gap < 0:
            overlaps += 1

    # CPS (caracteres por segundo)
    cps_values = []
    for c in cues:
        dur = c["end"] - c["start"]
        if dur > 0:
            chars = len(c["text"].replace("\n", ""))
            cps_values.append(chars / dur)

    very_short = sum(1 for d in durations if d < 0.5)
    very_long = sum(1 for d in durations if d > 7.0)
    negative_gaps = sum(1 for g in gaps if g < 0)
    tiny_gaps = sum(1 for g in gaps if 0 <= g < 0.08)

    metrics = {
        "total_cues": len(cues),
        "avg_duration": round(sum(durations) / len(durations), 3),
        "min_duration": round(min(durations), 3),
        "max_duration": round(max(durations), 3),
        "very_short_cues": very_short,
        "very_long_cues": very_long,
        "avg_gap": round(sum(gaps) / len(gaps), 3) if gaps else 0,
        "overlapping_cues": overlaps,
        "tiny_gap_cues": tiny_gaps,
        "avg_cps": round(sum(cps_values) / len(cps_values), 1) if cps_values else 0,
        "max_cps": round(max(cps_values), 1) if cps_values else 0,
    }

    return metrics


def compare_with_reference(generated: List[Dict], reference: List[Dict]) -> Dict:
    """
    Compara timestamps generados con una referencia manual.
    Calcula el error medio de inicio y fin.
    """
    if not generated or not reference:
        return {"error": "No data for comparison"}

    # Matching por texto similar (fuzzy)
    start_errors = []
    end_errors = []
    matched = 0

    for ref_cue in reference:
        ref_text = ref_cue["text"].lower().strip()
        best_match = None
        best_ratio = 0.0

        for gen_cue in generated:
            gen_text = gen_cue["text"].lower().strip()
            # Simple similarity: jaccard de palabras
            ref_words = set(ref_text.split())
            gen_words = set(gen_text.split())
            if not ref_words or not gen_words:
                continue
            intersection = ref_words & gen_words
            union = ref_words | gen_words
            ratio = len(intersection) / len(union)
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = gen_cue

        if best_match and best_ratio > 0.5:
            matched += 1
            start_errors.append(abs(best_match["start"] - ref_cue["start"]))
            end_errors.append(abs(best_match["end"] - ref_cue["end"]))

    return {
        "matched_cues": matched,
        "total_reference": len(reference),
        "match_rate": round(matched / len(reference) * 100, 1) if reference else 0,
        "avg_start_error_ms": round(sum(start_errors) / len(start_errors) * 1000, 0) if start_errors else 0,
        "avg_end_error_ms": round(sum(end_errors) / len(end_errors) * 1000, 0) if end_errors else 0,
        "max_start_error_ms": round(max(start_errors) * 1000, 0) if start_errors else 0,
        "max_end_error_ms": round(max(end_errors) * 1000, 0) if end_errors else 0,
        "median_start_error_ms": round(sorted(start_errors)[len(start_errors) // 2] * 1000, 0) if start_errors else 0,
        "median_end_error_ms": round(sorted(end_errors)[len(end_errors) // 2] * 1000, 0) if end_errors else 0,
    }


# ============================================================
# Ejecutar pipeline
# ============================================================

def run_pipeline_config(
    input_path: str,
    profile: str,
    language: Optional[str],
    model_size: str,
    device: str,
    hf_token: str,
    engine: str,
    enable_timing_fix: bool,
    label: str,
    diarization: bool = False,
) -> Tuple[Optional[str], float]:
    """
    Ejecuta el pipeline con una configuración y retorna (srt_path, elapsed_seconds).
    """
    from pipeline import pipeline_generate
    from rules import SubtitleRules

    rules = SubtitleRules()
    rules.enable_diarization = diarization

    start_time = time.time()

    def status_cb(msg: str):
        print(f"  [{label}] {msg}", flush=True)

    try:
        outputs = pipeline_generate(
            input_path,
            rules,
            profile,
            language,
            model_size,
            batch_size=8,
            hf_token=hf_token,
            device_pref=device,
            offline_mode=False,
            status_cb=status_cb,
            engine=engine,
            enable_timing_fix=enable_timing_fix,
        )
        elapsed = time.time() - start_time
        return outputs[0], elapsed  # out_srt, elapsed

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"  [{label}] ERROR: {e}", flush=True)
        return None, elapsed


# ============================================================
# Main
# ============================================================

def main():
    p = argparse.ArgumentParser(description="Comparar calidad de timestamps entre configuraciones")
    p.add_argument("--input", required=True, help="Ruta del video/audio")
    p.add_argument("--reference", default="", help="SRT de referencia manual (opcional)")
    p.add_argument("--profile", default="VE", help="Perfil: VE / VCAT")
    p.add_argument("--language", default="", help="Idioma (ej: es, ca)")
    p.add_argument("--model", default="small", help="Modelo para WhisperX")
    p.add_argument("--fw-model", default="large-v3-turbo", help="Modelo para Faster-Whisper")
    p.add_argument("--device", default="cpu", help="cpu o cuda")
    p.add_argument("--hf_token", default="", help="HuggingFace token")
    p.add_argument("--skip-faster-whisper", action="store_true", help="No probar Faster-Whisper")
    p.add_argument("--output-dir", default="", help="Carpeta para guardar SRTs de comparación")
    args = p.parse_args()

    input_path = str(Path(args.input).resolve())
    language = args.language.strip().lower() or None
    profile = args.profile.strip().upper()

    print("=" * 70)
    print("TEST DE COMPARACIÓN DE TIMESTAMPS")
    print("=" * 70)
    print(f"Input: {input_path}")
    print(f"Profile: {profile} | Language: {language or 'auto'}")
    print(f"Device: {args.device}")
    print()

    results = {}

    # --- Config 1: WhisperX sin timing fix ---
    print("-" * 50)
    print("CONFIG 1: WhisperX SIN timing fix (baseline)")
    print("-" * 50)
    srt_1, time_1 = run_pipeline_config(
        input_path, profile, language, args.model, args.device,
        args.hf_token, engine="whisperx", enable_timing_fix=False,
        label="BASELINE",
    )
    if srt_1:
        with open(srt_1, "r", encoding="utf-8") as f:
            cues_1 = parse_srt(f.read())
        results["1_whisperx_no_fix"] = {
            "srt": srt_1,
            "time_s": round(time_1, 1),
            "metrics": compute_metrics(cues_1),
        }
    print()

    # --- Config 2: WhisperX CON timing fix ---
    print("-" * 50)
    print("CONFIG 2: WhisperX CON timing fix")
    print("-" * 50)
    srt_2, time_2 = run_pipeline_config(
        input_path, profile, language, args.model, args.device,
        args.hf_token, engine="whisperx", enable_timing_fix=True,
        label="WHISPERX+FIX",
    )
    if srt_2:
        with open(srt_2, "r", encoding="utf-8") as f:
            cues_2 = parse_srt(f.read())
        results["2_whisperx_with_fix"] = {
            "srt": srt_2,
            "time_s": round(time_2, 1),
            "metrics": compute_metrics(cues_2),
        }
    print()

    # --- Config 3: Faster-Whisper CON timing fix ---
    if not args.skip_faster_whisper:
        print("-" * 50)
        print(f"CONFIG 3: Faster-Whisper ({args.fw_model}) CON timing fix")
        print("-" * 50)
        srt_3, time_3 = run_pipeline_config(
            input_path, profile, language, args.fw_model, args.device,
            args.hf_token, engine="faster-whisper", enable_timing_fix=True,
            label="FW+FIX",
        )
        if srt_3:
            with open(srt_3, "r", encoding="utf-8") as f:
                cues_3 = parse_srt(f.read())
            results["3_faster_whisper_with_fix"] = {
                "srt": srt_3,
                "time_s": round(time_3, 1),
                "metrics": compute_metrics(cues_3),
            }
        print()

    # --- Comparación con referencia ---
    ref_cues = None
    if args.reference and os.path.isfile(args.reference):
        print("-" * 50)
        print("COMPARACIÓN CON REFERENCIA MANUAL")
        print("-" * 50)
        with open(args.reference, "r", encoding="utf-8") as f:
            ref_cues = parse_srt(f.read())
        print(f"Referencia: {len(ref_cues)} cues")

        for key, data in results.items():
            srt_path = data.get("srt")
            if srt_path:
                with open(srt_path, "r", encoding="utf-8") as f:
                    gen_cues = parse_srt(f.read())
                data["vs_reference"] = compare_with_reference(gen_cues, ref_cues)
        print()

    # --- Resumen ---
    print("=" * 70)
    print("RESUMEN DE RESULTADOS")
    print("=" * 70)

    for key, data in results.items():
        print(f"\n{'—' * 40}")
        print(f"  {key}")
        print(f"{'—' * 40}")
        print(f"  Tiempo ejecución: {data['time_s']}s")
        m = data.get("metrics", {})
        print(f"  Total cues: {m.get('total_cues', '?')}")
        print(f"  Duración media: {m.get('avg_duration', '?')}s")
        print(f"  Duración min/max: {m.get('min_duration', '?')}s / {m.get('max_duration', '?')}s")
        print(f"  Cues muy cortos (<0.5s): {m.get('very_short_cues', '?')}")
        print(f"  Cues muy largos (>7s): {m.get('very_long_cues', '?')}")
        print(f"  Solapamientos: {m.get('overlapping_cues', '?')}")
        print(f"  Gaps tiny (<80ms): {m.get('tiny_gap_cues', '?')}")
        print(f"  CPS medio/máximo: {m.get('avg_cps', '?')} / {m.get('max_cps', '?')}")

        if "vs_reference" in data:
            r = data["vs_reference"]
            print(f"  --- vs Referencia ---")
            print(f"  Match rate: {r.get('match_rate', '?')}%")
            print(f"  Error medio START: {r.get('avg_start_error_ms', '?')}ms")
            print(f"  Error medio END: {r.get('avg_end_error_ms', '?')}ms")
            print(f"  Error mediana START: {r.get('median_start_error_ms', '?')}ms")
            print(f"  Error máximo START: {r.get('max_start_error_ms', '?')}ms")

    # Guardar JSON
    output_dir = args.output_dir or os.path.dirname(input_path)
    json_path = os.path.join(output_dir, "timing_comparison_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nResultados guardados en: {json_path}")


if __name__ == "__main__":
    main()
