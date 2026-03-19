from __future__ import annotations

import re
from typing import Any

from .cards import parse_cards
from .evaluator_tuning import river_clamp_candidate_tuning
from .game_state import ActionRecord, GameState, LegalActions
from .presets import PRESET_PROFILES
from .product_entry import analyze_decision
from .style_profile import StyleProfile

STYLE_FIELDS = (
    "vpip",
    "pfr",
    "three_bet",
    "aggression",
    "flop_cbet",
    "turn_barrel",
    "river_bluff",
    "hero_call",
    "risk_tolerance",
)

POSITION_ORDER_BY_OFFSET: tuple[str, ...] = (
    "BTN",
    "SB",
    "BB",
    "UTG",
    "UTG+1",
    "MP",
    "HJ",
    "CO",
)

PERSONA_ID_TO_PRESET = {
    "gto_master": "balanced_reg",
    "high_stakes_pro": "maniac",
    "river_ambassador": "lag",
    "evil_kuromi": "pressure_reg",
    "calculator_li": "balanced_reg",
    "od_sao_nan": "maniac",
    "teacher_liu": "tag",
    "cat_17": "trapper",
    "weak_leo": "nit",
}


def build_live_decision_payload(
    payload: dict[str, Any],
    *,
    evaluator_model: Any,
    policy_model: Any,
) -> dict[str, Any]:
    table = payload.get("table", {})
    players = payload.get("players", [])
    hero = payload.get("hero") or next((item for item in players if item.get("is_hero")), None)

    if not isinstance(hero, dict):
        raise ValueError("Missing hero payload.")
    if not isinstance(players, list) or not players:
        raise ValueError("Missing players payload.")

    table_size = max(2, int(table.get("players_count", len(players) or 2)))
    dealer_index = int(table.get("dealer_index", 0))
    small_blind = float(table.get("small_blind", 10.0))
    big_blind = float(table.get("big_blind", 20.0))
    street = str(table.get("street", "preflop")).lower()
    current_bet = float(table.get("current_bet", 0.0))
    pot = float(table.get("pot", 0.0))

    hero_name = str(hero.get("name") or "Bot")
    hero_seat = int(hero.get("seat_index", 0))
    hero_bet = float(hero.get("bet", 0.0))
    hero_chips = float(hero.get("chips", 0.0))
    hero_cards = parse_cards(hero.get("cards", []))
    board_cards = parse_cards(payload.get("board", []))
    valid_actions = _build_legal_actions(payload.get("valid_actions", []), current_bet)

    name_to_position = {
        str(player.get("name", f"P{index}")): _seat_to_position(int(player.get("seat_index", index)), dealer_index, table_size)
        for index, player in enumerate(players)
    }

    ordered_active_players = _ordered_active_players(players, dealer_index, street)
    active_names = [str(player.get("name", "Bot")) for player in ordered_active_players]
    players_to_act_behind = _players_to_act_behind(hero_seat, ordered_active_players)
    action_history = _parse_action_history(payload.get("action_log", []), name_to_position)

    current_street_aggression = [
        record for record in action_history if record.street == street and record.action in {"bet", "raise"}
    ]
    last_aggressor = current_street_aggression[-1].position if current_street_aggression else None
    facing_raise = len(current_street_aggression) >= 2 or (
        street == "preflop" and current_bet > big_blind and len(current_street_aggression) >= 1
    )
    facing_bet = bool(current_street_aggression) and not facing_raise
    is_preflop_aggressor = any(
        record.player_name == hero_name and record.street == "preflop" and record.action in {"bet", "raise"}
        for record in action_history
    )

    effective_stack = _effective_stack(hero, players)
    amount_to_call = max(0.0, current_bet - hero_bet)
    min_raise = _min_raise_target(current_bet, big_blind)
    max_raise = hero_bet + hero_chips
    profile = _resolve_profile(hero.get("persona"))

    state = GameState(
        table_size=table_size,
        small_blind=small_blind,
        big_blind=big_blind,
        street=street,
        hero_name=hero_name,
        hero_position=_seat_to_position(hero_seat, dealer_index, table_size),
        hero_hole_cards=hero_cards,
        board_cards=board_cards,
        pot_size=round(pot, 2),
        effective_stack=round(effective_stack, 2),
        amount_to_call=round(amount_to_call, 2),
        legal_actions=valid_actions,
        min_raise=round(min(min_raise, max_raise), 2),
        max_raise=round(max_raise, 2),
        action_history=action_history,
        active_players=active_names,
        style_profile_name=profile.name,
        players_to_act_behind=players_to_act_behind,
        is_preflop_aggressor=is_preflop_aggressor,
        facing_bet=facing_bet,
        facing_raise=facing_raise,
        last_aggressor_position=last_aggressor,
    )

    decision, _context = analyze_decision(
        state,
        profile,
        evaluator_model=evaluator_model,
        policy_model=policy_model,
        evaluator_tuning=river_clamp_candidate_tuning(),
    )

    normalized_amount = _normalize_decision_amount(decision.action, decision.size, state)
    return {
        "decision": {
            "action": decision.action,
            "amount": normalized_amount,
            "reason_tags": decision.reason_tags,
            "action_probabilities": decision.action_probabilities,
            "profile_name": profile.name,
            "engine": "pkclaw_local",
        }
    }


def _build_legal_actions(raw_actions: list[Any], current_bet: float) -> LegalActions:
    actions = {str(action).lower() for action in raw_actions}
    return LegalActions(
        can_fold="fold" in actions,
        can_check="check" in actions,
        can_call="call" in actions,
        can_bet=current_bet <= 0 and ("raise" in actions or "bet" in actions or "all-in" in actions),
        can_raise=current_bet > 0 and ("raise" in actions or "all-in" in actions),
    )


