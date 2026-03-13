from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from random import Random
from typing import Iterable

from .engine import HandResult
from .rollout_labeler import RolloutConfig, RolloutLabeler

DATASET_STREETS = ("preflop", "flop", "turn", "river")
DEFAULT_STREET_TARGETS = {
    "preflop": 250,
    "flop": 250,
    "turn": 250,
    "river": 250,
}
PRE_BUCKET_NAME = {
    0: "weak",
    1: "speculative",
    2: "playable",
    3: "strong",
    4: "premium",
}
POST_BUCKET_NAME = {
    0: "air",
    1: "weak_draw",
    2: "weak_showdown_value",
    3: "medium_made_hand",
    4: "strong_draw",
    5: "strong_made_hand",
}


@dataclass(slots=True)
class DatasetV1Config:
    seed: int = 42
    rollout_trials: int = 120
    street_targets: dict[str, int] | None = None
    max_opponents: int | None = None
    dataset_name: str = "dataset_v1"

    def resolved_street_targets(self) -> dict[str, int]:
        if self.street_targets is None:
            return DEFAULT_STREET_TARGETS.copy()
        return {street: int(self.street_targets.get(street, 0)) for street in DATASET_STREETS}


def count_samples_by_street(results: Iterable[HandResult]) -> dict[str, int]:
    counts = {street: 0 for street in DATASET_STREETS}
    for result in results:
        for sample in result.decision_samples:
            counts[sample.street] += 1
    return counts


def export_evaluator_dataset(
    results: Iterable[HandResult],
    output_dir: str | Path,
    *,
    rollout_trials: int = 120,
    seed: int = 42,
    target_samples_per_street: int | dict[str, int] | None = None,
    max_opponents: int | None = None,
    dataset_name: str = "evaluator_dataset",
) -> tuple[Path, Path, Path]:
    result_list = list(results)
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    dataset_jsonl = target / f"{dataset_name}.jsonl"
    dataset_csv = target / f"{dataset_name}.csv"
    dataset_metadata = target / f"{dataset_name}_metadata.json"

    street_targets = _resolve_street_targets(target_samples_per_street)
    config = RolloutConfig(trials=rollout_trials, seed=seed, max_opponents=max_opponents)
    labeler = RolloutLabeler(config)
    selected = _select_samples(result_list, seed=seed, street_targets=street_targets)

    flat_rows: list[dict[str, object]] = []
    exported_street_counts = {street: 0 for street in DATASET_STREETS}
    tag_summary = {
        "spot_type": {},
        "player_bucket": {},
        "position": {},
        "hand_class": {},
        "board_texture": {},
    }

    with dataset_jsonl.open("w", encoding="utf-8") as jsonl_file:
        for result, sample_index, sample in selected:
            row_seed = seed + result.hand_id * 10_000 + sample_index
            state = sample.raw_state
            labels = labeler.label_state(_deserialize_game_state(state), seed=row_seed).as_dict()
            tags = _build_sample_tags(sample.raw_state, sample.features, sample.position, sample.street)
            payload = {
                "meta": {
                    "hand_id": result.hand_id,
                    "sample_index": sample_index,
                    "street": sample.street,
                    "player_name": sample.player_name,
                    "position": sample.position,
                    "profile_name": sample.profile_name,
                    "action": sample.action,
                    "committed_amount": sample.committed_amount,
                    "selected_size": sample.selected_size,
                },
                "raw_state": state,
                "features": sample.features,
                "labels": labels,
                "tags": tags,
                "model_outputs": sample.model_outputs,
                "reason_tags": sample.reason_tags,
            }
            jsonl_file.write(json.dumps(payload, ensure_ascii=True) + "\n")

            flat_row = {
                "hand_id": result.hand_id,
                "sample_index": sample_index,
                "street": sample.street,
                "player_name": sample.player_name,
                "position": sample.position,
                "profile_name": sample.profile_name,
                "action": sample.action,
                "committed_amount": sample.committed_amount,
                "selected_size": sample.selected_size if sample.selected_size is not None else "",
                "raw_state_json": json.dumps(state, ensure_ascii=True),
                **tags,
                **sample.features,
                **labels,
            }
            flat_rows.append(flat_row)
            exported_street_counts[sample.street] += 1
            for tag_name, tag_value in tags.items():
                bucket = tag_summary[tag_name]
                bucket[tag_value] = bucket.get(tag_value, 0) + 1

    _write_csv(dataset_csv, flat_rows)
    metadata = {
        "dataset_name": dataset_name,
        "rollout_config": config.as_dict(),
        "sampling_strategy": {
            "mode": "stratified_with_forced_coverage",
            "street_targets": street_targets,
            "coverage_axes": ["position", "player_bucket", "spot_type", "hand_class", "board_texture"],
            "priority_bias": ["medium_made_hand", "weak_showdown_value", "strong_draw", "river_bluff_catch", "facing_3bet", "blind_defense"],
        },
        "candidate_hands": len(result_list),
        "candidate_samples_by_street": count_samples_by_street(result_list),
        "exported_samples": len(flat_rows),
        "exported_samples_by_street": exported_street_counts,
        "exported_tag_summary": tag_summary,
    }
    dataset_metadata.write_text(json.dumps(metadata, ensure_ascii=True, indent=2), encoding="utf-8")
    return dataset_jsonl, dataset_csv, dataset_metadata


