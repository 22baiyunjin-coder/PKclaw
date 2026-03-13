from __future__ import annotations

from dataclasses import asdict, dataclass
from random import Random

import eval7

from .cards import SUITS, RANK_ORDER
from .game_state import GameState


@dataclass(slots=True)
class RolloutConfig:
    trials: int = 120
    seed: int = 42
    max_opponents: int | None = None
    opponent_model: str = "rule_based_range_v1"
    board_completion: str = "random_runout_to_river"

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class RolloutLabels:
    equity_estimate: float
    showdown_strength_proxy: float

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


class RolloutLabeler:
    def __init__(self, config: RolloutConfig | None = None) -> None:
        self.config = config or RolloutConfig()
        self._range_cache: dict[str, list[tuple[tuple[eval7.Card, eval7.Card], float]]] = {}

    def label_state(self, state: GameState, seed: int | None = None) -> RolloutLabels:
        rng = Random(self.config.seed if seed is None else seed)
        hero_cards = [card.to_eval7() for card in state.hero_hole_cards]
        board_cards = [card.to_eval7() for card in state.board_cards]
        trials = max(1, self.config.trials)
        opponents = max(1, len(state.active_players) - 1)
        if self.config.max_opponents is not None:
            opponents = min(opponents, max(1, self.config.max_opponents))

        deck = [eval7.Card(f"{rank}{suit}") for rank in RANK_ORDER for suit in SUITS]
        excluded = set(hero_cards + board_cards)
        available = [card for card in deck if card not in excluded]
        missing_board = max(0, 5 - len(board_cards))
        range_string = self._range_string_for_state(state)

        equity_total = 0.0
        showdown_strength_total = 0.0

        for _ in range(trials):
            sampled_runout = rng.sample(available, missing_board)
            runout = board_cards + sampled_runout
            dead_cards = set(hero_cards + runout)
            villain_scores: list[int] = []

            hero_score = eval7.evaluate(hero_cards + runout)
            for _villain_index in range(opponents):
                villain_cards = self._sample_opponent_hand(rng, range_string, dead_cards, deck)
                dead_cards.update(villain_cards)
                villain_scores.append(eval7.evaluate(list(villain_cards) + runout))

            best_score = max([hero_score, *villain_scores])
            hero_is_best = hero_score == best_score
            winner_count = sum(1 for score in [hero_score, *villain_scores] if score == best_score)

            if hero_is_best:
                equity_total += 1.0 / winner_count

            heads_up_runout = runout
            villain_heads_up = self._sample_opponent_hand(rng, range_string, set(hero_cards + heads_up_runout), deck)
            hero_heads_up = eval7.evaluate(hero_cards + heads_up_runout)
            villain_heads_up_score = eval7.evaluate(list(villain_heads_up) + heads_up_runout)
            if hero_heads_up > villain_heads_up_score:
                showdown_strength_total += 1.0
            elif hero_heads_up == villain_heads_up_score:
                showdown_strength_total += 0.5

        equity_estimate = equity_total / trials
        showdown_strength_proxy = showdown_strength_total / trials
        return RolloutLabels(
            equity_estimate=round(equity_estimate, 4),
            showdown_strength_proxy=round(showdown_strength_proxy, 4),
        )

    def _sample_opponent_hand(
        self,
        rng: Random,
        range_string: str,
        dead_cards: set[eval7.Card],
        deck: list[eval7.Card],
    ) -> tuple[eval7.Card, eval7.Card]:
        candidates = self._range_cache.get(range_string)
        if candidates is None:
            candidates = list(eval7.HandRange(range_string))
            self._range_cache[range_string] = candidates

        valid = [cards for cards, _weight in candidates if cards[0] not in dead_cards and cards[1] not in dead_cards]
        if valid:
            return rng.choice(valid)

        available = [card for card in deck if card not in dead_cards]
        choice = rng.sample(available, 2)
        return choice[0], choice[1]

    @staticmethod
    def _range_string_for_state(state: GameState) -> str:
        if state.street == "preflop":
            if state.facing_raise:
                if state.last_aggressor_position in {"UTG", "UTG+1", "MP"}:
                    return "TT+,AQs+,AKo"
                if state.last_aggressor_position in {"CO", "BTN"}:
                    return "77+,ATs+,KTs+,QTs+,JTs,AQo+,KQo"
                return "88+,AJs+,KQs,AQo+"
            if state.facing_bet:
                if state.last_aggressor_position in {"CO", "BTN"}:
                    return "55+,A8s+,KTs+,QTs+,JTs,T9s,98s,AJo+,KQo"
                return "77+,ATs+,KJs+,QJs,AQo+"
            return "22+,A2s+,K8s+,Q9s+,J9s+,T9s,98s,87s,A9o+,KTo+,QTo+,JTo"

        if state.street == "flop":
            if state.facing_bet:
                return "66+,A8s+,KTs+,QTs+,JTs,T9s,98s,AJo+,KQo"
            return "22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,A9o+,KTo+,QTo+,JTo"

        if state.street == "turn":
            if state.facing_bet:
                return "77+,ATs+,KTs+,QTs+,JTs,T9s,98s,AQo+,KQo"
            return "44+,A5s+,K9s+,Q9s+,J9s+,T8s+,97s+,A9o+,KTo+,QTo+"

        if state.facing_bet:
            return "88+,ATs+,KTs+,QTs+,JTs,T9s,98s,AQo+,KQo"
        return "44+,A5s+,K9s+,Q9s+,J9s+,T8s+,97s+,A9o+,KTo+,QTo+"
