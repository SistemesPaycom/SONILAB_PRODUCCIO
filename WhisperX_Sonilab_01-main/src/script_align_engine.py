# -*- coding: utf-8 -*-
"""
script_align_engine.py — Motor de alineació forçada amb guió conegut.

En lloc de transcriure l'àudio (ASR), pren el TEXT del guió ja conegut
i l'alinea a l'àudio per obtenir word_segments amb timestamps precisos a
nivell de paraula.

Suporta dos formats de guió:
  ① Format TXT SONILAB  (*SPEAKER*\\t text (marcadors_temps))
      → Detectat automàticament via is_txt_guion_format().
      → Parseja els cues amb temps incorporats, construeix els segments
        directament a partir dels anchors del guió.
      → SALTA el pas de VAD/ASR (molt més ràpid i precís).

  ② Format DOCX/text pla SONILAB  (*PERSONATGE*(offset) text)
      → Flux original: ASR ràpid per detectar fronteres de segments +
        mapeig proporcional del guió + forced alignment WhisperX.

Flux general:
  1. Detectar format del guió.
  2a. [TXT]   parse_script_txt_from_text → build_srt_only_from_script
              → segments pre-cronometrats → forced alignment.
  2b. [DOCX]  ASR ràpid (model=small) + mapeig proporcional + forced alignment.
  3. Forced alignment WhisperX (wav2vec2).
"""
from __future__ import annotations

import gc
import re
from typing import Dict, List, Optional, Tuple


# ── Detecció de format SONILAB (DOCX clàssic) ───────────────────────────────
_SONILAB_DOCX_PATTERN = re.compile(
    r'TAKE\s*#?\s*\d+|^\*REPICAR\*|^\*[A-ZÀ-Ü][^*]*\*\s*\(',
    re.MULTILINE | re.IGNORECASE,
)


def _is_sonilab_docx_guion(text: str) -> bool:
    """Detecta si el text és un guió SONILAB format DOCX (TAKE / REPICAR / *CHAR*(offset))."""
    return bool(_SONILAB_DOCX_PATTERN.search(text))


def _is_txt_guion(text: str) -> bool:
    """Detecta si el text és un guió SONILAB format TXT (*SPEAKER*\\t...)."""
    try:
        from script_txt_parser import is_txt_guion_format
        return is_txt_guion_format(text)
    except ImportError:
        return False


# ── Preparació del text del guió (format DOCX) ──────────────────────────────

def _prepare_script_text(script_text: str, status_cb=None) -> str:
    """
    Si el text és un guió SONILAB format DOCX, extreu únicament les línies
    de diàleg netes. Si no, el retorna tal qual (text pla).

    Per al format TXT, aquesta funció NO s'utilitza (s'usa el camí directe).
    """
    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    if not _is_sonilab_docx_guion(script_text):
        return script_text.strip()

    try:
        from parse_guion import parse_guion_for_alignment
        clean = parse_guion_for_alignment(script_text)
        _status(
            f"Script-align: guió SONILAB (DOCX) detectat — "
            f"{len(script_text.splitlines())} línies entrada → "
            f"{len(clean.splitlines())} línies de diàleg net"
        )
        return clean
    except ImportError:
        _status("Script-align: AVÍS — parse_guion.py no trobat, usant text en brut")
        return script_text.strip()


# ── Helpers per al format TXT ────────────────────────────────────────────────

def _build_segments_from_txt(
    script_text: str,
    status_cb=None,
) -> Tuple[List[Dict], str]:
    """
    Parseja un guió TXT SONILAB i construeix segments pre-cronometrats.

    Retorna:
        (script_segments, guessed_lang)
        script_segments: [{"text": str, "start": float, "end": float}, ...]
        guessed_lang:    codi d'idioma estimat (per defecte "ca")
    """
    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    from script_txt_parser import parse_script_txt_from_text
    from script_only_builder import build_srt_only_from_script, ScriptOnlyConfig

    cues = parse_script_txt_from_text(script_text)
    _status(f"Script-align TXT: {len(cues)} cues parsejats del guió")

    cfg = ScriptOnlyConfig()
    segs = build_srt_only_from_script(cues, cfg)
    _status(f"Script-align TXT: {len(segs)} segments construïts amb temporització del guió")

    if not segs:
        raise ValueError(
            "El guió TXT no ha generat cap segment. "
            "Comprova que tingui línies *SPEAKER*\\t amb contingut verbal."
        )

    script_segments = [
        {"text": s.text, "start": float(s.start_sec), "end": float(s.end_sec)}
        for s in segs
    ]

    guessed_lang = _guess_language_from_segments(script_segments)
    return script_segments, guessed_lang


