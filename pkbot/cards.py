from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Iterable

import eval7

RANK_ORDER = "23456789TJQKA"
SUITS = "shdc"
RANK_VALUE = {rank: index + 2 for index, rank in enumerate(RANK_ORDER)}
HAND_CLASS_ORDER = {
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
EVAL7_TYPE_MAP = {
    "High Card": "high_card",
    "Pair": "pair",
    "Two Pair": "two_pair",
    "Trips": "trips",
    "Straight": "straight",
    "Flush": "flush",
    "Full House": "full_house",
    "Quads": "quads",
    "Straight Flush": "straight_flush",
}


@dataclass(frozen=True, slots=True)
class Card:
    rank: str
    suit: str

    def __post_init__(self) -> None:
        if self.rank not in RANK_VALUE:
            raise ValueError(f"Invalid rank: {self.rank}")
        if self.suit not in SUITS:
            raise ValueError(f"Invalid suit: {self.suit}")

    @property
    def value(self) -> int:
        return RANK_VALUE[self.rank]

    def to_eval7(self) -> eval7.Card:
        return eval7.Card(str(self))

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"


def parse_card(token: str | dict) -> Card:
    if isinstance(token, dict):
        rank = str(token.get("rank", "")).strip()
        suit = str(token.get("suit", "")).strip()
        if len(rank) != 1 or len(suit) != 1:
            raise ValueError(f"Invalid card token: {token}")
        return Card(rank.upper(), suit.lower())
    token = str(token).strip()
    if len(token) != 2:
        raise ValueError(f"Invalid card token: {token}")
    return Card(token[0].upper(), token[1].lower())


def parse_cards(tokens: Iterable[str] | str) -> list[Card]:
    if isinstance(tokens, str):
        raw = [item for item in tokens.replace(",", " ").split() if item]
    else:
        raw = list(tokens)
    return [parse_card(item) if not isinstance(item, Card) else item for item in raw]


def card_list_to_str(cards: Iterable[Card]) -> str:
    return " ".join(str(card) for card in cards)


def fresh_deck(excluded: Iterable[Card] | None = None, seed: int | None = None) -> list[Card]:
    excluded_set = set(excluded or [])
    deck = [Card(rank, suit) for rank in RANK_ORDER for suit in SUITS if Card(rank, suit) not in excluded_set]
    Random(seed).shuffle(deck)
    return deck


def evaluate_seven_card_hand(cards: Iterable[Card]) -> tuple[int, int]:
    hand = list(cards)
    if len(hand) < 5:
        raise ValueError("Need at least 5 cards")
    eval_score = eval7.evaluate([card.to_eval7() for card in hand])
    hand_name = EVAL7_TYPE_MAP[eval7.handtype(eval_score)]
    return HAND_CLASS_ORDER[hand_name], eval_score


def hand_class_name(score: tuple[int, int]) -> str:
    inverse = {value: key for key, value in HAND_CLASS_ORDER.items()}
    return inverse[score[0]]
