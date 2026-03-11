from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path
from typing import Iterable

from .cards import card_list_to_str
from .engine import HandResult
from .game_state import ActionRecord


def _serialize_action(record: ActionRecord) -> dict[str, object]:
    return asdict(record)


def hand_result_to_dict(result: HandResult) -> dict[str, object]:
    return {
        "hand_id": result.hand_id,
        "board": card_list_to_str(result.board),
        "pot": result.pot,
        "winners": result.winners,
        "showdown": result.showdown,
        "stacks": result.stacks,
        "actions": [_serialize_action(record) for record in result.action_history],
    }


def _decision_rows(results: Iterable[HandResult]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for result in results:
        for action in result.action_history:
            if action.note == "blind_post":
                continue
            rows.append(
                {
                    "hand_id": result.hand_id,
                    "street": action.street,
                    "player_name": action.player_name,
                    "position": action.position,
                    "profile_name": action.profile_name,
                    "action": action.action,
                    "amount": action.amount,
                    "facing_amount": action.facing_amount,
                    "pot_before": action.pot_before,
                    "reason_tags": "|".join(action.reason_tags),
                    "action_probabilities": json.dumps(action.action_probabilities, ensure_ascii=True),
                    "note": action.note,
                    "board": card_list_to_str(result.board),
                    "showdown": result.showdown,
                }
            )
    return rows


def _profile_summary(results: Iterable[HandResult]) -> list[dict[str, object]]:
    stats: dict[str, dict[str, float]] = {}

    def bucket(profile_name: str) -> dict[str, float]:
        if profile_name not in stats:
            stats[profile_name] = {
                "hands": 0,
                "vpip_hands": 0,
                "pfr_hands": 0,
                "three_bet_hands": 0,
                "flop_seen": 0,
                "flop_cbet_opportunities": 0,
                "flop_cbets": 0,
                "turn_seen": 0,
                "turn_barrel_opportunities": 0,
                "turn_barrels": 0,
                "river_seen": 0,
                "showdowns": 0,
                "wins": 0,
            }
        return stats[profile_name]

    for result in results:
        seen_profiles: set[str] = set()
        per_hand: dict[str, dict[str, bool]] = {}
        street_actions = {"preflop": [], "flop": [], "turn": [], "river": []}
        for action in result.action_history:
            if action.note == "blind_post":
                continue
            street_actions[action.street].append(action)
            profile_stats = bucket(action.profile_name)
            if action.profile_name not in seen_profiles:
                profile_stats["hands"] += 1
                seen_profiles.add(action.profile_name)
            state = per_hand.setdefault(
                action.player_name,
                {
                    "profile_name": action.profile_name,
                    "vpip": False,
                    "pfr": False,
                    "three_bet": False,
                    "flop_seen": False,
                    "turn_seen": False,
                    "river_seen": False,
                },
            )
            if action.street == "preflop" and action.action in {"call", "raise"}:
                state["vpip"] = True
            if action.street == "preflop" and action.action == "raise":
                if not state["pfr"]:
                    state["pfr"] = True
                elif not state["three_bet"]:
                    state["three_bet"] = True
            if action.street == "flop":
                state["flop_seen"] = True
            if action.street == "turn":
                state["turn_seen"] = True
            if action.street == "river":
                state["river_seen"] = True
        for winner in result.winners:
            for action in result.action_history:
                if action.player_name == winner and action.note != "blind_post":
                    bucket(action.profile_name)["wins"] += 1
                    break
        if result.showdown:
            showdown_players = {action.player_name: action.profile_name for action in result.action_history if action.street == "river" and action.note != "blind_post"}
            if not showdown_players:
                showdown_players = {action.player_name: action.profile_name for action in result.action_history if action.note != "blind_post" and action.action != "fold"}
            for profile_name in showdown_players.values():
                bucket(profile_name)["showdowns"] += 1

        for hand_state in per_hand.values():
            profile_stats = bucket(hand_state["profile_name"])
            if hand_state["vpip"]:
                profile_stats["vpip_hands"] += 1
            if hand_state["pfr"]:
                profile_stats["pfr_hands"] += 1
            if hand_state["three_bet"]:
                profile_stats["three_bet_hands"] += 1
            if hand_state["flop_seen"]:
                profile_stats["flop_seen"] += 1
            if hand_state["turn_seen"]:
                profile_stats["turn_seen"] += 1
            if hand_state["river_seen"]:
                profile_stats["river_seen"] += 1

        preflop_raisers = [action for action in street_actions["preflop"] if action.action == "raise"]
        if preflop_raisers:
            last_preflop_raiser = preflop_raisers[-1].player_name
            for action in street_actions["flop"]:
                if action.player_name == last_preflop_raiser:
                    profile_stats = bucket(action.profile_name)
                    profile_stats["flop_cbet_opportunities"] += 1
                    if action.action in {"bet", "raise"}:
                        profile_stats["flop_cbets"] += 1
                    break

        flop_aggressors = [action for action in street_actions["flop"] if action.action in {"bet", "raise"}]
        if flop_aggressors and street_actions["turn"]:
            last_flop_aggressor = flop_aggressors[-1].player_name
            for action in street_actions["turn"]:
                if action.player_name == last_flop_aggressor:
                    profile_stats = bucket(action.profile_name)
                    profile_stats["turn_barrel_opportunities"] += 1
                    if action.action in {"bet", "raise"}:
                        profile_stats["turn_barrels"] += 1
                    break

    rows: list[dict[str, object]] = []
    for profile_name, values in sorted(stats.items()):
        hands = max(values["hands"], 1)
        rows.append(
            {
                "profile_name": profile_name,
                "hands": int(values["hands"]),
                "vpip_pct": round(values["vpip_hands"] / hands * 100, 1),
                "pfr_pct": round(values["pfr_hands"] / hands * 100, 1),
                "three_bet_pct": round(values["three_bet_hands"] / hands * 100, 1),
                "flop_seen": int(values["flop_seen"]),
                "turn_seen": int(values["turn_seen"]),
                "river_seen": int(values["river_seen"]),
                "flop_cbet_pct": round(values["flop_cbets"] / values["flop_cbet_opportunities"] * 100, 1) if values["flop_cbet_opportunities"] else 0.0,
                "turn_barrel_pct": round(values["turn_barrels"] / values["turn_barrel_opportunities"] * 100, 1) if values["turn_barrel_opportunities"] else 0.0,
                "showdowns": int(values["showdowns"]),
                "wins": int(values["wins"]),
            }
        )
    return rows


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def export_hand_results(results: Iterable[HandResult], output_dir: str | Path) -> tuple[Path, Path, Path, Path, Path]:
    result_list = list(results)
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    hand_history_path = target / "hand_history.jsonl"
    decision_path = target / "decision_samples.jsonl"
    hand_csv_path = target / "hand_history.csv"
    summary_csv_path = target / "profile_summary.csv"
    summary_json_path = target / "profile_summary.json"

    all_decision_rows = _decision_rows(result_list)
    summary_rows = _profile_summary(result_list)

    with hand_history_path.open("w", encoding="utf-8") as hand_file, decision_path.open("w", encoding="utf-8") as decision_file:
        for result in result_list:
            hand_file.write(json.dumps(hand_result_to_dict(result), ensure_ascii=True) + "\n")
        for row in all_decision_rows:
            decision_file.write(json.dumps(row, ensure_ascii=True) + "\n")

    hand_rows = [{"hand_id": result.hand_id, "board": card_list_to_str(result.board), "pot": result.pot, "winners": "|".join(result.winners), "showdown": result.showdown} for result in result_list]
    _write_csv(hand_csv_path, hand_rows)
    _write_csv(summary_csv_path, summary_rows)
    summary_json_path.write_text(json.dumps(summary_rows, ensure_ascii=True, indent=2), encoding="utf-8")

    return hand_history_path, decision_path, hand_csv_path, summary_csv_path, summary_json_path
