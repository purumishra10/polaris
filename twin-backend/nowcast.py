"""6-hour weather nowcast: LSTM/BiLSTM gust + RF lockout probability.

Predictions are reconciled against live sensors so gust >= wind, lockout
probability cannot say CLEAR while gust is already 23 kt, and a WATCH cannot
override an SOP structural lockdown.
"""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

from weather_features import (
    HELI_KT,
    LOCKOUT_KT,
    SEQ_LEN,
    rows_from_hourly_tail,
)

log = logging.getLogger("polaris.nowcast")

NEIGHBOR = {
    "BHARATI": "PROGRESS",
    "MAITRI": "NOVOLAZAREVSKAYA",
}

WATCH_P = 0.45
IMMINENT_P = 0.70


def _hourly_rows(tail: dict[str, Any] | list | None) -> list[dict[str, Any]]:
    if not tail:
        return []
    if isinstance(tail, list):
        return [r for r in tail if isinstance(r, dict)]
    times = tail.get("time") or []
    rows = []
    for i, t in enumerate(times):
        def at(key: str, *alts: str):
            for k in (key, *alts):
                series = tail.get(k)
                if isinstance(series, list) and i < len(series) and series[i] is not None:
                    return series[i]
            return None

        rows.append(
            {
                "time": t,
                "temp_c": at("temperature_2m", "temp_c"),
                "wind_kn": at("wind_speed_10m", "wind_kn"),
                "gust_kn": at("wind_gusts_10m", "gust_kn"),
                "pres_hpa": at("surface_pressure", "pres_hpa"),
                "rh": at("relative_humidity_2m", "rh_pct", "rh"),
                "dni": at("shortwave_radiation", "direct_normal_irradiance", "dni"),
                "snow": at("snowfall", "snow"),
                "wdir": at("wind_direction_10m", "wdir"),
            }
        )
    return rows


class _SeqNet:
    def __init__(self, bundle: dict[str, Any]):
        import torch
        from torch import nn

        self.torch = torch
        hidden = int(bundle["hidden"])
        layers = int(bundle["layers"])
        bidirectional = bool(bundle["bidirectional"])
        n_feat = int(bundle["n_feat"])
        self.seq_len = int(bundle["seq_len"])
        self.mean = np.array(bundle["scaler_mean"], dtype=np.float32)
        self.scale = np.array(bundle["scaler_scale"], dtype=np.float32)
        self.scale[self.scale == 0] = 1.0

        class SeqNet(nn.Module):
            def __init__(self):
                super().__init__()
                self.rnn = nn.LSTM(
                    n_feat,
                    hidden,
                    num_layers=layers,
                    batch_first=True,
                    dropout=0.15 if layers > 1 else 0.0,
                    bidirectional=bidirectional,
                )
                h_out = hidden * (2 if bidirectional else 1)
                self.head = nn.Sequential(
                    nn.Linear(h_out, 48),
                    nn.ReLU(),
                    nn.Dropout(0.1),
                    nn.Linear(48, 4),
                )

            def forward(self, x):
                seq, _ = self.rnn(x)
                last = seq[:, -1, :]
                raw = self.head(last)
                wind = raw[:, 1]
                gust = wind + nn.functional.softplus(raw[:, 0])
                temp = raw[:, 2]
                logit = raw[:, 3]
                return gust, wind, temp, logit

        self.model = SeqNet()
        state = {k: torch.as_tensor(v) for k, v in bundle["state_dict"].items()}
        self.model.load_state_dict(state)
        self.model.eval()

    def predict(self, seq: np.ndarray) -> tuple[float, float, float, float]:
        import torch

        if seq.shape[0] < self.seq_len:
            pad = np.repeat(seq[:1], self.seq_len - seq.shape[0], axis=0)
            seq = np.concatenate([pad, seq], axis=0)
        seq = seq[-self.seq_len :]
        flat = seq.reshape(1, -1)
        scaled = (flat - self.mean) / self.scale
        x = torch.tensor(
            scaled.reshape(1, self.seq_len, -1), dtype=torch.float32
        )
        with torch.no_grad():
            gust, wind, temp, logit = self.model(x)
            p = float(torch.sigmoid(logit)[0])
        return float(gust[0]), float(wind[0]), float(temp[0]), p


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _parse_hour(raw: str | None) -> datetime | None:
    if not raw:
        return None
    text = str(raw).replace("Z", "")[:16]
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _open_meteo_next6_gust(
    rows: list[dict[str, Any]],
    now_gust: float,
    now_iso: str | None = None,
) -> tuple[float, int]:
    now = _parse_hour(now_iso)
    if now is None:
        return now_gust, 0
    end = now + timedelta(hours=6)
    gusts = [now_gust]
    for row in rows:
        stamp = _parse_hour(row.get("time"))
        if stamp is None or stamp < now or stamp > end:
            continue
        try:
            gusts.append(float(row.get("gust_kn") or row.get("wind_kn") or 0))
        except (TypeError, ValueError):
            continue
    return max(gusts), max(0, len(gusts) - 1)


