from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

import joblib
import pandas as pd
from lightgbm import LGBMRegressor


@dataclass(slots=True)
class EvaluatorPrediction:
    equity_estimate: float
    showdown_strength_proxy: float

    def as_dict(self) -> dict[str, float]:
        return {
            "equity_estimate": round(self.equity_estimate, 4),
            "showdown_strength_proxy": round(self.showdown_strength_proxy, 4),
        }


class EvaluatorModel(ABC):
    @abstractmethod
    def predict(self, features: Mapping[str, float]) -> EvaluatorPrediction:
        raise NotImplementedError


@dataclass(slots=True)
class NullEvaluatorModel(EvaluatorModel):
    def predict(self, features: Mapping[str, float]) -> EvaluatorPrediction:
        base_strength = float(features.get("postflop_score", features.get("preflop_score", 0.25)))
        pot_odds = float(features.get("pot_odds", 0.0))
        equity = min(0.99, max(0.01, base_strength * 0.72 + 0.12))
        showdown_strength = min(0.99, max(0.01, base_strength * 0.78 + 0.08 - pot_odds * 0.05))
        return EvaluatorPrediction(
            equity_estimate=equity,
            showdown_strength_proxy=showdown_strength,
        )


@dataclass(slots=True)
class LightGBMEvaluatorModel(EvaluatorModel):
    models: dict[str, LGBMRegressor]
    feature_names: list[str]
    metadata: dict[str, object] = field(default_factory=dict)

    def predict(self, features: Mapping[str, float]) -> EvaluatorPrediction:
        row = {name: float(features.get(name, 0.0)) for name in self.feature_names}
        frame = pd.DataFrame([row], columns=self.feature_names)
        predictions = {target: float(model.predict(frame)[0]) for target, model in self.models.items()}
        return EvaluatorPrediction(
            equity_estimate=_clamp_probability(predictions.get("equity_estimate", 0.0)),
            showdown_strength_proxy=_clamp_probability(predictions.get("showdown_strength_proxy", 0.0)),
        )

    def save(self, path: str | Path) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "feature_names": self.feature_names,
            "metadata": self.metadata,
            "targets": list(self.models.keys()),
            "models": self.models,
        }
        joblib.dump(payload, target)
        return target

    @classmethod
    def load(cls, path: str | Path) -> "LightGBMEvaluatorModel":
        payload = joblib.load(Path(path))
        return cls(
            models=payload["models"],
            feature_names=list(payload["feature_names"]),
            metadata=dict(payload.get("metadata", {})),
        )


def load_evaluator_model(path: str | Path) -> EvaluatorModel:
    return LightGBMEvaluatorModel.load(path)


def _clamp_probability(value: float) -> float:
    return min(0.999, max(0.0, value))