def _guess_language_from_segments(segments: List[Dict]) -> str:
    """
    Estima l'idioma a partir del text dels segments (heurística simple).
    Per defecte retorna "ca" (català, l'idioma habitual de SONILAB).
    """
    full_text = " ".join(s.get("text", "") for s in segments[:30]).lower()
    words = set(re.findall(r"[a-zà-ÿ]+", full_text))

    ca_score = len(words & {"però", "amb", "que", "una", "els", "les", "és", "hem", "han", "sí"})
    es_score = len(words & {"pero", "con", "que", "una", "los", "las", "es", "hemos", "han"})
    en_score = len(words & {"the", "and", "but", "with", "you", "are", "have", "that", "this"})

    if en_score > ca_score and en_score > es_score:
        return "en"
    if es_score > ca_score:
        return "es"
    return "ca"


# ── Funció principal ─────────────────────────────────────────────────────────

def align_script_to_audio(
    audio_path: str,
    script_text: str,
    language: Optional[str] = None,
    device: str = "cpu",
    compute_type: str = "int8",
    status_cb=None,
) -> Tuple[List[Dict], List[Dict], str]:
    """
    Alinea el texto del guion al audio y devuelve word_segments con timestamps.

    Paràmetres:
        audio_path   : ruta al fitxer d'àudio/vídeo
        script_text  : text complet del guió (TXT o DOCX)
        language     : codi d'idioma ("ca", "es", "en") o None = auto-detect
        device       : "cpu" o "cuda"
        compute_type : "int8" (cpu), "float16" (cuda)
        status_cb    : callback(msg: str) per a logging

    Retorna:
        (word_segments, segments, detected_language)
        word_segments: [{"word": str, "start": float, "end": float}, ...]
        segments:      [{"text": str, "start": float, "end": float}, ...]
    """
    import whisperx

    def _status(msg: str):
        if callable(status_cb):
            status_cb(msg)

    # ------------------------------------------------------------------ #
    # 0. Detectar format i construir els script_segments                   #
    # ------------------------------------------------------------------ #
    use_txt_path = _is_txt_guion(script_text)
    guessed_lang = language or "ca"
    script_segments: List[Dict] = []

    if use_txt_path:
        # ── Camí ① TXT: temporització directa del guió ───────────────── #
        _status(
            "Script-align: format TXT SONILAB detectat — "
            "usant ancoratge temporal del guió (sense VAD/ASR)"
        )
        try:
            script_segments, guessed_lang = _build_segments_from_txt(
                script_text, status_cb=status_cb
            )
        except Exception as e:
            _status(f"Script-align TXT: error ({e}), recorrent al flux DOCX")
            use_txt_path = False

    if not use_txt_path:
        # ── Camí ② DOCX: ASR ràpid + mapeig proporcional ────────────── #
        from faster_whisper import WhisperModel

        script_text_clean = _prepare_script_text(script_text, status_cb=status_cb)
        if not script_text_clean.strip():
            raise ValueError(
                "El guió no conté diàleg útil després de l'anàlisi. "
                "Comprova que el fitxer sigui un guió de doblatge vàlid."
            )

        # ── 1. ASR ràpid — només per detectar fronteres de segments ──── #
        _status("Script-align: detectant segments d'àudio (model=small, fronteres)...")
        vad_model = WhisperModel("small", device=device, compute_type=compute_type)

        vad_kwargs: Dict = {
            "word_timestamps": False,
            "vad_filter": True,
            "vad_parameters": {
                "threshold": 0.35,
                "min_speech_duration_ms": 250,
                "max_speech_duration_s": 30.0,
                "min_silence_duration_ms": 200,
                "speech_pad_ms": 100,
            },
        }
        if language:
            vad_kwargs["language"] = language

        segments_iter, info = vad_model.transcribe(audio_path, **vad_kwargs)
        guessed_lang = info.language

        asr_segments: List[Dict] = []
        for seg in segments_iter:
            asr_segments.append({
                "start": float(seg.start),
                "end": float(seg.end),
                "text": seg.text.strip(),
            })

        del vad_model
        gc.collect()

        _status(
            f"Script-align: {len(asr_segments)} segments detectats, "
            f"idioma_asr={guessed_lang}"
        )

        # Fallback si VAD no detecta parla
        if not asr_segments:
            try:
                import soundfile as sf
                with sf.SoundFile(audio_path) as f:
                    total_dur = len(f) / f.samplerate
            except Exception:
                try:
                    audio_arr_tmp = whisperx.load_audio(audio_path)
                    total_dur = len(audio_arr_tmp) / 16000
                    del audio_arr_tmp
                except Exception:
                    total_dur = 3600.0
            _status("Script-align: AVÍS - VAD no ha detectat parla, usant durada total.")
            asr_segments = [{"start": 0.0, "end": total_dur, "text": ""}]

        # ── 2. Mapeig proporcional del guió als segments ASR ─────────── #
        _status("Script-align: mapeig del guió als segments d'àudio...")
        script_segments = _map_script_to_segments(script_text_clean, asr_segments)
        _status(f"Script-align: {len(script_segments)} segments del guió mapeats")

    # ------------------------------------------------------------------ #
    # 3. Forced alignment amb WhisperX                                    #
    # ------------------------------------------------------------------ #
    lang = language or guessed_lang or "ca"

    _status(f"Script-align: carregant model d'alineació WhisperX (lang={lang})...")
    model_a = None
    metadata = None

    for try_lang in [lang, "es", "en"]:
        try:
            model_a, metadata = whisperx.load_align_model(
                language_code=try_lang, device=device
            )
            if try_lang != lang:
                _status(
                    f"Script-align: model per a '{lang}' no disponible, "
                    f"usant '{try_lang}'"
                )
            lang = try_lang
            break
        except Exception as e:
            _status(f"Script-align: no s'ha pogut carregar el model '{try_lang}': {e}")

    if model_a is None:
        raise RuntimeError(
            "No s'ha pogut carregar cap model d'alineació WhisperX. "
            "Comprova la instal·lació de whisperx i els models de wav2vec2."
        )

    _status("Script-align: carregant àudio...")
    audio_arr = whisperx.load_audio(audio_path)

    _status("Script-align: executant forced alignment...")
    aligned = whisperx.align(
        transcript=script_segments,
        model=model_a,
        align_model_metadata=metadata,
        audio=audio_arr,
        device=device,
        return_char_alignments=False,
    )

    word_segments: List[Dict] = aligned.get("word_segments", [])
    aligned_segs: List[Dict] = aligned.get("segments", script_segments)

    del model_a, audio_arr
    gc.collect()

    _status(
        f"Script-align completat: {len(word_segments)} words, "
        f"{len(aligned_segs)} segments"
    )
    return word_segments, aligned_segs, lang


