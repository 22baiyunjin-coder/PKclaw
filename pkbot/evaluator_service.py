from __future__ import annotations

from dataclasses import dataclass, field

from .feature_builder import FeatureBuilder
from .game_state import GameState
from .model_interface import EvaluatorModel, EvaluatorPrediction
from .style_profile import StyleProfile


@dataclass(slots=True)
class EvaluatorSnapshot:
    features: dict[str, float] = field(default_factory=dict)
    prediction: EvaluatorPrediction | None = None
    source: str = "disabled"

    @property
    def available(self) -> bool:
        return self.prediction is not None


class EvaluatorService:
    def __init__(
        self,
        *,
        model: EvaluatorModel | None = None,
        feature_builder: FeatureBuilder | None = None,
        enabled: bool | None = None,
    ) -> None:
        self.feature_builder = feature_builder or FeatureBuilder()
        self.model = model
        self.enabled = enabled if enabled is not None else model is not None

    def evaluate(self, state: GameState, profile: StyleProfile) -> EvaluatorSnapshot:
        features = self.feature_builder.build(state, profile)
        if not self.enabled or self.model is None:
            return EvaluatorSnapshot(features=features, prediction=None, source="disabled")
        prediction = self.model.predict(features)
        return EvaluatorSnapshot(
            features=features,
            prediction=prediction,
            source=type(self.model).__name__,
        )
