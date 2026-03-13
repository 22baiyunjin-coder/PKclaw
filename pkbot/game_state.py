from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .cards import Card

Street = Literal["preflop", "flop", "turn", "river"]
Position = Literal["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"]
ActionType = Literal["fold", "check", "call", "bet", "raise"]


@dataclass(slots=True)
class ActionRecord:
    street: Street
    player_name: str
    position: Position
    action: ActionType
    amount: float = 0.0
    facing_amount: float = 0.0
    pot_before: float = 0.0
    note: str = ""
    reason_tags: list[str] = field(default_factory=list)
    action_probabilities: dict[str, float] = field(default_factory=dict)
    profile_name: str = ""


@dataclass(slots=True)
class LegalActions:
    can_fold: bool = True
    can_check: bool = False
    can_call: bool = False
    can_bet: bool = False
    can_raise: bool = False

    def available(self) -> list[str]:
        actions: list[str] = []
        if self.can_fold:
            actions.append("fold")
        if self.can_check:
            actions.append("check")
        if self.can_call:
            actions.append("call")
        if self.can_bet:
            actions.append("bet")
        if self.can_raise:
            actions.append("raise")
        return actions


@dataclass(slots=True)
class GameState:
    table_size: int
    small_blind: float
    big_blind: float
    street: Street
    hero_name: str
    hero_position: Position
    hero_hole_cards: list[Card]
    board_cards: list[Card]
    pot_size: float
    effective_stack: float
    amount_to_call: float
    legal_actions: LegalActions
    min_raise: float
    max_raise: float
    action_history: list[ActionRecord] = field(default_factory=list)
    active_players: list[str] = field(default_factory=list)
    style_profile_name: str = ""
    players_to_act_behind: int = 0
    is_preflop_aggressor: bool = False
    facing_bet: bool = False
    facing_raise: bool = False
    last_aggressor_position: Position | None = None


@dataclass(slots=True)
class DecisionResult:
    action: ActionType | Literal["check"]
    size: float | None
    size_bucket: str | None
    action_probabilities: dict[str, float]
    reason_tags: list[str]
    debug_notes: list[str] = field(default_factory=list)
    model_outputs: dict[str, float] = field(default_factory=dict)


@dataclass(slots=True)
class DecisionSample:
    street: Street
    player_name: str
    position: Position
    profile_name: str
    action: ActionType
    committed_amount: float = 0.0
    selected_size: float | None = None
    size_bucket: str | None = None
    raw_state: dict[str, object] = field(default_factory=dict)
    features: dict[str, float] = field(default_factory=dict)
    action_probabilities: dict[str, float] = field(default_factory=dict)
    reason_tags: list[str] = field(default_factory=list)
    model_outputs: dict[str, float] = field(default_factory=dict)
