from __future__ import annotations

from abc import ABC, abstractmethod

from ..evaluator_tuning import EvaluatorTuning
from .shared import boost, continue_threshold_for_street, initialize_weights, style_bias
from .types import PolicyPlan, StrategyContext, StreetPolicy


class PostflopStreetPolicy(StreetPolicy, ABC):
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.tuning = tuning or EvaluatorTuning()

    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        state = context.state
        profile = context.profile
        weights = initialize_weights(state.legal_actions.available())
        aggression = profile.aggression / 100.0
        call_bias = profile.hero_call / 100.0 + style_bias(profile, "hero_call")
        bluff_bias = style_bias(profile, "bluff")
        pressure_bias = style_bias(profile, "pressure")
        board_pressure = 0.10 if context.board_texture == "dry" else 0.18 if context.board_texture == "semi_wet" else 0.24
        multiway_penalty = max(0.0, (len(state.active_players) - 2) * 0.11)
        big_bet_pressure = state.amount_to_call / max(state.pot_size + state.amount_to_call, 1.0) if state.amount_to_call > 0 else 0.0
        bet_action = "bet" if "bet" in weights else "raise"
        size_bucket = self.size_bucket_for_context(context)

        if context.hand_bucket == "strong_made_hand":
            boost(weights, bet_action, 0.72 + aggression * 0.45 + pressure_bias * 0.2)
            boost(weights, "call", 0.22)
            boost(weights, "check", 0.10)
        elif context.hand_bucket == "medium_made_hand":
            if state.amount_to_call == 0:
                boost(weights, bet_action, 0.34 + self.barrel_tendency(profile) / 100.0 * 0.40)
                boost(weights, "check", 0.44)
            else:
                boost(weights, "call", 0.48 + call_bias * 0.22 - multiway_penalty * 0.25)
                boost(weights, "fold", 0.28 + board_pressure * 0.35 + big_bet_pressure * 0.22)
        elif context.hand_bucket == "strong_draw":
            if state.amount_to_call == 0:
                boost(weights, bet_action, 0.42 + self.barrel_tendency(profile) / 100.0 * 0.46 + aggression * 0.18 + bluff_bias * 0.2)
            boost(weights, "call", 0.42 + call_bias * 0.16 - multiway_penalty * 0.2)
            boost(weights, "fold", 0.18 + max(0.0, big_bet_pressure - 0.35) * 0.35)
        elif context.hand_bucket == "weak_draw":
            if state.amount_to_call == 0:
                boost(weights, bet_action, 0.24 + self.barrel_tendency(profile) / 100.0 * 0.26 + bluff_bias * 0.18)
            boost(weights, "call", 0.26 + call_bias * 0.10 - multiway_penalty * 0.26)
            boost(weights, "fold", 0.34 + big_bet_pressure * 0.42 + multiway_penalty * 0.30)
        elif context.hand_bucket == "weak_showdown_value":
            boost(weights, "check", 0.66)
            boost(weights, "call", 0.34 + call_bias * 0.22 - multiway_penalty * 0.28)
            boost(weights, "fold", 0.32 + board_pressure * 0.24 + big_bet_pressure * 0.25)
        else:
            if state.amount_to_call == 0:
                boost(weights, bet_action, 0.12 + self.bluff_tendency(profile) / 100.0 * 0.34 + aggression * 0.20 + bluff_bias * 0.25)
            boost(weights, "check", 0.58)
            boost(weights, "fold", 0.50 + (1 - max(0.0, call_bias)) * 0.20 + multiway_penalty * 0.32 + big_bet_pressure * 0.25)
            boost(weights, "call", 0.10 + max(0.0, call_bias) * 0.10 - multiway_penalty * 0.24)

        if state.amount_to_call > 0:
            fold_pressure = 0.16 if context.hand_bucket == "strong_made_hand" else 0.30 if context.hand_bucket in {"medium_made_hand", "strong_draw"} else 0.52
            boost(weights, "fold", big_bet_pressure * fold_pressure + multiway_penalty * 0.18)
            boost(weights, "call", -(big_bet_pressure * 0.16 + multiway_penalty * 0.10))
            context.notes.append(f"Call pressure factor: {big_bet_pressure:.2f}, multiway penalty: {multiway_penalty:.2f}.")

        self.apply_evaluator_adjustments(weights, context, bet_action)

        if state.players_to_act_behind == 0:
            boost(weights, "call", 0.05)
            boost(weights, "check", 0.04)
            context.reason_tags.append("closing_action")
        if state.hero_position in {"CO", "BTN"}:
            context.reason_tags.append("in_position")
        if len(state.active_players) >= 4:
            context.reason_tags.append("multiway_pot")
        if profile.aggression >= 70:
            context.reason_tags.append("high_aggression_profile")
        if profile.hero_call >= 65:
            context.reason_tags.append("high_hero_call")

        return PolicyPlan(action_weights=weights, size_bucket=size_bucket)

    def apply_evaluator_adjustments(self, weights: dict[str, float], context: StrategyContext, bet_action: str) -> None:
        prediction = context.evaluator_snapshot.prediction
        if prediction is None:
            return
        state = context.state
        showdown_strength = prediction.showdown_strength_proxy
        required_equity = state.amount_to_call / max(state.pot_size + state.amount_to_call, 1.0) if state.amount_to_call > 0 else 0.0
        continue_threshold = continue_threshold_for_street(self.tuning, state.street)
        continue_margin = prediction.equity_estimate - required_equity - continue_threshold
        if state.amount_to_call > 0:
            boost(weights, "call", max(0.0, continue_margin) * max(0.1, 0.75 - self.tuning.call_penalty))
            boost(weights, "fold", max(0.0, -continue_margin) * (0.95 + self.tuning.fold_bonus))
            if context.hand_bucket in {"medium_made_hand", "weak_showdown_value"}:
                marginal_gap = max(0.0, self.tuning.medium_strength_continue_cap - showdown_strength)
                if marginal_gap > 0:
                    boost(weights, "call", -(marginal_gap * (0.70 + self.tuning.marginal_call_penalty)))
                    boost(weights, "fold", marginal_gap * (0.80 + self.tuning.fold_bonus))
        if showdown_strength >= 0.72:
            boost(weights, bet_action, 0.16)
            boost(weights, "call", 0.08)
        elif showdown_strength <= 0.34:
            boost(weights, "check", 0.08)
            if state.amount_to_call > 0:
                boost(weights, "fold", 0.10)
            boost(weights, bet_action, -0.08)
        if context.hand_bucket in {"medium_made_hand", "weak_showdown_value"} and showdown_strength >= 0.58:
            boost(weights, "call", 0.08)
            boost(weights, bet_action, 0.05)
        if state.street in {"turn", "river"} and context.hand_bucket == "medium_made_hand":
            if showdown_strength >= 0.62:
                boost(weights, bet_action, 0.10)
            elif showdown_strength <= 0.44:
                boost(weights, "check", 0.08)
                if state.amount_to_call > 0:
                    boost(weights, "fold", 0.08)
            if state.amount_to_call > 0 and showdown_strength < self.tuning.medium_strength_continue_cap:
                boost(weights, "call", -0.08 - self.tuning.marginal_call_penalty * 0.25)
                boost(weights, "fold", 0.08 + self.tuning.fold_bonus * 0.2)
        if state.street == "river" and context.hand_bucket in {"weak_showdown_value", "air"} and showdown_strength <= 0.22:
            boost(weights, bet_action, -0.08)
            boost(weights, "check", 0.05)
            if state.amount_to_call > 0:
                boost(weights, "fold", 0.06)
        if state.street == "river" and context.hand_bucket == "strong_made_hand" and showdown_strength >= 0.74:
            boost(weights, bet_action, 0.10)
        if state.street == "river" and state.amount_to_call > 0:
            river_threshold = self.tuning.river_call_threshold
            if context.hand_bucket in {"weak_showdown_value", "air"}:
                river_threshold = self.tuning.river_bluff_catch_threshold or river_threshold
            river_margin = showdown_strength - river_threshold
            boost(
                weights,
                "call",
                max(0.0, river_margin)
                * max(0.05, 0.50 - self.tuning.call_penalty - self.tuning.marginal_call_penalty * 0.4),
            )
            boost(weights, "fold", max(0.0, -river_margin) * (0.60 + self.tuning.fold_bonus))
        context.notes.append(
            f"Evaluator margin: {continue_margin:.2f} vs required {required_equity:.2f} with threshold {continue_threshold:.2f}; "
            f"showdown strength {showdown_strength:.2f}."
        )

    @abstractmethod
    def barrel_tendency(self, profile) -> float:
        raise NotImplementedError

    @abstractmethod
    def bluff_tendency(self, profile) -> float:
        raise NotImplementedError

    @abstractmethod
    def size_bucket_for_context(self, context: StrategyContext) -> str | None:
        raise NotImplementedError
