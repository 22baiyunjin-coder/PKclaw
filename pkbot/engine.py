from __future__ import annotations

from dataclasses import dataclass, field
from random import Random
from typing import Iterable

from .cards import Card, card_list_to_str, evaluate_seven_card_hand, fresh_deck
from .decision_engine import DecisionEngine
from .evaluator_tuning import EvaluatorTuning
from .feature_builder import FeatureBuilder
from .game_state import ActionRecord, DecisionSample, GameState, LegalActions
from .model_interface import EvaluatorModel
from .policy_adapter import PolicyAdapter
from .policy_interface import PolicyModel
from .presets import preset_cycle_for_table
from .style_profile import StyleProfile
from .strategy import StrategyLayer

POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"]
PRE_FLOP_ORDER = POSITIONS[:]
POST_FLOP_ORDER = ["SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO", "BTN"]
STREETS = ["preflop", "flop", "turn", "river"]


@dataclass(slots=True)
class BotPlayer:
    name: str
    position: str
    profile: StyleProfile
    stack: float = 100.0
    hole_cards: list[Card] = field(default_factory=list)
    in_hand: bool = True
    all_in: bool = False
    street_bet: float = 0.0
    total_committed: float = 0.0
    needs_action: bool = True

    def reset_for_hand(self) -> None:
        self.hole_cards = []
        self.in_hand = self.stack > 0
        self.all_in = False
        self.street_bet = 0.0
        self.total_committed = 0.0
        self.needs_action = self.in_hand

    def commit(self, amount: float) -> float:
        actual = min(amount, self.stack)
        self.stack -= actual
        self.street_bet += actual
        self.total_committed += actual
        self.all_in = self.stack <= 0
        return actual


@dataclass(slots=True)
class HandPlayer:
    name: str
    position: str
    profile_name: str
    hole_cards: list[Card]
    starting_stack: float


@dataclass(slots=True)
class HandResult:
    hand_id: int
    board: list[Card]
    pot: float
    winners: list[str]
    showdown: bool
    action_history: list[ActionRecord]
    decision_samples: list[DecisionSample]
    stacks: dict[str, float]
    players: list[HandPlayer]
    starting_stack: float
    small_blind: float
    big_blind: float


