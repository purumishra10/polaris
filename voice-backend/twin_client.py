"""Read live twin state. Writes are executed by the Polaris frontend store."""

from __future__ import annotations

import os
from typing import Any

import httpx

TWIN_ENGINE_URL = os.getenv("TWIN_ENGINE_URL", "http://127.0.0.1:8000").rstrip("/")


class TwinUnreachable(RuntimeError):
    pass


async def get_telemetry() -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{TWIN_ENGINE_URL}/api/telemetry")
    except httpx.HTTPError as exc:
        raise TwinUnreachable(f"Twin engine unreachable at {TWIN_ENGINE_URL}") from exc

    if response.status_code == 503:
        raise TwinUnreachable("Twin engine is still initializing")
    if response.status_code >= 400:
        raise TwinUnreachable(f"Twin engine HTTP {response.status_code}")
    return response.json()


async def get_health() -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{TWIN_ENGINE_URL}/health")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as exc:
        raise TwinUnreachable(str(exc)) from exc