# ── Mapeig proporcional (per al camí DOCX) ──────────────────────────────────

def _map_script_to_segments(
    script_text: str,
    asr_segments: List[Dict],
) -> List[Dict]:
    """
    Distribueix el text del guió proporcionalment als segments de l'ASR.

    Estratègia: el guió té N paraules; els segments de parla tenen una
    durada total T. Cada segment rep les paraules del guió proporcionals
    a la seva durada relativa.
    """
    cleaned = re.sub(r"[ \t]+", " ", script_text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = cleaned.strip()

    words = cleaned.split()

    if not words:
        end = asr_segments[-1]["end"] if asr_segments else 60.0
        return [{"text": "", "start": 0.0, "end": end}]

    if not asr_segments:
        return [{"text": cleaned, "start": 0.0, "end": 60.0}]

    total_speech_dur = sum(
        max(s["end"] - s["start"], 0.01) for s in asr_segments
    )
    total_words = len(words)

    result: List[Dict] = []
    word_idx = 0

    for i, seg in enumerate(asr_segments):
        seg_dur = max(seg["end"] - seg["start"], 0.01)

        if i == len(asr_segments) - 1:
            seg_words = words[word_idx:]
        else:
            ratio = seg_dur / total_speech_dur
            n_words = max(1, round(total_words * ratio))
            seg_words = words[word_idx: word_idx + n_words]

        if not seg_words:
            continue

        result.append({
            "text": " ".join(seg_words),
            "start": seg["start"],
            "end": seg["end"],
        })
        word_idx += len(seg_words)

    # Si sobren paraules, afegir-les a l'últim segment
    if word_idx < len(words) and result:
        result[-1]["text"] += " " + " ".join(words[word_idx:])

    return result
