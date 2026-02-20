# -*- coding: utf-8 -*-
"""
mini_diarize.py
Diagnóstico mínimo WhisperX + DiarizationPipeline (pyannote)
- Fuerza language="es" para evitar autodetección
- Ejecuta diarización y exporta segmentos a CSV
- Incluye parche de compat use_auth_token -> token
"""

from __future__ import annotations

import os
import sys
import csv
import tempfile
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------
# Compat HF: use_auth_token -> token
# ---------------------------
def patch_hf_hub_use_auth_token_compat() -> None:
    try:
        import huggingface_hub
        from huggingface_hub import file_download as _fd  # type: ignore
    except Exception:
        return

    old_main = getattr(huggingface_hub, "hf_hub_download", None)
    old_fd = getattr(_fd, "hf_hub_download", None)
    if old_main is None or old_fd is None:
        return

    if getattr(old_main, "_hf_compat_patched", False) or getattr(old_fd, "_hf_compat_patched", False):
        return

    def hf_hub_download_compat(*args, use_auth_token=None, token=None, **kwargs):
        if token is None and use_auth_token not in (None, False):
            token = use_auth_token if use_auth_token is not True else None
        kwargs.pop("use_auth_token", None)
        return old_main(*args, token=token, **kwargs)

    setattr(hf_hub_download_compat, "_hf_compat_patched", True)

    huggingface_hub.hf_hub_download = hf_hub_download_compat  # type: ignore
    _fd.hf_hub_download = hf_hub_download_compat  # type: ignore

    for m in list(sys.modules.values()):
        if not m or not hasattr(m, "hf_hub_download"):
            continue
        try:
            cur = getattr(m, "hf_hub_download")
            if cur is old_main or cur is old_fd:
                setattr(m, "hf_hub_download", hf_hub_download_compat)
        except Exception:
            pass


# ---------------------------
# Extraer segmentos (Annotation/DataFrame/dict/list)
# ---------------------------
def safe_float(x, default=None):
    try:
        return float(x)
    except Exception:
        return default


def extract_segments(diar_res: Any) -> List[Dict]:
    segs: List[Dict] = []
    if diar_res is None:
        return segs

    # pyannote Annotation-like
    if hasattr(diar_res, "itertracks"):
        try:
            for segment, _, label in diar_res.itertracks(yield_label=True):
                st = safe_float(getattr(segment, "start", None), None)
                en = safe_float(getattr(segment, "end", None), None)
                if st is None or en is None or en <= st:
                    continue
                segs.append({"start": float(st), "end": float(en), "speaker": str(label) if label is not None else "UNK"})
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs
        except Exception:
            pass

    # pandas DataFrame-like
    if hasattr(diar_res, "iterrows"):
        try:
            for _, row in diar_res.iterrows():
                st = safe_float(getattr(row, "start", None) if hasattr(row, "start") else row.get("start", None), None)
                en = safe_float(getattr(row, "end", None) if hasattr(row, "end") else row.get("end", None), None)
                if st is None or en is None or en <= st:
                    continue
                spk = getattr(row, "speaker", None) if hasattr(row, "speaker") else row.get("speaker", None)
                spk = spk or (getattr(row, "label", None) if hasattr(row, "label") else row.get("label", None))
                segs.append({"start": float(st), "end": float(en), "speaker": str(spk) if spk is not None else "UNK"})
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs
        except Exception:
            pass

    # dict
    if isinstance(diar_res, dict):
        items = diar_res.get("segments") or diar_res.get("diarization") or diar_res.get("speaker_segments")
        if isinstance(items, list):
            for s in items:
                st = safe_float(s.get("start", None), None)
                en = safe_float(s.get("end", None), None)
                spk = s.get("speaker", None) or s.get("label", None) or "UNK"
                if st is None or en is None or en <= st:
                    continue
                segs.append({"start": float(st), "end": float(en), "speaker": str(spk)})
            segs.sort(key=lambda x: (x["start"], x["end"]))
            return segs

    # list
    if isinstance(diar_res, list):
        for s in diar_res:
            try:
                st = safe_float(s.get("start", None), None)
                en = safe_float(s.get("end", None), None)
                spk = s.get("speaker", None) or s.get("label", None) or "UNK"
                if st is None or en is None or en <= st:
                    continue
                segs.append({"start": float(st), "end": float(en), "speaker": str(spk)})
            except Exception:
                continue
        segs.sort(key=lambda x: (x["start"], x["end"]))
        return segs

    return segs


