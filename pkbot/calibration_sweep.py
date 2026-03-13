from __future__ import annotations

import csv
import json
from pathlib import Path

from .ab_test import summarize_results
from .engine import TableSimulator
from .evaluator_tuning import EvaluatorTuning
from .model_interface import EvaluatorModel
from .test_scenarios import evaluate_demo_scenarios


def default_calibration_grid() -> list[EvaluatorTuning]:
    return [
        EvaluatorTuning(name="current_like", evaluator_influence_weight=0.45, flop_continue_threshold=0.00, turn_continue_threshold=0.03, river_call_threshold=0.40, call_penalty=0.00, fold_bonus=0.00),
        EvaluatorTuning(name="reduced_influence", evaluator_influence_weight=0.32, flop_continue_threshold=0.02, turn_continue_threshold=0.05, river_call_threshold=0.44, call_penalty=0.03, fold_bonus=0.04),
        EvaluatorTuning(name="turn_river_tighter", evaluator_influence_weight=0.35, flop_continue_threshold=0.02, turn_continue_threshold=0.07, river_call_threshold=0.48, call_penalty=0.05, fold_bonus=0.06),
        EvaluatorTuning(name="river_guard", evaluator_influence_weight=0.34, flop_continue_threshold=0.01, turn_continue_threshold=0.06, river_call_threshold=0.52, call_penalty=0.05, fold_bonus=0.09),
        EvaluatorTuning(name="balanced_candidate", evaluator_influence_weight=0.28, flop_continue_threshold=0.01, turn_continue_threshold=0.05, river_call_threshold=0.46, call_penalty=0.04, fold_bonus=0.05),
        EvaluatorTuning(name="strong_fold_bias", evaluator_influence_weight=0.25, flop_continue_threshold=0.03, turn_continue_threshold=0.08, river_call_threshold=0.50, call_penalty=0.08, fold_bonus=0.12),
    ]


def strong_fold_bias_local_grid() -> list[EvaluatorTuning]:
    return [
        EvaluatorTuning(
            name="current_like_reference",
            evaluator_influence_weight=0.45,
            flop_continue_threshold=0.00,
            turn_continue_threshold=0.03,
            river_call_threshold=0.40,
            river_bluff_catch_threshold=0.40,
            call_penalty=0.00,
            marginal_call_penalty=0.00,
            fold_bonus=0.00,
            medium_strength_continue_cap=0.44,
        ),
        EvaluatorTuning(
            name="strong_fold_bias_center",
            evaluator_influence_weight=0.25,
            flop_continue_threshold=0.03,
            turn_continue_threshold=0.08,
            river_call_threshold=0.50,
            river_bluff_catch_threshold=0.54,
            call_penalty=0.08,
            marginal_call_penalty=0.03,
            fold_bonus=0.12,
            medium_strength_continue_cap=0.43,
        ),
        EvaluatorTuning(
            name="river_guard_plus",
            evaluator_influence_weight=0.24,
            flop_continue_threshold=0.03,
            turn_continue_threshold=0.08,
            river_call_threshold=0.53,
            river_bluff_catch_threshold=0.58,
            call_penalty=0.09,
            marginal_call_penalty=0.05,
            fold_bonus=0.13,
            medium_strength_continue_cap=0.42,
        ),
        EvaluatorTuning(
            name="street_weight_guard",
            evaluator_influence_weight=0.24,
            flop_evaluator_weight=0.23,
            turn_evaluator_weight=0.19,
            river_evaluator_weight=0.15,
            flop_continue_threshold=0.03,
            turn_continue_threshold=0.08,
            river_call_threshold=0.52,
            river_bluff_catch_threshold=0.57,
            call_penalty=0.09,
            marginal_call_penalty=0.04,
            fold_bonus=0.13,
            medium_strength_continue_cap=0.42,
        ),
        EvaluatorTuning(
            name="marginal_call_guard",
            evaluator_influence_weight=0.25,
            flop_evaluator_weight=0.24,
            turn_evaluator_weight=0.20,
            river_evaluator_weight=0.17,
            flop_continue_threshold=0.03,
            turn_continue_threshold=0.09,
            river_call_threshold=0.52,
            river_bluff_catch_threshold=0.57,
            call_penalty=0.10,
            marginal_call_penalty=0.08,
            fold_bonus=0.13,
            medium_strength_continue_cap=0.41,
        ),
        EvaluatorTuning(
            name="medium_cap_guard",
            evaluator_influence_weight=0.24,
            flop_evaluator_weight=0.23,
            turn_evaluator_weight=0.18,
            river_evaluator_weight=0.16,
            flop_continue_threshold=0.04,
            turn_continue_threshold=0.09,
            river_call_threshold=0.52,
            river_bluff_catch_threshold=0.58,
            call_penalty=0.09,
            marginal_call_penalty=0.07,
            fold_bonus=0.14,
            medium_strength_continue_cap=0.39,
        ),
        EvaluatorTuning(
            name="balanced_middle_candidate",
            evaluator_influence_weight=0.23,
            flop_evaluator_weight=0.22,
            turn_evaluator_weight=0.18,
            river_evaluator_weight=0.14,
            flop_continue_threshold=0.04,
            turn_continue_threshold=0.10,
            river_call_threshold=0.54,
            river_bluff_catch_threshold=0.60,
            call_penalty=0.11,
            marginal_call_penalty=0.08,
            fold_bonus=0.14,
            medium_strength_continue_cap=0.40,
        ),
        EvaluatorTuning(
            name="river_clamp_candidate",
            evaluator_influence_weight=0.22,
            flop_evaluator_weight=0.22,
            turn_evaluator_weight=0.17,
            river_evaluator_weight=0.13,
            flop_continue_threshold=0.04,
            turn_continue_threshold=0.10,
            river_call_threshold=0.56,
            river_bluff_catch_threshold=0.62,
            call_penalty=0.12,
            marginal_call_penalty=0.09,
            fold_bonus=0.15,
            medium_strength_continue_cap=0.39,
        ),
    ]


