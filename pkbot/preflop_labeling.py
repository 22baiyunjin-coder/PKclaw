from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .game_state import ActionRecord, GameState

PreflopSpotType = Literal[
    "unopened_preflop_open",
    "late_position_steal",
    "facing_open",
    "facing_3bet",
    "blind_defense",
    "squeeze_opportunity",
    "facing_squeeze",
]


@dataclass(slots=True, frozen=True)
class PreflopActionSummary:
    hero_name: str
    hero_position: str
    spot_type: PreflopSpotType
    action_context_subtype: str
    opener_position: str | None
    last_aggressor_position: str | None
    aggressor_count: int
    caller_count: int
    fold_count: int
    has_limpers: bool
    has_cold_callers: bool
    opener_is_late: bool
    hero_in_blinds: bool
    effective_stack_bb: float
    amount_to_call_bb: float
    action_sequence: tuple[str, ...]

    @property
    def context_key(self) -> str:
        return f"{self.spot_type}:{self.action_context_subtype}"


def classify_preflop_spot(state: GameState) -> PreflopActionSummary:
    return _classify(
        hero_name=state.hero_name,
        hero_position=state.hero_position,
        action_history=state.action_history,
        effective_stack_bb=state.effective_stack / max(state.big_blind, 1.0),
        amount_to_call_bb=state.amount_to_call / max(state.big_blind, 1.0),
    )


def classify_preflop_spot_from_raw_state(raw_state: dict[str, object]) -> PreflopActionSummary:
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
        action_history=history,
        effective_stack_bb=float(raw_state.get("effective_stack", 0.0)) / max(float(raw_state.get("big_blind", 1.0)), 1.0),
        amount_to_call_bb=float(raw_state.get("amount_to_call", 0.0)) / max(float(raw_state.get("big_blind", 1.0)), 1.0),
    )


def match_spot_target(summary: PreflopActionSummary, target_key: str, position: str | None = None) -> bool:
    hero_position = position or summary.hero_position
    if target_key == summary.spot_type:
        return True
    if target_key == "btn_steal":
        return summary.spot_type == "late_position_steal" and hero_position == "BTN"
    if target_key == "co_open":
        return summary.spot_type == "late_position_steal" and hero_position == "CO"
    if target_key == "sb_complete_raise":
        return summary.action_context_subtype.startswith("sb_")
    if target_key == "bb_defend_vs_late_open":
        return summary.action_context_subtype == "bb_vs_late_open"
    if target_key == "facing_open":
        return summary.spot_type in {"facing_open", "blind_defense"} and "vs_" in summary.action_context_subtype
    if target_key == "facing_3bet":
        return summary.spot_type == "facing_3bet"
    if target_key == "blind_defense":
        return summary.spot_type == "blind_defense"
    if target_key == "small_blind_defense":
        return summary.action_context_subtype.startswith("sb_")
    if target_key == "late_position_open":
        return summary.spot_type == "late_position_steal"
    if target_key == "early_position_open":
        return summary.spot_type == "unopened_preflop_open"
    return False


