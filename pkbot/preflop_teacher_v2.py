from __future__ import annotations

from dataclasses import dataclass

from .game_state import GameState
from .hand_evaluator import evaluate_preflop
from .preflop_labeling import PreflopActionSummary, classify_preflop_spot
from .strategy.shared import boost, initialize_weights
from .strategy.types import PolicyPlan, StrategyContext

OPEN_THRESHOLDS = {
    "UTG": 0.60,
    "UTG+1": 0.58,
    "MP": 0.56,
    "HJ": 0.50,
    "CO": 0.44,
    "BTN": 0.38,
    "SB": 0.42,
    "BB": 0.55,
}

STEAL_THRESHOLDS = {
    "CO": 0.47,
    "BTN": 0.41,
}

DEFEND_THRESHOLDS = {
    "vs_early_middle_open": 0.66,
    "vs_late_open": 0.56,
    "bb_vs_open": 0.58,
    "bb_vs_late_open": 0.48,
    "sb_vs_open": 0.70,
    "sb_vs_late_open": 0.62,
    "sb_squeeze_or_defend": 0.68,
    "bb_squeeze_or_defend": 0.56,
}

THREE_BET_CONTINUE_THRESHOLDS = {
    "facing_3bet": 0.78,
    "facing_squeeze": 0.82,
    "sb_facing_3bet": 0.78,
    "bb_facing_3bet": 0.74,
    "sb_facing_squeeze": 0.82,
    "bb_facing_squeeze": 0.78,
}


@dataclass(slots=True, frozen=True)
class PreflopHandSummary:
    score: float
    category: str
    pair: bool
    suited: bool
    connected: bool
    broadway_count: int
    ace_high: bool
    wheel_ace: bool
    premium_like: bool


