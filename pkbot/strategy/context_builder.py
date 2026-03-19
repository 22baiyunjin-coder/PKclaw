from __future__ import annotations

from ..evaluator_service import EvaluatorSnapshot
from ..evaluator_tuning import EvaluatorTuning
from ..game_state import GameState
from ..hand_evaluator import analyze_board_texture, evaluate_postflop, evaluate_preflop
from ..postflop_labeling import classify_postflop_spot
from ..preflop_labeling import classify_preflop_spot
from ..style_profile import StyleProfile
from .shared import evaluator_weight_for_street
from .types import StrategyContext


class StrategyContextBuilder:
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.tuning = tuning or EvaluatorTuning()

    def build(
        self,
        state: GameState,
        profile: StyleProfile,
        evaluator_snapshot: EvaluatorSnapshot | None = None,
    ) -> StrategyContext:
        snapshot = evaluator_snapshot or EvaluatorSnapshot()
        if state.street == "preflop":
            insight = evaluate_preflop(state.hero_hole_cards)
            preflop_spot = classify_preflop_spot(state)
            context = StrategyContext(
                state=state,
                profile=profile,
                hand_bucket=insight.category,
                hand_score=insight.score,
                board_texture="preflop",
                board_tags=[],
                reason_tags=[insight.category, state.hero_position.lower().replace("+", "p"), preflop_spot.spot_type],
                notes=[
                    f"Preflop hand bucket: {insight.category} ({insight.score:.2f}).",
                    f"Preflop spot: {preflop_spot.spot_type} ({preflop_spot.action_context_subtype}).",
                ],
                evaluator_snapshot=snapshot,
                preflop_spot=preflop_spot,
            )
        else:
            board = analyze_board_texture(state.board_cards)
            insight = evaluate_postflop(state.hero_hole_cards, state.board_cards)
            postflop_spot = classify_postflop_spot(state)
            context = StrategyContext(
                state=state,
                profile=profile,
                hand_bucket=insight.category,
                hand_score=insight.score,
                board_texture=board.texture,
                board_tags=board.tags,
                reason_tags=[insight.category, board.texture, postflop_spot.spot_type, *board.tags[:2]],
                notes=[
                    f"Postflop category: {insight.category} ({insight.score:.2f}).",
                    f"Board texture: {board.texture} ({', '.join(board.tags) if board.tags else 'clean'}).",
                    f"Postflop spot: {postflop_spot.spot_type} ({postflop_spot.action_context_subtype}).",
                ],
                evaluator_snapshot=snapshot,
                postflop_spot=postflop_spot,
            )
        return self._apply_evaluator_snapshot(context)

    def _apply_evaluator_snapshot(self, context: StrategyContext) -> StrategyContext:
        prediction = context.evaluator_snapshot.prediction
        if prediction is None:
            return context
        context.reason_tags.append("model_assisted")
        context.notes.append(
            "Evaluator: "
            f"equity={prediction.equity_estimate:.2f}, "
            f"showdown_strength={prediction.showdown_strength_proxy:.2f}."
        )
        blended_weight = evaluator_weight_for_street(self.tuning, context.state.street)
        context.hand_score = (context.hand_score * (1.0 - blended_weight)) + (prediction.showdown_strength_proxy * blended_weight)
        if prediction.equity_estimate >= 0.62:
            context.reason_tags.append("high_equity_signal")
        elif prediction.equity_estimate <= 0.28:
            context.reason_tags.append("low_equity_signal")
        if prediction.showdown_strength_proxy >= 0.62:
            context.reason_tags.append("strong_showdown_signal")
        elif prediction.showdown_strength_proxy <= 0.26:
            context.reason_tags.append("weak_showdown_signal")
        return context
