from __future__ import annotations

import json
from pathlib import Path

from .ab_test import summarize_results
from .engine import HandResult, TableSimulator
from .evaluator_tuning import EvaluatorTuning
from .model_interface import EvaluatorModel
from .policy_interface import LEGAL_SIZE_BUCKETS_BY_STREET, PolicyModel
from .test_scenarios import evaluate_demo_scenarios


def run_policy_teacher_validation(
    *,
    hands: int,
    seed: int,
    evaluator_model: EvaluatorModel,
    policy_model: PolicyModel,
    evaluator_tuning: EvaluatorTuning,
    output_path: str | Path | None = None,
) -> dict[str, object]:
    teacher_results = TableSimulator(
        seed=seed,
        evaluator_model=evaluator_model,
        evaluator_tuning=evaluator_tuning,
    ).simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    learned_results = TableSimulator(
        seed=seed,
        evaluator_model=evaluator_model,
        evaluator_tuning=evaluator_tuning,
        policy_model=policy_model,
    ).simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)

    teacher_summary = summarize_results(teacher_results)
    learned_summary = summarize_results(learned_results)
    structure_summary = _evaluate_policy_structure(teacher_results, policy_model)

    teacher_scenarios = evaluate_demo_scenarios(evaluator_model=evaluator_model, evaluator_tuning=evaluator_tuning)
    learned_scenarios = evaluate_demo_scenarios(
        evaluator_model=evaluator_model,
        evaluator_tuning=evaluator_tuning,
        policy_model=policy_model,
    )
    scenario_differences = []
    for (teacher_scenario, teacher_result), (_learned_scenario, learned_result) in zip(teacher_scenarios, learned_scenarios):
        if teacher_result.action != learned_result.action or teacher_result.size_bucket != learned_result.size_bucket:
            scenario_differences.append(
                {
                    "scenario": teacher_scenario.label,
                    "teacher_action": teacher_result.action,
                    "teacher_size_bucket": teacher_result.size_bucket,
                    "learned_action": learned_result.action,
                    "learned_size_bucket": learned_result.size_bucket,
                }
            )

    summary = {
        "hands": hands,
        "seed": seed,
        "tuning": evaluator_tuning.as_dict(),
        "teacher": teacher_summary,
        "learned": learned_summary,
        "delta": _build_delta(teacher_summary, learned_summary),
        "structure": structure_summary,
        "scenario_differences": scenario_differences,
    }
    if output_path is not None:
        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(summary, ensure_ascii=True, indent=2), encoding="utf-8")
    return summary


def _evaluate_policy_structure(results: list[HandResult], policy_model: PolicyModel) -> dict[str, object]:
    total_samples = 0
    action_matches = 0
    size_bucket_matches = 0
    illegal_action_top1 = 0
    illegal_bucket_top1 = 0

    for result in results:
        for sample in result.decision_samples:
            total_samples += 1
            features = {
                **sample.features,
                "policy_equity_estimate": float(sample.model_outputs.get("equity_estimate", 0.0)),
                "policy_showdown_strength_proxy": float(sample.model_outputs.get("showdown_strength_proxy", 0.0)),
            }
            prediction = policy_model.predict(features)
            top_action = max(prediction.action_probabilities, key=prediction.action_probabilities.get)
            top_bucket = prediction.selected_size_bucket or "none"
            legal_actions = _legal_actions_from_state(sample.raw_state)
            legal_size_buckets = _legal_size_buckets_from_state(sample.raw_state, sample.street)

            if top_action == sample.action:
                action_matches += 1
            if top_bucket == (sample.size_bucket or "none"):
                size_bucket_matches += 1
            if top_action not in legal_actions:
                illegal_action_top1 += 1
            if top_bucket not in legal_size_buckets:
                illegal_bucket_top1 += 1

    return {
        "samples": total_samples,
        "teacher_action_agreement": round(action_matches / max(total_samples, 1), 4),
        "teacher_size_bucket_agreement": round(size_bucket_matches / max(total_samples, 1), 4),
        "raw_top1_illegal_action_rate": round(illegal_action_top1 / max(total_samples, 1), 4),
        "raw_top1_illegal_size_bucket_rate": round(illegal_bucket_top1 / max(total_samples, 1), 4),
    }


def _legal_actions_from_state(raw_state: dict[str, object]) -> set[str]:
    legal = raw_state["legal_actions"]
    allowed = set()
    if legal["can_fold"]:
        allowed.add("fold")
    if legal["can_check"]:
        allowed.add("check")
    if legal["can_call"]:
        allowed.add("call")
    if legal["can_bet"]:
        allowed.add("bet")
    if legal["can_raise"]:
        allowed.add("raise")
    return allowed


def _legal_size_buckets_from_state(raw_state: dict[str, object], street: str) -> set[str]:
    legal = raw_state["legal_actions"]
    allowed = {"none"}
    if legal["can_bet"] or legal["can_raise"]:
        allowed.update(LEGAL_SIZE_BUCKETS_BY_STREET.get(street, set()))
    return allowed


def _build_delta(teacher: dict[str, object], learned: dict[str, object]) -> dict[str, object]:
    return {
        "average_pot": round(float(learned["average_pot"]) - float(teacher["average_pot"]), 3),
        "showdown_rate": round(float(learned["showdown_rate"]) - float(teacher["showdown_rate"]), 3),
        "river_reach_rate": round(float(learned["street_reach_rate"]["river"]) - float(teacher["street_reach_rate"]["river"]), 3),
        "call_frequency": round(float(learned["call_frequency"]) - float(teacher["call_frequency"]), 4),
        "fold_frequency": round(float(learned["fold_frequency"]) - float(teacher["fold_frequency"]), 4),
        "aggression_ratio": round(float(learned["aggression_ratio"]) - float(teacher["aggression_ratio"]), 4),
    }
