from __future__ import annotations

from .postflop_base import PostflopStreetPolicy
from .types import StrategyContext


class RiverPolicy(PostflopStreetPolicy):
    def barrel_tendency(self, profile) -> float:
        return profile.river_bluff

    def bluff_tendency(self, profile) -> float:
        return profile.river_bluff

    def size_bucket_for_context(self, context: StrategyContext) -> str | None:
        prediction = context.evaluator_snapshot.prediction
        showdown_strength = prediction.showdown_strength_proxy if prediction is not None else context.hand_score
        if context.hand_bucket == "strong_made_hand":
            return "river_value"
        if context.hand_bucket == "medium_made_hand" and showdown_strength >= 0.58:
            return "river_value"
        return "river_bluff"
