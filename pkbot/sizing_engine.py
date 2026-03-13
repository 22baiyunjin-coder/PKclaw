from __future__ import annotations

from .game_state import GameState
from .style_profile import StyleProfile


class SizingEngine:
    def resolve_size(
        self,
        state: GameState,
        profile: StyleProfile,
        action: str,
        size_bucket: str | None,
        board_texture: str,
        hand_bucket: str,
    ) -> float | None:
        if action not in {"bet", "raise"}:
            return None
        bucket = size_bucket or self._default_bucket(state, hand_bucket)
        if bucket == "preflop_three_bet":
            return self.three_bet_size(state, profile)
        if bucket == "preflop_open":
            return self.preflop_open_size(state, profile)
        if bucket in {"flop_cbet", "flop_probe"}:
            return self.flop_cbet_size(state, profile, board_texture)
        if bucket in {"turn_barrel", "turn_probe"}:
            return self.turn_barrel_size(state, profile, board_texture)
        if bucket == "river_value":
            return self.river_value_size(state, profile)
        if bucket == "river_bluff":
            return self.river_bluff_size(state, profile)
        return self._fallback_size(state, profile, board_texture, hand_bucket)

    def preflop_open_size(self, state: GameState, profile: StyleProfile) -> float:
        base = 2.2 if state.hero_position in {"CO", "BTN", "SB"} else 2.5
        return round(base + profile.risk_tolerance * 0.003, 2)

    def three_bet_size(self, state: GameState, profile: StyleProfile) -> float:
        base = max(state.min_raise, max(state.amount_to_call * 3.2, state.big_blind * 8.0))
        if state.hero_position in {"SB", "BB"}:
            base += state.big_blind
        return round(min(base + profile.aggression * 0.02, state.max_raise), 2)

    def flop_cbet_size(self, state: GameState, profile: StyleProfile, board_texture: str) -> float:
        fraction = 0.30 if board_texture == "dry" else 0.45 if board_texture == "semi_wet" else 0.60
        fraction += (profile.flop_cbet - 50) * 0.0015
        return round(min(state.max_raise, max(state.big_blind, state.pot_size * fraction)), 2)

    def turn_barrel_size(self, state: GameState, profile: StyleProfile, board_texture: str) -> float:
        fraction = 0.55 if board_texture == "dry" else 0.65
        fraction += (profile.turn_barrel - 50) * 0.0015
        return round(min(state.max_raise, max(state.big_blind, state.pot_size * fraction)), 2)

    def river_value_size(self, state: GameState, profile: StyleProfile) -> float:
        fraction = 0.66 + (profile.aggression - 50) * 0.001
        return round(min(state.max_raise, max(state.big_blind, state.pot_size * fraction)), 2)

    def river_bluff_size(self, state: GameState, profile: StyleProfile) -> float:
        fraction = 0.55 + (profile.river_bluff - 50) * 0.0012
        return round(min(state.max_raise, max(state.big_blind, state.pot_size * fraction)), 2)

    def _default_bucket(self, state: GameState, hand_bucket: str) -> str:
        if state.street == "preflop":
            return "preflop_three_bet" if state.facing_bet or state.facing_raise else "preflop_open"
        if state.street == "flop":
            return "flop_cbet"
        if state.street == "turn":
            return "turn_barrel"
        if hand_bucket == "strong_made_hand":
            return "river_value"
        return "river_bluff"

    def _fallback_size(self, state: GameState, profile: StyleProfile, board_texture: str, hand_bucket: str) -> float:
        if state.street == "preflop":
            if state.facing_bet or state.facing_raise:
                return self.three_bet_size(state, profile)
            return self.preflop_open_size(state, profile)
        if state.street == "flop":
            return self.flop_cbet_size(state, profile, board_texture)
        if state.street == "turn":
            return self.turn_barrel_size(state, profile, board_texture)
        if hand_bucket == "strong_made_hand":
            return self.river_value_size(state, profile)
        return self.river_bluff_size(state, profile)
