# -*- coding: utf-8 -*-
"""
hf_env.py — Configuración de cachés HuggingFace y modo offline

Objetivo:
- Alinear HF_HOME/HF_HUB_CACHE/HF_ASSETS_CACHE/TRANSFORMERS_CACHE con tu estructura existente:
    D:\Whisper_Sonilab\hf_cache\hub
    D:\Whisper_Sonilab\hf_cache\assets
    D:\Whisper_Sonilab\hf_cache\token
    D:\Whisper_Sonilab\hf_cache\stored_tokens
- Permitir modo offline (servidor sin Internet) sin que intente “llamar a casa”.
"""

from __future__ import annotations

import os


def configure_local_caches(cache_root: str) -> None:
    """
    Si cache_root YA contiene 'hub' (estructura tipo hf_cache real),
    usa directamente ese root como HF_HOME.

    Si NO contiene 'hub', usa modo portable creando cache_root\\huggingface\\hub etc.
    """
    try:
        os.makedirs(cache_root, exist_ok=True)

        has_hub = os.path.isdir(os.path.join(cache_root, "hub"))
        has_assets = os.path.isdir(os.path.join(cache_root, "assets"))

        if has_hub:
            hf_home = cache_root
        else:
            hf_home = os.path.join(cache_root, "huggingface")
            os.makedirs(hf_home, exist_ok=True)

        # Torch cache siempre dentro del root (no molesta aunque sea hf_cache real)
        torch_home = os.path.join(cache_root, "torch")
        os.makedirs(torch_home, exist_ok=True)

        hub_dir = os.path.join(hf_home, "hub")
        assets_dir = os.path.join(hf_home, "assets") if (has_hub or has_assets) else os.path.join(hf_home, "assets")
        tfm_dir = os.path.join(hf_home, "transformers")

        os.makedirs(hub_dir, exist_ok=True)
        os.makedirs(assets_dir, exist_ok=True)
        os.makedirs(tfm_dir, exist_ok=True)

        # Variables HF/hub
        os.environ.setdefault("HF_HOME", hf_home)
        os.environ.setdefault("HF_HUB_CACHE", hub_dir)
        os.environ.setdefault("HF_ASSETS_CACHE", assets_dir)
        os.environ.setdefault("TRANSFORMERS_CACHE", tfm_dir)

        # Tokens (alineado con hf cli cuando cache_root es hf_cache real)
        os.environ.setdefault("HF_TOKEN_PATH", os.path.join(cache_root, "token"))
        os.environ.setdefault("HF_STORED_TOKENS_PATH", os.path.join(cache_root, "stored_tokens"))

        # Miscelánea
        os.environ.setdefault("XDG_CACHE_HOME", cache_root)
        os.environ.setdefault("TORCH_HOME", torch_home)

    except Exception:
        pass


def configure_offline_mode(enable: bool) -> None:
    """
    Fuerza modo sin red. Si falta algún modelo en caché, fallará (correcto).
    """
    if not enable:
        return
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def apply_hf_token(hf_token: str) -> None:
    """
    Exporta token a variables estándar (útil si librerías lo leen de env).
    """
    tok = (hf_token or "").strip()
    if not tok:
        return
    os.environ["HF_TOKEN"] = tok
    os.environ["HUGGINGFACE_HUB_TOKEN"] = tok


def report_cache_status(status_cb) -> None:
    """
    Mensajería útil para depurar “qué cache está usando”.
    """
    try:
        status_cb(f"HF_HOME = {os.environ.get('HF_HOME')}")
        status_cb(f"HF_HUB_CACHE = {os.environ.get('HF_HUB_CACHE')}")
        hub = os.environ.get("HF_HUB_CACHE") or ""
        if hub:
            p1 = os.path.join(hub, "models--pyannote--segmentation-3.0")
            p2 = os.path.join(hub, "models--pyannote--speaker-diarization-3.1")
            status_cb(f"pyannote/segmentation-3.0 en cache: {'OK' if os.path.isdir(p1) else 'NO'}")
            status_cb(f"pyannote/speaker-diarization-3.1 en cache: {'OK' if os.path.isdir(p2) else 'NO'}")
    except Exception:
        pass