def _resolve_street_targets(target_samples_per_street: int | dict[str, int] | None) -> dict[str, int]:
    if target_samples_per_street is None:
        return DEFAULT_STREET_TARGETS.copy()
    if isinstance(target_samples_per_street, int):
        return {street: target_samples_per_street for street in DATASET_STREETS}
    return {street: int(target_samples_per_street.get(street, 0)) for street in DATASET_STREETS}


def _select_samples(
    results: list[HandResult],
    *,
    seed: int,
    street_targets: dict[str, int],
) -> list[tuple[HandResult, int, object]]:
    rng = Random(seed)
    by_street: dict[str, list[tuple[HandResult, int, object, dict[str, str]]]] = {street: [] for street in DATASET_STREETS}
    for result in results:
        for sample_index, sample in enumerate(result.decision_samples):
            tags = _build_sample_tags(sample.raw_state, sample.features, sample.position, sample.street)
            by_street[sample.street].append((result, sample_index, sample, tags))

    selected: list[tuple[HandResult, int, object]] = []
    for street, rows in by_street.items():
        rng.shuffle(rows)
        target = street_targets.get(street, 0)
        selected.extend(_select_street_rows(rows, target))

    return sorted(selected, key=lambda item: (item[0].hand_id, item[1]))


def _select_street_rows(
    rows: list[tuple[HandResult, int, object, dict[str, str]]],
    target: int,
) -> list[tuple[HandResult, int, object]]:
    if target <= 0:
        return []

    selected_indices: set[int] = set()
    ordered_selection: list[tuple[HandResult, int, object]] = []
    coverage_keys = ["position", "player_bucket", "spot_type", "hand_class", "board_texture"]

    for key in coverage_keys:
        seen: set[str] = set()
        for index, row in enumerate(rows):
            if len(ordered_selection) >= target:
                return ordered_selection
            if index in selected_indices:
                continue
            tag_value = row[3][key]
            if tag_value not in seen:
                seen.add(tag_value)
                selected_indices.add(index)
                ordered_selection.append((row[0], row[1], row[2]))

    remaining = [
        (index, row)
        for index, row in enumerate(rows)
        if index not in selected_indices
    ]
    remaining.sort(key=lambda item: _sample_priority(item[1][3]), reverse=True)
    for index, row in remaining:
        if len(ordered_selection) >= target:
            break
        selected_indices.add(index)
        ordered_selection.append((row[0], row[1], row[2]))
    return ordered_selection


def _sample_priority(tags: dict[str, str]) -> int:
    score = 0
    if tags["hand_class"] in {"medium_made_hand", "weak_showdown_value", "strong_draw"}:
        score += 3
    if tags["spot_type"] in {"facing_3bet", "blind_defense", "facing_cbet", "barrel_spot", "river_bluff_catch"}:
        score += 2
    if tags["player_bucket"] == "heads_up":
        score += 1
    if tags["board_texture"] in {"wet_board", "monotone_board", "paired_board", "ace_high_dry_board"}:
        score += 1
    return score


def _build_sample_tags(raw_state: dict[str, object], features: dict[str, float], position: str, street: str) -> dict[str, str]:
    active_player_count = len(raw_state.get("active_players", []))
    facing_bet = bool(raw_state.get("facing_bet", False))
    facing_raise = bool(raw_state.get("facing_raise", False))
    is_preflop_aggressor = bool(raw_state.get("is_preflop_aggressor", False))
    preflop_raise_count = int(features.get("preflop_raise_count", 0.0))

    if street == "preflop":
        hand_class = PRE_BUCKET_NAME[int(features.get("preflop_bucket_index", 0.0))]
    else:
        hand_class = POST_BUCKET_NAME[int(features.get("postflop_bucket_index", 0.0))]

    board_texture = _board_texture_tag(raw_state, features)
    player_bucket = _player_bucket(street, active_player_count)
    spot_type = _spot_type(street, position, active_player_count, facing_bet, facing_raise, is_preflop_aggressor, preflop_raise_count, hand_class, board_texture)
    return {
        "spot_type": spot_type,
        "player_bucket": player_bucket,
        "position": position,
        "hand_class": hand_class,
        "board_texture": board_texture,
    }


def _player_bucket(street: str, active_player_count: int) -> str:
    if street == "preflop":
        return "full_ring_context"
    if active_player_count <= 2:
        return "heads_up"
    if active_player_count == 3:
        return "three_way"
    return "four_way_plus"


