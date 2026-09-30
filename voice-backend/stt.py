"""STT audio prep and transcript cleanup — EchoPilot path, PolarIS lexicon."""

from __future__ import annotations

import io
import os
import re
import struct
from difflib import SequenceMatcher, get_close_matches
from typing import Optional, Tuple

import numpy as np

SAMPLE_RATE = 16000
STT_MODEL = os.getenv("STT_MODEL", "whisper-large-v3")
NO_SPEECH_PROB_THRESHOLD = 0.80
AVG_LOGPROB_THRESHOLD = -1.0

STT_PROMPT = (
    "Polaris station ops. Bharati, Maitri, fuel tank, blizzard, map, weather, "
    "wind knots, sitrep, hatch, August fifth, replay, Jet A-1, radome, nowcast."
)

STATION_VOCAB = (
    "polaris",
    "bharati",
    "maitri",
    "fuel",
    "blizzard",
    "sitrep",
    "radome",
    "nowcast",
    "lockout",
    "katabatic",
    "helipad",
    "resupply",
    "replay",
    "gust",
    "knots",
    "autonomy",
    "microgrid",
    "hatch",
    "voyage",
    "quilty",
    "larsemann",
)

_DOMAIN_FIXES = (
    (r"\bbarati\b", "Bharati"),
    (r"\bbharti\b", "Bharati"),
    (r"\bbharathi\b", "Bharati"),
    (r"\bmaitry\b", "Maitri"),
    (r"\bmaitree\b", "Maitri"),
    (r"\bpolar\s*is\b", "Polaris"),
    (r"\bsit\s*rep\b", "sitrep"),
    (r"\bjet\s*a[\s-]*one\b", "Jet A-1"),
    (r"\bjet\s*a[\s-]*1\b", "Jet A-1"),
    (r"\baugust\s+fifth\b", "fifth of August"),
    (r"\b5th\s+of\s+august\b", "fifth of August"),
    (r"\bnow\s*cast\b", "nowcast"),
    (r"\block\s*out\b", "lockout"),
)

HALLUCINATION_SUBSTRINGS = (
    "thank you for watching",
    "subscribe to our",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "replay, historical",
    "gust, live now",
)
HALLUCINATION_EXACT = {
    "hmm",
    "hmm.",
    "uh.",
    "uh",
    "um.",
    "um",
    "thank you",
    "thank you.",
    "thanks",
    "thanks.",
    "thank you very much",
    "thank you very much.",
    "you",
    "you.",
    "bye",
    "bye.",
    "okay.",
    "ok.",
    "connection",
    "connected",
    "the connection",
    "siyan",
    "siyan.",
    "user 2.0",
    "user 2.0.",
    "user 2",
}
_THANK_YOU_ONLY = re.compile(
    r"^(?:ok(?:ay)?[,.\s]+)?(?:thanks|thank you)(?:\s+(?:so much|very much|a lot))?[.!?]*$",
    re.IGNORECASE,
)


def trim_silence(pcm: np.ndarray, noise_floor: float, pad_ms: int = 300) -> np.ndarray:
    if pcm is None or len(pcm) == 0:
        return np.array([], dtype=np.int16)
    samples = np.asarray(pcm, dtype=np.int16)
    frame = int(SAMPLE_RATE * 0.03)
    if len(samples) < frame:
        return samples
    threshold = max(float(noise_floor) * 1.6, 180.0)
    frames = len(samples) // frame
    rms = np.sqrt(
        np.mean(
            samples[: frames * frame].reshape(frames, frame).astype(np.float32) ** 2,
            axis=1,
        )
    )
    voiced = np.flatnonzero(rms >= threshold)
    if voiced.size == 0:
        return samples
    pad = int(SAMPLE_RATE * (pad_ms / 1000.0))
    start = max(0, int(voiced[0]) * frame - pad)
    end = min(len(samples), int(voiced[-1] + 1) * frame + pad)
    return samples[start:end]


def normalize_pcm(pcm: np.ndarray, target_rms: float = 2500.0, max_gain: float = 6.0) -> np.ndarray:
    samples = np.asarray(pcm, dtype=np.float32)
    if samples.size == 0:
        return np.array([], dtype=np.int16)
    samples = samples - float(np.mean(samples))
    rms = float(np.sqrt(np.mean(samples**2)))
    if rms < 80.0:
        return np.clip(samples, -32768, 32767).astype(np.int16)
    if rms < target_rms:
        samples = samples * min(target_rms / rms, max_gain)
    return np.clip(samples, -32768, 32767).astype(np.int16)


