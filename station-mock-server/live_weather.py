"""Poll public weather APIs for Bharati / Maitri.

NCPOR does not expose live AWS or fuel sockets. Open-Meteo forecast (ERA5-style
model) is the best free point weather we can poll without a key. NOAA SWPC is
live space weather. Fuel / CHP stay modeled.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("polaris.live_weather")

UA = "PolarisAntarcticDigitalTwin/1.0 (NCPOR SIH 26060)"

STATIONS = {
    "BHARATI": {"lat": -69.40680, "lon": 76.19525},
    "MAITRI": {"lat": -70.76683367, "lon": 11.73078318},
    "PROGRESS": {"lat": -69.3750, "lon": 76.3817},
    "NOVOLAZAREVSKAYA": {"lat": -70.7769, "lon": 11.8239},
}

NEIGHBOR = {
    "BHARATI": "PROGRESS",
    "MAITRI": "NOVOLAZAREVSKAYA",
}

DATA_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "datasets")
)


def _get_json(url: str, timeout: int = 20) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _save(rel_path: str, payload: Any) -> None:
    path = os.path.join(DATA_DIR, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def fetch_station_forecast(station_id: str) -> dict[str, Any] | None:
    meta = STATIONS[station_id]
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={meta['lat']}&longitude={meta['lon']}"
        "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,"
        "shortwave_radiation,relative_humidity_2m,surface_pressure"
        "&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,shortwave_radiation,"
        "relative_humidity_2m,surface_pressure,snowfall,wind_direction_10m"
        "&wind_speed_unit=kn&past_days=2&forecast_days=2&timezone=UTC"
    )
    try:
        data = _get_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        log.warning("Open-Meteo %s failed: %s", station_id, exc)
        return None

    current = data.get("current") or {}
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    cursor = str(current.get("time") or "")[:16]
    idx = 0
    for i, t in enumerate(times):
        if str(t)[:16] <= cursor:
            idx = i
    start = max(0, idx - 18)
    end = min(len(times), idx + 12)
    slim_hourly = {
        key: (hourly.get(key) or [])[start:end]
        for key in hourly
        if isinstance(hourly.get(key), list)
    }
    obs = {
        "station_id": station_id,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "provider": "OPEN_METEO_FORECAST",
        "model_time": current.get("time"),
        "temp_c": current.get("temperature_2m"),
        "wind_speed_knots": current.get("wind_speed_10m"),
        "wind_gust_knots": current.get("wind_gusts_10m"),
        "solar_flux_w_m2": current.get("shortwave_radiation"),
        "rh_pct": current.get("relative_humidity_2m"),
        "pressure_hpa": current.get("surface_pressure"),
        "hourly_tail": slim_hourly if times else {},
    }
    _save(f"environment/openmeteo_live_{station_id.lower()}.json", obs)
    return obs


def fetch_noaa_space_weather() -> dict[str, Any] | None:
    kp_url = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
    xray_url = "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json"
    out: dict[str, Any] = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "provider": "NOAA_SWPC",
    }
    try:
        kp_rows = _get_json(kp_url)
        _save("space_weather/planetary_k_index_1m.json", kp_rows)
        last = kp_rows[-1] if kp_rows else {}
        out["kp"] = last.get("kp_index")
        out["estimated_kp"] = last.get("estimated_kp")
        out["kp_time"] = last.get("time_tag")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, IndexError) as exc:
        log.warning("NOAA Kp failed: %s", exc)

    try:
        xray_rows = _get_json(xray_url)
        _save("space_weather/solar_xray_flux_6h.json", xray_rows)
        last_x = xray_rows[-1] if xray_rows else {}
        out["xray_flux"] = last_x.get("flux")
        out["xray_time"] = last_x.get("time_tag")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, IndexError) as exc:
        log.warning("NOAA X-ray failed: %s", exc)

    if "kp" not in out and "xray_flux" not in out:
        return None
    _save("space_weather/noaa_live_snapshot.json", out)
    return out


def ambient_from_obs(obs: dict[str, Any]) -> dict[str, float] | None:
    try:
        temp = float(obs["temp_c"])
        wind = float(obs["wind_speed_knots"])
        solar = float(obs.get("solar_flux_w_m2") or 0)
    except (TypeError, ValueError, KeyError):
        return None
    out = {
        "temp_c": temp,
        "wind_speed_knots": max(0.0, wind),
        "solar_flux_w_m2": max(0.0, solar),
    }
    try:
        out["pressure_hpa"] = float(obs.get("pressure_hpa"))
    except (TypeError, ValueError):
        pass
    return out


def weather_context(
    obs: dict[str, Any] | None,
    neighbor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not obs:
        return {}
    return {
        "provider": obs.get("provider"),
        "model_time": obs.get("model_time"),
        "wind_gust_knots": obs.get("wind_gust_knots"),
        "rh_pct": obs.get("rh_pct"),
        "pressure_hpa": obs.get("pressure_hpa"),
        "hourly": obs.get("hourly_tail"),
        "neighbor_id": (neighbor or {}).get("station_id"),
        "neighbor_hourly": (neighbor or {}).get("hourly_tail"),
    }


class LiveWeather:
    def __init__(self) -> None:
        self.obs: dict[str, dict[str, Any]] = {}
        self.space: dict[str, Any] | None = None
        self.last_ok: str | None = None

    def snapshot(self, station_id: str) -> dict[str, Any] | None:
        return self.obs.get(station_id)

    def refresh(self, station_id: str) -> bool:
        obs = fetch_station_forecast(station_id)
        neighbor_id = NEIGHBOR.get(station_id)
        if neighbor_id:
            nbr = fetch_station_forecast(neighbor_id)
            if nbr:
                self.obs[neighbor_id] = nbr
        if obs and ambient_from_obs(obs):
            self.obs[station_id] = obs
            self.last_ok = datetime.now(timezone.utc).isoformat()
            ok = True
        else:
            ok = False
        space = fetch_noaa_space_weather()
        if space:
            self.space = space
        return ok
