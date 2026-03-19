from __future__ import annotations

from ..evaluator_tuning import EvaluatorTuning
from ..policy_adapter import PolicyAdapter
from .flop_policy import FlopPolicy
from .heads_up_postflop_policy import HeadsUpPostflopPolicy
from .preflop_policy import PreflopPolicy
from .river_policy import RiverPolicy
from .turn_policy import TurnPolicy
from .types import PolicyPlan, StrategyContext


class StrategyLayer:
    def __init__(
        self,
        tuning: EvaluatorTuning | None = None,
        policy_adapter: PolicyAdapter | None = None,
    ) -> None:
        shared_tuning = tuning or EvaluatorTuning()
        self.policy_adapter = policy_adapter
        self.preflop_policy = PreflopPolicy(shared_tuning)
        self.heads_up_postflop_policy = HeadsUpPostflopPolicy(shared_tuning)
        self.multiway_policies = {
            "flop": FlopPolicy(shared_tuning),
            "turn": TurnPolicy(shared_tuning),
            "river": RiverPolicy(shared_tuning),
        }

    def plan(self, context: StrategyContext) -> PolicyPlan:
        if context.state.street == "preflop":
            policy = self.preflop_policy
        elif len(context.state.active_players) == 2:
            policy = self.heads_up_postflop_policy
        else:
            policy = self.multiway_policies[context.state.street]
        heuristic_plan = policy.build_plan(context)
        if self.policy_adapter is None:
            return heuristic_plan
        return self.policy_adapter.adapt(context, heuristic_plan)