# ---------------------------
# Convertir a wav mono 16k con ffmpeg (si hace falta)
# ---------------------------
def to_wav_16k_mono(in_path: Path, out_wav: Path) -> None:
    cmd = [
        "ffmpeg", "-y",
        "-i", str(in_path),
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(out_wav),
    ]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("FFmpeg falló:\n" + (p.stderr or p.stdout or ""))


def main():
    print("=== mini_diarize ===")
    root = Path(__file__).resolve().parents[1]  # ...\Subtitols_Sonilab\
    print("ROOT:", root)

    in_path_str = input("Ruta del audio/vídeo (mp4/mkv/wav/mp3...): ").strip().strip('"')
    in_path = Path(in_path_str)
    if not in_path.exists():
        raise SystemExit(f"ERROR: no existe: {in_path}")

    hf_token = (os.getenv("HUGGINGFACE_HUB_TOKEN", "") or "").strip()
    if not hf_token:
        hf_token = input("HUGGINGFACE_HUB_TOKEN (dejar vacío para abortar): ").strip()
    if not hf_token:
        raise SystemExit("ERROR: token vacío (pyannote suele ser gated).")

    # Opcional: silenciar warning symlinks
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

    patch_hf_hub_use_auth_token_compat()

    import torch

    # --- PyTorch 2.6+ safe load (pyannote checkpoints) ---
    try:
        import torch.serialization
        from torch.torch_version import TorchVersion
        from omegaconf import ListConfig, DictConfig
        torch.serialization.add_safe_globals([TorchVersion, ListConfig, DictConfig])
    except Exception:
        pass

    import whisperx
    
    # --- PyTorch 2.6+ safe loading: allowlist OmegaConf types used by pyannote checkpoints ---
    try:
        from omegaconf.listconfig import ListConfig
        from omegaconf.dictconfig import DictConfig
        torch.serialization.add_safe_globals([ListConfig, DictConfig])
    except Exception:
        pass


    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    print("Device:", device, "Compute:", compute_type)

    with tempfile.TemporaryDirectory(prefix="mini_diar_") as td:
        td = Path(td)
        wav_path = td / "audio_16k_mono.wav"

        # si ya es wav, igualmente normalizamos (más estable)
        print("Normalizando a WAV 16k mono...")
        to_wav_16k_mono(in_path, wav_path)
        print("WAV:", wav_path)

        audio = whisperx.load_audio(str(wav_path))

        # ---- ASR (forzando idioma ES)
        print("Cargando WhisperX (large-v2) + transcribiendo language='es'...")
        # Forzamos Silero VAD para evitar cargar VAD de pyannote dentro del ASR
        try:
            model = whisperx.load_model(
                "large-v2",
                device=device,
                compute_type=compute_type,
                vad_method="silero",
                language="es",  # opcional, ayuda a evitar el log de autodetección
            )
        except TypeError:
            # Compat si tu versión no soporta vad_method/language aquí
            model = whisperx.load_model("large-v2", device=device, compute_type=compute_type)
        result = model.transcribe(audio, batch_size=8, language="es")
        print("Idioma devuelto por WhisperX:", result.get("language"))
        print("Segments ASR:", len(result.get("segments", [])))

        # ---- Diarización
        print("Cargando DiarizationPipeline y diarizando...")
        DP = getattr(whisperx, "DiarizationPipeline", None)
        if DP is None:
            from whisperx.diarize import DiarizationPipeline as DP  # type: ignore

        diar = DP(use_auth_token=hf_token, device=device)
        diar_res = diar(str(wav_path))

        segs = extract_segments(diar_res)
        print("Segmentos diarización:", len(segs))
        uniq = sorted({s.get("speaker") for s in segs})
        print("Speakers únicos:", uniq[:20], ("..." if len(uniq) > 20 else ""))
        print("N speakers:", len(uniq))

        out_csv = root / "output" / (in_path.stem + "_mini_diar_segments.csv")
        out_csv.parent.mkdir(parents=True, exist_ok=True)
        with open(out_csv, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["start", "end", "speaker"])
            for s in segs:
                w.writerow([f"{s['start']:.3f}", f"{s['end']:.3f}", s.get("speaker", "UNK")])

        print("OK ->", out_csv)


if __name__ == "__main__":
    main()