def prepare_utterance(pcm: np.ndarray, noise_floor: float) -> np.ndarray:
    return normalize_pcm(trim_silence(pcm, noise_floor), target_rms=2500.0)


def build_stt_prompt(recent_text: str = "") -> str:
    chunks = [STT_PROMPT]
    user_bits = []
    for line in (recent_text or "").split("User:"):
        line = line.split("Assistant:")[0].strip()
        if line:
            user_bits.append(line)
    if user_bits:
        last_user = user_bits[-1][-200:]
        if not is_hallucination(last_user):
            chunks.append(last_user)
    return " ".join(chunks)[:700]


def correct_station_words(text: str) -> str:
    if not text:
        return ""
    parts = re.findall(r"[A-Za-z']+|\d+|[^\w\s]|\s+", text)
    out = []
    for part in parts:
        if not re.fullmatch(r"[A-Za-z']{5,}", part):
            out.append(part)
            continue
        lower = part.lower()
        if lower in STATION_VOCAB:
            out.append(part)
            continue
        match = get_close_matches(lower, STATION_VOCAB, n=1, cutoff=0.86)
        if match:
            fixed = match[0]
            if part[0].isupper():
                fixed = fixed.title()
            out.append(fixed)
        else:
            out.append(part)
    return "".join(out)


def cleanup_transcript(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text).strip().strip(" \"'")
    for pattern, replacement in _DOMAIN_FIXES:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    return correct_station_words(cleaned).strip()


def is_low_confidence(no_speech_prob: Optional[float], avg_logprob: Optional[float]) -> bool:
    noisy = no_speech_prob is not None and no_speech_prob >= NO_SPEECH_PROB_THRESHOLD
    weak = avg_logprob is not None and avg_logprob <= AVG_LOGPROB_THRESHOLD
    return bool(noisy and weak)


def pick_stt_language(_recent_text: str = "") -> str:
    return "en"


def _word_set(text: str) -> set[str]:
    return set(re.findall(r"[a-z']+", (text or "").lower()))


def is_echo_transcript(user_text: str, assistant_text: str) -> bool:
    user = (user_text or "").strip()
    assistant = (assistant_text or "").strip()
    if not user:
        return False
    lowered = user.lower()
    if "polaris online" in lowered or "say fuel, blizzard" in lowered:
        return True
    if not assistant:
        return False
    if SequenceMatcher(None, user.lower(), assistant.lower()).ratio() >= 0.32:
        return True
    uw, aw = _word_set(user), _word_set(assistant)
    if not uw:
        return True
    overlap = uw & aw
    return len(overlap) >= 3 and (len(overlap) / len(uw)) >= 0.45


def is_repeat_transcript(user_text: str, last_user_text: str) -> bool:
    a = re.sub(r"[.!?]+$", "", (user_text or "").strip().lower())
    b = re.sub(r"[.!?]+$", "", (last_user_text or "").strip().lower())
    return bool(a) and a == b


def is_hallucination(text: str) -> bool:
    if not text:
        return True
    t_lower = text.lower().strip()
    has_cyrillic = any("\u0400" <= char <= "\u04ff" for char in text)
    return (
        len(t_lower) < 2
        or has_cyrillic
        or t_lower in HALLUCINATION_EXACT
        or bool(_THANK_YOU_ONLY.match(t_lower))
        or any(part in t_lower for part in HALLUCINATION_SUBSTRINGS)
    )


def pcm_to_wav_bytes(pcm: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    samples = np.asarray(pcm, dtype=np.int16)
    raw = samples.tobytes()
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + len(raw)))
    buf.write(b"WAVEfmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", len(raw)))
    buf.write(raw)
    return buf.getvalue()


def groq_segment_confidence(transcription) -> Tuple[Optional[float], Optional[float]]:
    segments = getattr(transcription, "segments", None) or []
    if not segments:
        return None, None
    first = segments[0]
    if isinstance(first, dict):
        return first.get("no_speech_prob"), first.get("avg_logprob")
    return getattr(first, "no_speech_prob", None), getattr(first, "avg_logprob", None)
