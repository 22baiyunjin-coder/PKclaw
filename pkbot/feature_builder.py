from __future__ import annotations

from dataclasses import dataclass

from .cards import Card
from .game_state import ActionRecord, GameState
from .hand_evaluator import analyze_board_texture, evaluate_postflop, evaluate_preflop
from .style_profile import StyleProfile

POSITION_INDEX = {
    "UTG": 0,
    "UTG+1": 1,
    "MP": 2,
    "HJ": 3,
    "CO": 4,
    "BTN": 5,
    "SB": 6,
    "BB": 7,
}

STREET_INDEX = {
    "preflop": 0,
    "flop": 1,
    "turn": 2,
    "river": 3,
}

HAND_BUCKET_INDEX = {
    "weak": 0,
    "speculative": 1,
    "playable": 2,
    "strong": 3,
    "premium": 4,
    "air": 0,
    "weak_draw": 1,
    "weak_showdown_value": 2,
    "medium_made_hand": 3,
    "strong_draw": 4,
    "strong_made_hand": 5,
}

MADE_HAND_INDEX = {
    "high_card": 0,
    "pair": 1,
    "two_pair": 2,
    "trips": 3,
    "straight": 4,
    "flush": 5,
    "full_house": 6,
    "quads": 7,
    "straight_flush": 8,
}

DRAW_INDEX = {
    "no_draw": 0,
    "weak_draw": 1,
    "strong_draw": 2,
}

BOARD_TEXTURE_INDEX = {
    "preflop": 0,
    "dry": 1,
    "semi_wet": 2,
    "wet": 3,
}


