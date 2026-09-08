"""Offline trainer: Isolation Forest on 5,000 synthetic nominal polar-ops rows.

Run from twin-backend/:
    python train_isolation_forest.py

Writes:
    artifacts/isolation_forest.joblib
    artifacts/training_meta.json

The nominal distribution mirrors the Dev 1 physics baseline (Bharati idle):
ambient ~ -14.2 C, wind ~ 24 kt, load ~ 360 kVA, CHP heat = load * 0.52,
JET A1 burn = load * 0.22. No blizzard, polar night, or fuel cliff is sampled.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS = BASE_DIR / "artifacts"
MODEL_PATH = ARTIFACTS / "isolation_forest.joblib"
META_PATH = ARTIFACTS / "training_meta.json"

FEATURES: list[str] = [
    "ambient.temp_c",
    "ambient.wind_speed_knots",
    "microgrid.total_load_kva",
    "thermal.chp_thermal_output_kw",
    "fuel.burn_rate_lph",
]

N_SAMPLES = 5000
CONTAMINATION = 0.03
RANDOM_STATE = 42


def generate_nominal_rows(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)

    temp_c = np.clip(rng.normal(-14.2, 1.8, n), -22.0, -6.0)
    wind_kt = np.clip(rng.normal(24.0, 3.5, n), 12.0, 38.0)
    load_kva = np.clip(rng.normal(360.0, 8.0, n), 330.0, 390.0)
    chp_kw = np.clip(load_kva * 0.52 + rng.normal(0.0, 2.0, n), 160.0, 220.0)
    burn_lph = np.clip(load_kva * 0.22 + rng.normal(0.0, 1.0, n), 65.0, 95.0)

    return np.column_stack([temp_c, wind_kt, load_kva, chp_kw, burn_lph]).astype(float)


def train() -> IsolationForest:
    X = generate_nominal_rows(N_SAMPLES, RANDOM_STATE)
    model = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        max_samples="auto",
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    model.fit(X)
    return model


def sanity_check(model: IsolationForest) -> bool:
    nominal = np.array([[-14.2, 24.0, 360.0, 187.2, 79.2]])
    blizzard = np.array([[-36.0, 80.0, 360.0, 187.2, 79.2]])
    polar_night = np.array([[-28.0, 28.0, 360.0, 187.2, 79.2]])
    load_shed = np.array([[-14.0, 22.0, 240.0, 124.8, 52.8]])

    def report(label: str, vec: np.ndarray) -> tuple[int, float]:
        pred = int(model.predict(vec)[0])
        score = float(model.decision_function(vec)[0])
        print(f"  {label:<12} predict={pred:>2}  decision_function={score:+.4f}")
        return pred, score

    print("Sanity check:")
    n_pred, n_score = report("nominal", nominal)
    b_pred, b_score = report("blizzard", blizzard)
    report("polar_night", polar_night)
    report("load_shed", load_shed)

    ok = n_pred == 1 and n_score > 0 and b_pred == -1 and b_score < n_score
    print(f"  -> {'PASS' if ok else 'FAIL'}: blizzard must be an outlier and score below nominal")
    return ok


def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    model = train()

    if not sanity_check(model):
        print("Refusing to write a model that cannot separate 80 kt wind from baseline.")
        return 1

    joblib.dump(model, MODEL_PATH)
    meta = {
        "features": FEATURES,
        "n_samples": N_SAMPLES,
        "contamination": CONTAMINATION,
        "random_state": RANDOM_STATE,
        "n_estimators": 200,
        "sklearn_version": sklearn.__version__,
        "score_semantics": "decision_function: positive ~ inlier, negative ~ outlier",
    }
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {MODEL_PATH.relative_to(BASE_DIR)} and {META_PATH.relative_to(BASE_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
