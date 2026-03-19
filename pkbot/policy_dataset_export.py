from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .dataset_export import (
    DATASET_STREETS,
    _resolve_street_targets,
    count_samples_by_street,
)
from .engine import HandResult
from .postflop_labeling import classify_postflop_spot_from_raw_state
from .preflop_labeling import classify_preflop_spot_from_raw_state, match_spot_target
from .policy_interface import LEGAL_SIZE_BUCKETS_BY_STREET, POLICY_ACTIONS, POLICY_SIZE_BUCKETS

DEFAULT_POLICY_STREET_TARGETS = {
    "preflop": 1200,
    "flop": 1600,
    "turn": 1000,
    "river": 800,
}

POLICY_V1_SPOT_TARGETS = {
    "preflop": {
        "late_position_open": 60,
        "early_position_open": 30,
        "facing_open": 120,
        "facing_3bet": 160,
        "blind_defense": 90,
        "small_blind_defense": 60,
    },
    "flop": {
        "cbet_spot": 120,
        "facing_cbet": 180,
        "multiway_flop": 160,
        "checked_flop": 60,
        "draw_pressure_flop": 40,
    },
    "turn": {
        "barrel_spot": 120,
        "facing_second_barrel": 180,
        "turn_probe_or_checkback": 100,
        "draw_turn_decision": 80,
    },
    "river": {
        "river_value_decision": 180,
        "river_bluff_catch": 220,
        "river_bluff_decision": 50,
        "river_showdown_hand": 120,
    },
}

POLICY_V1_1_SPOT_TARGETS = {
    "preflop": {
        "unopened_preflop_open": 120,
        "btn_steal": 180,
        "co_open": 140,
        "sb_complete_raise": 180,
        "bb_defend_vs_late_open": 220,
        "facing_3bet": 160,
        "facing_open": 120,
    },
    "flop": POLICY_V1_SPOT_TARGETS["flop"],
    "turn": POLICY_V1_SPOT_TARGETS["turn"],
    "river": POLICY_V1_SPOT_TARGETS["river"],
}


@dataclass(slots=True)
class PolicyDatasetV1Config:
    seed: int = 42
    street_targets: dict[str, int] | None = None
    dataset_name: str = "policy_dataset_v1"

    def resolved_street_targets(self) -> dict[str, int]:
        if self.street_targets is None:
            return DEFAULT_POLICY_STREET_TARGETS.copy()
        return _resolve_street_targets(self.street_targets)


