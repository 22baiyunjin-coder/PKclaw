from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(slots=True, frozen=True)
class EvaluatorTuning:
    name: str = "default"
    evaluator_influence_weight: float = 0.45
    flop_evaluator_weight: float | None = None
    turn_evaluator_weight: float | None = None
    river_evaluator_weight: float | None = None
    flop_continue_threshold: float = 0.0
    turn_continue_threshold: float = 0.03
    river_call_threshold: float = 0.40
    river_bluff_catch_threshold: float | None = None
    call_penalty: float = 0.0
    marginal_call_penalty: float = 0.0
    fold_bonus: float = 0.0
    medium_strength_continue_cap: float = 0.44

    def as_dict(self) -> dict[str, float | str]:
        return asdict(self)


def river_clamp_candidate_tuning() -> EvaluatorTuning:
    return EvaluatorTuning(
        name="river_clamp_candidate",
        evaluator_influence_weight=0.22,
        flop_evaluator_weight=0.22,
        turn_evaluator_weight=0.17,
        river_evaluator_weight=0.13,
        flop_continue_threshold=0.04,
        turn_continue_threshold=0.10,
        river_call_threshold=0.56,
        river_bluff_catch_threshold=0.62,
        call_penalty=0.12,
        marginal_call_penalty=0.09,
        fold_bonus=0.0,
        medium_strength_continue_cap=0.39,
    )


def balanced_middle_candidate_tuning() -> EvaluatorTuning:
    return EvaluatorTuning(
        name="balanced_middle_candidate",
        evaluator_influence_weight=0.23,
        flop_evaluator_weight=0.22,
        turn_evaluator_weight=0.18,
        river_evaluator_weight=0.14,
        flop_continue_threshold=0.04,
        turn_continue_threshold=0.10,
        river_call_threshold=0.54,
        river_bluff_catch_threshold=0.60,
        call_penalty=0.11,
        marginal_call_penalty=0.08,
        fold_bonus=0.14,
        medium_strength_continue_cap=0.40,
    )
