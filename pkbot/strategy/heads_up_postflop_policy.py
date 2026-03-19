from __future__ import annotations

from ..evaluator_tuning import EvaluatorTuning
from ..heads_up_postflop_teacher_v2 import HeadsUpPostflopTeacherV2
from .types import PolicyPlan, StrategyContext, StreetPolicy


class HeadsUpPostflopPolicy(StreetPolicy):
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.teacher = HeadsUpPostflopTeacherV2(tuning)

    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        return self.teacher.build_plan(context)
