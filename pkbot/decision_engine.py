from __future__ import annotations

from .evaluator_service import EvaluatorService
from .evaluator_tuning import EvaluatorTuning
from .feature_builder import FeatureBuilder
from .game_state import DecisionResult, GameState
from .model_interface import EvaluatorModel
from .sizing_engine import SizingEngine
from .strategy import StrategyContextBuilder, StrategyLayer
from .style_profile import StyleProfile


class DecisionEngine:
    def __init__(
        self,
        sizing_engine: SizingEngine | None = None,
        evaluator_model: EvaluatorModel | None = None,
        feature_builder: FeatureBuilder | None = None,
        evaluator_tuning: EvaluatorTuning | None = None,
        evaluator_service: EvaluatorService | None = None,
        strategy_layer: StrategyLayer | None = None,
        context_builder: StrategyContextBuilder | None = None,
    ) -> None:
        tuning = evaluator_tuning or EvaluatorTuning()
        features = feature_builder or FeatureBuilder()
        self.sizing_engine = sizing_engine or SizingEngine()
        self.evaluator_service = evaluator_service or EvaluatorService(model=evaluator_model, feature_builder=features)
        self.context_builder = context_builder or StrategyContextBuilder(tuning)
        self.strategy_layer = strategy_layer or StrategyLayer(tuning)

    def decide(self, state: GameState, profile: StyleProfile) -> DecisionResult:
        evaluator_snapshot = self.evaluator_service.evaluate(state, profile)
        context = self.context_builder.build(state, profile, evaluator_snapshot)
        plan = self.strategy_layer.plan(context)

        for action in list(plan.action_weights):
            plan.action_weights[action] = max(plan.action_weights[action], 0.01)
        total = sum(plan.action_weights.values())
        probabilities = {action: round(value / total, 3) for action, value in plan.action_weights.items()}
        action = max(probabilities, key=probabilities.get)
        size_bucket = plan.size_bucket if action in {"bet", "raise"} else None
        size = self.sizing_engine.resolve_size(
            state,
            profile,
            action,
            size_bucket,
            context.board_texture,
            context.hand_bucket,
        )
        model_outputs = evaluator_snapshot.prediction.as_dict() if evaluator_snapshot.available and evaluator_snapshot.prediction is not None else {}
        return DecisionResult(
            action=action,
            size=size,
            size_bucket=size_bucket,
            action_probabilities=probabilities,
            reason_tags=context.reason_tags,
            debug_notes=context.notes,
            model_outputs=model_outputs,
        )
