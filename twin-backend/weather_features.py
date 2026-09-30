"""Shared feature construction for polar weather nowcast.

Wind in this module is always knots. 2023 landing files are km/h; 2022–2024
archive pulls are already kn (see hourly_units).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import json
import numpy as np

KMH_TO_KN = 1.0 / 1.852
SEQ_LEN = 12
HORIZON = 6
LOCKOUT_KT = 23.0
HELI_KT = 40.0

TABULAR_NAMES = [
    "temp_c",
    "wind_kn",
    "gust_kn",
    "pres_hpa",
    "rh",
    "dni",
    "snow",
    "wdir_sin",
    "wdir_cos",
    "month",
    "hour",
    "dP_3h",
    "dW_3h",
    "dG_3h",
    "dT_3h",
    "gust_ma6",
    "pres_ma6",
    "nbr_temp_c",
    "nbr_wind_kn",
    "nbr_gust_kn",
    "nbr_pres_hpa",
    "nbr_dG_3h",
    "nbr_dP_3h",
    "gust_minus_nbr",
]

SEQ_NAMES = [
    "temp_c",
    "wind_kn",
    "gust_kn",
    "pres_hpa",
    "rh",
    "dni",
    "nbr_wind_kn",
    "nbr_gust_kn",
    "nbr_pres_hpa",
]


def _unit_is_kmh(units: dict[str, Any] | None, key: str) -> bool:
    raw = str((units or {}).get(key, "")).lower()
    return "km" in raw


def load_hourly(path: Path) -> dict[str, np.ndarray | list[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    hourly = data.get("hourly") or {}
    units = data.get("hourly_units") or {}
    times = list(hourly.get("time") or [])
    wind_scale = KMH_TO_KN if _unit_is_kmh(units, "wind_speed_10m") else 1.0
    gust_scale = KMH_TO_KN if _unit_is_kmh(units, "wind_gusts_10m") else 1.0

    def col(name: str, scale: float = 1.0) -> np.ndarray:
        raw = hourly.get(name) or [np.nan] * len(times)
        arr = np.array(
            [np.nan if v is None else float(v) for v in raw],
            dtype=float,
        )
        return arr * scale

    temp = col("temperature_2m")
    wind = col("wind_speed_10m", wind_scale)
    gust = col("wind_gusts_10m", gust_scale)
    gust = np.fmax(gust, wind)
    return {
        "t": times,
        "temp": temp,
        "wind": wind,
        "gust": gust,
        "pres": col("surface_pressure"),
        "rh": col("relative_humidity_2m"),
        "dni": col("direct_normal_irradiance"),
        "snow": col("snowfall"),
        "wdir": col("wind_direction_10m"),
        "month": np.array([int(x[5:7]) for x in times], dtype=float),
        "hour": np.array([int(x[11:13]) for x in times], dtype=float),
    }


def align_neighbor(local: dict, neighbor: dict) -> dict[str, np.ndarray]:
    index = {t: i for i, t in enumerate(neighbor["t"])}
    n = len(local["t"])
    out = {k: np.full(n, np.nan) for k in ("temp", "wind", "gust", "pres")}
    for i, t in enumerate(local["t"]):
        j = index.get(t)
        if j is None:
            continue
        out["temp"][i] = neighbor["temp"][j]
        out["wind"][i] = neighbor["wind"][j]
        out["gust"][i] = neighbor["gust"][j]
        out["pres"][i] = neighbor["pres"][j]
    return out


def _delta(x: np.ndarray, k: int) -> np.ndarray:
    out = np.full_like(x, np.nan, dtype=float)
    out[k:] = x[k:] - x[:-k]
    return out


def _roll_mean(x: np.ndarray, k: int) -> np.ndarray:
    out = np.full_like(x, np.nan, dtype=float)
    if len(x) < k:
        return out
    c = np.cumsum(np.nan_to_num(x, nan=0.0))
    valid = np.isfinite(x).astype(float)
    cv = np.cumsum(valid)
    s = c[k - 1 :] - np.concatenate([[0.0], c[:-k]])
    n = cv[k - 1 :] - np.concatenate([[0.0], cv[:-k]])
    vals = np.divide(s, n, out=np.full_like(s, np.nan), where=n > 0)
    out[k - 1 :] = vals
    return out


def _future_max(x: np.ndarray, h: int) -> np.ndarray:
    n = len(x)
    out = np.full(n, np.nan)
    if n <= h:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(x, h)
    out[: n - h] = np.nanmax(windows[1 : n - h + 1], axis=1)
    return out


def _future_min(x: np.ndarray, h: int) -> np.ndarray:
    n = len(x)
    out = np.full(n, np.nan)
    if n <= h:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(x, h)
    out[: n - h] = np.nanmin(windows[1 : n - h + 1], axis=1)
    return out


def _future_any(mask: np.ndarray, h: int) -> np.ndarray:
    n = len(mask)
    out = np.full(n, np.nan)
    if n <= h:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(mask.astype(float), h)
    out[: n - h] = (np.nanmax(windows[1 : n - h + 1], axis=1) >= 1.0).astype(float)
    return out


def tabular_matrix(local: dict, nbr: dict) -> np.ndarray:
    wdir = np.deg2rad(local["wdir"])
    dP = _delta(local["pres"], 3)
    dW = _delta(local["wind"], 3)
    dG = _delta(local["gust"], 3)
    dT = _delta(local["temp"], 3)
    n_dG = _delta(nbr["gust"], 3)
    n_dP = _delta(nbr["pres"], 3)
    return np.column_stack(
        [
            local["temp"],
            local["wind"],
            local["gust"],
            local["pres"],
            local["rh"],
            local["dni"],
            local["snow"],
            np.sin(wdir),
            np.cos(wdir),
            local["month"],
            local["hour"],
            dP,
            dW,
            dG,
            dT,
            _roll_mean(local["gust"], 6),
            _roll_mean(local["pres"], 6),
            nbr["temp"],
            nbr["wind"],
            nbr["gust"],
            nbr["pres"],
            n_dG,
            n_dP,
            local["gust"] - nbr["gust"],
        ]
    ).astype(float)


def sequence_matrix(local: dict, nbr: dict) -> np.ndarray:
    return np.column_stack(
        [
            local["temp"],
            local["wind"],
            local["gust"],
            local["pres"],
            local["rh"],
            local["dni"],
            nbr["wind"],
            nbr["gust"],
            nbr["pres"],
        ]
    ).astype(float)


def targets(local: dict) -> dict[str, np.ndarray]:
    return {
        "gust_max_6h": _future_max(local["gust"], HORIZON),
        "wind_max_6h": _future_max(local["wind"], HORIZON),
        "temp_min_6h": _future_min(local["temp"], HORIZON),
        "lock23": _future_any(local["gust"] >= LOCKOUT_KT, HORIZON),
        "lock40": _future_any(local["gust"] >= HELI_KT, HORIZON),
    }


def valid_mask(X: np.ndarray, y: dict[str, np.ndarray], seq_start: int = 0) -> np.ndarray:
    ok = np.isfinite(X).all(axis=1)
    for arr in y.values():
        ok &= np.isfinite(arr)
    if seq_start:
        ok[:seq_start] = False
    return ok


def window_sequences(seq: np.ndarray, idx: np.ndarray, length: int = SEQ_LEN) -> np.ndarray:
    out = np.zeros((len(idx), length, seq.shape[1]), dtype=np.float32)
    for row, i in enumerate(idx):
        out[row] = seq[i - length + 1 : i + 1]
    return out


def rows_from_hourly_tail(
    hours: list[dict[str, float]],
    neighbor_hours: list[dict[str, float]] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Build one tabular row + sequence from live Open-Meteo hourly_tail."""

    def pack(rows: list[dict[str, float]]) -> dict:
        t = [str(r.get("time") or r.get("t") or "") for r in rows]
        def take(key: str, *alts: str) -> np.ndarray:
            vals = []
            for r in rows:
                v = None
                for k in (key, *alts):
                    if r.get(k) is not None:
                        v = r[k]
                        break
                vals.append(np.nan if v is None else float(v))
            return np.array(vals, dtype=float)

        wind = take("wind_kn", "wind_speed_10m", "wind")
        gust = take("gust_kn", "wind_gusts_10m", "gust")
        gust = np.fmax(gust, wind)
        times = t
        month = np.array([int(x[5:7]) if len(x) >= 7 else 1 for x in times], dtype=float)
        hour = np.array([int(x[11:13]) if len(x) >= 13 else 0 for x in times], dtype=float)
        return {
            "t": times,
            "temp": take("temp_c", "temperature_2m", "temp"),
            "wind": wind,
            "gust": gust,
            "pres": take("pres_hpa", "surface_pressure", "pressure"),
            "rh": take("rh", "relative_humidity_2m"),
            "dni": take("dni", "shortwave_radiation", "direct_normal_irradiance"),
            "snow": take("snow", "snowfall"),
            "wdir": take("wdir", "wind_direction_10m"),
            "month": month,
            "hour": hour,
        }

    local = pack(hours)
    if neighbor_hours:
        nbr = align_neighbor(local, pack(neighbor_hours))
    else:
        nbr = {
            "temp": local["temp"].copy(),
            "wind": local["wind"].copy(),
            "gust": local["gust"].copy(),
            "pres": local["pres"].copy(),
        }
    X = tabular_matrix(local, nbr)
    S = sequence_matrix(local, nbr)
    return X, S
