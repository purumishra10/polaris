# Polaris Station Ops Voice (port 8002)

Voice operator for the Bharati / Maitri twin. Audio loop is adapted from EchoPilot; there is **no clinic, booking, or healthcare persona**.

Requires the twin engine on `:8000`. Groq key (`GROQ_API_KEY`) for Whisper + `openai/gpt-oss-20b`; Ollama is a fallback.

```
cd voice-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --host 127.0.0.1 --port 8002
```

Frontend HUD: open Polaris, click **AI** in the bottom-right dock, then speak or type.

Male TTS defaults to `en-GB-RyanNeural` (override with `POLARIS_TTS_VOICE`). Do not pass SSML into Edge — it would read the XML tags aloud.
