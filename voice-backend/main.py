"""Polaris station-ops voice sidecar (port 8002).

Audio loop is the EchoPilot VAD / STT / barge-in / TTS path. Dialogue stays
station-ops — no clinic, booking, or healthcare persona.
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

_HERE = os.path.dirname(__file__)
load_dotenv(os.path.join(_HERE, ".env"), override=True)
load_dotenv(os.path.join(_HERE, "..", ".env"), override=False)

import rag
from station_ops import handle_turn
from speech_engines import list_stt_engines, transcribe_utterance
from stt import (
    build_stt_prompt,
    cleanup_transcript,
    is_echo_transcript,
    is_hallucination,
    is_repeat_transcript,
    pick_stt_language,
    prepare_utterance,
)
from tts import split_spoken_sentences, synthesize, warm_cache

if os.name == "nt":
    for site_dir in site.getsitepackages():
        for lib in ("cublas", "cudnn"):
            bin_path = os.path.join(site_dir, "nvidia", lib, "bin")
            if os.path.exists(bin_path):
                os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                if hasattr(os, "add_dll_directory"):
                    os.add_dll_directory(bin_path)

SAMPLE_RATE = 16000
FRAME_MS = 30
FRAME_SIZE = int(SAMPLE_RATE * FRAME_MS / 1000)
SILENCE_MS_TO_FINALIZE = int(os.getenv("SILENCE_MS_TO_FINALIZE", "800"))
BARGE_IN_CONFIRM_MS = 250
MAX_CAPTURE_SEC = 15
GREETING = "Polaris online. Say fuel, blizzard, map, or the fifth of August."


def groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "").strip()


def groq_client() -> OpenAI | None:
    key = groq_key()
    if not key:
        return None
    return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=key)


_groq_client = groq_client()
print("[STT] Groq whisper ready" if groq_key() else "[STT] GROQ_API_KEY missing")


class AudioSession:
    def __init__(self) -> None:
        self.pcm_buffer = bytearray()
        self.silence_ms = 0
        self.last_frame_had_speech = False
        self.assistant_speaking = False
        self.barge_in_speech_ms = 0
        self.interrupted = False
        self.interrupt_cooldown_until = 0.0
        self.speak_deadline = 0.0
        self.stt_busy = False
        self.history: list[dict[str, str]] = []
        self.noise_floor_rms = 150.0
        self.threshold_calibrated = False
        self._calibration_buffer = bytearray()
        self.last_recalibration_time = 0.0
        self.user_speaking_start_time = 0.0
        self.echo_guard_until = 0.0
        self.browser_stt = False

    def add_chunk(self, chunk: bytes) -> None:
        self.pcm_buffer.extend(chunk)
        cap = int(SAMPLE_RATE * 2 * MAX_CAPTURE_SEC)
        if len(self.pcm_buffer) > cap:
            self.pcm_buffer = self.pcm_buffer[-cap:]
        if not self.threshold_calibrated:
            self._calibration_buffer.extend(chunk)
            if len(self._calibration_buffer) >= 16000:
                cal_pcm = np.frombuffer(bytes(self._calibration_buffer[:16000]), dtype=np.int16)
                rms = float(np.sqrt(np.mean(np.square(cal_pcm.astype(np.float32)))))
                self.noise_floor_rms = rms
                self.threshold_calibrated = True
                print(
                    f"[AudioSession] Noise floor calibrated: RMS={rms:.1f}, "
                    f"speech threshold={self.speech_threshold:.1f}"
                )

    @property
    def speech_threshold(self) -> float:
        return max(150.0, min(600.0, self.noise_floor_rms * 3.0))

    def get_full_pcm(self) -> np.ndarray:
        if not self.pcm_buffer:
            return np.array([], dtype=np.int16)
        return np.frombuffer(bytes(self.pcm_buffer), dtype=np.int16)

    def reset_after_transcript(self) -> None:
        self.pcm_buffer = bytearray()

    def reset_for_interrupt(self, confirmed_speech_ms: int) -> None:
        keep_bytes = int(SAMPLE_RATE * (confirmed_speech_ms / 1000.0)) * 2
        if len(self.pcm_buffer) > keep_bytes:
            self.pcm_buffer = self.pcm_buffer[-keep_bytes:]


def has_speech(pcm: np.ndarray, window_ms: int = 300, threshold: float = 500) -> bool:
    if len(pcm) < FRAME_SIZE:
        return False
    window_frames = int(window_ms / FRAME_MS)
    tail = pcm[-FRAME_SIZE * window_frames :]
    if len(tail) == 0:
        return False
    rms = np.sqrt(np.mean(np.square(tail.astype(np.float32))))
    return rms > threshold


def get_peak_rms(pcm: np.ndarray, frame_ms: int = 30) -> float:
    if len(pcm) == 0:
        return 0.0
    frame_samples = int(SAMPLE_RATE * frame_ms / 1000)
    if len(pcm) < frame_samples:
        return float(np.sqrt(np.mean(np.square(pcm.astype(np.float32)))))
    num_frames = len(pcm) // frame_samples
    frames = pcm[: num_frames * frame_samples].reshape(num_frames, frame_samples).astype(np.float32)
    frame_rms = np.sqrt(np.mean(np.square(frames), axis=1))
    return float(np.max(frame_rms))


def _is_hallucination(text: str) -> bool:
    return is_hallucination(text)


async def transcribe(pcm: np.ndarray, recent: str = "") -> tuple[str, str]:
    if len(pcm) < 3200:
        return "", ""
    try:
        result = await transcribe_utterance(
            pcm,
            language=pick_stt_language(recent),
            groq_client=_groq_client,
            prompt=build_stt_prompt(recent),
        )
    except Exception as exc:
        print(f"[STT] {exc}")
        return "", str(exc)
    text = cleanup_transcript(result.text)
    if is_hallucination(text):
        print(f"[STT] dropped hallucination: {text!r}")
        return "", ""
    return text, ""


def _speak_deadline(text: str) -> float:
    words = max(1, len(text.split()))
    return time.time() + min(45.0, max(8.0, words * 0.45 + 3.0))


async def speak(websocket: WebSocket, session: AudioSession, text: str) -> None:
    spoken = str(text or "").strip()
    if not spoken:
        await websocket.send_json({"type": "status", "message": "listening"})
        return
    session.assistant_speaking = True
    session.barge_in_speech_ms = 0
    session.interrupted = False
    session.speak_deadline = _speak_deadline(spoken)
    await websocket.send_json(
        {"type": "transcript", "text": spoken, "final": True, "speaker": "assistant"}
    )
    await websocket.send_json({"type": "status", "message": "speaking"})
    await websocket.send_json({"type": "tts_stream", "phase": "start"})
    try:
        sent_any = False
        for sentence in split_spoken_sentences(spoken):
            if session.interrupted:
                break
            audio_bytes = await synthesize(sentence)
            if session.interrupted or not audio_bytes:
                continue
            await websocket.send_bytes(audio_bytes)
            sent_any = True
        if not session.interrupted:
            await websocket.send_json({"type": "tts_stream", "phase": "end"})
        if not sent_any and not session.interrupted:
            await websocket.send_json({"type": "tts_fallback", "text": spoken})
    except WebSocketDisconnect:
        session.assistant_speaking = False
        session.speak_deadline = 0.0
        raise
    except Exception as exc:
        print(f"[TTS] {exc}")
        session.assistant_speaking = False
        session.speak_deadline = 0.0
        if not session.interrupted:
            try:
                await websocket.send_json({"type": "tts_fallback", "text": spoken})
            except Exception:
                pass


async def _end_speaking(
    websocket: WebSocket,
    session: AudioSession,
    *,
    listen: bool,
) -> None:
    session.assistant_speaking = False
    session.speak_deadline = 0.0
    session.reset_after_transcript()
    session.silence_ms = 0
    session.last_frame_had_speech = False
    session.barge_in_speech_ms = 0
    session.interrupt_cooldown_until = time.time() + 0.2
    session.echo_guard_until = time.time() + 0.75
    if listen and not session.interrupted:
        await websocket.send_json({"type": "status", "message": "listening"})
    session.interrupted = False


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
    await warm_cache([GREETING])
    yield


app = FastAPI(
    title="Polaris Station Ops Voice",
    description="Voice operator for the Bharati / Maitri digital twin",
    version="1.1.0",
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
    key = groq_key()
    engines = list_stt_engines()
    return {
        "status": "ONLINE",
        "service": "polaris-voice",
        "stt": "groq" if engines.get("groq") else "local",
        "stt_engines": engines,
        "llm": bool(key),
        "rag": rag.status(),
    }


class TurnRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []


class SitrepAnalyzeRequest(BaseModel):
    station: str = "BHARATI"
    clock: str | None = None
    severity: str = "NOMINAL"
    mode: str = "LIVE"
    ambient: dict[str, Any] | None = None
    forecast: dict[str, Any] | None = None
    fuel: dict[str, Any] | None = None
    lockouts: dict[str, Any] | None = None
    polar: str | None = None
    ship: dict[str, Any] | None = None
    actions: list[str] = []
    citation: str | None = None
    note: str | None = None


SITREP_SYSTEM = (
    "You are Polar, NCPOR station intelligence for PolarIS. Write a formal SITREP "
    "executive analysis for Antarctic research stations Bharati and Maitri. "
    "Use only the JSON facts given. Be concrete: wind kt, °C, fuel days, ship ETA, "
    "SOP actions, nowcast P(≥23 kt). No fluff, no markdown, no bullet lists — "
    "3–5 tight sentences suitable for a printed ops PDF. Do not invent sensors or "
    "litres that are not in the payload. Label modeled plant vs Open-Meteo weather."
)


@app.post("/api/sitrep/analyze")
async def api_sitrep_analyze(req: SitrepAnalyzeRequest) -> dict[str, Any]:
    """Groq-backed executive paragraph for EXPORT SITREP PDF."""
    client = _groq_client
    if client is None:
        return {"ok": False, "analysis": None, "reason": "no_groq_key"}

    payload = req.model_dump()
    models = [
        os.getenv("LLM_MODEL", "openai/gpt-oss-20b"),
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
    ]
    seen: set[str] = set()
    last_reason = "empty"

    def _extract(message: Any) -> str:
        content = getattr(message, "content", None)
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    parts.append(str(part.get("text") or ""))
                else:
                    parts.append(str(getattr(part, "text", part) or ""))
            return "".join(parts).strip()
        return (content or "").strip()

    for model in models:
        if model in seen:
            continue
        seen.add(model)
        try:
            result = await asyncio.to_thread(
                lambda m=model: client.chat.completions.create(
                    model=m,
                    temperature=0.2,
                    max_tokens=1200,
                    messages=[
                        {"role": "system", "content": SITREP_SYSTEM},
                        {
                            "role": "user",
                            "content": (
                                "Write the executive analysis from these station facts:\n"
                                + json.dumps(payload, default=str)
                            ),
                        },
                    ],
                )
            )
            text = _extract(result.choices[0].message)
            if text:
                return {"ok": True, "analysis": text, "model": model}
            last_reason = f"empty:{model}"
            print(f"[sitrep] empty content from {model}")
        except Exception as exc:  # noqa: BLE001
            last_reason = str(exc)
            print(f"[sitrep] {model} failed: {exc}")
            continue

    return {"ok": False, "analysis": None, "reason": last_reason}


@app.post("/api/voice/turn")
async def api_turn(req: TurnRequest) -> dict[str, Any]:
    return await handle_turn(req.message, req.history)


@app.websocket("/ws/voice")
async def voice_socket(websocket: WebSocket):
    await websocket.accept()
    session = AudioSession()
    turn_lock = asyncio.Lock()
    pending: set[asyncio.Task] = set()
    await websocket.send_json({"type": "status", "message": "connected"})
    session.history.append({"role": "assistant", "content": GREETING})

    async def begin_turn(user_text: str) -> None:
        text = str(user_text or "").strip()
        if not text:
            return
        session.reset_after_transcript()
        session.silence_ms = 0
        session.last_frame_had_speech = False
        async with turn_lock:
            if session.assistant_speaking:
                session.interrupted = True
                try:
                    await websocket.send_json({"type": "interrupt"})
                except Exception:
                    pass
                session.assistant_speaking = False
                session.speak_deadline = 0.0
            await run_ops_turn(websocket, session, text)

    def schedule_turn(user_text: str) -> None:
        task = asyncio.create_task(begin_turn(user_text))
        pending.add(task)
        task.add_done_callback(pending.discard)

    greet_task = asyncio.create_task(speak(websocket, session, GREETING))
    pending.add(greet_task)
    greet_task.add_done_callback(pending.discard)

    last_check = time.time()
    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive(), timeout=0.12)
            except asyncio.TimeoutError:
                message = None

            if message is not None:
                if message.get("type") == "websocket.disconnect":
                    break
                raw_bytes = message.get("bytes")
                raw_text = message.get("text")
                if raw_bytes:
                    if session.assistant_speaking:
                        keep = int(SAMPLE_RATE * 2 * 0.18)
                        session.pcm_buffer = bytearray(raw_bytes[-keep:])
                    elif time.time() >= session.interrupt_cooldown_until:
                        session.add_chunk(raw_bytes)
                elif raw_text:
                    try:
                        data = json.loads(raw_text)
                    except json.JSONDecodeError:
                        data = None
                    if isinstance(data, dict):
                        kind = data.get("type")
                        if kind == "playback_ended":
                            await _end_speaking(websocket, session, listen=True)
                        elif kind == "text" and data.get("text"):
                            schedule_turn(str(data["text"]))
                        elif kind == "browser_stt":
                            session.browser_stt = bool(data.get("enabled"))

            now = time.time()
            if (
                session.assistant_speaking
                and session.speak_deadline
                and now > session.speak_deadline
            ):
                print("[Voice] speaking timeout — returning to listen")
                await _end_speaking(websocket, session, listen=True)

            if now - last_check < 0.15:
                continue
            last_check = now

            if now < session.echo_guard_until:
                continue

            if session.browser_stt and not session.assistant_speaking:
                continue

            if turn_lock.locked() or session.stt_busy:
                continue

            pcm = session.get_full_pcm()
            if len(pcm) == 0:
                continue

            if session.assistant_speaking:
                barge_threshold = max(session.speech_threshold * 3.5, 900.0)
                speaking_detected = has_speech(pcm, window_ms=150, threshold=barge_threshold)
                if speaking_detected:
                    session.barge_in_speech_ms += 150
                    if (
                        session.barge_in_speech_ms >= BARGE_IN_CONFIRM_MS
                        and not session.interrupted
                    ):
                        session.interrupted = True
                        session.assistant_speaking = False
                        session.speak_deadline = 0.0
                        session.interrupt_cooldown_until = time.time() + 0.20
                        await websocket.send_json({"type": "interrupt"})
                        await websocket.send_json({"type": "status", "message": "listening"})
                        session.reset_for_interrupt(session.barge_in_speech_ms)
                        session.silence_ms = 0
                        session.last_frame_had_speech = True
                        session.user_speaking_start_time = 0
                else:
                    session.barge_in_speech_ms = 0
                continue

            speaking_now = has_speech(pcm, window_ms=300, threshold=session.speech_threshold)
            if speaking_now:
                session.silence_ms = 0
                session.last_frame_had_speech = True
                if session.user_speaking_start_time == 0:
                    session.user_speaking_start_time = now
            else:
                session.silence_ms += 150
                if session.silence_ms >= 500:
                    session.user_speaking_start_time = 0
                if (
                    session.silence_ms >= 1000
                    and len(pcm) >= FRAME_SIZE
                    and now - session.last_recalibration_time > 10.0
                ):
                    tail = pcm[-FRAME_SIZE * int(300 / FRAME_MS) :]
                    ambient_rms = float(np.sqrt(np.mean(np.square(tail.astype(np.float32)))))
                    session.noise_floor_rms = 0.7 * session.noise_floor_rms + 0.3 * ambient_rms
                    session.last_recalibration_time = now

            if session.last_frame_had_speech and session.silence_ms >= SILENCE_MS_TO_FINALIZE:
                final_pcm = session.get_full_pcm()
                session.reset_after_transcript()
                session.silence_ms = 0
                session.last_frame_had_speech = False
                session.user_speaking_start_time = 0

                if len(final_pcm) < 1600:
                    await websocket.send_json({"type": "status", "message": "listening"})
                    continue

                peak_rms = get_peak_rms(final_pcm, frame_ms=30)
                silence_threshold = max(session.noise_floor_rms * 2.0, 220.0)
                if peak_rms < silence_threshold:
                    await websocket.send_json({"type": "status", "message": "listening"})
                    continue

                prepared = prepare_utterance(final_pcm, session.noise_floor_rms)
                if len(prepared) < 3200:
                    await websocket.send_json({"type": "status", "message": "listening"})
                    continue

                session.stt_busy = True
                recent = " ".join(
                    f"{item.get('role')}: {item.get('content')}"
                    for item in session.history[-4:]
                )

                async def finish_stt(chunk: np.ndarray, recent_text: str) -> None:
                    try:
                        await websocket.send_json({"type": "status", "message": "transcribing"})
                        text, err = await asyncio.wait_for(
                            transcribe(chunk, recent_text),
                            timeout=20,
                        )
                    except Exception as exc:
                        print(f"[STT] {exc}")
                        text, err = "", str(exc)
                    finally:
                        session.stt_busy = False

                    last_assistant = ""
                    last_user = ""
                    for item in reversed(session.history):
                        if item.get("role") == "assistant" and not last_assistant:
                            last_assistant = str(item.get("content") or "")
                        if item.get("role") == "user" and not last_user:
                            last_user = str(item.get("content") or "")
                        if last_assistant and last_user:
                            break
                    if (
                        is_echo_transcript(text, last_assistant)
                        or is_repeat_transcript(text, last_user)
                    ):
                        print(f"[STT] Dropped echo/repeat: {text!r}")
                        text = ""

                    if not text:
                        try:
                            if err:
                                await websocket.send_json(
                                    {
                                        "type": "notice",
                                        "level": "error",
                                        "message": (
                                            "Speech-to-text is unreachable. Check the "
                                            "network — typed orders still work."
                                        ),
                                    }
                                )
                            await websocket.send_json({"type": "status", "message": "listening"})
                        except Exception:
                            pass
                        return

                    print("[STT]", text.encode("ascii", "backslashreplace").decode("ascii"))
                    schedule_turn(text)

                task = asyncio.create_task(finish_stt(prepared, recent))
                pending.add(task)
                task.add_done_callback(pending.discard)
    except (WebSocketDisconnect, RuntimeError):
        print("[Voice] client disconnected")
    finally:
        for task in list(pending):
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