def export_policy_dataset(
    results: Iterable[HandResult],
    output_dir: str | Path,
    *,
    dataset_name: str = "policy_dataset",
    target_samples_per_street: int | dict[str, int] | None = None,
    seed: int = 42,
    spot_targets: dict[str, dict[str, int]] | None = None,
) -> tuple[Path, Path, Path]:
    result_list = list(results)
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    dataset_jsonl = target / f"{dataset_name}.jsonl"
    dataset_csv = target / f"{dataset_name}.csv"
    metadata_path = target / f"{dataset_name}_metadata.json"

    street_targets = _resolve_policy_targets(target_samples_per_street)
    resolved_spot_targets = spot_targets or POLICY_V1_SPOT_TARGETS
    selected = _select_policy_samples(result_list, street_targets=street_targets, spot_targets=resolved_spot_targets)

    rows: list[dict[str, object]] = []
    action_counts = {action: 0 for action in POLICY_ACTIONS}
    size_bucket_counts = {bucket: 0 for bucket in POLICY_SIZE_BUCKETS}
    exported_street_counts = {street: 0 for street in DATASET_STREETS}
    tag_summary = {
        "spot_type": {},
        "action_context_subtype": {},
        "player_bucket": {},
        "position": {},
        "hand_class": {},
        "board_texture": {},
    }

    with dataset_jsonl.open("w", encoding="utf-8") as handle:
        for result, sample_index, sample in selected:
            evaluator_outputs = {
                "policy_equity_estimate": float(sample.model_outputs.get("equity_estimate", 0.0)),
                "policy_showdown_strength_proxy": float(sample.model_outputs.get("showdown_strength_proxy", 0.0)),
            }
            legal_action_mask = _legal_action_mask(sample.raw_state)
            legal_size_bucket_mask = _legal_size_bucket_mask(sample.raw_state, sample.street)
            action_target = sample.action
            size_bucket = sample.size_bucket or "none"
            action_probabilities = {
                f"target_prob_{action}": float(sample.action_probabilities.get(action, 0.0))
                for action in POLICY_ACTIONS
            }
            tags = _build_policy_sample_tags(sample.raw_state, sample.features, sample.position, sample.street)
            style_profile = sample.raw_state.get("style_profile", {})

            payload = {
                "meta": {
                    "hand_id": result.hand_id,
                    "sample_index": sample_index,
                    "street": sample.street,
                    "player_name": sample.player_name,
                    "position": sample.position,
                    "profile_name": sample.profile_name,
                },
                "raw_state": sample.raw_state,
                "style_profile": style_profile,
                "evaluator_outputs": evaluator_outputs,
                "features": {
                    **sample.features,
                    **evaluator_outputs,
                    **legal_action_mask,
                    **legal_size_bucket_mask,
                },
                "targets": {
                    "action": action_target,
                    "size_bucket": size_bucket,
                    "selected_size": sample.selected_size,
                    "committed_amount": sample.committed_amount,
                    **action_probabilities,
                },
                "masks": {
                    "legal_actions": legal_action_mask,
                    "legal_size_buckets": legal_size_bucket_mask,
                },
                "tags": tags,
                "reason_tags": sample.reason_tags,
            }
            handle.write(json.dumps(payload, ensure_ascii=True) + "\n")

            rows.append(
                {
                    "hand_id": result.hand_id,
                    "sample_index": sample_index,
                    "street": sample.street,
                    "player_name": sample.player_name,
                    "position": sample.position,
                    "profile_name": sample.profile_name,
                    "action": action_target,
                    "size_bucket": size_bucket,
                    "selected_size": sample.selected_size if sample.selected_size is not None else "",
                    "committed_amount": sample.committed_amount,
                    "raw_state_json": json.dumps(sample.raw_state, ensure_ascii=True),
                    "style_profile_json": json.dumps(style_profile, ensure_ascii=True),
                    **sample.features,
                    **evaluator_outputs,
                    **legal_action_mask,
                    **legal_size_bucket_mask,
                    **action_probabilities,
                    **tags,
                }
            )
            action_counts[action_target] = action_counts.get(action_target, 0) + 1
            size_bucket_counts[size_bucket] = size_bucket_counts.get(size_bucket, 0) + 1
            exported_street_counts[sample.street] += 1
            for tag_name, tag_value in tags.items():
                bucket = tag_summary[tag_name]
                bucket[tag_value] = bucket.get(tag_value, 0) + 1

    _write_csv(dataset_csv, rows)
    metadata = {
        "dataset_name": dataset_name,
        "samples": len(rows),
        "source": "stable_teacher_strategy_pipeline",
        "sampling_strategy": {
            "mode": "stratified_with_forced_coverage",
            "street_targets": street_targets,
            "spot_targets": resolved_spot_targets,
            "coverage_axes": ["position", "player_bucket", "spot_type", "action_context_subtype", "hand_class", "board_texture"],
        },
        "candidate_hands": len(result_list),
        "candidate_samples_by_street": count_samples_by_street(result_list),
        "exported_samples_by_street": exported_street_counts,
        "exported_tag_summary": tag_summary,
        "targets": {
            "action": action_counts,
            "size_bucket": size_bucket_counts,
        },
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=True, indent=2), encoding="utf-8")
    return dataset_jsonl, dataset_csv, metadata_path


def _resolve_policy_targets(target_samples_per_street: int | dict[str, int] | None) -> dict[str, int]:
    if target_samples_per_street is None:
        return DEFAULT_POLICY_STREET_TARGETS.copy()
    return _resolve_street_targets(target_samples_per_street)