def _board_texture_tag(raw_state: dict[str, object], features: dict[str, float]) -> str:
    if raw_state["street"] == "preflop":
        return "preflop"
    if float(features.get("board_is_monotone", 0.0)) >= 1.0:
        return "monotone_board"
    if float(features.get("board_is_paired", 0.0)) >= 1.0:
        return "paired_board"
    if float(features.get("board_is_two_tone", 0.0)) >= 1.0:
        return "two_tone_board"
    if float(features.get("board_is_high_card", 0.0)) >= 1.0 and float(features.get("board_texture_index", 0.0)) == 1.0 and float(features.get("board_high_rank", 0.0)) >= 14.0:
        return "ace_high_dry_board"
    if float(features.get("board_is_low_board", 0.0)) >= 1.0 and float(features.get("board_is_coordinated", 0.0)) >= 1.0:
        return "low_connected_board"
    texture_index = int(features.get("board_texture_index", 0.0))
    if texture_index == 3:
        return "wet_board"
    if texture_index == 2:
        return "semi_wet_board"
    return "dry_board"


def _spot_type(
    street: str,
    position: str,
    active_player_count: int,
    facing_bet: bool,
    facing_raise: bool,
    is_preflop_aggressor: bool,
    preflop_raise_count: int,
    hand_class: str,
    board_texture: str,
) -> str:
    if street == "preflop":
        if not facing_bet and not facing_raise:
            if position in {"BTN", "CO"}:
                return "late_position_open"
            if position in {"UTG", "UTG+1", "MP"}:
                return "early_position_open"
            return "unopened_pot"
        if facing_raise or preflop_raise_count >= 2:
            return "facing_3bet"
        if position == "BB":
            return "blind_defense"
        if position == "SB":
            return "small_blind_defense"
        return "facing_open"

    if street == "flop":
        if active_player_count >= 4:
            return "multiway_flop"
        if is_preflop_aggressor and not facing_bet:
            return "cbet_spot"
        if facing_bet:
            return "facing_cbet"
        if board_texture in {"wet_board", "monotone_board"}:
            return "draw_pressure_flop"
        return "checked_flop"

    if street == "turn":
        if is_preflop_aggressor and not facing_bet:
            return "barrel_spot"
        if facing_bet:
            return "facing_second_barrel"
        if hand_class in {"strong_draw", "weak_draw"}:
            return "draw_turn_decision"
        return "turn_probe_or_checkback"

    if facing_bet:
        return "river_bluff_catch"
    if hand_class in {"strong_made_hand", "medium_made_hand"}:
        return "river_value_decision"
    if hand_class in {"air", "weak_draw"}:
        return "river_bluff_decision"
    return "river_showdown_hand"


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _deserialize_game_state(payload: dict[str, object]):
    from .cards import parse_cards
    from .game_state import ActionRecord, GameState, LegalActions

    action_history = [
        ActionRecord(
            street=item["street"],
            player_name=item["player_name"],
            position=item["position"],
            action=item["action"],
            amount=float(item.get("amount", 0.0)),
            facing_amount=float(item.get("facing_amount", 0.0)),
            pot_before=float(item.get("pot_before", 0.0)),
            note=str(item.get("note", "")),
            reason_tags=list(item.get("reason_tags", [])),
            profile_name=str(item.get("profile_name", "")),
        )
        for item in payload.get("action_history", [])
    ]
    legal = payload["legal_actions"]
    return GameState(
        table_size=int(payload["table_size"]),
        small_blind=float(payload["small_blind"]),
        big_blind=float(payload["big_blind"]),
        street=str(payload["street"]),
        hero_name=str(payload["hero_name"]),
        hero_position=str(payload["hero_position"]),
        hero_hole_cards=parse_cards(payload["hero_hole_cards"]),
        board_cards=parse_cards(payload["board_cards"]),
        pot_size=float(payload["pot_size"]),
        effective_stack=float(payload["effective_stack"]),
        amount_to_call=float(payload["amount_to_call"]),
        legal_actions=LegalActions(
            can_fold=bool(legal["can_fold"]),
            can_check=bool(legal["can_check"]),
            can_call=bool(legal["can_call"]),
            can_bet=bool(legal["can_bet"]),
            can_raise=bool(legal["can_raise"]),
        ),
        min_raise=float(payload["min_raise"]),
        max_raise=float(payload["max_raise"]),
        action_history=action_history,
        active_players=list(payload.get("active_players", [])),
        style_profile_name=str(payload.get("style_profile_name", "")),
        players_to_act_behind=int(payload.get("players_to_act_behind", 0)),
        is_preflop_aggressor=bool(payload.get("is_preflop_aggressor", False)),
        facing_bet=bool(payload.get("facing_bet", False)),
        facing_raise=bool(payload.get("facing_raise", False)),
        last_aggressor_position=payload.get("last_aggressor_position"),
    )
