from __future__ import annotations

from .game_state import GameState
from .style_profile import StyleProfile


class SizingEngine:
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
