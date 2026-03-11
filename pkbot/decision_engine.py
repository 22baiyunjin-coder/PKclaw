from __future__ import annotations

from dataclasses import dataclass

from .game_state import DecisionResult, GameState
from .hand_evaluator import analyze_board_texture, evaluate_postflop, evaluate_preflop
from .sizing_engine import SizingEngine
from .style_profile import StyleProfile

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


@dataclass(slots=True)
class DecisionContext:
    hand_bucket: str
    hand_score: float
    board_texture: str
    board_tags: list[str]
    reason_tags: list[str]
    notes: list[str]


class DecisionEngine:
    def __init__(self, sizing_engine: SizingEngine | None = None) -> None:
        self.sizing_engine = sizing_engine or SizingEngine()

    def decide(self, state: GameState, profile: StyleProfile) -> DecisionResult:
        context = self._build_context(state)
        weights = {action: 0.0 for action in state.legal_actions.available()}
        if state.street == "preflop":
            self._preflop_weights(weights, state, profile, context)
        else:
            self._postflop_weights(weights, state, profile, context)

        for action in list(weights):
            weights[action] = max(weights[action], 0.01)
        total = sum(weights.values())
        probabilities = {action: round(value / total, 3) for action, value in weights.items()}
        action = max(probabilities, key=probabilities.get)
        size = self._choose_size(state, profile, context, action)
        return DecisionResult(action=action, size=size, action_probabilities=probabilities, reason_tags=context.reason_tags, debug_notes=context.notes)

    def _boost(self, weights: dict[str, float], action: str, amount: float) -> None:
        if action in weights:
            weights[action] += amount

    def _style_bias(self, profile: StyleProfile, key: str) -> float:
        return STYLE_OFFSETS.get(profile.name, {}).get(key, 0.0)

    def _build_context(self, state: GameState) -> DecisionContext:
        if state.street == "preflop":
            insight = evaluate_preflop(state.hero_hole_cards)
            return DecisionContext(
                hand_bucket=insight.category,
                hand_score=insight.score,
                board_texture="preflop",
                board_tags=[],
                reason_tags=[insight.category, state.hero_position.lower().replace("+", "p")],
                notes=[f"Preflop hand bucket: {insight.category} ({insight.score:.2f})."],
            )

        board = analyze_board_texture(state.board_cards)
        insight = evaluate_postflop(state.hero_hole_cards, state.board_cards)
        reason_tags = [insight.category, board.texture, *board.tags[:2]]
        return DecisionContext(
            hand_bucket=insight.category,
            hand_score=insight.score,
            board_texture=board.texture,
            board_tags=board.tags,
            reason_tags=reason_tags,
            notes=[f"Postflop category: {insight.category} ({insight.score:.2f}).", f"Board texture: {board.texture} ({', '.join(board.tags) if board.tags else 'clean'})."],
        )

    def _preflop_weights(self, weights: dict[str, float], state: GameState, profile: StyleProfile, context: DecisionContext) -> None:
        looseness = profile.vpip / 100.0 - POSITION_TIGHTNESS[state.hero_position]
        raise_drive = profile.pfr / 100.0 + profile.aggression / 220.0
        call_drive = profile.hero_call / 100.0
        open_score = context.hand_score + looseness + raise_drive * 0.18 + self._style_bias(profile, "open")
        defend_score = context.hand_score + looseness + call_drive * 0.12 + self._style_bias(profile, "defend") + self._style_bias(profile, "hero_call") * 0.3
        to_call_bb = state.amount_to_call / max(state.big_blind, 1.0)

        if not state.facing_bet and not state.facing_raise:
            threshold = PRE_OPEN_THRESHOLDS[context.hand_bucket]
            context.notes.append(f"Open score {open_score:.2f} vs threshold {threshold:.2f}.")
            if open_score >= threshold:
                self._boost(weights, "raise", 0.82 + raise_drive * 0.35)
                self._boost(weights, "bet", 0.82 + raise_drive * 0.35)
                self._boost(weights, "check", 0.12)
            else:
                self._boost(weights, "check", 0.78)
                self._boost(weights, "fold", 0.62)
            return

        thresholds = FACING_3BET_THRESHOLDS if state.facing_raise else FACING_OPEN_THRESHOLDS
        threshold = thresholds[context.hand_bucket]
        pressure_penalty = min(0.22, max(0.0, to_call_bb - 2.5) * 0.04)
        defend_score -= pressure_penalty
        context.notes.append(f"Defend score {defend_score:.2f} vs threshold {threshold:.2f}.")

        if context.hand_bucket in {"premium", "strong"}:
            self._boost(weights, "raise", 0.38 + profile.three_bet / 100.0 + profile.aggression / 220.0 + self._style_bias(profile, "pressure") * 0.3)
        if defend_score >= threshold:
            self._boost(weights, "call", 0.55 + call_drive * 0.25)
            if state.hero_position in {"BTN", "CO", "BB"} and context.hand_bucket in {"playable", "speculative"}:
                self._boost(weights, "call", 0.10)
        else:
            self._boost(weights, "fold", 0.66 + max(0.0, threshold - defend_score))
        self._boost(weights, "fold", 0.18 + max(0.0, threshold - defend_score) * 0.35)

    def _postflop_weights(self, weights: dict[str, float], state: GameState, profile: StyleProfile, context: DecisionContext) -> None:
        aggression = profile.aggression / 100.0
        call_bias = profile.hero_call / 100.0 + self._style_bias(profile, "hero_call")
        bluff_bias = self._style_bias(profile, "bluff")
        pressure_bias = self._style_bias(profile, "pressure")
        board_pressure = 0.10 if context.board_texture == "dry" else 0.18 if context.board_texture == "semi_wet" else 0.24
        multiway_penalty = max(0.0, (len(state.active_players) - 2) * 0.11)
        big_bet_pressure = state.amount_to_call / max(state.pot_size + state.amount_to_call, 1.0) if state.amount_to_call > 0 else 0.0
        bet_action = "bet" if "bet" in weights else "raise"

        if context.hand_bucket == "strong_made_hand":
            self._boost(weights, bet_action, 0.72 + aggression * 0.45 + pressure_bias * 0.2)
            self._boost(weights, "call", 0.22)
            self._boost(weights, "check", 0.10)
        elif context.hand_bucket == "medium_made_hand":
            if state.amount_to_call == 0:
                self._boost(weights, bet_action, 0.34 + profile.flop_cbet / 100.0 * 0.40)
                self._boost(weights, "check", 0.44)
            else:
                self._boost(weights, "call", 0.48 + call_bias * 0.22 - multiway_penalty * 0.25)
                self._boost(weights, "fold", 0.28 + board_pressure * 0.35 + big_bet_pressure * 0.22)
        elif context.hand_bucket == "strong_draw":
            barrel = profile.flop_cbet if state.street == "flop" else profile.turn_barrel
            if state.amount_to_call == 0:
                self._boost(weights, bet_action, 0.42 + barrel / 100.0 * 0.46 + aggression * 0.18 + bluff_bias * 0.2)
            self._boost(weights, "call", 0.42 + call_bias * 0.16 - multiway_penalty * 0.2)
            self._boost(weights, "fold", 0.18 + max(0.0, big_bet_pressure - 0.35) * 0.35)
        elif context.hand_bucket == "weak_draw":
            barrel = profile.flop_cbet if state.street == "flop" else profile.turn_barrel
            if state.amount_to_call == 0:
                self._boost(weights, bet_action, 0.24 + barrel / 100.0 * 0.26 + bluff_bias * 0.18)
            self._boost(weights, "call", 0.26 + call_bias * 0.10 - multiway_penalty * 0.26)
            self._boost(weights, "fold", 0.34 + big_bet_pressure * 0.42 + multiway_penalty * 0.30)
        elif context.hand_bucket == "weak_showdown_value":
            self._boost(weights, "check", 0.66)
            self._boost(weights, "call", 0.34 + call_bias * 0.22 - multiway_penalty * 0.28)
            self._boost(weights, "fold", 0.32 + board_pressure * 0.24 + big_bet_pressure * 0.25)
        else:
            bluff_drive = profile.river_bluff if state.street == "river" else profile.flop_cbet if state.street == "flop" else profile.turn_barrel
            if state.amount_to_call == 0:
                self._boost(weights, bet_action, 0.12 + bluff_drive / 100.0 * 0.34 + aggression * 0.20 + bluff_bias * 0.25)
            self._boost(weights, "check", 0.58)
            self._boost(weights, "fold", 0.50 + (1 - max(0.0, call_bias)) * 0.20 + multiway_penalty * 0.32 + big_bet_pressure * 0.25)
            self._boost(weights, "call", 0.10 + max(0.0, call_bias) * 0.10 - multiway_penalty * 0.24)

        if state.amount_to_call > 0:
            fold_pressure = 0.16 if context.hand_bucket == "strong_made_hand" else 0.30 if context.hand_bucket in {"medium_made_hand", "strong_draw"} else 0.52
            self._boost(weights, "fold", big_bet_pressure * fold_pressure + multiway_penalty * 0.18)
            self._boost(weights, "call", -(big_bet_pressure * 0.16 + multiway_penalty * 0.10))
            context.notes.append(f"Call pressure factor: {big_bet_pressure:.2f}, multiway penalty: {multiway_penalty:.2f}.")
        if state.players_to_act_behind == 0:
            self._boost(weights, "call", 0.05)
            self._boost(weights, "check", 0.04)
            context.reason_tags.append("closing_action")
        if state.hero_position in {"CO", "BTN"}:
            context.reason_tags.append("in_position")
        if len(state.active_players) >= 4:
            context.reason_tags.append("multiway_pot")
        if profile.aggression >= 70:
            context.reason_tags.append("high_aggression_profile")
        if profile.hero_call >= 65:
            context.reason_tags.append("high_hero_call")

    def _choose_size(self, state: GameState, profile: StyleProfile, context: DecisionContext, action: str) -> float | None:
        if action not in {"bet", "raise"}:
            return None
        if state.street == "preflop":
            if state.facing_bet or state.facing_raise:
                return self.sizing_engine.three_bet_size(state, profile)
            return self.sizing_engine.preflop_open_size(state, profile)
        if state.street == "flop":
            return self.sizing_engine.flop_cbet_size(state, profile, context.board_texture)
        if state.street == "turn":
            return self.sizing_engine.turn_barrel_size(state, profile, context.board_texture)
        if context.hand_bucket == "strong_made_hand":
            return self.sizing_engine.river_value_size(state, profile)
        return self.sizing_engine.river_bluff_size(state, profile)

