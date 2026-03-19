from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

from .cards import parse_cards
from .engine import HandResult, TableSimulator
from .evaluator_tuning import river_clamp_candidate_tuning
from .hand_evaluator import evaluate_postflop
from .model_interface import EvaluatorModel
from .postflop_labeling import classify_postflop_spot_from_raw_state


def export_heads_up_postflop_teacher_v2_report(
    results: Iterable[HandResult],
    output_dir: str | Path,
    *,
    dataset_name: str = "heads_up_postflop_teacher_v2_dataset",
) -> tuple[Path, Path, Path, Path]:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    dataset_jsonl = target / f"{dataset_name}.jsonl"
    dataset_csv = target / f"{dataset_name}.csv"
    spot_report_path = target / "heads_up_postflop_spot_report.json"
    sanity_report_path = target / "heads_up_postflop_sanity_report.json"

    rows: list[dict[str, object]] = []
    with dataset_jsonl.open("w", encoding="utf-8") as handle:
        for result in results:
            for sample_index, sample in enumerate(result.decision_samples):
                if sample.street == "preflop":
                    continue
                if len(sample.raw_state.get("active_players", [])) != 2:
                    continue
                summary = classify_postflop_spot_from_raw_state(sample.raw_state)
                insight = evaluate_postflop(
                    parse_cards(sample.raw_state["hero_hole_cards"]),
                    parse_cards(sample.raw_state["board_cards"]),
                )
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
                    "features": sample.features,
                    "labels": {
                        "teacher_action": sample.action,
                        "teacher_size_bucket": sample.size_bucket or "none",
                    },
                    "postflop_spot": {
                        "spot_type": summary.spot_type,
                        "action_context_subtype": summary.action_context_subtype,
                        "player_count_bucket": summary.player_count_bucket,
                        "pot_type": summary.pot_type,
                        "position_status": summary.position_status,
                        "pressure_bucket": summary.pressure_bucket,
                        "amount_to_call_share": summary.amount_to_call_share,
                        "hero_was_last_street_aggressor": summary.hero_was_last_street_aggressor,
                    },
                    "hand_insight": {
                        "category": insight.category,
                        "made_hand_class": insight.made_hand_class,
                        "draw_strength": insight.draw_strength,
                        "showdown_value": insight.showdown_value,
                    },
                }
                handle.write(json.dumps(payload, ensure_ascii=True) + "\n")
                rows.append(
                    {
                        "hand_id": result.hand_id,
                        "sample_index": sample_index,
                        "street": sample.street,
                        "position": sample.position,
                        "profile_name": sample.profile_name,
                        "action": sample.action,
                        "size_bucket": sample.size_bucket or "none",
                        "spot_type": summary.spot_type,
                        "action_context_subtype": summary.action_context_subtype,
                        "pot_type": summary.pot_type,
                        "position_status": summary.position_status,
                        "pressure_bucket": summary.pressure_bucket,
                        "amount_to_call_share": round(summary.amount_to_call_share, 4),
                        "hand_bucket": insight.category,
                        "made_hand_class": insight.made_hand_class,
                        "draw_strength": insight.draw_strength,
                        "showdown_value": insight.showdown_value,
                        "raw_state_json": json.dumps(sample.raw_state, ensure_ascii=True),
                    }
                )

    _write_csv(dataset_csv, rows)
    spot_report = build_heads_up_postflop_spot_report(rows)
    sanity_report = build_heads_up_postflop_sanity_report(rows)
    spot_report_path.write_text(json.dumps(spot_report, ensure_ascii=True, indent=2), encoding="utf-8")
    sanity_report_path.write_text(json.dumps(sanity_report, ensure_ascii=True, indent=2), encoding="utf-8")
    return dataset_jsonl, dataset_csv, spot_report_path, sanity_report_path


def build_heads_up_postflop_spot_report(rows: list[dict[str, object]]) -> dict[str, object]:
    street_counts = Counter(row["street"] for row in rows)
    spot_counts = Counter(row["spot_type"] for row in rows)
    subtype_counts = Counter(row["action_context_subtype"] for row in rows)
    hand_bucket_counts = Counter(row["hand_bucket"] for row in rows)
    warnings = _spot_warnings(rows, street_counts, spot_counts, hand_bucket_counts)
    return {
        "samples": len(rows),
        "street_counts": dict(sorted(street_counts.items())),
        "spot_type_counts": dict(sorted(spot_counts.items())),
        "action_context_subtype_counts": dict(sorted(subtype_counts.items())),
        "hand_bucket_counts": dict(sorted(hand_bucket_counts.items())),
        "warnings": warnings,
    }


