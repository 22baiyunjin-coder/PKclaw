from __future__ import annotations

import csv
import json
from pathlib import Path

from .ab_test import summarize_results
from .calibration_sweep import strong_fold_bias_local_grid
from .engine import TableSimulator
from .model_interface import EvaluatorModel


def run_candidate_validation(
    *,
    hands: int,
    seed: int,
    evaluator_model: EvaluatorModel,
    output_dir: str | Path,
) -> tuple[Path, Path]:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    tuning_by_name = {tuning.name: tuning for tuning in strong_fold_bias_local_grid()}

    engine_configs: list[tuple[str, object | None]] = [("heuristic_only", None)]
    for name in ("river_clamp_candidate", "balanced_middle_candidate"):
        tuning = tuning_by_name.get(name)
        if tuning is not None:
            engine_configs.append((name, tuning))

    detailed_results: list[dict[str, object]] = []
    csv_rows: list[dict[str, object]] = []
    baseline_summary: dict[str, object] | None = None

    for config_name, tuning in engine_configs:
        if tuning is None:
            simulator = TableSimulator(seed=seed)
        else:
            simulator = TableSimulator(seed=seed, evaluator_model=evaluator_model, evaluator_tuning=tuning)
        results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
        summary = summarize_results(results)
        if config_name == "heuristic_only":
            baseline_summary = summary

        detailed_results.append(
            {
                "engine_name": config_name,
                "tuning": None if tuning is None else tuning.as_dict(),
                "summary": summary,
            }
        )
        csv_rows.append(
            {
                "engine_name": config_name,
                "average_pot": summary["average_pot"],
                "showdown_rate": summary["showdown_rate"],
                "river_reach_rate": summary["street_reach_rate"]["river"],
                "average_actions_per_hand": summary["average_actions_per_hand"],
                "call_frequency": summary["call_frequency"],
                "fold_frequency": summary["fold_frequency"],
                "aggression_ratio": summary["aggression_ratio"],
            }
        )

    if baseline_summary is not None:
        for row in csv_rows:
            if row["engine_name"] == "heuristic_only":
                row["delta_average_pot"] = 0.0
                row["delta_showdown_rate"] = 0.0
                row["delta_river_reach_rate"] = 0.0
                row["delta_call_frequency"] = 0.0
                row["delta_fold_frequency"] = 0.0
                row["delta_aggression_ratio"] = 0.0
                continue
            row["delta_average_pot"] = round(float(row["average_pot"]) - float(baseline_summary["average_pot"]), 3)
            row["delta_showdown_rate"] = round(float(row["showdown_rate"]) - float(baseline_summary["showdown_rate"]), 3)
            row["delta_river_reach_rate"] = round(float(row["river_reach_rate"]) - float(baseline_summary["street_reach_rate"]["river"]), 3)
            row["delta_call_frequency"] = round(float(row["call_frequency"]) - float(baseline_summary["call_frequency"]), 4)
            row["delta_fold_frequency"] = round(float(row["fold_frequency"]) - float(baseline_summary["fold_frequency"]), 4)
            row["delta_aggression_ratio"] = round(float(row["aggression_ratio"]) - float(baseline_summary["aggression_ratio"]), 4)

    json_path = target / "candidate_validation.json"
    csv_path = target / "candidate_validation.csv"
    json_path.write_text(
        json.dumps(
            {
                "hands": hands,
                "seed": seed,
                "baseline_engine": "heuristic_only",
                "results": detailed_results,
            },
            ensure_ascii=True,
            indent=2,
        ),
        encoding="utf-8",
    )
    _write_csv(csv_path, csv_rows)
    return json_path, csv_path


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
