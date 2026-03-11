from __future__ import annotations

from .cards import parse_cards
from .decision_engine import DecisionEngine
from .game_state import ActionRecord, GameState, LegalActions
from .presets import PRESET_PROFILES


def _state(
    *,
    street: str,
    position: str,
    hole: str,
    board: str,
    pot: float,
    to_call: float,
    min_raise: float,
    max_raise: float,
    history: list[ActionRecord],
    legal_actions: LegalActions,
) -> GameState:
    return GameState(
        table_size=8,
        small_blind=0.5,
        big_blind=1.0,
        street=street,
        hero_name="Hero",
        hero_position=position,
        hero_hole_cards=parse_cards(hole),
        board_cards=parse_cards(board) if board else [],
        pot_size=pot,
        effective_stack=100.0,
        amount_to_call=to_call,
        legal_actions=legal_actions,
        min_raise=min_raise,
        max_raise=max_raise,
        action_history=history,
        active_players=["Hero", "Villain1", "Villain2"],
        style_profile_name="",
        players_to_act_behind=1,
        is_preflop_aggressor=any(record.player_name == "Hero" and record.action in {"bet", "raise"} for record in history if record.street == "preflop"),
        facing_bet=to_call > 0,
        facing_raise=any(record.action == "raise" for record in history if record.street == street),
        last_aggressor_position=history[-1].position if history else None,
    )


def run_demo_scenarios() -> None:
    engine = DecisionEngine()
    scenarios = [
        (
            "preflop unopened pot",
            PRESET_PROFILES["balanced_reg"],
            _state(street="preflop", position="CO", hole="As Js", board="", pot=1.5, to_call=0.0, min_raise=2.5, max_raise=100.0, history=[], legal_actions=LegalActions(can_fold=False, can_check=True, can_bet=True)),
        ),
        (
            "preflop facing open",
            PRESET_PROFILES["tag"],
            _state(street="preflop", position="BTN", hole="Qh Jh", board="", pot=4.0, to_call=2.5, min_raise=8.0, max_raise=100.0, history=[ActionRecord("preflop", "Villain", "HJ", "raise", 2.5)], legal_actions=LegalActions(can_fold=True, can_call=True, can_raise=True)),
        ),
        (
            "preflop facing 3-bet",
            PRESET_PROFILES["lag"],
            _state(street="preflop", position="CO", hole="Ac Kd", board="", pot=13.5, to_call=7.0, min_raise=18.0, max_raise=100.0, history=[ActionRecord("preflop", "Hero", "CO", "raise", 2.5), ActionRecord("preflop", "Villain", "BTN", "raise", 9.5)], legal_actions=LegalActions(can_fold=True, can_call=True, can_raise=True)),
        ),
        (
            "flop c-bet spot",
            PRESET_PROFILES["balanced_reg"],
            _state(street="flop", position="CO", hole="Ac Qc", board="Qh 7d 2s", pot=6.5, to_call=0.0, min_raise=2.0, max_raise=100.0, history=[ActionRecord("preflop", "Hero", "CO", "raise", 2.5)], legal_actions=LegalActions(can_fold=False, can_check=True, can_bet=True)),
        ),
        (
            "flop draw spot",
            PRESET_PROFILES["lag"],
            _state(street="flop", position="BTN", hole="Kd Qd", board="Jh 8d 3c", pot=8.0, to_call=3.0, min_raise=9.0, max_raise=100.0, history=[ActionRecord("flop", "Villain", "BB", "bet", 3.0)], legal_actions=LegalActions(can_fold=True, can_call=True, can_raise=True)),
        ),
        (
            "turn barrel spot",
            PRESET_PROFILES["pressure_reg"],
            _state(street="turn", position="BTN", hole="Kd Qd", board="Jh 8d 3c Td", pot=18.0, to_call=0.0, min_raise=4.0, max_raise=100.0, history=[ActionRecord("flop", "Hero", "BTN", "bet", 3.0)], legal_actions=LegalActions(can_fold=False, can_check=True, can_bet=True)),
        ),
        (
            "river value bet spot",
            PRESET_PROFILES["tag"],
            _state(street="river", position="BTN", hole="Ah Qh", board="Ad 9s 4c 4d 2h", pot=24.0, to_call=0.0, min_raise=6.0, max_raise=100.0, history=[ActionRecord("turn", "Hero", "BTN", "bet", 8.0)], legal_actions=LegalActions(can_fold=False, can_check=True, can_bet=True)),
        ),
        (
            "river bluff-catch spot",
            PRESET_PROFILES["calling_station"],
            _state(street="river", position="BB", hole="Ad Jc", board="Ks 9h 4c 4d 2s", pot=31.0, to_call=11.0, min_raise=24.0, max_raise=100.0, history=[ActionRecord("river", "Villain", "BTN", "bet", 11.0)], legal_actions=LegalActions(can_fold=True, can_call=True, can_raise=True)),
        ),
        (
            "blind defense spot",
            PRESET_PROFILES["calling_station"],
            _state(street="preflop", position="BB", hole="Qs Js", board="", pot=5.5, to_call=2.0, min_raise=8.0, max_raise=100.0, history=[ActionRecord("preflop", "Villain", "CO", "raise", 2.5)], legal_actions=LegalActions(can_fold=True, can_call=True, can_raise=True)),
        ),
        (
            "late-position steal spot",
            PRESET_PROFILES["maniac"],
            _state(street="preflop", position="BTN", hole="9s 7s", board="", pot=1.5, to_call=0.0, min_raise=2.2, max_raise=100.0, history=[], legal_actions=LegalActions(can_fold=False, can_check=True, can_bet=True)),
        ),
    ]

    for label, profile, state in scenarios:
        result = engine.decide(state, profile)
        print(f"\nScenario: {label}")
        print(f"Profile: {profile.name} ({profile.describe()})")
        print(f"State: {state.street} | {state.hero_position} | hand {' '.join(str(card) for card in state.hero_hole_cards)} | board {' '.join(str(card) for card in state.board_cards) or '--'}")
        print(f"Decision: {result.action} | size={result.size}")
        print(f"Probabilities: {result.action_probabilities}")
        print(f"Reason tags: {result.reason_tags}")
