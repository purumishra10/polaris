"""Environment configuration for the Polaris Digital Twin Engine (Dev 2, port 8000).

Reads only twin-backend/.env. Never reads the SIH-root .env (research/Postgres stack).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


@dataclass(frozen=True)
class Settings:
    api_host: str = _env("POLARIS_API_HOST", "127.0.0.1")
    api_port: int = int(_env("POLARIS_API_PORT", "8000"))
    edge_base_url: str = _env("EDGE_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
    poll_interval_seconds: float = float(_env("POLL_INTERVAL_SECONDS", "2.0"))
    sat_latency_min_ms: int = int(_env("SAT_LATENCY_MIN_MS", "400"))
    sat_latency_max_ms: int = int(_env("SAT_LATENCY_MAX_MS", "800"))
    edge_timeout_seconds: float = float(_env("EDGE_TIMEOUT_SECONDS", "3.0"))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in _env(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if o.strip()
        ]
    )
    isolation_forest_path: Path = field(
        default_factory=lambda: (
            BASE_DIR / _env("ISOLATION_FOREST_PATH", "artifacts/isolation_forest.joblib")
        ).resolve()
    )
    log_level: str = _env("LOG_LEVEL", "INFO").upper()

    # Constants from the team contract
    link_type: str = "C-band/LEO"
    degraded_after_failures: int = 3
    degraded_latency_ms: int = 800


settings = Settings()
