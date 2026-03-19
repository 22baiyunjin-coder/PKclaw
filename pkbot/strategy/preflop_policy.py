from __future__ import annotations

from ..evaluator_tuning import EvaluatorTuning
from ..preflop_teacher_v2 import PreflopTeacherV2
from .types import PolicyPlan, StrategyContext, StreetPolicy


class PreflopPolicy(StreetPolicy):
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.tuning = tuning or EvaluatorTuning()
        self.teacher_v2 = PreflopTeacherV2()

    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        return self.teacher_v2.build_plan(context)
