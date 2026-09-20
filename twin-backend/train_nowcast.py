"""Train polar 6h nowcast: tabular vs LSTM/BiLSTM, with Russian proxy features.

Usage (from twin-backend/):
    python train_nowcast.py

Writes artifacts/nowcast_{station}.joblib (sklearn) or .pt (torch),
artifacts/nowcast_meta.json, and datasets/environment/climate_monthly.json.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    average_precision_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    r2_score,
    roc_auc_score,
)
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from weather_features import (
    HORIZON,
    LOCKOUT_KT,
    SEQ_LEN,
    TABULAR_NAMES,
    align_neighbor,
    load_hourly,
    sequence_matrix,
    tabular_matrix,
    targets,
    valid_mask,
    window_sequences,
)

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / "datasets" / "environment"
ART = Path(__file__).resolve().parent / "artifacts"

PAIRS = {
    "BHARATI": "PROGRESS",
    "MAITRI": "NOVOLAZAREVSKAYA",
}


def archive_path(station: str) -> Path:
    return ENV / f"openmeteo_hourly_2022_2024_{station.lower()}.json"


def year_of(times: list[str]) -> np.ndarray:
    return np.array([int(t[:4]) for t in times], dtype=int)


def split_idx(ok: np.ndarray, years: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    idx = np.where(ok)[0]
    tr = idx[years[idx] <= 2023]
    te = idx[years[idx] >= 2024]
    return tr, te


def metrics_reg(y, p) -> dict:
    return {
        "mae": round(float(mean_absolute_error(y, p)), 4),
        "rmse": round(float(mean_squared_error(y, p) ** 0.5), 4),
        "r2": round(float(r2_score(y, p)), 4),
    }


def metrics_cls(y, proba) -> dict:
    pred = (proba >= 0.5).astype(int)
    p, r, f, _ = precision_recall_fscore_support(
        y, pred, average="binary", zero_division=0
    )
    out = {
        "precision": round(float(p), 4),
        "recall": round(float(r), 4),
        "f1": round(float(f), 4),
    }
    if len(np.unique(y)) > 1:
        out["roc_auc"] = round(float(roc_auc_score(y, proba)), 4)
        out["pr_auc"] = round(float(average_precision_score(y, proba)), 4)
    return out


def train_torch_seq(
    name: str,
    Xtr: np.ndarray,
    y_g_tr: np.ndarray,
    y_w_tr: np.ndarray,
    y_t_tr: np.ndarray,
    y_c_tr: np.ndarray,
    Xte: np.ndarray,
    y_g_te: np.ndarray,
    y_c_te: np.ndarray,
    bidirectional: bool,
    layers: int,
    hidden: int,
    epochs: int = 14,
):
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, TensorDataset

    device = torch.device("cpu")
    scaler = StandardScaler()
    n, t, f = Xtr.shape
    Xtr_s = scaler.fit_transform(Xtr.reshape(n, t * f)).reshape(n, t, f)
    Xte_s = scaler.transform(Xte.reshape(len(Xte), t * f)).reshape(len(Xte), t, f)

    class SeqNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.rnn = nn.LSTM(
                f,
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
            gust = wind + torch.nn.functional.softplus(raw[:, 0])
            temp = raw[:, 2]
            logit = raw[:, 3]
            return gust, wind, temp, logit

    model = SeqNet().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1.2e-3, weight_decay=1e-4)
    # last 12% of train as val
    cut = max(32, int(len(Xtr_s) * 0.88))
    tr_ds = TensorDataset(
        torch.tensor(Xtr_s[:cut], dtype=torch.float32),
        torch.tensor(y_g_tr[:cut], dtype=torch.float32),
        torch.tensor(y_w_tr[:cut], dtype=torch.float32),
        torch.tensor(y_t_tr[:cut], dtype=torch.float32),
        torch.tensor(y_c_tr[:cut], dtype=torch.float32),
    )
    va_x = torch.tensor(Xtr_s[cut:], dtype=torch.float32)
    va_g = torch.tensor(y_g_tr[cut:], dtype=torch.float32)
    loader = DataLoader(tr_ds, batch_size=256, shuffle=True)
    best_state = None
    best_val = 1e9
    patience = 0
    t0 = time.time()
    for epoch in range(epochs):
        model.train()
        for xb, yg, yw, yt, yc in loader:
            opt.zero_grad()
            pg, pw, pt, logit = model(xb)
            loss = (
                nn.functional.l1_loss(pg, yg)
                + 0.5 * nn.functional.l1_loss(pw, yw)
                + 0.25 * nn.functional.l1_loss(pt, yt)
                + 0.35 * nn.functional.binary_cross_entropy_with_logits(logit, yc)
            )
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
        model.eval()
        with torch.no_grad():
            vg, _, _, _ = model(va_x)
            val = float(nn.functional.l1_loss(vg, va_g))
        if val < best_val - 0.005:
            best_val = val
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            patience = 0
        else:
            patience += 1
            if patience >= 3:
                break
    if best_state:
        model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        pg, _, _, logit = model(torch.tensor(Xte_s, dtype=torch.float32))
        gust_hat = pg.numpy()
        proba = torch.sigmoid(logit).numpy()
    dt = time.time() - t0
    return {
        "name": name,
        "kind": "torch",
        "gust": metrics_reg(y_g_te, gust_hat),
        "lock23": metrics_cls(y_c_te, proba),
        "fit_s": round(dt, 1),
        "epochs_ran": epoch + 1,
        "val_mae": round(best_val, 4),
        "bundle": {
            "state_dict": {k: v.numpy() for k, v in model.state_dict().items()},
            "scaler_mean": scaler.mean_.tolist(),
            "scaler_scale": scaler.scale_.tolist(),
            "hidden": hidden,
            "layers": layers,
            "bidirectional": bidirectional,
            "seq_len": t,
            "n_feat": f,
        },
    }


def persist_gust(local, te_idx):
    return local["gust"][te_idx]


def climate_monthly(local: dict, station: str) -> list[dict]:
    months = []
    times = local["t"]
    for m in range(1, 13):
        mask = np.array([int(t[5:7]) == m for t in times])
        if not mask.any():
            continue
        months.append(
            {
                "month": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1],
                "month_num": m,
                "temp": round(float(np.nanmean(local["temp"][mask])), 2),
                "wind": round(float(np.nanmean(local["wind"][mask])), 2),
                "gust": round(float(np.nanmean(local["gust"][mask])), 2),
            }
        )
    return months


def fit_station(station: str, neighbor: str) -> dict:
    print(f"\n===== {station}  neighbor={neighbor} =====")
    local = load_hourly(archive_path(station))
    nbr_raw = load_hourly(archive_path(neighbor))
    nbr = align_neighbor(local, nbr_raw)
    X = tabular_matrix(local, nbr)
    S = sequence_matrix(local, nbr)
    y = targets(local)
    years = year_of(local["t"])
    ok = valid_mask(X, y, seq_start=SEQ_LEN)
    # drop rows with missing neighbor
    ok &= np.isfinite(nbr["gust"])
    tr, te = split_idx(ok, years)
    print(f"  n_train={len(tr)} n_test={len(te)} 2024 pos23={y['lock23'][te].mean():.3f}")

    corr = float(
        np.corrcoef(
            local["gust"][ok],
            nbr["gust"][ok],
        )[0, 1]
    )
    print(f"  corr local vs {neighbor} gust={corr:.3f}")

    Xtr, Xte = X[tr], X[te]
    y_g_tr, y_g_te = y["gust_max_6h"][tr], y["gust_max_6h"][te]
    y_w_tr, y_w_te = y["wind_max_6h"][tr], y["wind_max_6h"][te]
    y_t_tr, y_t_te = y["temp_min_6h"][tr], y["temp_min_6h"][te]
    y_c_tr, y_c_te = y["lock23"][tr], y["lock23"][te]

    rows = []
    pers = persist_gust(local, te)
    rows.append(
        {
            "name": "Persistence",
            "kind": "baseline",
            "gust": metrics_reg(y_g_te, pers),
            "lock23": metrics_cls(y_c_te, (local["gust"][te] >= LOCKOUT_KT).astype(float)),
        }
    )
    print("  Persistence", rows[-1]["gust"])

    ridge = Pipeline([("sc", StandardScaler()), ("m", Ridge(1.0))])
    t0 = time.time()
    ridge.fit(Xtr, y_g_tr)
    rows.append(
        {
            "name": "Ridge",
            "kind": "sklearn",
            "gust": metrics_reg(y_g_te, ridge.predict(Xte)),
            "lock23": {},
            "fit_s": round(time.time() - t0, 2),
        }
    )

    rf = RandomForestRegressor(
        n_estimators=220,
        max_depth=14,
        min_samples_leaf=6,
        random_state=42,
        n_jobs=-1,
    )
    t0 = time.time()
    rf.fit(Xtr, y_g_tr)
    rf_pred = rf.predict(Xte)
    rf_time = time.time() - t0
    rf_cls = RandomForestClassifier(
        n_estimators=180,
        max_depth=12,
        min_samples_leaf=8,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf_cls.fit(Xtr, y_c_tr)
    rows.append(
        {
            "name": "RandomForest",
            "kind": "sklearn",
            "gust": metrics_reg(y_g_te, rf_pred),
            "lock23": metrics_cls(y_c_te, rf_cls.predict_proba(Xte)[:, 1]),
            "fit_s": round(rf_time, 2),
        }
    )
    print("  RF", rows[-1]["gust"], rows[-1]["lock23"])

    hgb = HistGradientBoostingRegressor(
        max_depth=6, learning_rate=0.07, max_iter=280, random_state=42
    )
    t0 = time.time()
    hgb.fit(Xtr, y_g_tr)
    hgb_cls = HistGradientBoostingClassifier(
        max_depth=6,
        learning_rate=0.07,
        max_iter=220,
        class_weight="balanced",
        random_state=42,
    )
    hgb_cls.fit(Xtr, y_c_tr)
    rows.append(
        {
            "name": "HistGB",
            "kind": "sklearn",
            "gust": metrics_reg(y_g_te, hgb.predict(Xte)),
            "lock23": metrics_cls(y_c_te, hgb_cls.predict_proba(Xte)[:, 1]),
            "fit_s": round(time.time() - t0, 2),
        }
    )
    print("  HGB", rows[-1]["gust"], rows[-1]["lock23"])

    mlp = Pipeline(
        [
            ("sc", StandardScaler()),
            (
                "m",
                MLPRegressor(
                    hidden_layer_sizes=(64, 32),
                    max_iter=120,
                    random_state=42,
                    early_stopping=True,
                ),
            ),
        ]
    )
    t0 = time.time()
    mlp.fit(Xtr, y_g_tr)
    rows.append(
        {
            "name": "MLP",
            "kind": "sklearn",
            "gust": metrics_reg(y_g_te, mlp.predict(Xte)),
            "lock23": {},
            "fit_s": round(time.time() - t0, 2),
        }
    )
    print("  MLP", rows[-1]["gust"])

    logreg = Pipeline(
        [
            ("sc", StandardScaler()),
            ("m", LogisticRegression(max_iter=400, class_weight="balanced")),
        ]
    )
    logreg.fit(Xtr, y_c_tr)

    # extra heads so UI can show consistent wind/temp
    rf_wind = RandomForestRegressor(
        n_estimators=160, max_depth=12, min_samples_leaf=8, random_state=42, n_jobs=-1
    )
    rf_temp = RandomForestRegressor(
        n_estimators=160, max_depth=12, min_samples_leaf=8, random_state=42, n_jobs=-1
    )
    rf_wind.fit(Xtr, y_w_tr)
    rf_temp.fit(Xtr, y_t_tr)

    Str = window_sequences(S, tr, SEQ_LEN)
    Ste = window_sequences(S, te, SEQ_LEN)
    torch_rows = []
    for spec in (
        ("LSTM", False, 1, 48),
        ("BiLSTM", True, 1, 32),
        ("LSTM2", False, 2, 32),
    ):
        try:
            result = train_torch_seq(
                spec[0],
                Str,
                y_g_tr,
                y_w_tr,
                y_t_tr,
                y_c_tr,
                Ste,
                y_g_te,
                y_c_te,
                bidirectional=spec[1],
                layers=spec[2],
                hidden=spec[3],
            )
            torch_rows.append(result)
            print(f"  {spec[0]}", result["gust"], result["lock23"], f"fit {result['fit_s']}s")
        except Exception as exc:  # noqa: BLE001
            print(f"  {spec[0]} FAILED {exc}")
            rows.append({"name": spec[0], "kind": "torch", "error": str(exc)})

    rows.extend(
        {k: v for k, v in r.items() if k != "bundle"} for r in torch_rows
    )

    def score(row: dict) -> tuple:
        gust_mae = row.get("gust", {}).get("mae", 99)
        pr = row.get("lock23", {}).get("pr_auc", 0) or 0
        return (gust_mae, -pr)

    candidates = [r for r in rows if r.get("gust") and "mae" in r["gust"]]
    best = min(candidates, key=score)
    print("  BEST", best["name"], best["gust"])

    # Prefer sklearn RF/HGB unless a sequence model beats RF MAE by >= 0.12 kn
    rf_mae = next(r["gust"]["mae"] for r in rows if r["name"] == "RandomForest")
    seq_best = min(
        (r for r in torch_rows if r.get("gust")),
        key=lambda r: r["gust"]["mae"],
        default=None,
    )
    use_torch = (
        seq_best is not None and seq_best["gust"]["mae"] <= rf_mae - 0.12
    )
    if use_torch:
        import torch

        winner_name = seq_best["name"]
        kind = "torch"
        path = ART / f"nowcast_{station.lower()}.pt"
        torch.save(seq_best["bundle"], path)
        sklearn_bundle = None
    else:
        # pick RF vs HGB by gust MAE then PR-AUC
        hgb_row = next(r for r in rows if r["name"] == "HistGB")
        rf_row = next(r for r in rows if r["name"] == "RandomForest")
        if hgb_row["gust"]["mae"] < rf_row["gust"]["mae"] - 0.05:
            winner_name = "HistGB"
            sklearn_bundle = {
                "gust": hgb,
                "lock": hgb_cls,
                "wind": rf_wind,
                "temp": rf_temp,
            }
        else:
            winner_name = "RandomForest"
            sklearn_bundle = {
                "gust": rf,
                "lock": rf_cls,
                "wind": rf_wind,
                "temp": rf_temp,
            }
        kind = "sklearn"
        path = ART / f"nowcast_{station.lower()}.joblib"
        joblib.dump(sklearn_bundle, path)
        bundle = None

    imp = []
    if winner_name == "RandomForest":
        imp = sorted(
            zip(TABULAR_NAMES, rf.feature_importances_.tolist()),
            key=lambda x: -x[1],
        )[:12]

    return {
        "station": station,
        "neighbor": neighbor,
        "neighbor_gust_corr": round(corr, 4),
        "n_train": int(len(tr)),
        "n_test": int(len(te)),
        "holdout": "calendar year 2024",
        "horizon_h": HORIZON,
        "seq_len": SEQ_LEN,
        "results": rows,
        "winner": winner_name,
        "winner_kind": kind,
        "artifact": str(path.relative_to(ART.parent)),
        "feature_importance": [(n, round(v, 4)) for n, v in imp],
        "climate": climate_monthly(local, station),
        "lock23_test_rate": round(float(y_c_te.mean()), 4),
    }


def main() -> int:
    ART.mkdir(parents=True, exist_ok=True)
    reports = []
    climate = {}
    for station, neighbor in PAIRS.items():
        rep = fit_station(station, neighbor)
        reports.append(rep)
        climate[station] = {
            "source": "Open-Meteo ERA5-land archive 2022–2024, wind kn",
            "neighbor": neighbor,
            "monthly": rep["climate"],
        }
    meta = {
        "protocol": (
            "Train 2022–2023, test 2024. Features include Russian proxy "
            "(Progress for Bharati, Novolazarevskaya for Maitri). "
            "Targets: 6h max gust/wind, 6h min temp, P(gust>=23kt in 6h). "
            "Sequence models constrained so predicted gust >= predicted wind."
        ),
        "stations": reports,
    }
    (ART / "nowcast_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (ENV / "climate_monthly.json").write_text(json.dumps(climate, indent=2), encoding="utf-8")
    print("\nWrote", ART / "nowcast_meta.json")
    for rep in reports:
        print(f"  {rep['station']}: {rep['winner']} ({rep['winner_kind']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
