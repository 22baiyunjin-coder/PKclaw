from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..evaluator_service import EvaluatorSnapshot
from ..game_state import GameState
from ..style_profile import StyleProfile


@dataclass(slots=True)
class StrategyContext:
    state: GameState
    profile: StyleProfile
    hand_bucket: str
    hand_score: float
    board_texture: str
    board_tags: list[str]
    reason_tags: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    evaluator_snapshot: EvaluatorSnapshot = field(default_factory=EvaluatorSnapshot)


@dataclass(slots=True)
class PolicyPlan:
    action_weights: dict[str, float]
    size_bucket: str | None = None


class StreetPolicy(ABC):
    @abstractmethod
    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        raise NotImplementedError
