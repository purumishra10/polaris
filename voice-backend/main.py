"""Polaris station-ops voice sidecar (port 8002).

Audio pipeline adapted from EchoPilot; domain is Polarisonly.
"""

from __future__ import annotations

import asyncio
import io
import json
import os
import site
import time
import wave
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

from station_ops import handle_turn
from tts import synthesize
import rag

try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None

if os.name == "nt":
    for site_dir in site.getsitepackages():
        for lib in ("cublas", "cudnn"):
            bin_path = os.path.join(site_dir, "nvidia", lib, "bin")
            if os.path.exists(bin_path):
                os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                if hasattr(os, "add_dll_directory"):
                    os.add_dll_directory(bin_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
STT_PROMPT = (
    "Polaris, Bharati, Maitri, NCPOR, Antarctica, JET A-1, fuel farm, autonomy, "
    "CHP, microgrid, blizzard, hatch lockdown, radome, C-band, resupply, polar night, "
    "August fifth, replay, historical, gust, live now"
)

groq_client: OpenAI | None = None
if GROQ_API_KEY:
    groq_client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=GROQ_API_KEY,
    )
    print("[STT] Groq whisper-large-v3")

local_whisper = None
if WhisperModel:
    try:
        local_whisper = WhisperModel("small", device="cuda", compute_type="float16")
        print("[STT] Local CUDA faster-whisper")
    except Exception:
        try:
            local_whisper = WhisperModel("small", device="cpu", compute_type="int8")
            print("[STT] Local CPU faster-whisper")
        except Exception as exc:
            print(f"[STT] Local whisper skipped: {exc}")

SAMPLE_RATE = 16000
FRAME_MS = 30
FRAME_SIZE = int(SAMPLE_RATE * FRAME_MS / 1000)
SILENCE_MS_TO_FINALIZE = 750
BARGE_IN_CONFIRM_MS = 450
GREETING = (
    "Polaris online. Bharati and Maitri are on the board. "
    "Give the order — map, fuel, blizzard, or the fifth of August."
)


class AudioSession:
    def __init__(self) -> None:
        self.pcm_buffer = bytearray()
        self.silence_ms = 0
        self.last_frame_had_speech = False
        self.assistant_speaking = False
        self.barge_in_speech_ms = 0
        self.interrupted = False
        self.history: list[dict[str, str]] = []

    def add_chunk(self, chunk: bytes) -> None:
        self.pcm_buffer.extend(chunk)
        if len(self.pcm_buffer) > 16000 * 2 * 8:
            self.pcm_buffer = self.pcm_buffer[-16000 * 2 * 8 :]

    def get_full_pcm(self) -> np.ndarray:
        if not self.pcm_buffer:
            return np.array([], dtype=np.int16)
        return np.frombuffer(bytes(self.pcm_buffer), dtype=np.int16)

    def reset_after_transcript(self) -> None:
        self.pcm_buffer = bytearray()


def has_speech(pcm: np.ndarray, window_ms: int = 300, threshold: float = 500) -> bool:
    if len(pcm) < FRAME_SIZE:
        return False
    window_frames = int(window_ms / FRAME_MS)
    tail = pcm[-FRAME_SIZE * window_frames :]
    if len(tail) == 0:
        return False
    rms = np.sqrt(np.mean(np.square(tail.astype(np.float32))))
    return rms > threshold


