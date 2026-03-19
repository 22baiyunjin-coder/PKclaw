from __future__ import annotations

from dataclasses import dataclass

from .evaluator_tuning import EvaluatorTuning
from .postflop_labeling import PostflopActionSummary, classify_postflop_spot
from .strategy.shared import boost, initialize_weights, style_bias
from .strategy.types import PolicyPlan, StrategyContext


@dataclass(slots=True, frozen=True)
class HeadsUpPostflopMetrics:
    equity_estimate: float
    showdown_strength: float
    required_equity: float
    amount_to_call_share: float
    medium_continue_threshold: float
    turn_medium_continue_threshold_small: float
    turn_medium_continue_threshold_medium: float
    turn_medium_continue_threshold_large: float
    river_bluff_catch_threshold_small: float
    river_bluff_catch_threshold_medium: float
    river_bluff_catch_threshold_large: float


class HeadsUpPostflopTeacherV2:
    def __init__(self, tuning: EvaluatorTuning | None = None) -> None:
        self.tuning = tuning or EvaluatorTuning()

    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        state = context.state
        summary = context.postflop_spot or classify_postflop_spot(state)
        weights = initialize_weights(state.legal_actions.available())
        bet_action = "bet" if "bet" in weights else "raise"
        metrics = self._resolve_metrics(context, summary)

        context.reason_tags.extend(
            [
                "heads_up_postflop_v2",
                summary.spot_type,
                summary.position_status,
            ]
        )
        if summary.pot_type != "single_raised_pot":
            context.reason_tags.append(summary.pot_type)
        if context.hand_bucket in {"medium_made_hand", "weak_showdown_value"} and state.street in {"turn", "river"}:
            context.reason_tags.append("threshold_sensitive_hand")
        if summary.spot_type == "river_bluff_catch":
            context.reason_tags.append("river_bluff_catch_spot")
        context.notes.append(
            f"Heads-up postflop spot: {summary.spot_type} ({summary.action_context_subtype}); "
            f"pressure={summary.pressure_bucket}, pot_type={summary.pot_type}."
        )
        context.notes.append(
            f"HU metrics: eq={metrics.equity_estimate:.2f}, showdown={metrics.showdown_strength:.2f}, "
            f"required={metrics.required_equity:.2f}, medium_threshold={metrics.medium_continue_threshold:.2f}, "
            f"turn_medium=({metrics.turn_medium_continue_threshold_small:.2f}/{metrics.turn_medium_continue_threshold_medium:.2f}/{metrics.turn_medium_continue_threshold_large:.2f}), "
            f"river_bluff_catch=({metrics.river_bluff_catch_threshold_small:.2f}/{metrics.river_bluff_catch_threshold_medium:.2f}/{metrics.river_bluff_catch_threshold_large:.2f})."
        )

        if state.street == "flop":
            self._build_flop_plan(weights, context, summary, metrics, bet_action)
        elif state.street == "turn":
            self._build_turn_plan(weights, context, summary, metrics, bet_action)
        else:
            self._build_river_plan(weights, context, summary, metrics, bet_action)

        if state.amount_to_call <= 0:
            boost(weights, "check", 0.06)
        else:
            boost(weights, "fold", 0.04)
        return PolicyPlan(action_weights=weights, size_bucket=self._size_bucket(context, metrics))

    def _build_flop_plan(
        self,
        weights: dict[str, float],
        context: StrategyContext,
        summary: PostflopActionSummary,
        metrics: HeadsUpPostflopMetrics,
        bet_action: str,
    ) -> None:
        state = context.state
        profile = context.profile
        aggression = profile.aggression / 100.0
        hero_call = profile.hero_call / 100.0
        cbet_bias = profile.flop_cbet / 100.0 + style_bias(profile, "pressure")
        bluff_bias = style_bias(profile, "bluff")
        dry_bonus = 0.10 if context.board_texture == "dry" else 0.03 if context.board_texture == "semi_wet" else -0.06

        if context.hand_bucket == "strong_made_hand":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.78 + aggression * 0.18 + dry_bonus * 0.2)
                boost(weights, "check", 0.18)
            else:
                boost(weights, "raise", 0.30 - metrics.amount_to_call_share * 0.10)
                boost(weights, "call", 0.40)
                boost(weights, "fold", 0.08)
        elif context.hand_bucket == "medium_made_hand":
            if state.amount_to_call <= 0:
                cbet_score = 0.22
                if summary.spot_type == "flop_cbet_opportunity":
                    cbet_score += 0.34 + cbet_bias * 0.18 + dry_bonus * 0.34
                elif summary.position_status == "ip":
                    cbet_score += 0.08
                boost(weights, bet_action, cbet_score)
                boost(weights, "check", 0.44 - max(0.0, cbet_score - 0.28) * 0.12)
            else:
                threshold_margin = max(
                    metrics.showdown_strength - metrics.medium_continue_threshold,
                    metrics.equity_estimate - (metrics.required_equity + 0.02),
                )
                boost(weights, "call", 0.34 + max(0.0, threshold_margin) * 0.90 + (hero_call - 0.5) * 0.10)
                boost(weights, "fold", 0.26 + max(0.0, -threshold_margin) * 1.10 + metrics.amount_to_call_share * 0.18)
                if metrics.showdown_strength >= 0.74 and summary.pressure_bucket != "large":
                    boost(weights, "raise", 0.10 + aggression * 0.06)
        elif context.hand_bucket == "strong_draw":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.46 + aggression * 0.12 + cbet_bias * 0.14)
                boost(weights, "check", 0.22)
            else:
                margin = metrics.equity_estimate - metrics.required_equity
                boost(weights, "call", 0.36 + max(0.0, margin) * 1.10)
                boost(weights, "fold", 0.14 + max(0.0, -margin) * 0.90)
                if summary.pressure_bucket != "large":
                    boost(weights, "raise", 0.14 + aggression * 0.08 + max(0.0, margin) * 0.20)
        elif context.hand_bucket == "weak_draw":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.14 + max(0.0, cbet_bias) * 0.12 + max(0.0, dry_bonus) * 0.10)
                boost(weights, "check", 0.58)
            else:
                margin = metrics.equity_estimate - (metrics.required_equity + 0.03)
                boost(weights, "call", 0.18 + max(0.0, margin) * 0.80)
                boost(weights, "fold", 0.34 + max(0.0, -margin) * 1.10 + metrics.amount_to_call_share * 0.14)
        elif context.hand_bucket == "weak_showdown_value":
            if state.amount_to_call <= 0:
                boost(weights, "check", 0.76)
                if summary.spot_type == "flop_cbet_opportunity":
                    boost(weights, bet_action, 0.12 + max(0.0, dry_bonus) * 0.16 + max(0.0, cbet_bias) * 0.08)
                else:
                    boost(weights, bet_action, 0.06 + max(0.0, dry_bonus) * 0.10)
            else:
                threshold = metrics.medium_continue_threshold - 0.08
                margin = metrics.showdown_strength - threshold
                boost(weights, "call", 0.20 + max(0.0, margin) * 0.80 + (hero_call - 0.5) * 0.12)
                boost(weights, "fold", 0.36 + max(0.0, -margin) * 1.15 + metrics.amount_to_call_share * 0.16)
        else:
            if state.amount_to_call <= 0:
                bluff_score = 0.10
                if summary.spot_type == "flop_cbet_opportunity":
                    bluff_score += max(0.0, cbet_bias) * 0.18 + max(0.0, dry_bonus) * 0.34
                elif summary.position_status == "ip":
                    bluff_score += 0.06
                boost(weights, bet_action, bluff_score + max(0.0, bluff_bias) * 0.08)
                boost(weights, "check", 0.66)
            else:
                boost(weights, "fold", 0.64 + metrics.amount_to_call_share * 0.18)
                boost(weights, "call", 0.06 + max(0.0, hero_call - 0.55) * 0.06)

    def _build_turn_plan(
        self,
        weights: dict[str, float],
        context: StrategyContext,
        summary: PostflopActionSummary,
        metrics: HeadsUpPostflopMetrics,
        bet_action: str,
    ) -> None:
        state = context.state
        profile = context.profile
        aggression = profile.aggression / 100.0
        hero_call = profile.hero_call / 100.0
        barrel_bias = profile.turn_barrel / 100.0 + style_bias(profile, "pressure")

        if context.hand_bucket == "strong_made_hand":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.74 + aggression * 0.16 + barrel_bias * 0.10)
                boost(weights, "check", 0.18)
            else:
                boost(weights, "call", 0.32)
                boost(weights, "raise", 0.28 - metrics.amount_to_call_share * 0.08)
                boost(weights, "fold", 0.08)
        elif context.hand_bucket == "medium_made_hand":
            if state.amount_to_call <= 0:
                thin_value = 0.08
                if metrics.showdown_strength >= max(0.60, metrics.medium_continue_threshold + 0.04):
                    thin_value += 0.16 + max(0.0, barrel_bias) * 0.12
                if summary.position_status == "ip":
                    thin_value += 0.04
                boost(weights, bet_action, thin_value)
                boost(weights, "check", 0.66 - max(0.0, thin_value - 0.12) * 0.15)
            else:
                threshold = self._turn_continue_threshold(metrics, summary, context.hand_bucket)
                equity_threshold = metrics.required_equity + (0.02 if summary.pressure_bucket == "small" else 0.03 if summary.pressure_bucket == "medium" else 0.05)
                margin = max(
                    metrics.showdown_strength - threshold,
                    metrics.equity_estimate - equity_threshold,
                )
                base_call = 0.22 if summary.pressure_bucket == "small" else 0.16 if summary.pressure_bucket == "medium" else 0.08
                base_fold = 0.40 if summary.pressure_bucket == "small" else 0.52 if summary.pressure_bucket == "medium" else 0.68
                boost(weights, "call", base_call + max(0.0, margin) * 0.68 + (hero_call - 0.5) * 0.08)
                boost(weights, "fold", base_fold + max(0.0, -margin) * 1.02 + metrics.amount_to_call_share * 0.16)
                if summary.pressure_bucket != "large" and (
                    metrics.showdown_strength >= 0.72 or metrics.equity_estimate >= 0.70
                ):
                    boost(weights, "call", 0.06)
                    boost(weights, "fold", -0.03)
                    context.reason_tags.append("qualified_turn_continue")
                if metrics.showdown_strength >= 0.78 and summary.pressure_bucket == "small":
                    boost(weights, "raise", 0.08 + aggression * 0.05)
                context.reason_tags.append("turn_medium_strength_threshold")
        elif context.hand_bucket == "strong_draw":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.38 + aggression * 0.12 + max(0.0, barrel_bias) * 0.14)
                boost(weights, "check", 0.28)
            else:
                margin = metrics.equity_estimate - (metrics.required_equity + 0.01)
                boost(weights, "call", 0.30 + max(0.0, margin) * 0.95)
                boost(weights, "fold", 0.20 + max(0.0, -margin) * 1.05)
                if summary.pressure_bucket != "large":
                    boost(weights, "raise", 0.12 + aggression * 0.08 + max(0.0, margin) * 0.18)
        elif context.hand_bucket == "weak_draw":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.10 + max(0.0, barrel_bias) * 0.08)
                boost(weights, "check", 0.60)
            else:
                margin = metrics.equity_estimate - (metrics.required_equity + 0.06)
                boost(weights, "call", 0.12 + max(0.0, margin) * 0.72)
                boost(weights, "fold", 0.40 + max(0.0, -margin) * 1.10 + metrics.amount_to_call_share * 0.12)
        elif context.hand_bucket == "weak_showdown_value":
            if state.amount_to_call <= 0:
                boost(weights, "check", 0.80)
                if summary.position_status == "ip" and metrics.showdown_strength >= 0.62:
                    boost(weights, bet_action, 0.10)
            else:
                threshold = self._turn_continue_threshold(metrics, summary, context.hand_bucket)
                equity_threshold = metrics.required_equity + (0.00 if summary.pressure_bucket == "small" else 0.02 if summary.pressure_bucket == "medium" else 0.04)
                margin = max(
                    metrics.showdown_strength - threshold,
                    metrics.equity_estimate - equity_threshold,
                )
                base_call = 0.14 if summary.pressure_bucket == "small" else 0.08 if summary.pressure_bucket == "medium" else 0.03
                base_fold = 0.48 if summary.pressure_bucket == "small" else 0.62 if summary.pressure_bucket == "medium" else 0.78
                boost(weights, "call", base_call + max(0.0, margin) * 0.58 + (hero_call - 0.5) * 0.08)
                boost(weights, "fold", base_fold + max(0.0, -margin) * 1.04 + metrics.amount_to_call_share * 0.16)
                if summary.pressure_bucket == "small" and (
                    metrics.showdown_strength >= 0.62 or metrics.equity_estimate >= 0.65
                ):
                    boost(weights, "call", 0.08)
                    boost(weights, "fold", -0.06)
                context.reason_tags.append("turn_bluff_catch_filter")
        else:
            if state.amount_to_call <= 0:
                bluff_score = 0.04
                if summary.spot_type == "turn_barrel_opportunity":
                    bluff_score += max(0.0, barrel_bias) * 0.12
                if summary.position_status == "ip":
                    bluff_score += 0.03
                boost(weights, bet_action, bluff_score)
                boost(weights, "check", 0.70)
            else:
                boost(weights, "fold", 0.72 + metrics.amount_to_call_share * 0.16)
                boost(weights, "call", 0.04)

    def _build_river_plan(
        self,
        weights: dict[str, float],
        context: StrategyContext,
        summary: PostflopActionSummary,
        metrics: HeadsUpPostflopMetrics,
        bet_action: str,
    ) -> None:
        state = context.state
        profile = context.profile
        aggression = profile.aggression / 100.0
        hero_call = profile.hero_call / 100.0
        bluff_bias = profile.river_bluff / 100.0 + style_bias(profile, "bluff")

        if context.hand_bucket == "strong_made_hand":
            if state.amount_to_call <= 0:
                boost(weights, bet_action, 0.82 + aggression * 0.16)
                boost(weights, "check", 0.14)
            else:
                margin = metrics.showdown_strength - max(0.66, self.tuning.river_call_threshold - 0.06)
                boost(weights, "call", 0.34 + max(0.0, margin) * 0.72)
                boost(weights, "raise", 0.32 + max(0.0, margin) * 0.18 - metrics.amount_to_call_share * 0.08)
                boost(weights, "fold", 0.04)
        elif context.hand_bucket == "medium_made_hand":
            if state.amount_to_call <= 0:
                thin_value_threshold = max(0.66, metrics.medium_continue_threshold + 0.08)
                if metrics.showdown_strength >= thin_value_threshold:
                    boost(weights, bet_action, 0.22 + aggression * 0.08)
                boost(weights, "check", 0.72)
                context.reason_tags.append("river_medium_strength_value_filter")
            else:
                call_threshold = self._river_bluff_catch_threshold(metrics, summary, context.hand_bucket)
                margin = metrics.showdown_strength - call_threshold
                base_call = 0.26 if summary.pressure_bucket == "small" else 0.20 if summary.pressure_bucket == "medium" else 0.05
                base_fold = 0.30 if summary.pressure_bucket == "small" else 0.44 if summary.pressure_bucket == "medium" else 0.72
                boost(weights, "call", base_call + max(0.0, margin) * 0.72 + (hero_call - 0.5) * 0.10)
                boost(weights, "fold", base_fold + max(0.0, -margin) * 0.90 + metrics.amount_to_call_share * 0.08)
                if summary.pressure_bucket == "small" and metrics.showdown_strength >= call_threshold + 0.02:
                    boost(weights, "call", 0.03)
                    boost(weights, "fold", -0.02)
                    context.reason_tags.append("qualified_river_continue")
                elif summary.pressure_bucket == "medium" and metrics.showdown_strength >= call_threshold + 0.08:
                    boost(weights, "call", 0.02)
                    boost(weights, "fold", -0.01)
                    context.reason_tags.append("qualified_river_continue")
                if metrics.showdown_strength >= 0.82 and summary.pressure_bucket == "small":
                    boost(weights, "raise", 0.07 + aggression * 0.04)
                context.reason_tags.append("river_medium_strength_threshold")
        elif context.hand_bucket == "weak_showdown_value":
            if state.amount_to_call <= 0:
                boost(weights, "check", 0.88)
                if metrics.showdown_strength >= 0.68 and summary.position_status == "ip":
                    boost(weights, bet_action, 0.08)
            else:
                call_threshold = self._river_bluff_catch_threshold(metrics, summary, context.hand_bucket)
                margin = metrics.showdown_strength - call_threshold
                base_call = 0.14 if summary.pressure_bucket == "small" else 0.10 if summary.pressure_bucket == "medium" else 0.02
                base_fold = 0.50 if summary.pressure_bucket == "small" else 0.62 if summary.pressure_bucket == "medium" else 0.82
                boost(weights, "call", base_call + max(0.0, margin) * 0.64 + (hero_call - 0.5) * 0.10)
                boost(weights, "fold", base_fold + max(0.0, -margin) * 0.86 + metrics.amount_to_call_share * 0.08)
                if summary.pressure_bucket == "small" and metrics.showdown_strength >= 0.42:
                    boost(weights, "call", 0.06)
                    boost(weights, "fold", -0.03)
                    context.reason_tags.append("qualified_river_bluff_catch")
                elif summary.pressure_bucket == "medium" and metrics.showdown_strength >= 0.46:
                    boost(weights, "call", 0.04)
                    boost(weights, "fold", -0.02)
                    context.reason_tags.append("qualified_river_bluff_catch")
                context.reason_tags.append("river_bluff_catch_threshold")
        elif context.hand_bucket == "strong_draw":
            if state.amount_to_call <= 0:
                boost(weights, "check", 0.84)
                boost(weights, bet_action, 0.08 + max(0.0, bluff_bias - 0.55) * 0.10)
            else:
                boost(weights, "fold", 0.70)
                boost(weights, "call", 0.05)
        elif context.hand_bucket == "air":
            if state.amount_to_call <= 0:
                bluff_score = 0.04 + max(0.0, bluff_bias - 0.50) * 0.14
                if summary.position_status == "ip" and summary.spot_type == "river_bluff_or_giveup":
                    bluff_score += 0.05
                boost(weights, bet_action, bluff_score)
                boost(weights, "check", 0.76)
            else:
                boost(weights, "fold", 0.82 + metrics.amount_to_call_share * 0.10)
                boost(weights, "call", 0.02)
        else:
            if state.amount_to_call <= 0:
                boost(weights, "check", 0.86)
            else:
                boost(weights, "fold", 0.74 + metrics.amount_to_call_share * 0.10)
                boost(weights, "call", 0.04)

    def _size_bucket(self, context: StrategyContext, metrics: HeadsUpPostflopMetrics) -> str | None:
        if context.state.street == "flop":
            if context.hand_bucket in {"strong_made_hand", "medium_made_hand", "strong_draw"}:
                return "flop_cbet"
            return "flop_probe"
        if context.state.street == "turn":
            if context.hand_bucket in {"strong_made_hand", "strong_draw"}:
                return "turn_barrel"
            return "turn_probe"
        if context.hand_bucket == "strong_made_hand":
            return "river_value"
        if context.hand_bucket == "medium_made_hand" and metrics.showdown_strength >= 0.68:
            return "river_value"
        return "river_bluff"

    def _resolve_metrics(self, context: StrategyContext, summary: PostflopActionSummary) -> HeadsUpPostflopMetrics:
        prediction = context.evaluator_snapshot.prediction
        equity_estimate = prediction.equity_estimate if prediction is not None else context.hand_score
        showdown_strength = prediction.showdown_strength_proxy if prediction is not None else context.hand_score
        required_equity = (
            context.state.amount_to_call / max(context.state.pot_size + context.state.amount_to_call, 1.0)
            if context.state.amount_to_call > 0
            else 0.0
        )
        hero_call_adjustment = ((context.profile.hero_call / 100.0) - 0.5) * 0.06
        risk_adjustment = ((context.profile.risk_tolerance / 100.0) - 0.5) * 0.04
        pressure_adjustment = 0.00 if summary.pressure_bucket == "small" else 0.03 if summary.pressure_bucket == "medium" else 0.07 if summary.pressure_bucket == "large" else -0.02
        pot_adjustment = 0.03 if summary.pot_type in {"three_bet_pot", "four_bet_plus_pot"} else 0.0

        base_medium = 0.48 if context.state.street == "flop" else 0.55 if context.state.street == "turn" else 0.60
        medium_continue_threshold = base_medium + pressure_adjustment + pot_adjustment - hero_call_adjustment - risk_adjustment
        turn_threshold_small = 0.46 + pot_adjustment * 0.6 - hero_call_adjustment * 0.7 - risk_adjustment * 0.6
        turn_threshold_medium = 0.52 + pot_adjustment * 0.7 - hero_call_adjustment * 0.6 - risk_adjustment * 0.5
        turn_threshold_large = 0.60 + pot_adjustment * 0.8 - hero_call_adjustment * 0.5 - risk_adjustment * 0.4

        river_base = (
            self.tuning.river_bluff_catch_threshold
            if self.tuning.river_bluff_catch_threshold is not None
            else max(self.tuning.river_call_threshold + 0.04, 0.60)
        )
        river_small = river_base - 0.12 + pot_adjustment * 0.2 - hero_call_adjustment * 0.7
        river_medium = river_base - 0.10 + pot_adjustment * 0.4 - hero_call_adjustment * 0.6
        river_large = river_base - 0.02 + pot_adjustment * 0.6 - hero_call_adjustment * 0.5

        return HeadsUpPostflopMetrics(
            equity_estimate=equity_estimate,
            showdown_strength=showdown_strength,
            required_equity=required_equity,
            amount_to_call_share=summary.amount_to_call_share,
            medium_continue_threshold=max(0.38, min(0.82, medium_continue_threshold)),
            turn_medium_continue_threshold_small=max(0.42, min(0.78, turn_threshold_small)),
            turn_medium_continue_threshold_medium=max(0.46, min(0.82, turn_threshold_medium)),
            turn_medium_continue_threshold_large=max(0.52, min(0.88, turn_threshold_large)),
            river_bluff_catch_threshold_small=max(0.46, min(0.80, river_small)),
            river_bluff_catch_threshold_medium=max(0.52, min(0.86, river_medium)),
            river_bluff_catch_threshold_large=max(0.60, min(0.92, river_large)),
        )

    def _turn_continue_threshold(
        self,
        metrics: HeadsUpPostflopMetrics,
        summary: PostflopActionSummary,
        hand_bucket: str,
    ) -> float:
        if summary.pressure_bucket == "large":
            threshold = metrics.turn_medium_continue_threshold_large
        elif summary.pressure_bucket == "medium":
            threshold = metrics.turn_medium_continue_threshold_medium
        else:
            threshold = metrics.turn_medium_continue_threshold_small
        if hand_bucket == "weak_showdown_value":
            threshold += 0.06
        return threshold

    def _river_bluff_catch_threshold(
        self,
        metrics: HeadsUpPostflopMetrics,
        summary: PostflopActionSummary,
        hand_bucket: str,
    ) -> float:
        if summary.pressure_bucket == "large":
            threshold = metrics.river_bluff_catch_threshold_large
        elif summary.pressure_bucket == "medium":
            threshold = metrics.river_bluff_catch_threshold_medium
        else:
            threshold = metrics.river_bluff_catch_threshold_small
        if hand_bucket == "medium_made_hand":
            threshold -= 0.06
        return threshold