class TableSimulator:
    def __init__(
        self,
        seed: int = 42,
        starting_stack: float = 100.0,
        small_blind: float = 0.5,
        big_blind: float = 1.0,
        evaluator_model: EvaluatorModel | None = None,
        evaluator_tuning: EvaluatorTuning | None = None,
        policy_model: PolicyModel | None = None,
        policy_adapter: PolicyAdapter | None = None,
    ) -> None:
        profiles = preset_cycle_for_table()
        self.players = [BotPlayer(f"Bot{i + 1}", POSITIONS[i], profiles[i], stack=starting_stack) for i in range(8)]
        self.seed = seed
        self.random = Random(seed)
        self.starting_stack = starting_stack
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.feature_builder = FeatureBuilder()
        strategy_layer = None
        resolved_policy_adapter = policy_adapter
        if resolved_policy_adapter is None and policy_model is not None:
            resolved_policy_adapter = PolicyAdapter(policy_model)
        if resolved_policy_adapter is not None:
            strategy_layer = StrategyLayer(evaluator_tuning, policy_adapter=resolved_policy_adapter)
        self.decision_engine = DecisionEngine(
            evaluator_model=evaluator_model,
            feature_builder=self.feature_builder,
            evaluator_tuning=evaluator_tuning,
            strategy_layer=strategy_layer,
        )
        self.hand_counter = 0

    def reset_stacks(self) -> None:
        for player in self.players:
            player.stack = self.starting_stack
            player.reset_for_hand()

    def simulate_batch(self, hands: int, seed: int | None = None, reset_stacks_each_hand: bool = True, verbose: bool = False) -> list[HandResult]:
        base_seed = self.seed if seed is None else seed
        results: list[HandResult] = []
        for index in range(hands):
            if reset_stacks_each_hand:
                self.reset_stacks()
            result = self.simulate_hand(hand_seed=base_seed + index, verbose=verbose)
            results.append(result)
        return results

    def simulate_hand(self, hand_seed: int | None = None, verbose: bool = False) -> HandResult:
        self.hand_counter += 1
        hand_rng_seed = hand_seed if hand_seed is not None else self.random.randint(1, 10_000_000)
        for player in self.players:
            player.reset_for_hand()

        deck = fresh_deck(seed=hand_rng_seed)
        for _ in range(2):
            for player in self.players:
                player.hole_cards.append(deck.pop())

        board: list[Card] = []
        history: list[ActionRecord] = []
        decision_samples: list[DecisionSample] = []
        pot = 0.0

        pot += self._post_blind("SB", self.small_blind, history)
        pot += self._post_blind("BB", self.big_blind, history)

        current_bet = self.big_blind
        min_raise_increment = self.big_blind

        if verbose:
            print(f"Starting hand #{self.hand_counter} with seed {hand_rng_seed}")

        for street in STREETS:
            if street == "flop":
                board.extend([deck.pop(), deck.pop(), deck.pop()])
                current_bet = 0.0
                min_raise_increment = self.big_blind
                self._reset_street_state()
            elif street == "turn":
                board.append(deck.pop())
                current_bet = 0.0
                min_raise_increment = self.big_blind
                self._reset_street_state()
            elif street == "river":
                board.append(deck.pop())
                current_bet = 0.0
                min_raise_increment = self.big_blind
                self._reset_street_state()
            else:
                self._mark_needs_action()

            if self._active_player_count() <= 1:
                break

            current_bet, min_raise_increment, pot = self._run_betting_round(
                street=street,
                board=board,
                history=history,
                decision_samples=decision_samples,
                pot=pot,
                current_bet=current_bet,
                min_raise_increment=min_raise_increment,
                verbose=verbose,
            )

            if self._active_player_count() <= 1:
                break

        active_players = [player for player in self.players if player.in_hand]
        showdown = len(active_players) > 1
        if showdown:
            best_score = max(evaluate_seven_card_hand(player.hole_cards + board) for player in active_players)
            winners = [player for player in active_players if evaluate_seven_card_hand(player.hole_cards + board) == best_score]
        else:
            winners = active_players

        share = round(pot / len(winners), 2)
        distributed = 0.0
        for index, winner in enumerate(winners):
            payout = share if index < len(winners) - 1 else round(pot - distributed, 2)
            winner.stack += payout
            distributed += payout

        if verbose:
            print(f"Board: {card_list_to_str(board)}")
            print(f"Winners: {', '.join(player.name for player in winners)} for pot {pot:.2f} BB")

        return HandResult(
            hand_id=self.hand_counter,
            board=board,
            pot=round(pot, 2),
            winners=[player.name for player in winners],
            showdown=showdown,
            action_history=history,
            decision_samples=decision_samples,
            stacks={player.name: round(player.stack, 2) for player in self.players},
            players=[
                HandPlayer(
                    name=player.name,
                    position=player.position,
                    profile_name=player.profile.name,
                    hole_cards=player.hole_cards[:],
                    starting_stack=self.starting_stack,
                )
                for player in self.players
            ],
            starting_stack=self.starting_stack,
            small_blind=self.small_blind,
            big_blind=self.big_blind,
        )

    def _run_betting_round(
        self,
        street: str,
        board: list[Card],
        history: list[ActionRecord],
        decision_samples: list[DecisionSample],
        pot: float,
        current_bet: float,
        min_raise_increment: float,
        verbose: bool,
    ) -> tuple[float, float, float]:
        order = PRE_FLOP_ORDER if street == "preflop" else POST_FLOP_ORDER
        while True:
            if self._active_player_count() <= 1:
                break
            progress = False
            for position in order:
                player = self._player_by_position(position)
                if not player.in_hand or player.all_in or not player.needs_action:
                    continue

                legal = self._legal_actions(player, current_bet, min_raise_increment)
                state = self._build_game_state(player, street, board, pot, current_bet, min_raise_increment, legal, history, order)
                raw_state = self.feature_builder.serialize_state(state, player.profile)
                derived_features = self.feature_builder.build(state, player.profile)
                decision = self.decision_engine.decide(state, player.profile)
                facing_amount = max(0.0, current_bet - player.street_bet)
                pot_before = pot
                action, amount = self._apply_decision(player, decision.action, decision.size, legal, current_bet, min_raise_increment)
                pot += amount

                if action in {"bet", "raise"}:
                    new_bet = player.street_bet
                    min_raise_increment = max(min_raise_increment, new_bet - current_bet)
                    current_bet = new_bet
                    for other in self.players:
                        if other.in_hand and not other.all_in and other is not player:
                            other.needs_action = True
                player.needs_action = False
                progress = True

                history.append(
                    ActionRecord(
                        street=street,
                        player_name=player.name,
                        position=player.position,
                        action=action,
                        amount=round(amount, 2),
                        facing_amount=round(facing_amount, 2),
                        pot_before=round(pot_before, 2),
                        note="; ".join(decision.debug_notes[:2]),
                        reason_tags=decision.reason_tags[:],
                        action_probabilities=decision.action_probabilities.copy(),
                        profile_name=player.profile.name,
                    )
                )
                decision_samples.append(
                    DecisionSample(
                        street=street,
                        player_name=player.name,
                        position=player.position,
                        profile_name=player.profile.name,
                        action=action,
                        committed_amount=round(amount, 2),
                        selected_size=decision.size,
                        size_bucket=decision.size_bucket,
                        raw_state=raw_state,
                        features=derived_features,
                        action_probabilities=decision.action_probabilities.copy(),
                        reason_tags=decision.reason_tags[:],
                        model_outputs=decision.model_outputs.copy(),
                    )
                )

                if verbose:
                    size_text = f" {amount:.2f} BB" if amount else ""
                    print(f"[{street.upper():7}] {player.name:>5} {player.position:>5}: {action}{size_text}")

                if self._active_player_count() <= 1:
                    break

            if not progress or self._round_closed(current_bet):
                break
        return current_bet, min_raise_increment, pot

    def _apply_decision(self, player: BotPlayer, action: str, size: float | None, legal: LegalActions, current_bet: float, min_raise_increment: float) -> tuple[str, float]:
        to_call = max(0.0, current_bet - player.street_bet)
        if action == "fold" and legal.can_fold:
            player.in_hand = False
            player.needs_action = False
            return "fold", 0.0
        if action == "check" and legal.can_check:
            return "check", 0.0
        if action == "call" and legal.can_call:
            return "call", player.commit(to_call)

        if action in {"bet", "raise"} and (legal.can_bet or legal.can_raise):
            min_target = self.big_blind if current_bet == 0 else current_bet + min_raise_increment
            target = size if size is not None else min_target
            target = max(min_target, target)
            target = min(target, player.street_bet + player.stack)
            contribution = max(0.0, target - player.street_bet)
            actual = player.commit(contribution)
            return ("bet" if current_bet == 0 else "raise"), actual

        if legal.can_call and to_call > 0:
            return "call", player.commit(to_call)
        if legal.can_check:
            return "check", 0.0
        player.in_hand = False
        return "fold", 0.0

    def _build_game_state(self, player: BotPlayer, street: str, board: list[Card], pot: float, current_bet: float, min_raise_increment: float, legal: LegalActions, history: list[ActionRecord], order: Iterable[str]) -> GameState:
        active = [other for other in self.players if other.in_hand]
        to_call = max(0.0, current_bet - player.street_bet)
        max_raise = player.street_bet + player.stack
        players_after = self._players_to_act_behind(player.position, order)
        street_actions = [record for record in history if record.street == street]
        aggressive_actions = [record for record in street_actions if record.action in {"bet", "raise"} and record.note != "blind_post"]
        last_aggressor = aggressive_actions[-1].position if aggressive_actions else None
        facing_raise = len(aggressive_actions) >= 2 or (street == "preflop" and current_bet > self.big_blind and len(aggressive_actions) >= 1)
        facing_bet = bool(aggressive_actions) and not facing_raise

        return GameState(
            table_size=8,
            small_blind=self.small_blind,
            big_blind=self.big_blind,
            street=street,
            hero_name=player.name,
            hero_position=player.position,
            hero_hole_cards=player.hole_cards[:],
            board_cards=board[:],
            pot_size=round(pot, 2),
            effective_stack=round(min([player.stack] + [other.stack for other in active if other is not player]), 2),
            amount_to_call=round(to_call, 2),
            legal_actions=legal,
            min_raise=round(min(current_bet + min_raise_increment, max_raise), 2),
            max_raise=round(max_raise, 2),
            action_history=history[:],
            active_players=[other.name for other in active],
            style_profile_name=player.profile.name,
            players_to_act_behind=players_after,
            is_preflop_aggressor=any(record.player_name == player.name and record.action in {"bet", "raise"} for record in history if record.street == "preflop" and record.note != "blind_post"),
            facing_bet=facing_bet,
            facing_raise=facing_raise,
            last_aggressor_position=last_aggressor,
        )

    def _legal_actions(self, player: BotPlayer, current_bet: float, min_raise_increment: float) -> LegalActions:
        to_call = max(0.0, current_bet - player.street_bet)
        can_raise = player.stack > to_call and (player.street_bet + player.stack) > current_bet
        if current_bet == 0:
            return LegalActions(can_fold=False, can_check=True, can_bet=player.stack > 0, can_raise=False)
        return LegalActions(
            can_fold=to_call > 0,
            can_check=to_call == 0,
            can_call=to_call > 0 and player.stack > 0,
            can_bet=False,
            can_raise=can_raise and (player.street_bet + player.stack) >= current_bet + min_raise_increment,
        )

    def _post_blind(self, position: str, amount: float, history: list[ActionRecord]) -> float:
        player = self._player_by_position(position)
        posted = player.commit(amount)
        history.append(ActionRecord(street="preflop", player_name=player.name, position=player.position, action="bet", amount=posted, pot_before=0.0, note="blind_post", profile_name=player.profile.name))
        return posted

    def _player_by_position(self, position: str) -> BotPlayer:
        for player in self.players:
            if player.position == position:
                return player
        raise KeyError(position)

    def _reset_street_state(self) -> None:
        for player in self.players:
            player.street_bet = 0.0
            player.needs_action = player.in_hand and not player.all_in

    def _mark_needs_action(self) -> None:
        for player in self.players:
            player.needs_action = player.in_hand and not player.all_in

    def _players_to_act_behind(self, hero_position: str, order: Iterable[str]) -> int:
        positions = [position for position in order if self._player_by_position(position).in_hand and self._player_by_position(position).needs_action]
        if hero_position not in positions:
            return 0
        hero_index = positions.index(hero_position)
        return max(0, len(positions) - hero_index - 1)

    def _round_closed(self, current_bet: float) -> bool:
        for player in self.players:
            if not player.in_hand or player.all_in:
                continue
            if player.needs_action:
                return False
            if abs(player.street_bet - current_bet) > 1e-9 and player.stack > 0:
                return False
        return True

    def _active_player_count(self) -> int:
        return sum(1 for player in self.players if player.in_hand)