def transcribe(pcm: np.ndarray) -> str:
    text = ""
    if groq_client is not None:
        try:
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(pcm.tobytes())
            wav_io.seek(0)
            wav_io.name = "audio.wav"
            transcription = groq_client.audio.transcriptions.create(
                file=wav_io,
                model="whisper-large-v3",
                prompt=STT_PROMPT,
            )
            text = (transcription.text or "").strip()
        except Exception as exc:
            print(f"[STT] Groq failed: {exc}")

    if not text and local_whisper is not None:
        pcm_float = pcm.astype(np.float32) / 32768.0
        segments, _ = local_whisper.transcribe(
            pcm_float,
            vad_filter=True,
            beam_size=5,
            initial_prompt=STT_PROMPT,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()

    hallucinations = {
        "thank you for watching",
        "thanks for watching",
        "thanks for watching!",
        "thank you for watching!",
        "subscribe to",
        "thank you.",
        "you.",
        "you",
        "please subscribe",
        "subscribe.",
        "hmm.",
        "okay.",
        "ok.",
        "connection",
        "connected",
        "the connection",
        "connection.",
        "connected.",
    }
    lowered = text.lower().strip()
    if (
        len(text) < 3
        or lowered in hallucinations
        or "thank you for watching" in lowered
        or "thanks for watching" in lowered
    ):
        return ""
    return text


async def speak(websocket: WebSocket, session: AudioSession, text: str) -> None:
    session.assistant_speaking = True
    session.barge_in_speech_ms = 0
    session.interrupted = False
    await websocket.send_json(
        {"type": "transcript", "text": text, "final": True, "speaker": "assistant"}
    )
    await websocket.send_json({"type": "status", "message": "speaking"})
    try:
        audio_bytes = await synthesize(text)
        if session.interrupted:
            session.assistant_speaking = False
            return
        if audio_bytes:
            await websocket.send_bytes(audio_bytes)
    except WebSocketDisconnect:
        session.assistant_speaking = False
    except Exception as exc:
        print(f"[TTS] {exc}")
        session.assistant_speaking = False
        if not session.interrupted:
            try:
                await websocket.send_json({"type": "status", "message": "listening"})
            except Exception:
                pass


async def run_ops_turn(websocket: WebSocket, session: AudioSession, user_text: str) -> None:
    await websocket.send_json(
        {"type": "transcript", "text": user_text, "final": True, "speaker": "user"}
    )
    await websocket.send_json({"type": "status", "message": "thinking"})
    result = await handle_turn(user_text, session.history)
    session.history.append({"role": "user", "content": user_text})
    session.history.append({"role": "assistant", "content": result["reply"]})
    if len(session.history) > 16:
        session.history = session.history[-16:]
    await websocket.send_json({"type": "action", "actions": result["actions"]})
    if result.get("sources"):
        await websocket.send_json(
            {
                "type": "sources",
                "hits": result["sources"],
                "rag": result.get("rag"),
            }
        )
    await speak(websocket, session, result["reply"])


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title="Polaris Station Ops Voice",
    description="Voice operator for the Bharati / Maitri digital twin",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ONLINE",
        "service": "polaris-voice",
        "stt": "groq" if groq_client else ("local" if local_whisper else "none"),
        "llm": bool(GROQ_API_KEY),
        "rag": rag.status(),
    }


class TurnRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []


@app.post("/api/voice/turn")
async def api_turn(req: TurnRequest) -> dict[str, Any]:
    return await handle_turn(req.message, req.history)


@app.websocket("/ws/voice")
async def voice_socket(websocket: WebSocket):
    await websocket.accept()
    session = AudioSession()
    await websocket.send_json({"type": "status", "message": "connected"})
    await speak(websocket, session, GREETING)
    session.history.append({"role": "assistant", "content": GREETING})

    last_check = time.time()
    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                session.add_chunk(message["bytes"])
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue
                kind = data.get("type")
                if kind == "playback_ended":
                    session.assistant_speaking = False
                    if not session.interrupted:
                        await websocket.send_json({"type": "status", "message": "listening"})
                elif kind == "text" and data.get("text"):
                    await run_ops_turn(websocket, session, str(data["text"]))

            now = time.time()
            if now - last_check < 0.15:
                continue
            last_check = now

            pcm = session.get_full_pcm()
            if len(pcm) == 0:
                continue

            if session.assistant_speaking:
                speaking_detected = has_speech(pcm, window_ms=150, threshold=2200)
                if speaking_detected:
                    session.barge_in_speech_ms += 150
                    if (
                        session.barge_in_speech_ms >= BARGE_IN_CONFIRM_MS
                        and not session.interrupted
                    ):
                        session.interrupted = True
                        session.assistant_speaking = False
                        await websocket.send_json({"type": "interrupt"})
                        await websocket.send_json({"type": "status", "message": "listening"})
                        session.reset_after_transcript()
                        session.silence_ms = 0
                        session.last_frame_had_speech = True
                else:
                    session.barge_in_speech_ms = 0
                continue

            speaking_now = has_speech(pcm, window_ms=300, threshold=550)
            if speaking_now:
                session.silence_ms = 0
                session.last_frame_had_speech = True
            else:
                session.silence_ms += 150

            if session.last_frame_had_speech and session.silence_ms >= SILENCE_MS_TO_FINALIZE:
                captured = pcm.copy()
                session.reset_after_transcript()
                session.silence_ms = 0
                session.last_frame_had_speech = False
                await websocket.send_json({"type": "status", "message": "transcribing"})
                text = await asyncio.to_thread(transcribe, captured)
                if not text:
                    await websocket.send_json({"type": "status", "message": "listening"})
                    continue
                print("[STT]", text.encode("ascii", "backslashreplace").decode("ascii"))
                await run_ops_turn(websocket, session, text)
    except (WebSocketDisconnect, RuntimeError):
        print("[Voice] client disconnected")
