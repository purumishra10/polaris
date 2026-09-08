"""Satellite ingestion worker: poll edge -> enrich -> cache -> broadcast.

One asyncio task for the process lifetime. Never wipes the cache on failure;
re-broadcasts the last good payload marked DEGRADED instead.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import WebSocket
from pydantic import ValidationError

import satellite
from anomaly import AnomalyScorer
from config import settings
from models import RawTelemetry, StationTelemetry
from lockouts import compute_lockouts
from sop import build_risk

log = logging.getLogger("polaris.ingest")


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    @property
    def count(self) -> int:
        return len(self._clients)

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            targets = list(self._clients)
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)


class TwinState:
    """In-memory HQ state. No database by design."""

    def __init__(self, scorer: AnomalyScorer, manager: ConnectionManager) -> None:
        self.scorer = scorer
        self.manager = manager
        self.client: Optional[httpx.AsyncClient] = None

        self.latest: Optional[StationTelemetry] = None
        self.last_ingest_utc: Optional[str] = None
        self.last_latency_ms: Optional[int] = None
        self.consecutive_edge_failures: int = 0
        self.edge_reachable: bool = False
        self.active_station: str = "BHARATI"

        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    # ------------------------------------------------------------------ #
    # lifecycle
    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=settings.edge_base_url,
            timeout=settings.edge_timeout_seconds,
        )
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="polaris-ingest")
        log.info(
            "Ingest worker started -> %s every %.1fs (sat %d–%d ms)",
            settings.edge_base_url,
            settings.poll_interval_seconds,
            settings.sat_latency_min_ms,
            settings.sat_latency_max_ms,
        )

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        if self.client:
            await self.client.aclose()

    # ------------------------------------------------------------------ #
    # enrichment
    # ------------------------------------------------------------------ #
    def enrich(self, raw: RawTelemetry, latency_ms: int) -> StationTelemetry:
        result = self.scorer.score(raw)
        risk = build_risk(raw, result.anomaly_score, result.is_outlier)
        lockouts = compute_lockouts(raw)
        payload = raw.model_dump()
        payload["lockouts"] = lockouts.model_dump()
        return StationTelemetry(
            **payload,
            link_status=satellite.online(latency_ms),
            risk=risk,
        )

    # ------------------------------------------------------------------ #
    # poll loop
    # ------------------------------------------------------------------ #
    async def _tick(self) -> None:
        assert self.client is not None
        latency_ms = await satellite.satellite_delay()

        try:
            resp = await self.client.get("/edge/raw-telemetry")
            resp.raise_for_status()
            raw = RawTelemetry.model_validate(resp.json())
        except (httpx.HTTPError, ValidationError, ValueError) as exc:
            await self._on_failure(exc)
            return

        enriched = self.enrich(raw, latency_ms)
        self.latest = enriched
        self.active_station = raw.station_id
        self.last_latency_ms = latency_ms
        self.last_ingest_utc = datetime.now(timezone.utc).isoformat()
        if self.consecutive_edge_failures:
            log.info("Edge link restored after %d failures", self.consecutive_edge_failures)
        self.consecutive_edge_failures = 0
        self.edge_reachable = True

        await self.manager.broadcast(enriched.model_dump())

    async def _on_failure(self, exc: Exception) -> None:
        self.consecutive_edge_failures += 1
        self.edge_reachable = False
        log.warning(
            "Edge poll failed (%d consecutive): %s",
            self.consecutive_edge_failures,
            exc.__class__.__name__,
        )
        if self.latest is None:
            return
        degraded = self.latest.model_copy(
            update={"link_status": satellite.degraded(self.last_latency_ms)}
        )
        self.latest = degraded
        await self.manager.broadcast(degraded.model_dump())

    async def _loop(self) -> None:
        while not self._stop.is_set():
            t0 = time.monotonic()
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                log.exception("Unexpected ingest error; continuing")
            elapsed = time.monotonic() - t0
            await asyncio.sleep(max(0.0, settings.poll_interval_seconds - elapsed))

    # ------------------------------------------------------------------ #
    # helpers for routes
    # ------------------------------------------------------------------ #
    def snapshot(self) -> Optional[dict]:
        return self.latest.model_dump() if self.latest else None
