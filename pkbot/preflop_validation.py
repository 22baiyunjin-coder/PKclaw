from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

from .engine import HandResult, TableSimulator
from .model_interface import EvaluatorModel
from .preflop_labeling import classify_preflop_spot_from_raw_state


def export_preflop_teacher_v2_report(
    results: Iterable[HandResult],
    output_dir: str | Path,
    *,
    dataset_name: str = "preflop_teacher_v2_dataset",
) -> tuple[Path, Path, Path, Path]:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    dataset_jsonl = target / f"{dataset_name}.jsonl"
    dataset_csv = target / f"{dataset_name}.csv"
    spot_report_path = target / "preflop_spot_report.json"
    sanity_report_path = target / "preflop_sanity_report.json"

    rows: list[dict[str, object]] = []
    with dataset_jsonl.open("w", encoding="utf-8") as handle:
        for result in results:
            for sample_index, sample in enumerate(result.decision_samples):
                if sample.street != "preflop":
                    continue
                summary = classify_preflop_spot_from_raw_state(sample.raw_state)
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
                    "preflop_spot": {
                        "spot_type": summary.spot_type,
                        "action_context_subtype": summary.action_context_subtype,
                        "opener_position": summary.opener_position,
                        "last_aggressor_position": summary.last_aggressor_position,
                        "aggressor_count": summary.aggressor_count,
                        "caller_count": summary.caller_count,
                        "fold_count": summary.fold_count,
                        "opener_is_late": summary.opener_is_late,
                    },
                }
                handle.write(json.dumps(payload, ensure_ascii=True) + "\n")
                rows.append(
                    {
                        "hand_id": result.hand_id,
                        "sample_index": sample_index,
                        "position": sample.position,
                        "profile_name": sample.profile_name,
                        "action": sample.action,
                        "size_bucket": sample.size_bucket or "none",
                        "spot_type": summary.spot_type,
                        "action_context_subtype": summary.action_context_subtype,
                        "opener_position": summary.opener_position or "",
                        "last_aggressor_position": summary.last_aggressor_position or "",
                        "aggressor_count": summary.aggressor_count,
                        "caller_count": summary.caller_count,
                        "fold_count": summary.fold_count,
                        "amount_to_call_bb": round(summary.amount_to_call_bb, 3),
                        "effective_stack_bb": round(summary.effective_stack_bb, 3),
                        "raw_state_json": json.dumps(sample.raw_state, ensure_ascii=True),
                    }
                )

    _write_csv(dataset_csv, rows)
    spot_report = build_preflop_spot_report(rows)
    sanity_report = build_preflop_sanity_report(rows)
    spot_report_path.write_text(json.dumps(spot_report, ensure_ascii=True, indent=2), encoding="utf-8")
    sanity_report_path.write_text(json.dumps(sanity_report, ensure_ascii=True, indent=2), encoding="utf-8")
    return dataset_jsonl, dataset_csv, spot_report_path, sanity_report_path


def build_preflop_spot_report(rows: list[dict[str, object]]) -> dict[str, object]:
    spot_counts = Counter(row["spot_type"] for row in rows)
    position_counts = Counter(row["position"] for row in rows)
    subtype_counts = Counter(row["action_context_subtype"] for row in rows)
    action_context_counts = Counter(f"{row['spot_type']}::{row['action_context_subtype']}" for row in rows)
    warnings = _spot_collapse_warnings(spot_counts, subtype_counts, len(rows))
    return {
        "samples": len(rows),
        "spot_type_counts": dict(sorted(spot_counts.items())),
        "position_counts": dict(sorted(position_counts.items())),
        "action_context_subtype_counts": dict(sorted(subtype_counts.items())),
        "spot_subtype_counts": dict(sorted(action_context_counts.items())),
        "warnings": warnings,
    }


def build_preflop_sanity_report(rows: list[dict[str, object]]) -> dict[str, object]:
    first_in_positions = {"UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB"}
    open_opportunities = Counter()
    open_raises = Counter()
    participation = Counter()
    facing_open_mix = defaultdict(Counter)
    facing_3bet_mix = defaultdict(Counter)
    blind_mix = defaultdict(Counter)
    steal_mix = defaultdict(Counter)

    for row in rows:
        position = str(row["position"])
        action = str(row["action"])
        spot_type = str(row["spot_type"])
        subtype = str(row["action_context_subtype"])

        if spot_type in {"unopened_preflop_open", "late_position_steal"} or subtype == "sb_first_in":
            if position in first_in_positions:
                open_opportunities[position] += 1
                if action == "raise":
                    open_raises[position] += 1
                if action in {"call", "raise"}:
                    participation[position] += 1

        if spot_type == "facing_open" or subtype.startswith("bb_vs_") or subtype.startswith("sb_vs_"):
            facing_open_mix[subtype][action] += 1
        if spot_type in {"facing_3bet", "facing_squeeze"}:
            facing_3bet_mix[subtype][action] += 1
        if position in {"SB", "BB"}:
            blind_mix[subtype][action] += 1
        if spot_type == "late_position_steal":
            steal_mix[position][action] += 1

    open_freq_by_position = {position: _ratio(open_raises[position], open_opportunities[position]) for position in sorted(open_opportunities)}
    vpip_like_by_position = {position: _ratio(participation[position], open_opportunities[position]) for position in sorted(open_opportunities)}
    warnings = _sanity_warnings(open_freq_by_position, facing_3bet_mix, blind_mix, steal_mix)
    return {
        "samples": len(rows),
        "vpip_like_first_in_by_position": vpip_like_by_position,
        "pfr_like_open_by_position": open_freq_by_position,
        "facing_open_action_mix": _normalize_counter_map(facing_open_mix),
        "facing_3bet_action_mix": _normalize_counter_map(facing_3bet_mix),
        "blind_behavior_mix": _normalize_counter_map(blind_mix),
        "late_position_steal_mix": _normalize_counter_map(steal_mix),
        "warnings": warnings,
    }