def _seat_to_position(seat_index: int, dealer_index: int, table_size: int) -> str:
    active_cycle = POSITION_ORDER_BY_OFFSET if table_size >= 8 else POSITION_ORDER_BY_OFFSET[: max(table_size, 2)]
    offset = (seat_index - dealer_index) % len(active_cycle)
    return active_cycle[offset]


def _street_order(dealer_index: int, player_count: int, street: str) -> list[int]:
    start_index = (dealer_index + 3) % player_count if street == "preflop" else (dealer_index + 1) % player_count
    return [((start_index + step) % player_count) for step in range(player_count)]


def _ordered_active_players(players: list[dict[str, Any]], dealer_index: int, street: str) -> list[dict[str, Any]]:
    by_seat = {int(player.get("seat_index", index)): player for index, player in enumerate(players)}
    order = _street_order(dealer_index, len(players), street)
    ordered = []
    for seat in order:
        player = by_seat.get(seat)
        if not player:
            continue
        if bool(player.get("folded")):
            continue
        if float(player.get("chips", 0.0)) <= 0 and float(player.get("bet", 0.0)) <= 0:
            continue
        ordered.append(player)
    return ordered


def _players_to_act_behind(hero_seat: int, ordered_active_players: list[dict[str, Any]]) -> int:
    seats = [int(player.get("seat_index", 0)) for player in ordered_active_players]
    if hero_seat not in seats:
        return 0
    return max(0, len(seats) - seats.index(hero_seat) - 1)


def _effective_stack(hero: dict[str, Any], players: list[dict[str, Any]]) -> float:
    hero_total = float(hero.get("chips", 0.0)) + float(hero.get("bet", 0.0))
    opponent_totals = [
        float(player.get("chips", 0.0)) + float(player.get("bet", 0.0))
        for player in players
        if not player.get("is_hero") and not bool(player.get("folded"))
    ]
    if not opponent_totals:
        return hero_total
    return min(hero_total, max(opponent_totals))


def _parse_action_history(raw_logs: list[Any], name_to_position: dict[str, str]) -> list[ActionRecord]:
    history: list[ActionRecord] = []
    ordered_names = sorted(name_to_position, key=len, reverse=True)

    for raw in raw_logs[-40:]:
        if not isinstance(raw, str) or ":" not in raw:
            continue
        street_text, detail = raw.split(":", 1)
        street = street_text.strip().lower()
        if street not in {"preflop", "flop", "turn", "river"}:
            continue

        detail = detail.strip()
        actor_name = next((name for name in ordered_names if detail.startswith(name)), None)
        if actor_name is None:
            continue

        remainder = detail[len(actor_name) :].strip()
        action = None
        amount = 0.0

        if remainder.startswith("Fold"):
            action = "fold"
        elif remainder.startswith("Check"):
            action = "check"
        elif remainder.startswith("Call"):
            action = "call"
            amount = _extract_amount(remainder)
        elif remainder.startswith("Raise to"):
            action = "raise"
            amount = _extract_amount(remainder)
        elif remainder.startswith("All-in"):
            action = "raise"
            amount = _extract_amount(remainder)

        if action is None:
            continue

        history.append(
            ActionRecord(
                street=street,
                player_name=actor_name,
                position=name_to_position[actor_name],
                action=action,
                amount=round(amount, 2),
            )
        )

    return history


def _extract_amount(text: str) -> float:
    match = re.search(r"(-?\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else 0.0


def _resolve_profile(persona: Any) -> StyleProfile:
    if not isinstance(persona, dict):
        return PRESET_PROFILES["balanced_reg"].clone(name="PokerMind Bot")

    raw_name = str(persona.get("name") or "").strip()
    raw_id = str(persona.get("id") or "").strip().lower()

    if all(field in persona for field in STYLE_FIELDS):
        overrides = {}
        for field_name in STYLE_FIELDS:
            try:
                overrides[field_name] = int(round(float(persona.get(field_name, 50))))
            except (TypeError, ValueError):
                overrides[field_name] = 50
        return StyleProfile(name=raw_name or "Custom Persona", **overrides)

    preset_key = PERSONA_ID_TO_PRESET.get(raw_id)
    if preset_key is None:
        text = " ".join(
            str(persona.get(key, "")).lower()
            for key in ("style", "description", "name")
        )
        if any(keyword in text for keyword in ("nit", "tight", "cautious", "conservative")):
            preset_key = "nit"
        elif any(keyword in text for keyword in ("calling station", "passive")):
            preset_key = "calling_station"
        elif any(keyword in text for keyword in ("gto", "solver", "balanced")):
            preset_key = "balanced_reg"
        elif any(keyword in text for keyword in ("maniac", "hyper aggressive")):
            preset_key = "maniac"
        elif any(keyword in text for keyword in ("lag", "loose", "pressure", "aggressive", "aggro")):
            preset_key = "pressure_reg"
        elif any(keyword in text for keyword in ("teacher", "tag", "pro")):
            preset_key = "tag"
        else:
            preset_key = "balanced_reg"

    base_profile = PRESET_PROFILES[preset_key]
    return base_profile.clone(name=raw_name or base_profile.name)


def _min_raise_target(current_bet: float, big_blind: float) -> float:
    if current_bet <= 0:
        return big_blind * 2
    return max(current_bet * 2, big_blind * 2)


def _normalize_decision_amount(action: str, amount: float | None, state: GameState) -> float | None:
    if action not in {"bet", "raise"}:
        return None

    target = amount if amount is not None else state.min_raise
    if state.street == "preflop" and target <= 10:
        target *= state.big_blind
    target = max(state.min_raise, target)
    target = min(target, state.max_raise)
    return round(target, 2)
