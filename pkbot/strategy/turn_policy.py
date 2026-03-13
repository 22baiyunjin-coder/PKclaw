from __future__ import annotations

from .postflop_base import PostflopStreetPolicy
from .types import StrategyContext


class TurnPolicy(PostflopStreetPolicy):
    def barrel_tendency(self, profile) -> float:
        return profile.turn_barrel

    def bluff_tendency(self, profile) -> float:
        return profile.turn_barrel

    def size_bucket_for_context(self, context: StrategyContext) -> str | None:
        if context.hand_bucket in {"strong_made_hand", "medium_made_hand"}:
            return "turn_barrel"
        return "turn_probe"