def _select_policy_samples(
    results: list[HandResult],
    *,
    street_targets: dict[str, int],
    spot_targets: dict[str, dict[str, int]],
) -> list[tuple[HandResult, int, object]]:
    by_street: dict[str, list[tuple[HandResult, int, object, dict[str, str]]]] = {street: [] for street in DATASET_STREETS}
    for result in results:
        for sample_index, sample in enumerate(result.decision_samples):
            tags = _build_policy_sample_tags(sample.raw_state, sample.features, sample.position, sample.street)
            by_street[sample.street].append((result, sample_index, sample, tags))

    selected: list[tuple[HandResult, int, object]] = []
    for street, rows in by_street.items():
        target = street_targets.get(street, 0)
        selected.extend(_select_policy_rows_for_street(rows, target, street, spot_targets.get(street, {})))
    return sorted(selected, key=lambda item: (item[0].hand_id, item[1]))


def _select_policy_rows_for_street(
    rows: list[tuple[HandResult, int, object, dict[str, str]]],
    target: int,
    street: str,
    min_spot_targets: dict[str, int],
) -> list[tuple[HandResult, int, object]]:
    if target <= 0:
        return []

    selected_indices: set[int] = set()
    ordered_selection: list[tuple[HandResult, int, object]] = []
    for spot_type, spot_target in min_spot_targets.items():
        matched_count = 0
        for index, row in enumerate(rows):
            if len(ordered_selection) >= target or sum(1 for _, _, sample in ordered_selection if sample.street == street) >= target:
                return ordered_selection
            if index in selected_indices:
                continue
            if not _row_matches_target(row[3], spot_type):
                continue
            selected_indices.add(index)
            ordered_selection.append((row[0], row[1], row[2]))
            matched_count += 1
            if matched_count >= spot_target:
                break

    coverage_keys = ["position", "player_bucket", "action_context_subtype", "hand_class", "board_texture"]
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
    remaining.sort(key=lambda item: _policy_sample_priority(item[1][3]), reverse=True)
    for index, row in remaining:
        if len(ordered_selection) >= target:
            break
        selected_indices.add(index)
        ordered_selection.append((row[0], row[1], row[2]))
    return ordered_selection


def _build_policy_sample_tags(raw_state: dict[str, object], features: dict[str, float], position: str, street: str) -> dict[str, str]:
    active_player_count = len(raw_state.get("active_players", []))
    hand_class = _policy_hand_class(street, features)
    board_texture = _policy_board_texture_tag(raw_state, features)
    player_bucket = _policy_player_bucket(street, active_player_count)
    if street == "preflop":
        summary = classify_preflop_spot_from_raw_state(raw_state)
        return {
            "street": street,
            "spot_type": summary.spot_type,
            "action_context_subtype": summary.action_context_subtype,
            "player_bucket": player_bucket,
            "position": position,
            "hand_class": hand_class,
            "board_texture": board_texture,
        }
    summary = classify_postflop_spot_from_raw_state(raw_state)
    return {
        "street": street,
        "spot_type": summary.spot_type,
        "action_context_subtype": summary.action_context_subtype,
        "player_bucket": player_bucket,
        "position": position,
        "hand_class": hand_class,
        "board_texture": board_texture,
    }


def _policy_sample_priority(tags: dict[str, str]) -> int:
    score = 0
    if tags["hand_class"] in {"medium_made_hand", "weak_showdown_value", "strong_draw"}:
        score += 3
    if tags["spot_type"] in {
        "facing_3bet",
        "blind_defense",
        "facing_cbet",
        "barrel_spot",
        "river_bluff_catch",
        "river_value_decision",
        "unopened_preflop_open",
        "late_position_steal",
        "squeeze_opportunity",
        "facing_squeeze",
    }:
        score += 3
    if tags["player_bucket"] == "heads_up":
        score += 1
    if tags["board_texture"] in {"wet_board", "monotone_board", "paired_board", "ace_high_dry_board"}:
        score += 1
    return score


