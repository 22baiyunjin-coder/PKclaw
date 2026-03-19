from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .game_state import ActionRecord, GameState

PostflopSpotType = Literal[
    "flop_cbet_opportunity",
    "flop_facing_cbet",
    "flop_probe_or_delayed_cbet",
    "flop_facing_probe",
    "turn_barrel_opportunity",
    "turn_facing_barrel",
    "turn_probe_or_delayed_barrel",
    "turn_facing_probe",
    "river_value_decision",
    "river_bluff_catch",
    "river_bluff_or_giveup",
    "river_facing_value_or_polar",
    "multiway_postflop_generic",
]

PlayerCountBucket = Literal["heads_up", "multiway"]
PressureBucket = Literal["none", "small", "medium", "large"]

POSTFLOP_STREET_ORDER = {
    "preflop": 0,
    "flop": 1,
    "turn": 2,
    "river": 3,
}


@dataclass(slots=True, frozen=True)
class PostflopActionSummary:
    hero_name: str
    hero_position: str
    street: str
    player_count_bucket: PlayerCountBucket
    spot_type: PostflopSpotType
    action_context_subtype: str
    pot_type: str
    position_status: str
    pressure_bucket: PressureBucket
    amount_to_call_share: float
    preflop_raise_count: int
    aggressor_count_current_street: int
    last_street_aggressor_position: str | None
    hero_was_last_street_aggressor: bool
    last_street_was_check_through: bool

    @property
    def in_position(self) -> bool:
        return self.position_status == "ip"

    @property
    def context_key(self) -> str:
        return f"{self.street}:{self.spot_type}:{self.action_context_subtype}"


def classify_postflop_spot(state: GameState) -> PostflopActionSummary:
    return _classify(
        hero_name=state.hero_name,
        hero_position=state.hero_position,
        street=state.street,
        action_history=state.action_history,
        active_player_count=len(state.active_players),
        amount_to_call=state.amount_to_call,
        pot_size=state.pot_size,
        players_to_act_behind=state.players_to_act_behind,
        is_preflop_aggressor=state.is_preflop_aggressor,
    )


def classify_postflop_spot_from_raw_state(raw_state: dict[str, object]) -> PostflopActionSummary:
    history = [
        ActionRecord(
            street=record["street"],
            player_name=record["player_name"],
            position=record["position"],
            action=record["action"],
            amount=float(record.get("amount", 0.0)),
            facing_amount=float(record.get("facing_amount", 0.0)),
            pot_before=float(record.get("pot_before", 0.0)),
            note=str(record.get("note", "")),
            reason_tags=list(record.get("reason_tags", [])),
            profile_name=str(record.get("profile_name", "")),
        )
        for record in raw_state.get("action_history", [])
    ]
    return _classify(
        hero_name=str(raw_state.get("hero_name", "")),
        hero_position=str(raw_state.get("hero_position", "")),
        street=str(raw_state.get("street", "")),
        action_history=history,
        active_player_count=len(raw_state.get("active_players", [])),
        amount_to_call=float(raw_state.get("amount_to_call", 0.0)),
        pot_size=float(raw_state.get("pot_size", 0.0)),
        players_to_act_behind=int(raw_state.get("players_to_act_behind", 0)),
        is_preflop_aggressor=bool(raw_state.get("is_preflop_aggressor", False)),
    )


