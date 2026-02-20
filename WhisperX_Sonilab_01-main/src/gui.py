# -*- coding: utf-8 -*-
"""
gui.py — Interfaz gráfica (Tkinter).
Separa completamente lo visual del pipeline.
"""

import os
import queue
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk

from rules import (
    SubtitleRules,
    LANG_LABELS,
    LANG_LABEL_TO_CODE,
    DEFAULT_LANG_LABEL_VE,
    DEFAULT_LANG_LABEL_VCAT,
)
from pipeline import pipeline_generate


def select_video_file() -> str:
    return filedialog.askopenfilename(
        title="Selecciona un archivo de vídeo o audio",
        filetypes=[
            ("Media", "*.mp4;*.avi;*.mkv;*.mov;*.wav;*.mp3;*.m4a;*.flac"),
            ("All Files", "*.*"),
        ],
    )


def launch_gui():
    root = tk.Tk()
    root.title("Subtítols Sonilab (WhisperX) - VE/VCAT + Interlocutores")
    root.geometry("820x640")

    main = tk.Frame(root, padx=12, pady=12)
    main.pack(fill="both", expand=True)

    # ---- general
    top = tk.LabelFrame(main, text="Configuración general", padx=10, pady=10)
    top.pack(fill="x")

    tk.Label(top, text="Perfil:").grid(row=0, column=0, sticky="w")
    profile_var = tk.StringVar(value="VE")
    tk.OptionMenu(top, profile_var, "VE", "VCAT").grid(row=0, column=1, sticky="w", padx=(8, 24))

    tk.Label(top, text="Idioma (transcripción):").grid(row=0, column=2, sticky="w")
    lang_var = tk.StringVar(value=DEFAULT_LANG_LABEL_VE)
    lang_combo = ttk.Combobox(top, textvariable=lang_var, values=LANG_LABELS, state="readonly", width=22)
    lang_combo.grid(row=0, column=3, sticky="w", padx=(8, 0))

    tk.Label(top, text="Modelo:").grid(row=1, column=0, sticky="w", pady=(10, 0))
    model_var = tk.StringVar(value="large-v2")
    tk.OptionMenu(top, model_var, "tiny", "base", "small", "medium", "large-v2").grid(
        row=1, column=1, sticky="w", padx=(8, 24), pady=(10, 0)
    )

    tk.Label(top, text="Batch size:").grid(row=1, column=2, sticky="w", pady=(10, 0))
    batch_entry = tk.Entry(top, width=8)
    batch_entry.grid(row=1, column=3, sticky="w", padx=(8, 0), pady=(10, 0))
    batch_entry.insert(0, "8")

    tk.Label(top, text="Device:").grid(row=2, column=0, sticky="w", pady=(10, 0))
    device_var = tk.StringVar(value="auto")
    tk.OptionMenu(top, device_var, "auto", "cuda", "cpu").grid(row=2, column=1, sticky="w", padx=(8, 24), pady=(10, 0))

    tk.Label(top, text="HF_TOKEN (para diarización):").grid(row=3, column=0, sticky="w", pady=(10, 0))
    hf_token_entry = tk.Entry(top, width=55)
    hf_token_entry.grid(row=3, column=1, columnspan=3, sticky="w", padx=(8, 0), pady=(10, 0))

    hf_token_entry.configure(state="disabled")  # bloqueado (offline fijo)

    offline_var = tk.BooleanVar(value=True)

    offline_chk = tk.Checkbutton(
        top,
        text="Modo offline (sin internet)",
        variable=offline_var
    )
    offline_chk.grid(row=2, column=2, columnspan=2, sticky="w", pady=(10, 0))

    offline_chk.configure(state="disabled")  # bloqueado

    note = tk.Label(
        top,
        text="Nota: si HF_TOKEN está vacío, no habrá interlocutores salvo que estés en offline y los modelos pyannote estén ya cacheados.",
        fg="#444",
        wraplength=700,
        justify="left",
    )
    note.grid(row=4, column=0, columnspan=4, sticky="w", pady=(8, 0))

    # ---- normativa
    norm = tk.LabelFrame(main, text="Normativa / Lógica", padx=10, pady=10)
    norm.pack(fill="x", pady=(12, 0))

    r = 0
    tk.Label(norm, text="Máx. líneas:").grid(row=r, column=0, sticky="w")
    lines_entry = tk.Entry(norm, width=10)
    lines_entry.grid(row=r, column=1, sticky="w", padx=(8, 24))
    lines_entry.insert(0, "2")

    tk.Label(norm, text="Máx. caracteres por línea:").grid(row=r, column=2, sticky="w")
    chars_entry = tk.Entry(norm, width=10)
    chars_entry.grid(row=r, column=3, sticky="w", padx=(8, 0))
    chars_entry.insert(0, "38")

    r += 1
    tk.Label(norm, text="Máx. CPS (car/seg):").grid(row=r, column=0, sticky="w", pady=(8, 0))
    cps_entry = tk.Entry(norm, width=10)
    cps_entry.grid(row=r, column=1, sticky="w", padx=(8, 24), pady=(8, 0))
    cps_entry.insert(0, "20")

    tk.Label(norm, text="Duración mínima (s):").grid(row=r, column=2, sticky="w", pady=(8, 0))
    min_dur_entry = tk.Entry(norm, width=10)
    min_dur_entry.grid(row=r, column=3, sticky="w", padx=(8, 0), pady=(8, 0))
    min_dur_entry.insert(0, "1.0")

    r += 1
    tk.Label(norm, text="Duración máxima (s):").grid(row=r, column=0, sticky="w", pady=(8, 0))
    max_dur_entry = tk.Entry(norm, width=10)
    max_dur_entry.grid(row=r, column=1, sticky="w", padx=(8, 24), pady=(8, 0))
    max_dur_entry.insert(0, "7.0")

    tk.Label(norm, text="Pausa mínima entre subtítulos (s):").grid(row=r, column=2, sticky="w", pady=(8, 0))
    min_gap_entry = tk.Entry(norm, width=10)
    min_gap_entry.grid(row=r, column=3, sticky="w", padx=(8, 0), pady=(8, 0))
    min_gap_entry.insert(0, "0.16")

    r += 1
    tk.Label(norm, text="Pausa MÁX. entre palabras dentro del cue (s):").grid(row=r, column=0, sticky="w", pady=(8, 0))
    max_pause_entry = tk.Entry(norm, width=10)
    max_pause_entry.grid(row=r, column=1, sticky="w", padx=(8, 24), pady=(8, 0))
    max_pause_entry.insert(0, "1.0")
    tk.Label(norm, text="(vacío = desactivar)").grid(row=r, column=2, columnspan=2, sticky="w", pady=(8, 0))

    # defaults por perfil
    def apply_profile_defaults(*_):
        prof = profile_var.get().strip()
        if prof == "VE":
            lang_var.set(DEFAULT_LANG_LABEL_VE)
        elif prof == "VCAT":
            lang_var.set(DEFAULT_LANG_LABEL_VCAT)

    profile_var.trace_add("write", apply_profile_defaults)
    apply_profile_defaults()

    # ---- status + progress
    status_frame = tk.Frame(main)
    status_frame.pack(fill="x", pady=(12, 0))

    status_label = tk.Label(status_frame, text="Listo.", anchor="w")
    status_label.pack(fill="x")

    progress = ttk.Progressbar(status_frame, mode="indeterminate")
    progress.pack(fill="x", pady=(6, 0))

    # ---- action
    btns = tk.Frame(main)
    btns.pack(fill="x", pady=(14, 0))

    def on_generate():
        video_path = select_video_file()
        offline_mode = True

        if not video_path:
            return

        try:
            rules = SubtitleRules(
                max_lines=int(lines_entry.get().strip() or "2"),
                max_chars_per_line=int(chars_entry.get().strip() or "38"),
                max_cps=float(cps_entry.get().strip() or "20"),
                min_duration=float(min_dur_entry.get().strip() or "1.0"),
                max_duration=float(max_dur_entry.get().strip() or "7.0"),
                min_gap=float(min_gap_entry.get().strip() or "0.16"),
                max_pause_within_cue=float(max_pause_entry.get().strip()) if max_pause_entry.get().strip() else None,
            )
        except Exception as e:
            messagebox.showerror("Error", f"Parámetros inválidos: {e}")
            return

        prof = profile_var.get().strip()
        lang_label = lang_var.get().strip()

        # language debe ser un CODE: "es", "ca", "en", etc. (None => autodetect)
        language = LANG_LABEL_TO_CODE.get(lang_label, None)

        model_size = model_var.get().strip()
        batch_size = int(batch_entry.get().strip() or "8")
        hf_token = hf_token_entry.get().strip()
        device_pref = device_var.get().strip()

        btn_generate.config(state="disabled")
        progress.start(10)
        status_label.config(text="Iniciando...")

        q = queue.Queue()

        def status_cb(msg: str):
            q.put(("status", msg))

        def worker():
            try:
                out_srt, out_txt, out_csv, out_cues, out_subs_spk, out_spk_map = pipeline_generate(
                    video_path=video_path,
                    rules=rules,
                    profile=prof,
                    language=language,
                    model_size=model_size,
                    batch_size=batch_size,
                    hf_token=hf_token,
                    device_pref=device_pref,
                    offline_mode=offline_mode,
                    status_cb=status_cb,
                )
                q.put(("done", (out_srt, out_txt, out_csv, out_cues, out_subs_spk, out_spk_map)))
            except Exception as e:
                q.put(("error", str(e)))

        def _exists(p: str) -> bool:
            return bool(p) and isinstance(p, str) and os.path.exists(p)

        def poll():
            try:
                while True:
                    kind, payload = q.get_nowait()
                    if kind == "status":
                        status_label.config(text=payload)

                    elif kind == "done":
                        progress.stop()
                        btn_generate.config(state="normal")
                        out_srt, out_txt, out_csv, out_cues, out_subs_spk, out_spk_map = payload

                        lines = []

                        # SRT (siempre debería existir)
                        if _exists(out_srt):
                            lines.append("Subtítulos generados:\n" + out_srt)
                        else:
                            # fallback: al menos muestra el path devuelto
                            lines.append("Subtítulos generados:\n" + str(out_srt))

                        # Debug palabra a palabra (solo si existen)
                        word_debug = []
                        if _exists(out_txt):
                            word_debug.append(out_txt)
                        if _exists(out_csv):
                            word_debug.append(out_csv)
                        if word_debug:
                            lines.append("Debug palabra-a-palabra:\n" + "\n".join(word_debug))

                        # Debug cues
                        if _exists(out_cues):
                            lines.append("Debug cues:\n" + out_cues)

                        # CSV subs + speaker
                        if _exists(out_subs_spk):
                            lines.append("CSV subtítulos + interlocutor:\n" + out_subs_spk)

                        # Map speakers
                        if _exists(out_spk_map):
                            lines.append("Mapa de speakers (original -> InterlocutorXX):\n" + out_spk_map)

                        messagebox.showinfo("OK", "\n\n".join(lines).strip())

                        status_label.config(text="Listo.")
                        return

                    elif kind == "error":
                        progress.stop()
                        btn_generate.config(state="normal")
                        messagebox.showerror("Error", payload)
                        status_label.config(text="Error.")
                        return

            except queue.Empty:
                pass

            root.after(120, poll)

        threading.Thread(target=worker, daemon=True).start()
        root.after(120, poll)

    btn_generate = tk.Button(
        btns,
        text="Seleccionar vídeo y generar SRT",
        command=on_generate,
        height=2
    )
    btn_generate.pack(fill="x")

    hint = tk.Label(
        main,
        text="Salida: D:\\Subtitols_Sonilab\\output\\. Genera _subs.srt (y opcionalmente debugs si están activados en el pipeline).",
        fg="#444"
    )
    hint.pack(anchor="w", pady=(10, 0))

    root.mainloop()


if __name__ == "__main__":
    launch_gui()