class PreflopTeacherV2:
    def build_plan(self, context: StrategyContext) -> PolicyPlan:
        state = context.state
        summary = context.preflop_spot or classify_preflop_spot(state)
        hand = summarize_preflop_hand(state)
        aggressive_action = _aggressive_action(state)
        passive_action = _passive_action(state)
        weights = initialize_weights(state.legal_actions.available())
        size_bucket = "preflop_three_bet" if summary.spot_type in {"facing_3bet", "facing_squeeze", "squeeze_opportunity"} else "preflop_open"

        if summary.spot_type == "unopened_preflop_open":
            self._handle_unopened_open(weights, context, summary, hand, aggressive_action)
        elif summary.spot_type == "late_position_steal":
            self._handle_late_steal(weights, context, summary, hand, aggressive_action)
        elif summary.action_context_subtype == "sb_first_in":
            self._handle_small_blind_first_in(weights, context, summary, hand, aggressive_action)
        elif summary.spot_type in {"facing_open", "blind_defense"}:
            self._handle_facing_open(weights, context, summary, hand, aggressive_action, passive_action)
        elif summary.spot_type == "squeeze_opportunity":
            self._handle_squeeze(weights, context, summary, hand, aggressive_action, passive_action)
        else:
            self._handle_facing_reraise(weights, context, summary, hand, aggressive_action, passive_action)

        _ensure_fallback(weights, state)
        return PolicyPlan(action_weights=weights, size_bucket=size_bucket if aggressive_action in weights else None)

    def _handle_unopened_open(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str) -> None:
        state = context.state
        profile = context.profile
        threshold = OPEN_THRESHOLDS.get(state.hero_position, 0.60)
        open_score = _base_preflop_score(hand) + _position_open_bonus(state.hero_position) + _style_open_delta(profile)
        context.notes.append(f"PreflopTeacherV2 open score {open_score:.2f} vs {threshold:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        if open_score >= threshold:
            boost(weights, aggressive_action, 1.00 + profile.pfr / 220.0)
            boost(weights, "call", -0.35)
            _block_open_limp(weights, state)
            return
        _prefer_fold_or_check(weights, state)

    def _handle_late_steal(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str) -> None:
        state = context.state
        profile = context.profile
        threshold = STEAL_THRESHOLDS.get(state.hero_position, 0.46)
        steal_score = _base_preflop_score(hand) + _position_steal_bonus(state.hero_position) + _style_open_delta(profile) + _steal_hand_bonus(hand)
        context.notes.append(f"PreflopTeacherV2 steal score {steal_score:.2f} vs {threshold:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        if steal_score >= threshold:
            boost(weights, aggressive_action, 1.08 + profile.aggression / 210.0)
            _block_open_limp(weights, state)
            return
        _prefer_fold_or_check(weights, state)

    def _handle_facing_open(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str, passive_action: str) -> None:
        profile = context.profile
        subtype = summary.action_context_subtype
        threshold = DEFEND_THRESHOLDS.get(subtype, 0.62)
        defend_score = _base_preflop_score(hand) + _defend_bonus(summary, hand) + _style_defend_delta(profile)
        three_bet_score = defend_score + _three_bet_bonus(summary, hand) + profile.three_bet / 140.0
        context.notes.append(f"PreflopTeacherV2 defend score {defend_score:.2f} / 3bet score {three_bet_score:.2f} vs {threshold:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        can_pressure_reraise = profile.three_bet >= 12 or profile.aggression >= 65 or profile.risk_tolerance >= 60
        if hand.premium_like or (hand.category == "strong" and can_pressure_reraise and three_bet_score >= threshold + 0.18):
            boost(weights, aggressive_action, 0.94 + profile.three_bet / 150.0)
            if passive_action in weights:
                boost(weights, passive_action, 0.12)
            return
        if defend_score >= threshold:
            if passive_action in weights:
                boost(weights, passive_action, 0.88 + profile.hero_call / 260.0)
            if summary.hero_in_blinds and hand.category in {"strong", "playable"} and aggressive_action in weights:
                boost(weights, aggressive_action, 0.16 + profile.three_bet / 420.0)
            return
        boost(weights, "fold", 1.00 + max(0.0, threshold - defend_score))

    def _handle_squeeze(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str, passive_action: str) -> None:
        profile = context.profile
        squeeze_score = _base_preflop_score(hand) + _squeeze_bonus(summary, hand) + profile.three_bet / 160.0
        context.notes.append(f"PreflopTeacherV2 squeeze score {squeeze_score:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        if hand.premium_like or squeeze_score >= 0.78:
            boost(weights, aggressive_action, 1.00 + profile.aggression / 180.0)
            return
        if squeeze_score >= 0.62 and passive_action in weights:
            boost(weights, passive_action, 0.72)
            if aggressive_action in weights:
                boost(weights, aggressive_action, 0.18)
            return
        boost(weights, "fold", 0.96)

    def _handle_facing_reraise(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str, passive_action: str) -> None:
        profile = context.profile
        threshold = THREE_BET_CONTINUE_THRESHOLDS.get(summary.action_context_subtype, THREE_BET_CONTINUE_THRESHOLDS.get(summary.spot_type, 0.78))
        continue_score = _base_preflop_score(hand) + _reraise_continue_bonus(summary, hand) + _style_defend_delta(profile) * 0.6
        four_bet_score = continue_score + profile.three_bet / 170.0 + (0.10 if hand.premium_like else 0.0)
        context.notes.append(f"PreflopTeacherV2 continue score {continue_score:.2f} / re-raise score {four_bet_score:.2f} vs {threshold:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        if hand.premium_like or four_bet_score >= threshold + 0.16:
            boost(weights, aggressive_action, 0.98 + profile.three_bet / 150.0)
            if passive_action in weights:
                boost(weights, passive_action, 0.08)
            return
        if continue_score >= threshold and passive_action in weights:
            boost(weights, passive_action, 0.84 + profile.hero_call / 300.0)
            return
        boost(weights, "fold", 1.08)

    def _handle_small_blind_first_in(self, weights: dict[str, float], context: StrategyContext, summary: PreflopActionSummary, hand: PreflopHandSummary, aggressive_action: str) -> None:
        state = context.state
        profile = context.profile
        open_score = _base_preflop_score(hand) + 0.06 + _style_open_delta(profile) + _steal_hand_bonus(hand)
        complete_score = _base_preflop_score(hand) + _style_defend_delta(profile) * 0.5
        context.notes.append(f"PreflopTeacherV2 SB first-in open score {open_score:.2f}; complete score {complete_score:.2f}.")
        context.reason_tags.extend([summary.spot_type, summary.action_context_subtype])
        if open_score >= 0.44:
            boost(weights, aggressive_action, 1.02 + profile.pfr / 240.0)
            _block_open_limp(weights, state)
            return
        if "call" in weights and hand.suited and hand.connected and complete_score >= 0.50 and profile.hero_call >= 55:
            boost(weights, "call", 0.42)
            boost(weights, "fold", 0.58)
            return
        _prefer_fold_or_check(weights, state)


def summarize_preflop_hand(state: GameState) -> PreflopHandSummary:
    insight = evaluate_preflop(state.hero_hole_cards)
    values = sorted((card.value for card in state.hero_hole_cards), reverse=True)
    pair = values[0] == values[1]
    suited = state.hero_hole_cards[0].suit == state.hero_hole_cards[1].suit
    connected = abs(values[0] - values[1]) <= 2
    broadway_count = sum(1 for value in values if value >= 10)
    ace_high = values[0] == 14
    wheel_ace = ace_high and values[1] <= 5 and suited
    premium_like = insight.category == "premium" or (pair and values[0] >= 11)
    return PreflopHandSummary(insight.score, insight.category, pair, suited, connected, broadway_count, ace_high, wheel_ace, premium_like)


def _base_preflop_score(hand: PreflopHandSummary) -> float:
    score = hand.score
    if hand.pair:
        score += 0.05
    if hand.suited:
        score += 0.03
    if hand.connected:
        score += 0.03
    if hand.broadway_count == 2:
        score += 0.04
    if hand.ace_high and hand.suited:
        score += 0.03
    if hand.wheel_ace:
        score += 0.03
    if hand.category == "weak" and not hand.suited and not hand.pair and hand.broadway_count == 0:
        score -= 0.08
    return score


def _position_open_bonus(position: str) -> float:
    return {"UTG": -0.08, "UTG+1": -0.06, "MP": -0.02, "HJ": 0.05, "CO": 0.12, "BTN": 0.18, "SB": 0.08, "BB": -0.04}.get(position, 0.0)


def _position_steal_bonus(position: str) -> float:
    return {"CO": 0.06, "BTN": 0.10, "SB": 0.04}.get(position, 0.0)


def _style_open_delta(profile) -> float:
    return (profile.pfr - 18) / 180.0 + (profile.risk_tolerance - 50) / 300.0


def _style_defend_delta(profile) -> float:
    return (profile.hero_call - 45) / 240.0 + (profile.risk_tolerance - 50) / 360.0


def _steal_hand_bonus(hand: PreflopHandSummary) -> float:
    bonus = 0.0
    if hand.suited:
        bonus += 0.03
    if hand.connected:
        bonus += 0.03
    if hand.ace_high:
        bonus += 0.03
    if hand.category == "weak" and hand.broadway_count == 0 and not hand.suited:
        bonus -= 0.05
    return bonus


def _defend_bonus(summary: PreflopActionSummary, hand: PreflopHandSummary) -> float:
    bonus = 0.0
    if summary.opener_is_late:
        bonus += 0.05
    if summary.hero_in_blinds:
        bonus += 0.04 if summary.hero_position == "BB" else -0.03
    if hand.pair:
        bonus += 0.05
    if hand.suited:
        bonus += 0.04
    if hand.connected:
        bonus += 0.03
    if hand.broadway_count == 2:
        bonus += 0.04
    if hand.category == "weak" and not hand.suited:
        bonus -= 0.06
    return bonus


def _three_bet_bonus(summary: PreflopActionSummary, hand: PreflopHandSummary) -> float:
    bonus = 0.0
    if hand.premium_like:
        bonus += 0.15
    elif hand.category == "strong":
        bonus += 0.08
    if summary.opener_is_late and hand.ace_high:
        bonus += 0.04
    if summary.hero_position in {"CO", "BTN"}:
        bonus += 0.02
    return bonus


def _squeeze_bonus(summary: PreflopActionSummary, hand: PreflopHandSummary) -> float:
    bonus = 0.0
    if hand.premium_like:
        bonus += 0.16
    elif hand.category == "strong":
        bonus += 0.08
    if summary.opener_is_late:
        bonus += 0.03
    if hand.ace_high and hand.suited:
        bonus += 0.03
    if hand.category == "weak" and not hand.ace_high:
        bonus -= 0.08
    return bonus


def _reraise_continue_bonus(summary: PreflopActionSummary, hand: PreflopHandSummary) -> float:
    bonus = 0.0
    if hand.premium_like:
        bonus += 0.14
    elif hand.category == "strong":
        bonus += 0.08
    elif hand.category == "playable" and hand.pair:
        bonus += 0.04
    if summary.hero_position in {"CO", "BTN"}:
        bonus += 0.03
    if summary.hero_in_blinds and hand.category in {"weak", "speculative"}:
        bonus -= 0.04
    return bonus


def _aggressive_action(state: GameState) -> str:
    if state.legal_actions.can_raise:
        return "raise"
    if state.legal_actions.can_bet:
        return "bet"
    return "call"


def _passive_action(state: GameState) -> str:
    if state.legal_actions.can_call:
        return "call"
    if state.legal_actions.can_check:
        return "check"
    return "fold"


def _block_open_limp(weights: dict[str, float], state: GameState) -> None:
    if state.amount_to_call > 0 and not state.facing_bet and not state.facing_raise and "call" in weights:
        boost(weights, "call", -0.42)


def _prefer_fold_or_check(weights: dict[str, float], state: GameState) -> None:
    if state.legal_actions.can_check:
        boost(weights, "check", 0.96)
    elif state.legal_actions.can_fold:
        boost(weights, "fold", 0.96)
    elif state.legal_actions.can_call:
        boost(weights, "call", 0.24)


def _ensure_fallback(weights: dict[str, float], state: GameState) -> None:
    if all(value <= 0.0 for value in weights.values()):
        if state.legal_actions.can_fold:
            weights["fold"] = 1.0
        elif state.legal_actions.can_check:
            weights["check"] = 1.0
        elif state.legal_actions.can_call:
            weights["call"] = 1.0