def _classify(
    *,
    hero_name: str,
    hero_position: str,
    street: str,
    action_history: list[ActionRecord],
    active_player_count: int,
    amount_to_call: float,
    pot_size: float,
    players_to_act_behind: int,
    is_preflop_aggressor: bool,
) -> PostflopActionSummary:
    if street not in {"flop", "turn", "river"}:
        raise ValueError(f"Postflop spot classifier received unsupported street: {street}")

    history = [record for record in action_history if record.note != "blind_post"]
    street_history = [record for record in history if record.street == street]
    street_aggression = [record for record in street_history if record.action in {"bet", "raise"}]
    previous_street = _previous_street(street)
    previous_history = [record for record in history if record.street == previous_street]
    previous_aggression = [record for record in previous_history if record.action in {"bet", "raise"}]
    last_street_aggressor = previous_aggression[-1] if previous_aggression else None
    last_street_was_check_through = bool(previous_street and previous_history and not previous_aggression)
    preflop_raises = [
        record
        for record in history
        if record.street == "preflop" and record.action == "raise"
    ]
    preflop_raise_count = len(preflop_raises)
    pot_type = _pot_type(preflop_raise_count)
    player_count_bucket: PlayerCountBucket = "heads_up" if active_player_count == 2 else "multiway"
    position_status = "ip" if players_to_act_behind == 0 else "oop"
    amount_to_call_share = amount_to_call / max(pot_size + amount_to_call, 1.0) if amount_to_call > 0 else 0.0
    pressure_bucket = _pressure_bucket(amount_to_call_share)

    if player_count_bucket != "heads_up":
        return PostflopActionSummary(
            hero_name=hero_name,
            hero_position=hero_position,
            street=street,
            player_count_bucket=player_count_bucket,
            spot_type="multiway_postflop_generic",
            action_context_subtype=f"{street}_{pot_type}_{position_status}_{pressure_bucket}",
            pot_type=pot_type,
            position_status=position_status,
            pressure_bucket=pressure_bucket,
            amount_to_call_share=round(amount_to_call_share, 4),
            preflop_raise_count=preflop_raise_count,
            aggressor_count_current_street=len(street_aggression),
            last_street_aggressor_position=last_street_aggressor.position if last_street_aggressor else None,
            hero_was_last_street_aggressor=bool(last_street_aggressor and last_street_aggressor.player_name == hero_name),
            last_street_was_check_through=last_street_was_check_through,
        )

    spot_type, action_context_subtype = _classify_heads_up(
        street=street,
        amount_to_call=amount_to_call,
        pressure_bucket=pressure_bucket,
        pot_type=pot_type,
        position_status=position_status,
        is_preflop_aggressor=is_preflop_aggressor,
        hero_was_last_street_aggressor=bool(last_street_aggressor and last_street_aggressor.player_name == hero_name),
        last_street_was_check_through=last_street_was_check_through,
    )
    return PostflopActionSummary(
        hero_name=hero_name,
        hero_position=hero_position,
        street=street,
        player_count_bucket=player_count_bucket,
        spot_type=spot_type,
        action_context_subtype=action_context_subtype,
        pot_type=pot_type,
        position_status=position_status,
        pressure_bucket=pressure_bucket,
        amount_to_call_share=round(amount_to_call_share, 4),
        preflop_raise_count=preflop_raise_count,
        aggressor_count_current_street=len(street_aggression),
        last_street_aggressor_position=last_street_aggressor.position if last_street_aggressor else None,
        hero_was_last_street_aggressor=bool(last_street_aggressor and last_street_aggressor.player_name == hero_name),
        last_street_was_check_through=last_street_was_check_through,
    )


def _classify_heads_up(
    *,
    street: str,
    amount_to_call: float,
    pressure_bucket: PressureBucket,
    pot_type: str,
    position_status: str,
    is_preflop_aggressor: bool,
    hero_was_last_street_aggressor: bool,
    last_street_was_check_through: bool,
) -> tuple[PostflopSpotType, str]:
    if street == "flop":
        if amount_to_call <= 0:
            if is_preflop_aggressor:
                return "flop_cbet_opportunity", f"{pot_type}_{position_status}"
            return "flop_probe_or_delayed_cbet", f"{pot_type}_{position_status}"
        if is_preflop_aggressor:
            return "flop_facing_probe", f"{pot_type}_{position_status}_{pressure_bucket}"
        return "flop_facing_cbet", f"{pot_type}_{position_status}_{pressure_bucket}"

    if street == "turn":
        if amount_to_call <= 0:
            if hero_was_last_street_aggressor:
                return "turn_barrel_opportunity", f"{pot_type}_{position_status}"
            return "turn_probe_or_delayed_barrel", f"{pot_type}_{position_status}_{'checked_through' if last_street_was_check_through else 'passive_line'}"
        if hero_was_last_street_aggressor:
            return "turn_facing_probe", f"{pot_type}_{position_status}_{pressure_bucket}"
        return "turn_facing_barrel", f"{pot_type}_{position_status}_{pressure_bucket}"

    if amount_to_call <= 0:
        if hero_was_last_street_aggressor:
            return "river_value_decision", f"{pot_type}_{position_status}"
        return "river_bluff_or_giveup", f"{pot_type}_{position_status}_{'checked_through' if last_street_was_check_through else 'passive_line'}"
    if hero_was_last_street_aggressor:
        return "river_facing_value_or_polar", f"{pot_type}_{position_status}_{pressure_bucket}"
    return "river_bluff_catch", f"{pot_type}_{position_status}_{pressure_bucket}"


def _previous_street(street: str) -> str | None:
    if street == "flop":
        return "preflop"
    if street == "turn":
        return "flop"
    if street == "river":
        return "turn"
    return None


def _pot_type(preflop_raise_count: int) -> str:
    if preflop_raise_count <= 0:
        return "limped_pot"
    if preflop_raise_count == 1:
        return "single_raised_pot"
    if preflop_raise_count == 2:
        return "three_bet_pot"
    return "four_bet_plus_pot"


def _pressure_bucket(amount_to_call_share: float) -> PressureBucket:
    if amount_to_call_share <= 0:
        return "none"
    if amount_to_call_share <= 0.25:
        return "small"
    if amount_to_call_share <= 0.50:
        return "medium"
    return "large"
