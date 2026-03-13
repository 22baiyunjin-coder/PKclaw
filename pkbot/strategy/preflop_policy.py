from __future__ import annotations

from ..evaluator_tuning import EvaluatorTuning
from .shared import (
    FACING_3BET_THRESHOLDS,
    FACING_OPEN_THRESHOLDS,
    POSITION_TIGHTNESS,
    PRE_OPEN_THRESHOLDS,
    boost,
    initialize_weights,
    style_bias,
)
from .types import PolicyPlan, StrategyContext, StreetPolicy


class PreflopPolicy(StreetPolicy):
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.tuning = tuning or EvaluatorTuning()

    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        state = context.state
        profile = context.profile
        weights = initialize_weights(state.legal_actions.available())
        looseness = profile.vpip / 100.0 - POSITION_TIGHTNESS[state.hero_position]
        raise_drive = profile.pfr / 100.0 + profile.aggression / 220.0
        call_drive = profile.hero_call / 100.0
        prediction = context.evaluator_snapshot.prediction
        model_strength = prediction.showdown_strength_proxy if prediction is not None else context.hand_score
        open_score = (context.hand_score * 0.7 + model_strength * 0.3) + looseness + raise_drive * 0.18 + style_bias(profile, "open")
        defend_score = (
            (context.hand_score * 0.65 + model_strength * 0.35)
            + looseness
            + call_drive * 0.12
            + style_bias(profile, "defend")
            + style_bias(profile, "hero_call") * 0.3
        )
        to_call_bb = state.amount_to_call / max(state.big_blind, 1.0)
        size_bucket = "preflop_open" if not state.facing_bet and not state.facing_raise else "preflop_three_bet"

        if not state.facing_bet and not state.facing_raise:
            threshold = PRE_OPEN_THRESHOLDS[context.hand_bucket]
            context.notes.append(f"Open score {open_score:.2f} vs threshold {threshold:.2f}.")
            if open_score >= threshold:
                boost(weights, "raise", 0.82 + raise_drive * 0.35)
                boost(weights, "bet", 0.82 + raise_drive * 0.35)
                boost(weights, "check", 0.12)
            else:
                boost(weights, "check", 0.78)
                boost(weights, "fold", 0.62)
            return PolicyPlan(action_weights=weights, size_bucket=size_bucket)

        thresholds = FACING_3BET_THRESHOLDS if state.facing_raise else FACING_OPEN_THRESHOLDS
        threshold = thresholds[context.hand_bucket]
        pressure_penalty = min(0.22, max(0.0, to_call_bb - 2.5) * 0.04)
        defend_score -= pressure_penalty
        context.notes.append(f"Defend score {defend_score:.2f} vs threshold {threshold:.2f}.")

        if context.hand_bucket in {"premium", "strong"}:
            boost(weights, "raise", 0.38 + profile.three_bet / 100.0 + profile.aggression / 220.0 + style_bias(profile, "pressure") * 0.3)
        if defend_score >= threshold:
            boost(weights, "call", 0.55 + call_drive * 0.25)
            if state.hero_position in {"BTN", "CO", "BB"} and context.hand_bucket in {"playable", "speculative"}:
                boost(weights, "call", 0.10)
        else:
            boost(weights, "fold", 0.66 + max(0.0, threshold - defend_score))
        boost(weights, "fold", 0.18 + max(0.0, threshold - defend_score) * 0.35)
        return PolicyPlan(action_weights=weights, size_bucket=size_bucket)
