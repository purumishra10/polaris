"""Simulated polar satellite link dynamics.

The sampled 400–800 ms value represents the full round trip the UI should
display. Sleep once per hop; never sleep twice for the same sample.
"""
from __future__ import annotations

import asyncio
import random

from config import settings
from models import LinkStatus


def sample_latency_ms() -> int:
    lo, hi = settings.sat_latency_min_ms, settings.sat_latency_max_ms
    if hi < lo:
        lo, hi = hi, lo
    return random.randint(lo, hi)


async def satellite_delay() -> int:
    """Sleep for one sampled round trip and return the latency in ms."""
    latency = sample_latency_ms()
    await asyncio.sleep(latency / 1000.0)
    return latency


def online(latency_ms: int) -> LinkStatus:
    return LinkStatus(type=settings.link_type, latency_ms=int(latency_ms), health="ONLINE")


def degraded(previous_latency_ms: int | None = None) -> LinkStatus:
    latency = max(previous_latency_ms or 0, settings.degraded_latency_ms)
    return LinkStatus(type=settings.link_type, latency_ms=int(latency), health="DEGRADED")
