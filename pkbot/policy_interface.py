from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

import joblib
import pandas as pd
from lightgbm import LGBMClassifier

POLICY_ACTIONS = ["fold", "check", "call", "bet", "raise"]
POLICY_SIZE_BUCKETS = [
    "none",
    "preflop_open",
    "preflop_three_bet",
    "flop_cbet",
    "flop_probe",
    "turn_barrel",
    "turn_probe",
    "river_value",
    "river_bluff",
]
LEGAL_SIZE_BUCKETS_BY_STREET = {
    "preflop": {"preflop_open", "preflop_three_bet"},
    "flop": {"flop_cbet", "flop_probe"},
    "turn": {"turn_barrel", "turn_probe"},
    "river": {"river_value", "river_bluff"},
}


@dataclass(slots=True)
class PolicyPrediction:
    action_probabilities: dict[str, float]
    size_bucket_probabilities: dict[str, float] = field(default_factory=dict)
    selected_size_bucket: str | None = None


class PolicyModel(ABC):
    @abstractmethod
    def predict(self, features: Mapping[str, float]) -> PolicyPrediction:
        raise NotImplementedError


@dataclass(slots=True)
class LightGBMPolicyModel(PolicyModel):
    action_model: LGBMClassifier
    size_bucket_model: LGBMClassifier
    feature_names: list[str]
    metadata: dict[str, object] = field(default_factory=dict)

    def predict(self, features: Mapping[str, float]) -> PolicyPrediction:
        row = {name: float(features.get(name, 0.0)) for name in self.feature_names}
        frame = pd.DataFrame([row], columns=self.feature_names)
        action_probs = self.action_model.predict_proba(frame)[0]
        action_probabilities = {
            POLICY_ACTIONS[int(label)]: round(float(probability), 6)
            for label, probability in zip(self.action_model.classes_, action_probs)
        }
        size_probs = self.size_bucket_model.predict_proba(frame)[0]
        size_bucket_probabilities = {
            POLICY_SIZE_BUCKETS[int(label)]: round(float(probability), 6)
            for label, probability in zip(self.size_bucket_model.classes_, size_probs)
        }
        selected_bucket = max(size_bucket_probabilities, key=size_bucket_probabilities.get)
        return PolicyPrediction(
            action_probabilities=action_probabilities,
            size_bucket_probabilities=size_bucket_probabilities,
            selected_size_bucket=None if selected_bucket == "none" else selected_bucket,
        )

    def save(self, path: str | Path) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "feature_names": self.feature_names,
            "metadata": self.metadata,
            "action_model": self.action_model,
            "size_bucket_model": self.size_bucket_model,
        }
        joblib.dump(payload, target)
        return target

    @classmethod
    def load(cls, path: str | Path) -> "LightGBMPolicyModel":
        payload = joblib.load(Path(path))
        return cls(
            action_model=payload["action_model"],
            size_bucket_model=payload["size_bucket_model"],
            feature_names=list(payload["feature_names"]),
            metadata=dict(payload.get("metadata", {})),
        )


def load_policy_model(path: str | Path) -> PolicyModel:
    return LightGBMPolicyModel.load(path)
