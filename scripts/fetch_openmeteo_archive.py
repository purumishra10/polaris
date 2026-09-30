"""Pull multi-year Open-Meteo archive (Indian stations + Russian proxies)."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "datasets" / "environment"

STATIONS = {
    "BHARATI": {"lat": -69.40680, "lon": 76.19525},
    "PROGRESS": {"lat": -69.3750, "lon": 76.3817},
    "MAITRI": {"lat": -70.76683367, "lon": 11.73078318},
    "NOVOLAZAREVSKAYA": {"lat": -70.7769, "lon": 11.8239},
}

HOURLY = ",".join(
    [
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_2m",
        "surface_pressure",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "direct_normal_irradiance",
        "diffuse_radiation",
        "snowfall",
    ]
)
UA = "PolarisAntarcticDigitalTwin/1.0 (NCPOR SIH 26060)"


def fetch(station: str, start: str, end: str) -> dict:
    meta = STATIONS[station]
    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={meta['lat']}&longitude={meta['lon']}"
        f"&start_date={start}&end_date={end}"
        f"&hourly={HOURLY}&wind_speed_unit=kn&timezone=UTC"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    start = os.environ.get("OM_START", "2022-01-01")
    end = os.environ.get("OM_END", "2024-12-31")
    OUT.mkdir(parents=True, exist_ok=True)
    failed = 0
    for station in STATIONS:
        try:
            data = fetch(station, start, end)
            n = len((data.get("hourly") or {}).get("time") or [])
            path = OUT / f"openmeteo_hourly_{start[:4]}_{end[:4]}_{station.lower()}.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            units = data.get("hourly_units", {})
            print(f"[OK] {station} n={n} wind_unit={units.get('wind_speed_10m')} -> {path.name}")
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL] {station}: {exc}")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
