# -*- coding: utf-8 -*-
"""
torch_patch.py — parches de compatibilidad PyTorch

Evita errores típicos al cargar checkpoints antiguos con torch.load y 'weights_only',
añadiendo safe globals cuando la versión de torch lo soporta.
"""

from __future__ import annotations


def patch_torch_safe_globals() -> None:
    try:
        import torch
        import builtins
        import typing

            # --- Fix PyTorch weights_only (pyannote / lightning checkpoints) ---
        try:
            import torch
            import torch.serialization

            # Clases que aparecen en checkpoints de pyannote/omegaconf
            from torch.torch_version import TorchVersion
            from omegaconf import ListConfig, DictConfig

            torch.serialization.add_safe_globals([TorchVersion, ListConfig, DictConfig])
        except Exception:
            pass

        if hasattr(torch, "serialization") and hasattr(torch.serialization, "add_safe_globals"):
            safe = [builtins.list, builtins.dict, builtins.tuple, builtins.set]

            # OmegaConf objects sometimes appear in checkpoints
            try:
                from omegaconf.listconfig import ListConfig
                safe.append(ListConfig)
            except Exception:
                pass
            try:
                from omegaconf.dictconfig import DictConfig
                safe.append(DictConfig)
            except Exception:
                pass
            try:
                from omegaconf.base import ContainerMetadata
                safe.append(ContainerMetadata)
            except Exception:
                pass

            try:
                safe.append(typing.Any)
            except Exception:
                pass

            torch.serialization.add_safe_globals(safe)

    except Exception:
        pass
