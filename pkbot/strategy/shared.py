from __future__ import annotations

from ..evaluator_tuning import EvaluatorTuning
from ..style_profile import StyleProfile

POSITION_TIGHTNESS = {
    "UTG": 0.12,
    "UTG+1": 0.09,
    "MP": 0.04,
    "HJ": -0.01,
    "CO": -0.06,
    "BTN": -0.10,
    "SB": -0.02,
    "BB": 0.00,
}

PRE_OPEN_THRESHOLDS = {
    "premium": 0.74,
    "strong": 0.64,
    "playable": 0.56,
    "speculative": 0.48,
    "weak": 0.44,
}

FACING_OPEN_THRESHOLDS = {
    "premium": 0.74,
    "strong": 0.64,
    "playable": 0.56,
    "speculative": 0.46,
    "weak": 0.34,
}

FACING_3BET_THRESHOLDS = {
    "premium": 0.76,
    "strong": 0.66,
    "playable": 0.54,
    "speculative": 0.36,
    "weak": 0.24,
}

STYLE_OFFSETS = {
    "Nit": {"open": -0.10, "defend": -0.12, "bluff": -0.16, "hero_call": -0.14, "pressure": -0.08},
    "TAG": {"open": -0.02, "defend": -0.03, "bluff": -0.03, "hero_call": -0.05, "pressure": 0.02},
    "Balanced Reg": {"open": 0.00, "defend": 0.00, "bluff": 0.00, "hero_call": 0.00, "pressure": 0.00},
    "LAG": {"open": 0.10, "defend": 0.06, "bluff": 0.10, "hero_call": -0.02, "pressure": 0.08},
    "Calling Station": {"open": -0.08, "defend": 0.14, "bluff": -0.18, "hero_call": 0.20, "pressure": -0.06},
    "Maniac": {"open": 0.18, "defend": 0.10, "bluff": 0.18, "hero_call": -0.08, "pressure": 0.14},
    "Trapper": {"open": -0.03, "defend": 0.08, "bluff": -0.06, "hero_call": 0.10, "pressure": -0.02},
    "Pressure Reg": {"open": 0.08, "defend": 0.02, "bluff": 0.12, "hero_call": -0.02, "pressure": 0.10},
}


def initialize_weights(available_actions: list[str]) -> dict[str, float]:
    return {action: 0.0 for action in available_actions}


def boost(weights: dict[str, float], action: str, amount: float) -> None:
    if action in weights:
        weights[action] += amount


def style_bias(profile: StyleProfile, key: str) -> float:
    return STYLE_OFFSETS.get(profile.name, {}).get(key, 0.0)


def continue_threshold_for_street(tuning: EvaluatorTuning, street: str) -> float:
    if street == "flop":
        return tuning.flop_continue_threshold
    if street == "turn":
        return tuning.turn_continue_threshold
    if street == "river":
        return max(tuning.turn_continue_threshold, 0.0)
    return 0.0


def evaluator_weight_for_street(tuning: EvaluatorTuning, street: str) -> float:
    if street == "preflop":
        return min(0.25, tuning.evaluator_influence_weight * 0.55)
    if street == "flop" and tuning.flop_evaluator_weight is not None:
        return tuning.flop_evaluator_weight
    if street == "turn" and tuning.turn_evaluator_weight is not None:
        return tuning.turn_evaluator_weight
    if street == "river" and tuning.river_evaluator_weight is not None:
        return tuning.river_evaluator_weight
    return tuning.evaluator_influence_weight
