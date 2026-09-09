"""Fetch Open-Meteo forecast + NOAA SWPC into datasets/.

Run from repo root:
  python scripts/fetch_live_weather.py
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "station-mock-server"))

from live_weather import STATIONS, fetch_noaa_space_weather, fetch_station_forecast  # noqa: E402


def main() -> int:
    failed = 0
    for station in STATIONS:
        obs = fetch_station_forecast(station)
        if obs:
            print(
                f"[OK] {station}  T={obs.get('temp_c')} C  "
                f"wind={obs.get('wind_speed_knots')} kn  "
                f"gust={obs.get('wind_gust_knots')} kn  "
                f"solar={obs.get('solar_flux_w_m2')} W/m2  "
                f"@ {obs.get('model_time')}"
            )
        else:
            print(f"[FAIL] {station} Open-Meteo")
            failed += 1
    space = fetch_noaa_space_weather()
    if space:
        print(
            f"[OK] NOAA  Kp={space.get('kp')}  "
            f"est={space.get('estimated_kp')}  "
            f"xray={space.get('xray_flux')}  "
            f"@ {space.get('kp_time')}"
        )
    else:
        print("[FAIL] NOAA SWPC")
        failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