@dataclass(slots=True)
class FeatureBuilder:
    include_style: bool = True

    def build(self, state: GameState, profile: StyleProfile | None = None) -> dict[str, float]:
        active_player_count = len(state.active_players)
        preflop = evaluate_preflop(state.hero_hole_cards)
        board = analyze_board_texture(state.board_cards)
        postflop = evaluate_postflop(state.hero_hole_cards, state.board_cards) if state.street != "preflop" else None
        history = state.action_history
        street_history = [record for record in history if record.street == state.street and record.note != "blind_post"]
        total_aggression = sum(1 for record in history if record.action in {"bet", "raise"} and record.note != "blind_post")
        street_aggression = sum(1 for record in street_history if record.action in {"bet", "raise"})
        hero_prior_aggression = sum(1 for record in history if record.player_name == state.hero_name and record.action in {"bet", "raise"} and record.note != "blind_post")
        hero_prior_calls = sum(1 for record in history if record.player_name == state.hero_name and record.action == "call")
        prior_folds = sum(1 for record in history if record.action == "fold")
        pot_after_call = state.pot_size + state.amount_to_call
        pot_odds = state.amount_to_call / pot_after_call if state.amount_to_call > 0 and pot_after_call > 0 else 0.0
        spr = state.effective_stack / max(state.pot_size, state.big_blind)
        hole_values = sorted((card.value for card in state.hero_hole_cards), reverse=True)
        suited = 1.0 if state.hero_hole_cards[0].suit == state.hero_hole_cards[1].suit else 0.0
        pair = 1.0 if hole_values[0] == hole_values[1] else 0.0
        gap = abs(hole_values[0] - hole_values[1])
        board_values = sorted((card.value for card in state.board_cards), reverse=True)
        board_high = board_values[0] if board_values else 0
        board_low = board_values[-1] if board_values else 0
        board_span = board_high - board_low if board_values else 0
        suit_counts = self._suit_count_features(state.board_cards)
        preflop_raisers = [record for record in history if record.street == "preflop" and record.action == "raise" and record.note != "blind_post"]
        current_street_raises = sum(1 for record in street_history if record.action == "raise")

        features: dict[str, float] = {
            "street_index": float(STREET_INDEX[state.street]),
            "hero_position_index": float(POSITION_INDEX[state.hero_position]),
            "last_aggressor_position_index": float(POSITION_INDEX.get(state.last_aggressor_position or "", -1)),
            "board_card_count": float(len(state.board_cards)),
            "active_player_count": float(active_player_count),
            "players_to_act_behind": float(state.players_to_act_behind),
            "pot_size_bb": float(state.pot_size / max(state.big_blind, 1.0)),
            "effective_stack_bb": float(state.effective_stack / max(state.big_blind, 1.0)),
            "amount_to_call_bb": float(state.amount_to_call / max(state.big_blind, 1.0)),
            "min_raise_bb": float(state.min_raise / max(state.big_blind, 1.0)),
            "max_raise_bb": float(state.max_raise / max(state.big_blind, 1.0)),
            "spr": float(spr),
            "pot_odds": float(pot_odds),
            "call_share_of_pot": float(state.amount_to_call / max(state.pot_size, state.big_blind)) if state.amount_to_call > 0 else 0.0,
            "facing_bet": float(state.facing_bet),
            "facing_raise": float(state.facing_raise),
            "is_preflop_aggressor": float(state.is_preflop_aggressor),
            "legal_can_check": float(state.legal_actions.can_check),
            "legal_can_call": float(state.legal_actions.can_call),
            "legal_can_bet": float(state.legal_actions.can_bet),
            "legal_can_raise": float(state.legal_actions.can_raise),
            "history_action_count": float(len(history)),
            "street_action_count": float(len(street_history)),
            "total_aggression_count": float(total_aggression),
            "street_aggression_count": float(street_aggression),
            "hero_prior_aggression_count": float(hero_prior_aggression),
            "hero_prior_call_count": float(hero_prior_calls),
            "prior_fold_count": float(prior_folds),
            "preflop_raise_count": float(len(preflop_raisers)),
            "current_street_raise_count": float(current_street_raises),
            "hole_high_rank": float(hole_values[0]),
            "hole_low_rank": float(hole_values[1]),
            "hole_suited": suited,
            "hole_pair": pair,
            "hole_gap": float(gap),
            "hole_broadway_count": float(sum(1 for value in hole_values if value >= 10)),
            "preflop_bucket_index": float(HAND_BUCKET_INDEX[preflop.category]),
            "preflop_score": float(preflop.score),
            "board_texture_index": float(BOARD_TEXTURE_INDEX[board.texture]),
            "board_high_rank": float(board_high),
            "board_low_rank": float(board_low),
            "board_span": float(board_span),
            "board_pair_count": float(len(state.board_cards) - len(set(board_values))),
            "board_max_suit_count": float(suit_counts["board_max_suit_count"]),
            "board_is_monotone": float("monotone" in board.tags),
            "board_is_two_tone": float("two_tone" in board.tags),
            "board_is_paired": float("paired" in board.tags),
            "board_is_coordinated": float("coordinated" in board.tags),
            "board_is_high_card": float("high_card_board" in board.tags),
            "board_is_low_board": float("low_board" in board.tags),
        }

        if postflop is not None:
            features.update(
                {
                    "postflop_bucket_index": float(HAND_BUCKET_INDEX[postflop.category]),
                    "postflop_score": float(postflop.score),
                    "made_hand_index": float(MADE_HAND_INDEX[postflop.made_hand_class]),
                    "draw_index": float(DRAW_INDEX[postflop.draw_strength]),
                    "showdown_value_flag": float(postflop.showdown_value),
                }
            )
        else:
            features.update(
                {
                    "postflop_bucket_index": -1.0,
                    "postflop_score": 0.0,
                    "made_hand_index": -1.0,
                    "draw_index": -1.0,
                    "showdown_value_flag": 0.0,
                }
            )

        if self.include_style and profile is not None:
            features.update(
                {
                    "style_vpip": profile.vpip / 100.0,
                    "style_pfr": profile.pfr / 100.0,
                    "style_three_bet": profile.three_bet / 100.0,
                    "style_aggression": profile.aggression / 100.0,
                    "style_flop_cbet": profile.flop_cbet / 100.0,
                    "style_turn_barrel": profile.turn_barrel / 100.0,
                    "style_river_bluff": profile.river_bluff / 100.0,
                    "style_hero_call": profile.hero_call / 100.0,
                    "style_risk_tolerance": profile.risk_tolerance / 100.0,
                }
            )

        return features

    def serialize_state(self, state: GameState, profile: StyleProfile | None = None) -> dict[str, object]:
        return {
            "table_size": state.table_size,
            "small_blind": state.small_blind,
            "big_blind": state.big_blind,
            "street": state.street,
            "hero_name": state.hero_name,
            "hero_position": state.hero_position,
            "hero_hole_cards": self._serialize_cards(state.hero_hole_cards),
            "board_cards": self._serialize_cards(state.board_cards),
            "pot_size": state.pot_size,
            "effective_stack": state.effective_stack,
            "amount_to_call": state.amount_to_call,
            "min_raise": state.min_raise,
            "max_raise": state.max_raise,
            "active_players": state.active_players[:],
            "style_profile_name": state.style_profile_name,
            "players_to_act_behind": state.players_to_act_behind,
            "is_preflop_aggressor": state.is_preflop_aggressor,
            "facing_bet": state.facing_bet,
            "facing_raise": state.facing_raise,
            "last_aggressor_position": state.last_aggressor_position,
            "legal_actions": {
                "can_fold": state.legal_actions.can_fold,
                "can_check": state.legal_actions.can_check,
                "can_call": state.legal_actions.can_call,
                "can_bet": state.legal_actions.can_bet,
                "can_raise": state.legal_actions.can_raise,
            },
            "action_history": [self._serialize_action(record) for record in state.action_history],
            "style_profile": self._serialize_style(profile) if profile is not None else None,
        }

    @staticmethod
    def _serialize_cards(cards: list[Card]) -> list[str]:
        return [str(card) for card in cards]

    @staticmethod
    def _serialize_action(record: ActionRecord) -> dict[str, object]:
        return {
            "street": record.street,
            "player_name": record.player_name,
            "position": record.position,
            "action": record.action,
            "amount": record.amount,
            "facing_amount": record.facing_amount,
            "pot_before": record.pot_before,
            "note": record.note,
            "reason_tags": record.reason_tags[:],
            "profile_name": record.profile_name,
        }

    @staticmethod
    def _serialize_style(profile: StyleProfile) -> dict[str, object]:
        return {
            "name": profile.name,
            "vpip": profile.vpip,
            "pfr": profile.pfr,
            "three_bet": profile.three_bet,
            "aggression": profile.aggression,
            "flop_cbet": profile.flop_cbet,
            "turn_barrel": profile.turn_barrel,
            "river_bluff": profile.river_bluff,
            "hero_call": profile.hero_call,
            "risk_tolerance": profile.risk_tolerance,
        }

    @staticmethod
    def _suit_count_features(board_cards: list[Card]) -> dict[str, int]:
        if not board_cards:
            return {"board_max_suit_count": 0}
        counts: dict[str, int] = {}
        for card in board_cards:
            counts[card.suit] = counts.get(card.suit, 0) + 1
        return {"board_max_suit_count": max(counts.values())}
