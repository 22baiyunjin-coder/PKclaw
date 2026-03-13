from __future__ import annotations

import json
from pathlib import Path

from .engine import HandResult, TableSimulator
from .evaluator_tuning import EvaluatorTuning
from .model_interface import EvaluatorModel
from .test_scenarios import evaluate_demo_scenarios


def run_engine_ab_test(
    *,
    hands: int,
    seed: int,
    evaluator_model: EvaluatorModel,
    evaluator_tuning: EvaluatorTuning | None = None,
    output_path: str | Path | None = None,
) -> dict[str, object]:
    baseline_results = TableSimulator(seed=seed).simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    evaluator_results = TableSimulator(seed=seed, evaluator_model=evaluator_model, evaluator_tuning=evaluator_tuning).simulate_batch(
        hands=hands,
        seed=seed,
        reset_stacks_each_hand=True,
        verbose=False,
    )

    baseline_scenarios = evaluate_demo_scenarios()
    evaluator_scenarios = evaluate_demo_scenarios(evaluator_model, evaluator_tuning)
    scenario_differences = []
    for (baseline_scenario, baseline_result), (_evaluator_scenario, evaluator_result) in zip(baseline_scenarios, evaluator_scenarios):
        if baseline_result.action != evaluator_result.action or baseline_result.size != evaluator_result.size:
            scenario_differences.append(
                {
                    "scenario": baseline_scenario.label,
                    "baseline_action": baseline_result.action,
                    "baseline_size": baseline_result.size,
                    "evaluator_action": evaluator_result.action,
                    "evaluator_size": evaluator_result.size,
                }
            )

    summary = {
        "hands": hands,
        "seed": seed,
        "tuning": evaluator_tuning.as_dict() if evaluator_tuning is not None else None,
        "baseline": summarize_results(baseline_results),
        "evaluator": summarize_results(evaluator_results),
        "scenario_differences": scenario_differences,
    }
    summary["delta"] = _build_delta(summary["baseline"], summary["evaluator"])

    if output_path is not None:
        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(summary, ensure_ascii=True, indent=2), encoding="utf-8")
    return summary


def summarize_results(results: list[HandResult]) -> dict[str, object]:
    total_hands = max(1, len(results))
    total_pot = sum(result.pot for result in results)
    total_actions = 0
    showdown_count = 0
    street_reach = {"flop": 0, "turn": 0, "river": 0}
    action_mix = {"fold": 0, "check": 0, "call": 0, "bet": 0, "raise": 0}

    for result in results:
        if result.showdown:
            showdown_count += 1
        seen_streets = {sample.street for sample in result.decision_samples}
        for street in street_reach:
            if street in seen_streets:
                street_reach[street] += 1
        total_actions += len(result.decision_samples)
        for sample in result.decision_samples:
            action_mix[sample.action] += 1

    call_frequency = round(action_mix["call"] / max(total_actions, 1), 4)
    fold_frequency = round(action_mix["fold"] / max(total_actions, 1), 4)
    aggression_ratio = round((action_mix["bet"] + action_mix["raise"]) / max(action_mix["call"], 1), 4)
    return {
        "average_pot": round(total_pot / total_hands, 3),
        "showdown_rate": round(showdown_count / total_hands, 3),
        "average_actions_per_hand": round(total_actions / total_hands, 3),
        "street_reach_rate": {street: round(count / total_hands, 3) for street, count in street_reach.items()},
        "action_mix": action_mix,
        "call_frequency": call_frequency,
        "fold_frequency": fold_frequency,
        "aggression_ratio": aggression_ratio,
    }


def _build_delta(baseline: dict[str, object], evaluator: dict[str, object]) -> dict[str, object]:
    delta = {
        "average_pot": round(float(evaluator["average_pot"]) - float(baseline["average_pot"]), 3),
        "showdown_rate": round(float(evaluator["showdown_rate"]) - float(baseline["showdown_rate"]), 3),
        "average_actions_per_hand": round(float(evaluator["average_actions_per_hand"]) - float(baseline["average_actions_per_hand"]), 3),
        "call_frequency": round(float(evaluator["call_frequency"]) - float(baseline["call_frequency"]), 4),
        "fold_frequency": round(float(evaluator["fold_frequency"]) - float(baseline["fold_frequency"]), 4),
        "aggression_ratio": round(float(evaluator["aggression_ratio"]) - float(baseline["aggression_ratio"]), 4),
        "street_reach_rate": {},
        "action_mix": {},
    }
    for street, value in evaluator["street_reach_rate"].items():
        delta["street_reach_rate"][street] = round(float(value) - float(baseline["street_reach_rate"][street]), 3)
    for action, value in evaluator["action_mix"].items():
        delta["action_mix"][action] = int(value) - int(baseline["action_mix"][action])
    return delta