def reconcile(
    *,
    now_wind: float,
    now_gust: float,
    now_temp: float,
    gust_hat: float,
    wind_hat: float,
    temp_hat: float,
    p23: float,
) -> dict[str, Any]:
    """Force physical + SOP consistency with sensors."""
    now_gust = max(now_gust, now_wind)
    wind_hat = max(0.0, wind_hat)
    gust_hat = max(gust_hat, wind_hat, now_wind * 0.5)
    # 6h max can fall, but not below a collapsing-now floor of 0
    p23 = min(1.0, max(0.0, p23))
    p_from_gust = _sigmoid((gust_hat - LOCKOUT_KT) / 4.0)
    p23 = max(p23, 0.55 * p_from_gust)
    if now_gust >= LOCKOUT_KT:
        p23 = max(p23, 0.92)
    if gust_hat < 16 and now_gust < 16:
        p23 = min(p23, 0.22)
    p40 = _sigmoid((gust_hat - HELI_KT) / 5.0)
    if now_gust >= HELI_KT:
        p40 = max(p40, 0.9)

    if now_gust >= 60 or now_wind > 60:
        status = "ACTIVE"
        hazard = "BLIZZARD"
    elif now_gust >= LOCKOUT_KT:
        status = "ACTIVE"
        hazard = "WIND"
    elif p23 >= IMMINENT_P or gust_hat >= 32:
        status = "IMMINENT"
        hazard = "WIND"
    elif p23 >= WATCH_P or gust_hat >= LOCKOUT_KT:
        status = "WATCH"
        hazard = "WIND"
    else:
        status = "CLEAR"
        hazard = "NONE"

    actions: list[str] = []
    if status == "ACTIVE" and now_gust >= 60:
        actions = [
            "Maintain exterior hatch lockdown",
            "Abort outdoor sorties",
            "Keep external weather sensors stowed",
        ]
    elif status == "ACTIVE":
        actions = [
            "Outdoor lockout in force (gust ≥ 23 kt)",
            "Hold field parties",
            "Review heli / convoy gates",
        ]
    elif status == "IMMINENT":
        actions = [
            "Prepare outdoor stow sequence",
            "Account for field personnel",
            "Do not start new sorties",
        ]
    elif status == "WATCH":
        actions = [
            "Watch outdoor lockout within 6 h",
            "Brief field parties on return criteria",
        ]

    return {
        "hazard": hazard,
        "status": status,
        "eta_minutes": 360.0 if status in {"WATCH", "IMMINENT"} else None,
        "confidence": round(min(0.93, 0.55 + 0.4 * p23), 2),
        "gust_max_6h_kn": round(gust_hat, 1),
        "wind_max_6h_kn": round(wind_hat, 1),
        "temp_min_6h_c": round(temp_hat, 1),
        "p_lockout_23": round(p23, 3),
        "p_heli_40": round(p40, 3),
        "now_gust_kn": round(now_gust, 1),
        "now_wind_kn": round(now_wind, 1),
        "now_temp_c": round(now_temp, 1),
        "recommended_actions": actions,
        "horizon_hours": 6,
    }