def build_heads_up_postflop_sanity_report(rows: list[dict[str, object]]) -> dict[str, object]:
    cbet_mix = defaultdict(Counter)
    medium_threshold_mix = defaultdict(Counter)
    river_bluff_catch_mix = defaultdict(Counter)
    street_action_mix = defaultdict(Counter)

    for row in rows:
        street = str(row["street"])
        spot_type = str(row["spot_type"])
        subtype = str(row["action_context_subtype"])
        hand_bucket = str(row["hand_bucket"])
        action = str(row["action"])
        street_action_mix[street][action] += 1

        if spot_type == "flop_cbet_opportunity":
            cbet_mix[subtype][action] += 1

        if street in {"turn", "river"} and hand_bucket in {"medium_made_hand", "weak_showdown_value"} and row["amount_to_call_share"] > 0:
            medium_threshold_mix[f"{street}:{hand_bucket}:{row['pressure_bucket']}"][action] += 1

        if street == "river" and spot_type in {"river_bluff_catch", "river_facing_value_or_polar"} and hand_bucket in {"medium_made_hand", "weak_showdown_value"}:
            river_bluff_catch_mix[f"{hand_bucket}:{row['pressure_bucket']}"][action] += 1

    warnings = _sanity_warnings(cbet_mix, medium_threshold_mix, river_bluff_catch_mix)
    return {
        "samples": len(rows),
        "street_action_mix": _normalize_counter_map(street_action_mix),
        "flop_cbet_mix": _normalize_counter_map(cbet_mix),
        "turn_river_medium_strength_mix": _normalize_counter_map(medium_threshold_mix),
        "river_bluff_catch_mix": _normalize_counter_map(river_bluff_catch_mix),
        "warnings": warnings,
    }


def run_heads_up_postflop_teacher_v2_validation(
    *,
    hands: int,
    seed: int,
    export_dir: str,
    evaluator_model: EvaluatorModel | None = None,
) -> tuple[Path, Path, Path, Path]:
    simulator = TableSimulator(
        seed=seed,
        evaluator_model=evaluator_model,
        evaluator_tuning=river_clamp_candidate_tuning(),
    )
    results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    return export_heads_up_postflop_teacher_v2_report(results, export_dir)


def _spot_warnings(
    rows: list[dict[str, object]],
    street_counts: Counter,
    spot_counts: Counter,
    hand_bucket_counts: Counter,
) -> list[str]:
    warnings: list[str] = []
    if not rows:
        return ["No heads-up postflop samples were collected."]
    required_spots = [
        "flop_cbet_opportunity",
        "flop_facing_cbet",
        "turn_barrel_opportunity",
        "turn_facing_barrel",
        "river_bluff_catch",
    ]
    for spot in required_spots:
        if spot_counts.get(spot, 0) == 0:
            warnings.append(f"Missing required heads-up postflop spot: {spot}.")
    for street in ("flop", "turn", "river"):
        if street_counts.get(street, 0) == 0:
            warnings.append(f"Missing heads-up postflop street coverage on {street}.")
    if hand_bucket_counts.get("medium_made_hand", 0) == 0:
        warnings.append("No medium-strength heads-up postflop samples were collected.")
    return warnings


def _sanity_warnings(
    cbet_mix: dict[str, Counter],
    medium_threshold_mix: dict[str, Counter],
    river_bluff_catch_mix: dict[str, Counter],
) -> list[str]:
    warnings: list[str] = []
    for subtype, counts in cbet_mix.items():
        total = sum(counts.values())
        if total <= 0:
            continue
        bet_share = (counts["bet"] + counts["raise"]) / total
        if bet_share <= 0.20:
            warnings.append(f"{subtype} c-bet share looks too low at {bet_share:.1%}.")
    for key, counts in medium_threshold_mix.items():
        total = sum(counts.values())
        if total <= 0:
            continue
        call_share = counts["call"] / total
        fold_share = counts["fold"] / total
        if key.startswith("turn:") and call_share >= 0.60:
            warnings.append(f"{key} still over-calls turn medium-strength spots at {call_share:.1%}.")
        if key.startswith("river:") and fold_share <= 0.30:
            warnings.append(f"{key} under-folds river medium-strength spots at {fold_share:.1%}.")
    for key, counts in river_bluff_catch_mix.items():
        total = sum(counts.values())
        if total <= 0:
            continue
        call_share = counts["call"] / total
        if "large" in key and call_share >= 0.35:
            warnings.append(f"{key} is too sticky versus large river pressure at {call_share:.1%}.")
    return warnings


def _normalize_counter_map(counter_map: dict[str, Counter]) -> dict[str, dict[str, float]]:
    normalized: dict[str, dict[str, float]] = {}
    for key, counts in sorted(counter_map.items()):
        total = sum(counts.values())
        normalized[key] = {action: round(count / total, 4) for action, count in sorted(counts.items())} if total else {}
    return normalized


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