def run_calibration_sweep(
    *,
    hands: int,
    seed: int,
    evaluator_model: EvaluatorModel,
    output_dir: str | Path,
    tuning_grid: list[EvaluatorTuning] | None = None,
) -> tuple[Path, Path]:
    grid = tuning_grid or default_calibration_grid()
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)

    baseline_results = TableSimulator(seed=seed).simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    baseline_summary = summarize_results(baseline_results)
    baseline_scenarios = evaluate_demo_scenarios()

    rows: list[dict[str, object]] = []
    detailed: list[dict[str, object]] = []

    for tuning in grid:
        evaluator_results = TableSimulator(seed=seed, evaluator_model=evaluator_model, evaluator_tuning=tuning).simulate_batch(
            hands=hands,
            seed=seed,
            reset_stacks_each_hand=True,
            verbose=False,
        )
        evaluator_summary = summarize_results(evaluator_results)
        evaluator_scenarios = evaluate_demo_scenarios(evaluator_model, tuning)
        scenario_differences = []
        for (baseline_scenario, baseline_result), (_scenario, evaluator_result) in zip(baseline_scenarios, evaluator_scenarios):
            if baseline_result.action != evaluator_result.action or baseline_result.size != evaluator_result.size:
                scenario_differences.append(
                    {
                        "scenario": baseline_scenario.label,
                        "baseline_action": baseline_result.action,
                        "evaluator_action": evaluator_result.action,
                        "baseline_size": baseline_result.size,
                        "evaluator_size": evaluator_result.size,
                    }
                )

        delta = _build_delta(baseline_summary, evaluator_summary)
        row = {
            "config_name": tuning.name,
            "evaluator_influence_weight": tuning.evaluator_influence_weight,
            "flop_evaluator_weight": tuning.flop_evaluator_weight,
            "turn_evaluator_weight": tuning.turn_evaluator_weight,
            "river_evaluator_weight": tuning.river_evaluator_weight,
            "flop_continue_threshold": tuning.flop_continue_threshold,
            "turn_continue_threshold": tuning.turn_continue_threshold,
            "river_call_threshold": tuning.river_call_threshold,
            "river_bluff_catch_threshold": tuning.river_bluff_catch_threshold,
            "call_penalty": tuning.call_penalty,
            "marginal_call_penalty": tuning.marginal_call_penalty,
            "fold_bonus": tuning.fold_bonus,
            "medium_strength_continue_cap": tuning.medium_strength_continue_cap,
            "average_pot": evaluator_summary["average_pot"],
            "showdown_rate": evaluator_summary["showdown_rate"],
            "river_reach_rate": evaluator_summary["street_reach_rate"]["river"],
            "average_actions_per_hand": evaluator_summary["average_actions_per_hand"],
            "call_frequency": evaluator_summary["call_frequency"],
            "fold_frequency": evaluator_summary["fold_frequency"],
            "aggression_ratio": evaluator_summary["aggression_ratio"],
            "delta_average_pot": delta["average_pot"],
            "delta_showdown_rate": delta["showdown_rate"],
            "delta_river_reach_rate": delta["street_reach_rate"]["river"],
            "delta_average_actions_per_hand": delta["average_actions_per_hand"],
            "delta_call_frequency": delta["call_frequency"],
            "delta_fold_frequency": delta["fold_frequency"],
            "delta_aggression_ratio": delta["aggression_ratio"],
            "scenario_difference_count": len(scenario_differences),
        }
        rows.append(row)
        detailed.append(
            {
                "config": tuning.as_dict(),
                "baseline": baseline_summary,
                "evaluator": evaluator_summary,
                "delta": delta,
                "scenario_differences": scenario_differences,
            }
        )

    json_path = target / "calibration_sweep.json"
    csv_path = target / "calibration_sweep.csv"
    json_path.write_text(
        json.dumps(
            {
                "hands": hands,
                "seed": seed,
                "baseline_summary": baseline_summary,
                "results": detailed,
            },
            ensure_ascii=True,
            indent=2,
        ),
        encoding="utf-8",
    )
    _write_csv(csv_path, rows)
    return json_path, csv_path


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _build_delta(baseline: dict[str, object], evaluator: dict[str, object]) -> dict[str, object]:
    return {
        "average_pot": round(float(evaluator["average_pot"]) - float(baseline["average_pot"]), 3),
        "showdown_rate": round(float(evaluator["showdown_rate"]) - float(baseline["showdown_rate"]), 3),
        "average_actions_per_hand": round(float(evaluator["average_actions_per_hand"]) - float(baseline["average_actions_per_hand"]), 3),
        "call_frequency": round(float(evaluator["call_frequency"]) - float(baseline["call_frequency"]), 4),
        "fold_frequency": round(float(evaluator["fold_frequency"]) - float(baseline["fold_frequency"]), 4),
        "aggression_ratio": round(float(evaluator["aggression_ratio"]) - float(baseline["aggression_ratio"]), 4),
        "street_reach_rate": {
            street: round(float(value) - float(baseline["street_reach_rate"][street]), 3)
            for street, value in evaluator["street_reach_rate"].items()
        },
    }