def _classify(
    *,
    hero_name: str,
    hero_position: str,
    action_history: list[ActionRecord],
    effective_stack_bb: float,
    amount_to_call_bb: float,
) -> PreflopActionSummary:
    history = [
        record
        for record in action_history
        if record.street == "preflop" and record.note != "blind_post"
    ]
    aggression = [record for record in history if record.action in {"bet", "raise"}]
    callers = [record for record in history if record.action == "call"]
    folds = [record for record in history if record.action == "fold"]
    opener = aggression[0] if aggression else None
    last_aggressor = aggression[-1] if aggression else None
    opener_is_late = opener.position in {"CO", "BTN", "SB"} if opener is not None else False
    hero_in_blinds = hero_position in {"SB", "BB"}
    action_sequence = tuple(f"{record.position}:{record.action}" for record in history)

    if not aggression:
        if not callers:
            if hero_position in {"CO", "BTN"}:
                return PreflopActionSummary(
                    hero_name=hero_name,
                    hero_position=hero_position,
                    spot_type="late_position_steal",
                    action_context_subtype=f"{hero_position.lower()}_first_in",
                    opener_position=None,
                    last_aggressor_position=None,
                    aggressor_count=0,
                    caller_count=0,
                    fold_count=len(folds),
                    has_limpers=False,
                    has_cold_callers=False,
                    opener_is_late=False,
                    hero_in_blinds=hero_in_blinds,
                    effective_stack_bb=effective_stack_bb,
                    amount_to_call_bb=amount_to_call_bb,
                    action_sequence=action_sequence,
                )
            if hero_position == "SB":
                return PreflopActionSummary(
                    hero_name=hero_name,
                    hero_position=hero_position,
                    spot_type="blind_defense",
                    action_context_subtype="sb_first_in",
                    opener_position=None,
                    last_aggressor_position=None,
                    aggressor_count=0,
                    caller_count=0,
                    fold_count=len(folds),
                    has_limpers=False,
                    has_cold_callers=False,
                    opener_is_late=False,
                    hero_in_blinds=True,
                    effective_stack_bb=effective_stack_bb,
                    amount_to_call_bb=amount_to_call_bb,
                    action_sequence=action_sequence,
                )
            return PreflopActionSummary(
                hero_name=hero_name,
                hero_position=hero_position,
                spot_type="unopened_preflop_open",
                action_context_subtype=f"{hero_position.lower()}_first_in",
                opener_position=None,
                last_aggressor_position=None,
                aggressor_count=0,
                caller_count=0,
                fold_count=len(folds),
                has_limpers=False,
                has_cold_callers=False,
                opener_is_late=False,
                hero_in_blinds=hero_in_blinds,
                effective_stack_bb=effective_stack_bb,
                amount_to_call_bb=amount_to_call_bb,
                action_sequence=action_sequence,
            )

        if hero_position == "SB":
            subtype = "sb_limped_pot_decision"
            spot_type: PreflopSpotType = "blind_defense"
        elif hero_position == "BB":
            subtype = "bb_limped_pot_option"
            spot_type = "blind_defense"
        else:
            subtype = "limped_pot_isolation"
            spot_type = "unopened_preflop_open"
        return PreflopActionSummary(
            hero_name=hero_name,
            hero_position=hero_position,
            spot_type=spot_type,
            action_context_subtype=subtype,
            opener_position=None,
            last_aggressor_position=None,
            aggressor_count=0,
            caller_count=len(callers),
            fold_count=len(folds),
            has_limpers=True,
            has_cold_callers=len(callers) >= 2,
            opener_is_late=False,
            hero_in_blinds=hero_in_blinds,
            effective_stack_bb=effective_stack_bb,
            amount_to_call_bb=amount_to_call_bb,
            action_sequence=action_sequence,
        )

    if len(aggression) == 1:
        if callers:
            if hero_position in {"SB", "BB"}:
                subtype = f"{hero_position.lower()}_squeeze_or_defend"
                spot_type = "blind_defense"
            else:
                subtype = f"{hero_position.lower()}_squeeze_over_open_call"
                spot_type = "squeeze_opportunity"
        else:
            if hero_position == "BB":
                subtype = "bb_vs_late_open" if opener_is_late else "bb_vs_open"
                spot_type = "blind_defense"
            elif hero_position == "SB":
                subtype = "sb_vs_late_open" if opener_is_late else "sb_vs_open"
                spot_type = "blind_defense"
            else:
                subtype = "vs_late_open" if opener_is_late else "vs_early_middle_open"
                spot_type = "facing_open"
        return PreflopActionSummary(
            hero_name=hero_name,
            hero_position=hero_position,
            spot_type=spot_type,
            action_context_subtype=subtype,
            opener_position=opener.position,
            last_aggressor_position=last_aggressor.position,
            aggressor_count=1,
            caller_count=len(callers),
            fold_count=len(folds),
            has_limpers=False,
            has_cold_callers=bool(callers),
            opener_is_late=opener_is_late,
            hero_in_blinds=hero_in_blinds,
            effective_stack_bb=effective_stack_bb,
            amount_to_call_bb=amount_to_call_bb,
            action_sequence=action_sequence,
        )

    between_first_and_last = history[history.index(opener) + 1: history.index(last_aggressor)]
    squeeze_detected = any(record.action == "call" for record in between_first_and_last)
    if squeeze_detected:
        spot_type = "facing_squeeze"
        subtype = f"{hero_position.lower()}_facing_squeeze" if hero_position in {"SB", "BB"} else "opener_or_caller_facing_squeeze"
    else:
        spot_type = "facing_3bet"
        subtype = f"{hero_position.lower()}_facing_3bet" if hero_position in {"SB", "BB"} else "opener_or_caller_facing_3bet"
    return PreflopActionSummary(
        hero_name=hero_name,
        hero_position=hero_position,
        spot_type=spot_type,
        action_context_subtype=subtype,
        opener_position=opener.position,
        last_aggressor_position=last_aggressor.position,
        aggressor_count=len(aggression),
        caller_count=len(callers),
        fold_count=len(folds),
        has_limpers=False,
        has_cold_callers=bool(callers),
        opener_is_late=opener_is_late,
        hero_in_blinds=hero_in_blinds,
        effective_stack_bb=effective_stack_bb,
        amount_to_call_bb=amount_to_call_bb,
        action_sequence=action_sequence,
    )