def run_preflop_teacher_v2_validation(
    *,
    hands: int,
    seed: int,
    export_dir: str,
    evaluator_model: EvaluatorModel | None = None,
) -> tuple[Path, Path, Path, Path]:
    simulator = TableSimulator(seed=seed, evaluator_model=evaluator_model)
    results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    return export_preflop_teacher_v2_report(results, export_dir)


def _spot_collapse_warnings(spot_counts: Counter, subtype_counts: Counter, total_rows: int) -> list[str]:
    warnings: list[str] = []
    required_spots = [
        "unopened_preflop_open",
        "late_position_steal",
        "facing_open",
        "facing_3bet",
        "blind_defense",
        "squeeze_opportunity",
    ]
    for spot in required_spots:
        if spot_counts.get(spot, 0) == 0:
            warnings.append(f"Missing required preflop spot type: {spot}.")
    if total_rows > 0:
        dominant_spot, dominant_count = spot_counts.most_common(1)[0]
        if dominant_count / total_rows >= 0.55:
            warnings.append(f"Preflop spot distribution is still collapsed: {dominant_spot} is {dominant_count / total_rows:.1%} of samples.")
    for subtype in ("bb_vs_late_open", "sb_vs_late_open", "btn_first_in", "co_first_in"):
        if subtype_counts.get(subtype, 0) == 0:
            warnings.append(f"Missing key action-context subtype: {subtype}.")
    for subtype in ("sb_first_in", "bb_vs_late_open", "sb_vs_late_open", "vs_late_open", "btn_first_in", "co_first_in"):
        count = subtype_counts.get(subtype, 0)
        if 0 < count < 25:
            warnings.append(f"Low coverage for key action-context subtype: {subtype} only has {count} samples.")
    return warnings


def _sanity_warnings(open_freq_by_position: dict[str, float], facing_3bet_mix: dict[str, Counter], blind_mix: dict[str, Counter], steal_mix: dict[str, Counter]) -> list[str]:
    warnings: list[str] = []
    for position in ("UTG", "UTG+1"):
        freq = open_freq_by_position.get(position)
        if freq is not None and freq > 0.40:
            warnings.append(f"{position} first-in open frequency looks too loose at {freq:.1%}.")
    for position in ("CO", "BTN"):
        freq = open_freq_by_position.get(position)
        if freq is not None and freq < 0.25:
            warnings.append(f"{position} first-in open frequency looks too tight at {freq:.1%}.")
    for subtype, counts in facing_3bet_mix.items():
        total = sum(counts.values())
        if total <= 0:
            continue
        call_share = counts["call"] / total
        fold_share = counts["fold"] / total
        if call_share >= 0.70:
            warnings.append(f"{subtype} is over-calling facing 3-bets at {call_share:.1%}.")
        if fold_share <= 0.10:
            warnings.append(f"{subtype} is under-folding facing 3-bets at {fold_share:.1%}.")
    bb_late = blind_mix.get("bb_vs_late_open")
    if bb_late:
        total = sum(bb_late.values())
        if total > 0 and (bb_late["raise"] / total) <= 0.01:
            warnings.append("BB vs late open has almost no aggressive defend branch.")
    btn_steal = steal_mix.get("BTN")
    if btn_steal:
        total = sum(btn_steal.values())
        if total > 0 and (btn_steal["raise"] / total) < 0.40:
            warnings.append("BTN late-position steal raise share still looks too low.")
    return warnings


def _normalize_counter_map(counter_map: dict[str, Counter]) -> dict[str, dict[str, float]]:
    normalized: dict[str, dict[str, float]] = {}
    for key, counts in sorted(counter_map.items()):
        total = sum(counts.values())
        normalized[key] = {action: round(count / total, 4) for action, count in sorted(counts.items())} if total else {}
    return normalized


def _ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 4)


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