class NowcastEngine:
    def __init__(self, artifacts: Path) -> None:
        self.artifacts = artifacts
        self._seq: dict[str, _SeqNet] = {}
        self._lock = {}
        self._meta: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        meta_path = self.artifacts / "nowcast_meta.json"
        if meta_path.exists():
            self._meta = json.loads(meta_path.read_text(encoding="utf-8"))
        try:
            import torch  # noqa: F401
        except ImportError:
            log.warning("torch missing — LSTM nowcast disabled")
            return
        for station, spec in (
            ("BHARATI", "nowcast_bharati.pt"),
            ("MAITRI", "nowcast_maitri.pt"),
        ):
            path = self.artifacts / spec
            if not path.exists():
                continue
            try:
                import torch

                bundle = torch.load(path, map_location="cpu", weights_only=False)
                self._seq[station] = _SeqNet(bundle)
                log.info("Nowcast LSTM loaded for %s from %s", station, path.name)
            except Exception:  # noqa: BLE001
                log.exception("Failed to load nowcast for %s", station)
        try:
            import joblib

            for station in ("BHARATI", "MAITRI"):
                heads = self.artifacts / f"nowcast_{station.lower()}_heads.joblib"
                if heads.exists():
                    self._lock[station] = joblib.load(heads)
        except Exception:  # noqa: BLE001
            log.exception("Failed to load nowcast RF heads")

    @property
    def loaded(self) -> bool:
        return bool(self._seq)

    def score(self, station_id: str, raw: Any) -> dict[str, Any]:
        station = str(station_id).upper()
        net = self._seq.get(station)
        weather = getattr(raw, "weather", None)
        if isinstance(weather, dict):
            wx = weather
        else:
            wx = {}
        rows = _hourly_rows(wx.get("hourly") or wx.get("hourly_tail"))
        nbr_rows = _hourly_rows(
            wx.get("neighbor_hourly") or wx.get("neighbor_hourly_tail")
        )
        now_wind = float(raw.ambient.wind_speed_knots)
        now_temp = float(raw.ambient.temp_c)
        now_gust = float(wx.get("wind_gust_knots") or now_wind)
        now_gust = max(now_gust, now_wind)

        if net is None or len(rows) < 4:
            # persistence fallback still reconciled
            return {
                **reconcile(
                    now_wind=now_wind,
                    now_gust=now_gust,
                    now_temp=now_temp,
                    gust_hat=now_gust,
                    wind_hat=now_wind,
                    temp_hat=now_temp,
                    p23=1.0 if now_gust >= LOCKOUT_KT else 0.0,
                ),
                "model": "persistence",
                "neighbor": NEIGHBOR.get(station),
                "source": "sensor-hold",
            }

        X, S = rows_from_hourly_tail(rows, nbr_rows or None)
        seq = np.nan_to_num(S[-SEQ_LEN:], nan=0.0)
        gust_hat, wind_hat, temp_hat, p_lstm = net.predict(seq)

        p_rf = p_lstm
        heads = self._lock.get(station)
        if heads is not None:
            try:
                xt = np.nan_to_num(X[-1:], nan=0.0)
                p_rf = float(heads["lock"].predict_proba(xt)[0, 1])
                wind_hat = float(heads["wind"].predict(xt)[0])
                temp_hat = float(heads["temp"].predict(xt)[0])
            except Exception:  # noqa: BLE001
                log.exception("RF heads failed; using LSTM only")

        # Blend: LSTM owns gust; RF lock is better calibrated; never ignore LSTM p
        p23 = 0.65 * p_rf + 0.35 * p_lstm
        om_peak, n_future = _open_meteo_next6_gust(
            rows,
            now_gust,
            wx.get("model_time") or getattr(raw, "timestamp", None),
        )
        if n_future == 0:
            gust_hat = min(max(now_gust, 0.6 * now_gust + 0.4 * gust_hat), now_gust + 5.0)
            wind_hat = min(wind_hat, gust_hat)
            if now_gust < LOCKOUT_KT:
                p23 = min(p23, 0.2)
        elif om_peak is not None:
            gust_hat = float(np.clip(gust_hat, om_peak - 8.0, om_peak + 8.0))
            wind_hat = min(wind_hat, gust_hat)
            if om_peak < LOCKOUT_KT - 2:
                p23 = min(p23, 0.35)
            if om_peak >= LOCKOUT_KT:
                p23 = max(p23, 0.55)

        out = reconcile(
            now_wind=now_wind,
            now_gust=now_gust,
            now_temp=now_temp,
            gust_hat=gust_hat,
            wind_hat=wind_hat,
            temp_hat=temp_hat,
            p23=p23,
        )
        winner = "hybrid"
        for item in self._meta.get("stations") or []:
            if item.get("station") == station:
                winner = item.get("winner", winner)
        out.update(
            {
                "model": winner,
                "neighbor": NEIGHBOR.get(station),
                "source": "Open-Meteo hourly + proxy nowcast",
                "valid_hours": 6,
            }
        )
        return out


def forecast_to_proactive(forecast: dict[str, Any]) -> dict[str, Any]:
    return {
        "hazard": forecast.get("hazard") or "NONE",
        "status": forecast.get("status") or "CLEAR",
        "eta_minutes": forecast.get("eta_minutes"),
        "confidence": forecast.get("confidence") or 0.0,
        "gust_max_6h_kn": forecast.get("gust_max_6h_kn"),
        "p_lockout_23": forecast.get("p_lockout_23"),
        "recommended_actions": forecast.get("recommended_actions") or [],
        "source": forecast.get("source"),
        "model": forecast.get("model"),
        "neighbor": forecast.get("neighbor"),
    }
