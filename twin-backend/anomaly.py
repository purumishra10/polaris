"""Isolation Forest runtime scorer (non-LLM).

Loads the committed joblib once and scores one telemetry tick at a time.
Feature order is read from artifacts/training_meta.json when present and
falls back to the locked contract order otherwise.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np

from models import RawTelemetry

log = logging.getLogger("polaris.anomaly")

DEFAULT_FEATURES: list[str] = [
    "ambient.temp_c",
    "ambient.wind_speed_knots",
    "microgrid.total_load_kva",
    "thermal.chp_thermal_output_kw",
    "fuel.burn_rate_lph",
]


@dataclass(frozen=True)
class AnomalyResult:
    anomaly_score: float
    is_outlier: bool
    model_loaded: bool


class AnomalyScorer:
    def __init__(self, model_path: Path) -> None:
        self._model: Optional[Any] = None
        self._features: list[str] = list(DEFAULT_FEATURES)
        self._path = model_path
        self._load()

    # ------------------------------------------------------------------ #
    def _load(self) -> None:
        if not self._path.exists():
            log.warning(
                "Isolation Forest not found at %s — running SOP-only. "
                "Run `python train_isolation_forest.py`.",
                self._path,
            )
            return
        try:
            self._model = joblib.load(self._path)
            meta_path = self._path.with_name("training_meta.json")
            if meta_path.exists():
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                feats = meta.get("features")
                if isinstance(feats, list) and len(feats) == 5:
                    self._features = [str(f) for f in feats]
            log.info("Isolation Forest loaded from %s", self._path)
        except Exception:  # noqa: BLE001
            self._model = None
            log.exception("Failed to load Isolation Forest — running SOP-only")

    @property
    def loaded(self) -> bool:
        return self._model is not None

    # ------------------------------------------------------------------ #
    @staticmethod
    def _pluck(raw: RawTelemetry, dotted: str) -> float:
        node: Any = raw
        for part in dotted.split("."):
            node = getattr(node, part)
        return float(node)

    def vector(self, raw: RawTelemetry) -> np.ndarray:
        return np.array([[self._pluck(raw, f) for f in self._features]], dtype=float)

    def score(self, raw: RawTelemetry) -> AnomalyResult:
        if self._model is None:
            return AnomalyResult(anomaly_score=0.0, is_outlier=False, model_loaded=False)
        x = self.vector(raw)
        score = float(self._model.decision_function(x)[0])
        outlier = int(self._model.predict(x)[0]) == -1
        return AnomalyResult(
            anomaly_score=round(score, 3),
            is_outlier=outlier,
            model_loaded=True,
        )