def _legal_action_mask(raw_state: dict[str, object]) -> dict[str, float]:
    legal = raw_state["legal_actions"]
    return {
        "legal_action_fold": float(legal["can_fold"]),
        "legal_action_check": float(legal["can_check"]),
        "legal_action_call": float(legal["can_call"]),
        "legal_action_bet": float(legal["can_bet"]),
        "legal_action_raise": float(legal["can_raise"]),
    }


def _legal_size_bucket_mask(raw_state: dict[str, object], street: str) -> dict[str, float]:
    legal = raw_state["legal_actions"]
    allow_bucket_sizes = bool(legal["can_bet"] or legal["can_raise"])
    allowed = {"none"}
    if allow_bucket_sizes:
        allowed.update(LEGAL_SIZE_BUCKETS_BY_STREET.get(street, set()))
    return {
        f"legal_size_bucket_{bucket}": float(bucket in allowed)
        for bucket in POLICY_SIZE_BUCKETS
    }


def _policy_hand_class(street: str, features: dict[str, float]) -> str:
    if street == "preflop":
        bucket_index = int(features.get("preflop_bucket_index", 0.0))
        bucket_map = {
            0: "weak",
            1: "speculative",
            2: "playable",
            3: "strong",
            4: "premium",
        }
        return bucket_map.get(bucket_index, "weak")
    bucket_index = int(features.get("postflop_bucket_index", 0.0))
    bucket_map = {
        0: "air",
        1: "weak_draw",
        2: "weak_showdown_value",
        3: "medium_made_hand",
        4: "strong_draw",
        5: "strong_made_hand",
    }
    return bucket_map.get(bucket_index, "air")


def _policy_player_bucket(street: str, active_player_count: int) -> str:
    if street == "preflop":
        return "full_ring_context"
    if active_player_count <= 2:
        return "heads_up"
    if active_player_count == 3:
        return "three_way"
    return "four_way_plus"


def _policy_board_texture_tag(raw_state: dict[str, object], features: dict[str, float]) -> str:
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


def _row_matches_target(tags: dict[str, str], target_key: str) -> bool:
    if target_key == tags["spot_type"]:
        return True
    if tags.get("board_texture") == "preflop":
        summary = type("SummaryView", (), {
            "spot_type": tags["spot_type"],
            "action_context_subtype": tags.get("action_context_subtype", ""),
            "hero_position": tags["position"],
        })()
        return match_spot_target(summary, target_key, position=tags["position"])
    postflop_compatibility = {
        "cbet_spot": {"flop_cbet_opportunity"},
        "facing_cbet": {"flop_facing_cbet"},
        "multiway_flop": {"multiway_postflop_generic"},
        "checked_flop": {"flop_probe_or_delayed_cbet"},
        "barrel_spot": {"turn_barrel_opportunity"},
        "facing_second_barrel": {"turn_facing_barrel"},
        "turn_probe_or_checkback": {"turn_probe_or_delayed_barrel"},
        "river_value_decision": {"river_value_decision"},
        "river_bluff_catch": {"river_bluff_catch", "river_facing_value_or_polar"},
        "river_bluff_decision": {"river_bluff_or_giveup"},
    }
    if target_key in postflop_compatibility and tags["spot_type"] in postflop_compatibility[target_key]:
        if target_key == "multiway_flop":
            return tags.get("street") == "flop" and tags.get("player_bucket") != "heads_up"
        return True
    if target_key == "draw_pressure_flop":
        return tags.get("street") == "flop" and tags.get("hand_class") in {"strong_draw", "weak_draw"}
    if target_key == "draw_turn_decision":
        return tags.get("street") == "turn" and tags.get("hand_class") in {"strong_draw", "weak_draw"}
    if target_key == "river_showdown_hand":
        return tags.get("street") == "river" and tags.get("hand_class") in {"medium_made_hand", "weak_showdown_value"}
    return False


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
