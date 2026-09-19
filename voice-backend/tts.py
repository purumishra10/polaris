"""Polaris desk TTS — male station intelligence. Never speak SSML tags."""

from __future__ import annotations

import asyncio
import os
import re

import edge_tts

VOICE = os.getenv("POLARIS_TTS_VOICE", "en-GB-RyanNeural")
RATE = os.getenv("POLARIS_TTS_RATE", "-6%")
PITCH = os.getenv("POLARIS_TTS_PITCH", "-8Hz")
FALLBACK_VOICE = "en-IN-PrabhatNeural"
# Whole-stream collection budget. A 40-word brief is ~20 s of audio, so a short
# timeout here silently drops the primary voice on every long reply.
TTS_TIMEOUT_SEC = float(os.getenv("POLARIS_TTS_TIMEOUT", "20"))
_phrase_cache: dict[tuple[str, str], bytes] = {}


def _watermark(audio_bytes: bytes) -> bytes:
    if not audio_bytes or audio_bytes.startswith(b"ID3"):
        return audio_bytes

    artist = b"Polaris Station Ops"
    title = b"AI Generated Station Briefing"

    def frame(frame_id: bytes, content: bytes) -> bytes:
        payload = b"\x00" + content
        size = len(payload).to_bytes(4, byteorder="big")
        return frame_id + size + b"\x00\x00" + payload

    frames = frame(b"TPE1", artist) + frame(b"TIT2", title)
    tag_size = len(frames)
    header = b"ID3\x03\x00\x00" + bytes(
        [
            (tag_size >> 21) & 0x7F,
            (tag_size >> 14) & 0x7F,
            (tag_size >> 7) & 0x7F,
            tag_size & 0x7F,
        ]
    )
    return header + frames + audio_bytes


_TYPOGRAPHY = {
    "\u202f": " ",  # narrow no-break space, emitted between value and unit
    "\u00a0": " ",
    "\u2009": " ",
    "\u2011": "-",  # non-breaking hyphen
    "\u2012": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
}


def _speechify(text: str) -> str:
    spoken = text.strip()
    for bad, good in _TYPOGRAPHY.items():
        spoken = spoken.replace(bad, good)
    spoken = re.sub(r"<[^>]+>", " ", spoken)
    spoken = re.sub(
        r"speak\s+version[^.]{0,180}",
        " ",
        spoken,
        flags=re.I,
    )
    spoken = re.sub(r"xmlns[^\s]*", " ", spoken, flags=re.I)
    spoken = re.sub(r"http://www\.w3\.org[^\s]*", " ", spoken, flags=re.I)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*kL\b", r"\1 kiloliters", spoken, flags=re.I)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*kVA\b", r"\1 kay-vah", spoken, flags=re.I)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*L/h\b", r"\1 liters an hour", spoken, flags=re.I)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*L\b", r"\1 liters", spoken)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*kn\b", r"\1 knots", spoken, flags=re.I)
    spoken = re.sub(r"(\d+(?:\.\d+)?)\s*kt\b", r"\1 knots", spoken, flags=re.I)
    swaps = (
        ("JET A-1", "Jet A-one"),
        ("JET A1", "Jet A-one"),
        ("kVA", "kay-vah"),
        ("kiloliters liters", "kiloliters"),
        ("NOMINAL", "nominal"),
        ("CRITICAL", "critical"),
        ("ADVISORY", "advisory"),
        ("BHARATI", "Bharati"),
        ("MAITRI", "Maitri"),
        ("C-band", "C band"),
        ("GIS", "G I S"),
        ("SITREP", "sit-rep"),
    )
    for old, new in swaps:
        spoken = spoken.replace(old, new)
    spoken = re.sub(r"\s+", " ", spoken).strip()
    return spoken


async def _collect(voice: str, rate: str, pitch: str, spoken: str) -> bytes:
    communicate = edge_tts.Communicate(spoken, voice, rate=rate, pitch=pitch)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            chunks.append(chunk["data"])
    data = b"".join(chunks)
    return _watermark(data) if data else b""


async def warm_cache(phrases: list[str]) -> None:
    tasks = [synthesize(phrase) for phrase in phrases if phrase and phrase.strip()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    hits = sum(1 for item in results if isinstance(item, bytes) and item)
    print(f"[TTS] Cache warm: {hits}/{len(phrases)} phrases pre-synthesized")


async def synthesize(text: str) -> bytes:
    if not text or not text.strip():
        return b""

    spoken = _speechify(text)
    if not spoken:
        return b""

    cache_key = (spoken.lower(), VOICE)
    cached = _phrase_cache.get(cache_key)
    if cached:
        return cached

    audio = b""
    try:
        audio = await asyncio.wait_for(
            _collect(VOICE, RATE, PITCH, spoken),
            timeout=TTS_TIMEOUT_SEC,
        )
    except Exception as exc:
        print(f"[TTS] {VOICE} failed: {exc}")
        try:
            audio = await asyncio.wait_for(
                _collect(FALLBACK_VOICE, "-4%", "-4Hz", spoken),
                timeout=TTS_TIMEOUT_SEC,
            )
        except Exception as inner:
            print(f"[TTS] fallback failed: {inner}")
            return b""

    if audio:
        _phrase_cache[cache_key] = audio
    return audio
