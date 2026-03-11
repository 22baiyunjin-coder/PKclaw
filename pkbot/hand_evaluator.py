from __future__ import annotations

from dataclasses import dataclass

import eval7

from .cards import Card, evaluate_seven_card_hand, hand_class_name


@dataclass(slots=True)
class PreflopInsight:
    category: str
    score: float
    tags: list[str]


@dataclass(slots=True)
class PostflopInsight:
    category: str
    score: float
    made_hand_class: str
    draw_strength: str
    showdown_value: bool
    tags: list[str]


@dataclass(slots=True)
class BoardTexture:
    texture: str
    tags: list[str]


def evaluate_preflop(hole_cards: list[Card]) -> PreflopInsight:
    ranks = sorted((card.value for card in hole_cards), reverse=True)
    high, low = ranks
    suited = hole_cards[0].suit == hole_cards[1].suit
    pair = high == low
    gap = high - low
    tags: list[str] = []

    if pair:
        tags.append("paired_hand")
    if suited:
        tags.append("suited")
    if gap <= 1:
        tags.append("connected")
    if high >= 13:
        tags.append("high_card_pressure")

    if pair and high >= 12:
        return PreflopInsight("premium", 0.97, tags + ["premium_pair"])
    if {high, low} == {14, 13}:
        return PreflopInsight("premium", 0.95, tags + ["big_ace"])
    if pair and high >= 10:
        return PreflopInsight("strong", 0.85, tags)
    if high == 14 and low >= 11:
        return PreflopInsight("strong", 0.83, tags + ["strong_ace"])
    if suited and high >= 12 and low >= 10:
        return PreflopInsight("strong", 0.80, tags + ["broadway_suited"])
    if pair and high >= 7:
        return PreflopInsight("playable", 0.70, tags + ["mid_pair"])
    if suited and gap <= 2 and high >= 9:
        return PreflopInsight("playable", 0.66, tags + ["suited_connector"])
    if high >= 12 and low >= 9:
        return PreflopInsight("playable", 0.62, tags + ["broadway"])
    if pair or suited or (gap <= 3 and high >= 8):
        return PreflopInsight("speculative", 0.48, tags + ["speculative"])
    return PreflopInsight("weak", 0.22, tags + ["trash"])


def analyze_board_texture(board_cards: list[Card]) -> BoardTexture:
    if not board_cards:
        return BoardTexture("preflop", [])

    values = sorted((card.value for card in board_cards), reverse=True)
    suits = [card.suit for card in board_cards]
    tags: list[str] = []

    if len(set(suits)) == 1:
        tags.append("monotone")
    elif max(suits.count(suit) for suit in set(suits)) >= 2:
        tags.append("two_tone")

    if len(set(values)) < len(values):
        tags.append("paired")

    spread = max(values) - min(values)
    unique_sorted = sorted(set(values))
    connected_pairs = sum(1 for left, right in zip(unique_sorted, unique_sorted[1:]) if right - left <= 2)
    if connected_pairs >= 2 or spread <= 5:
        tags.append("coordinated")

    if max(values) >= 13:
        tags.append("high_card_board")
    if max(values) <= 10:
        tags.append("low_board")

    if "monotone" in tags or ("coordinated" in tags and "two_tone" in tags):
        texture = "wet"
    elif "coordinated" in tags or "two_tone" in tags or "paired" in tags:
        texture = "semi_wet"
    else:
        texture = "dry"

    return BoardTexture(texture, tags)


def _draw_strength(hole_cards: list[Card], board_cards: list[Card]) -> str:
    all_cards = hole_cards + board_cards
    suits = [card.suit for card in all_cards]
    max_suit = max(suits.count(suit) for suit in set(suits))
    values = sorted(set(card.value for card in all_cards))
    if 14 in values:
        values = [1] + values

    longest = 1
    current = 1
    for left, right in zip(values, values[1:]):
        if right - left == 1:
            current += 1
            longest = max(longest, current)
        elif right != left:
            current = 1

    hole_eval = [card.to_eval7() for card in hole_cards]
    board_eval = [card.to_eval7() for card in board_cards]
    if len(board_eval) >= 3:
        equity = eval7.py_hand_vs_range_exact(hole_eval, eval7.HandRange('22+,A2s+,KTs+,QTs+,JTs,T9s,98s,87s,AJo+,KQo'), board_eval)
    else:
        equity = 0.0

    if (max_suit >= 4 and longest >= 4) or equity >= 0.55:
        return "strong_draw"
    if max_suit >= 4 or longest >= 4 or equity >= 0.42:
        return "strong_draw"
    if max_suit == 3 or longest == 3 or equity >= 0.30:
        return "weak_draw"
    return "no_draw"


def evaluate_postflop(hole_cards: list[Card], board_cards: list[Card]) -> PostflopInsight:
    all_cards = hole_cards + board_cards
    score = evaluate_seven_card_hand(all_cards)
    made_hand = hand_class_name(score)
    draw_strength = _draw_strength(hole_cards, board_cards)
    tags = [made_hand]

    if made_hand in {"straight_flush", "quads", "full_house", "flush", "straight", "trips"}:
        category = "strong_made_hand"
        strength = 0.92
    elif made_hand == "two_pair":
        category = "strong_made_hand"
        strength = 0.86
    elif made_hand == "pair":
        hole_values = sorted((card.value for card in hole_cards), reverse=True)
        board_values = sorted((card.value for card in board_cards), reverse=True)
        top_board = board_values[0]
        if hole_values[0] == hole_values[1] and hole_values[0] > top_board:
            category = "strong_made_hand"
            strength = 0.82
            tags.append("overpair")
        elif hole_values[0] == top_board or hole_values[1] == top_board:
            category = "medium_made_hand"
            strength = 0.68
            tags.append("top_pair")
        else:
            category = "weak_showdown_value"
            strength = 0.50
            tags.append("marginal_pair")
    else:
        if draw_strength == "strong_draw":
            category = "strong_draw"
            strength = 0.60
        elif draw_strength == "weak_draw":
            category = "weak_draw"
            strength = 0.38
        else:
            category = "air"
            strength = 0.15

    showdown_value = category in {"strong_made_hand", "medium_made_hand", "weak_showdown_value"}
    if draw_strength != "no_draw":
        tags.append(draw_strength)
    return PostflopInsight(category, strength, made_hand, draw_strength, showdown_value, tags)
