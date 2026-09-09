"""Polaris desk TTS — male station intelligence. Never speak SSML tags."""

from __future__ import annotations

import os
import re
import tempfile

import edge_tts

VOICE = os.getenv("POLARIS_TTS_VOICE", "en-GB-RyanNeural")
RATE = os.getenv("POLARIS_TTS_RATE", "-6%")
PITCH = os.getenv("POLARIS_TTS_PITCH", "-8Hz")
FALLBACK_VOICE = "en-IN-PrabhatNeural"


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


def _speechify(text: str) -> str:
    spoken = text.strip()
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


async def synthesize(text: str) -> bytes:
    if not text or not text.strip():
        return b""

    spoken = _speechify(text)
    if not spoken:
        return b""

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        communicate = edge_tts.Communicate(
            spoken,
            VOICE,
            rate=RATE,
            pitch=PITCH,
        )
        await communicate.save(tmp_path)
        with open(tmp_path, "rb") as handle:
            return _watermark(handle.read())
    except Exception as exc:
        print(f"[TTS] {VOICE} failed: {exc}")
        try:
            communicate = edge_tts.Communicate(
                spoken,
                FALLBACK_VOICE,
                rate="-4%",
                pitch="-4Hz",
            )
            await communicate.save(tmp_path)
            with open(tmp_path, "rb") as handle:
                return _watermark(handle.read())
        except Exception as inner:
            print(f"[TTS] fallback failed: {inner}")
            return b""
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
