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
from tts import synthesize, warm_cache

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

SAMPLE_RATE = 16000
FRAME_MS = 30
FRAME_SIZE = int(SAMPLE_RATE * FRAME_MS / 1000)
SILENCE_MS_TO_FINALIZE = 900
BARGE_IN_CONFIRM_MS = 250
MAX_CAPTURE_SEC = 15
GREETING = "Polaris online. Say fuel, blizzard, map, or the fifth of August."
STT_PROMPT = (
    "Polaris, Bharati, Maitri, fuel, tank, blizzard, map, weather, wind, "
    "power, sitrep, hatch, August fifth, replay, Jet A-1"
)
NO_SPEECH_PROB_THRESHOLD = 0.80
AVG_LOGPROB_THRESHOLD = -1.0
GROQ_FAILURE_THRESHOLD = 3
GROQ_CIRCUIT_OPEN_SECONDS = 30
GROQ_TIMEOUT_SECONDS = 4.0
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
}


def groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "").strip()


def groq_client() -> OpenAI | None:
    key = groq_key()
    if not key:
        return None
    return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=key)


_groq_client = groq_client()
_groq_failure_count = 0
_groq_circuit_open_until = 0.0
_local_whisper = None


def get_local_whisper():
    global _local_whisper
    if _local_whisper is None and WhisperModel:
        try:
            _local_whisper = WhisperModel("small", device="cuda", compute_type="float16")
            print("[STT] Local CUDA faster-whisper")
        except Exception:
            try:
                _local_whisper = WhisperModel("small", device="cpu", compute_type="int8")
                print("[STT] Local CPU faster-whisper")
            except Exception as exc:
                print(f"[STT] Local whisper skipped: {exc}")
    return _local_whisper


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
    lowered = text.lower().strip()
    has_cyrillic = any("\u0400" <= char <= "\u04ff" for char in text)
    return (
        len(lowered) < 2
        or has_cyrillic
        or lowered in HALLUCINATION_EXACT
        or any(part in lowered for part in HALLUCINATION_SUBSTRINGS)
    )


def transcribe(pcm: np.ndarray) -> tuple[str, str]:
    global _groq_failure_count, _groq_circuit_open_until

    text = ""
    last_error = ""
    circuit_open = time.time() < _groq_circuit_open_until

    if _groq_client and not circuit_open:
        try:
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(pcm.tobytes())
            wav_io.seek(0)
            wav_io.name = "audio.wav"
            transcription = _groq_client.audio.transcriptions.create(
                file=wav_io,
                model="whisper-large-v3",
                language="en",
                temperature=0,
                response_format="verbose_json",
                prompt=STT_PROMPT,
                timeout=GROQ_TIMEOUT_SECONDS,
            )
            segments_data = getattr(transcription, "segments", None) or []
            if segments_data:
                all_no_speech = all(
                    getattr(seg, "no_speech_prob", 0.0) > NO_SPEECH_PROB_THRESHOLD
                    and getattr(seg, "avg_logprob", 0.0) < AVG_LOGPROB_THRESHOLD
                    for seg in segments_data
                )
                if all_no_speech:
                    return "", ""
            text = (transcription.text or "").strip()
            _groq_failure_count = 0
        except Exception as exc:
            last_error = str(exc)
            _groq_failure_count += 1
            if _groq_failure_count >= GROQ_FAILURE_THRESHOLD:
                _groq_circuit_open_until = time.time() + GROQ_CIRCUIT_OPEN_SECONDS
                print(f"[STT] Groq circuit open after {_groq_failure_count} failures: {exc}")
            else:
                print(f"[STT] Groq error ({_groq_failure_count}/{GROQ_FAILURE_THRESHOLD}): {exc}")

    if not text:
        local_model = get_local_whisper()
        if local_model:
            try:
                pcm_float = pcm.astype(np.float32) / 32768.0
                segments, _ = local_model.transcribe(
                    pcm_float,
                    language="en",
                    temperature=0,
                    vad_filter=False,
                    beam_size=5,
                    initial_prompt=STT_PROMPT,
                )
                text = " ".join(seg.text.strip() for seg in segments).strip()
                if time.time() >= _groq_circuit_open_until and _groq_failure_count >= GROQ_FAILURE_THRESHOLD:
                    _groq_failure_count = 0
                    print("[STT] Groq circuit closed — will retry next turn")
            except Exception as exc:
                last_error = str(exc)
                print(f"[STT] local whisper failed: {exc}")

    if _is_hallucination(text):
        print(f"[STT] dropped hallucination: {text!r}")
        return "", ""
    if not text:
        return "", last_error
    return text, ""


def _speak_deadline(text: str) -> float:
    words = max(1, len(text.split()))
    return time.time() + min(45.0, max(8.0, words * 0.45 + 3.0))


async def speak(websocket: WebSocket, session: AudioSession, text: str) -> None:
    session.assistant_speaking = True
    session.barge_in_speech_ms = 0
    session.interrupted = False
    session.speak_deadline = _speak_deadline(text)
    await websocket.send_json(
        {"type": "transcript", "text": text, "final": True, "speaker": "assistant"}
    )
    await websocket.send_json({"type": "status", "message": "speaking"})
    try:
        audio_bytes = await synthesize(text)
        if session.interrupted:
            session.assistant_speaking = False
            session.speak_deadline = 0.0
            return
        if audio_bytes:
            await websocket.send_bytes(audio_bytes)
            return
        await websocket.send_json({"type": "tts_fallback", "text": text})
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
                await websocket.send_json({"type": "tts_fallback", "text": text})
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
    return {
        "status": "ONLINE",
        "service": "polaris-voice",
        "stt": "groq" if key else ("local" if get_local_whisper() else "none"),
        "llm": bool(key),
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
                        session.add_chunk(raw_bytes)
                        cap = int(SAMPLE_RATE * 2 * 0.45)
                        if len(session.pcm_buffer) > cap:
                            session.pcm_buffer = session.pcm_buffer[-cap:]
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

            if turn_lock.locked() or session.stt_busy:
                continue

            pcm = session.get_full_pcm()
            if len(pcm) == 0:
                continue

            if session.assistant_speaking:
                barge_threshold = max(session.speech_threshold * 1.8, 350.0)
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
                silence_threshold = max(session.noise_floor_rms * 1.5, 120.0)
                if peak_rms < silence_threshold:
                    await websocket.send_json({"type": "status", "message": "listening"})
                    continue

                session.stt_busy = True

                async def finish_stt(chunk: np.ndarray) -> None:
                    try:
                        await websocket.send_json({"type": "status", "message": "transcribing"})
                        text, err = await asyncio.wait_for(
                            asyncio.to_thread(transcribe, chunk),
                            timeout=20,
                        )
                    except Exception as exc:
                        print(f"[STT] {exc}")
                        text, err = "", str(exc)
                    finally:
                        session.stt_busy = False

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

                task = asyncio.create_task(finish_stt(final_pcm))
                pending.add(task)
                task.add_done_callback(pending.discard)
    except (WebSocketDisconnect, RuntimeError):
        print("[Voice] client disconnected")
    finally:
        for task in list(pending):
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
