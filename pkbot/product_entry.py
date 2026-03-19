from __future__ import annotations

import copy
from typing import Any

from .evaluator_service import EvaluatorService
from .evaluator_tuning import EvaluatorTuning, river_clamp_candidate_tuning
from .feature_builder import FeatureBuilder
from .game_state import DecisionResult, GameState
from .model_interface import EvaluatorModel
from .policy_adapter import PolicyAdapter
from .policy_interface import PolicyModel
from .presets import PRESET_PROFILES
from .sizing_engine import SizingEngine
from .style_profile import StyleProfile
from .strategy import StrategyContextBuilder, StrategyLayer
from .test_scenarios import DemoScenario, get_demo_scenarios

STYLE_FIELDS = [
    "vpip",
    "pfr",
    "three_bet",
    "aggression",
    "flop_cbet",
    "turn_barrel",
    "river_bluff",
    "hero_call",
    "risk_tolerance",
]

DEFAULT_PRESET_KEY = "balanced_reg"
DEFAULT_SCENARIO_KEY = "flop_c_bet_spot"


def list_product_presets() -> list[dict[str, Any]]:
    presets = []
    for key, profile in PRESET_PROFILES.items():
        presets.append(
            {
                "key": key,
                "name": profile.name,
                "description": profile.describe(),
                "style_profile": serialize_style_profile(profile),
            }
        )
    return presets


def list_product_scenarios() -> list[dict[str, str]]:
    return [{"key": scenario_key(scenario), "label": scenario.label} for scenario in get_demo_scenarios()]


def default_scenario_key() -> str:
    return DEFAULT_SCENARIO_KEY


def build_product_entry_payload(
    *,
    scenario_id: str | None,
    preset_key: str | None,
    bot_mode: str | None,
    custom_profile_values: dict[str, Any] | None,
    custom_bot_name: str | None,
    evaluator_model: EvaluatorModel | None,
    policy_model: PolicyModel | None,
    evaluator_tuning: EvaluatorTuning | None = None,
) -> dict[str, Any]:
    tuning = evaluator_tuning or river_clamp_candidate_tuning()
    scenario = resolve_scenario(scenario_id)
    preset_key = preset_key if preset_key in PRESET_PROFILES else DEFAULT_PRESET_KEY
    mode = "custom" if bot_mode == "custom" else "preset"
    profile = build_active_profile(
        preset_key=preset_key,
        bot_mode=mode,
        custom_profile_values=custom_profile_values,
        custom_bot_name=custom_bot_name,
    )
    state = copy.deepcopy(scenario.state)
    state.style_profile_name = profile.name

    decision, context = analyze_decision(state, profile, evaluator_model=evaluator_model, policy_model=policy_model, evaluator_tuning=tuning)
    return {
        "current_bot": {
            "mode": mode,
            "name": profile.name,
            "preset_key": preset_key,
            "preset_name": PRESET_PROFILES[preset_key].name,
            "style_profile": serialize_style_profile(profile),
            "preset_style_profile": serialize_style_profile(PRESET_PROFILES[preset_key]),
        },
        "available_presets": list_product_presets(),
        "available_scenarios": list_product_scenarios(),
        "scenario": {
            "key": scenario_key(scenario),
            "label": scenario.label,
        },
        "game_state": serialize_game_state(state),
        "decision": serialize_decision_result(decision),
        "evaluator_summary": {
            "source": context.evaluator_snapshot.source,
            "available": context.evaluator_snapshot.available,
            "hand_bucket": context.hand_bucket,
            "hand_score": round(context.hand_score, 4),
            "board_texture": context.board_texture,
            "board_tags": context.board_tags,
            "model_outputs": decision.model_outputs,
        },
        "policy_summary": {
            "reason_tags": context.reason_tags,
            "notes": context.notes,
            "action_probabilities": decision.action_probabilities,
            "selected_size_bucket": decision.size_bucket,
            "engine_mode": "learned_policy" if policy_model is not None else "rule_scaffold",
        },
        "context_package": build_chat_context_package(
            scenario=scenario,
            state=state,
            profile=profile,
            decision=decision,
            context=context,
            preset_key=preset_key,
            bot_mode=mode,
        ),
    }


def analyze_decision(
    state: GameState,
    profile: StyleProfile,
    *,
    evaluator_model: EvaluatorModel | None,
    policy_model: PolicyModel | None,
    evaluator_tuning: EvaluatorTuning,
) -> tuple[DecisionResult, Any]:
    feature_builder = FeatureBuilder()
    evaluator_service = EvaluatorService(model=evaluator_model, feature_builder=feature_builder)
    context_builder = StrategyContextBuilder(evaluator_tuning)
    strategy_layer = StrategyLayer(
        evaluator_tuning,
        policy_adapter=PolicyAdapter(policy_model) if policy_model is not None else None,
    )
    sizing_engine = SizingEngine()

    evaluator_snapshot = evaluator_service.evaluate(state, profile)
    context = context_builder.build(state, profile, evaluator_snapshot)
    plan = strategy_layer.plan(context)

    action_weights = {action: max(weight, 0.01) for action, weight in plan.action_weights.items()}
    total = sum(action_weights.values())
    probabilities = {action: round(weight / total, 3) for action, weight in action_weights.items()}
    action = max(probabilities, key=probabilities.get)
    size_bucket = plan.size_bucket if action in {"bet", "raise"} else None
    size = sizing_engine.resolve_size(
        state,
        profile,
        action,
        size_bucket,
        context.board_texture,
        context.hand_bucket,
    )
    model_outputs = evaluator_snapshot.prediction.as_dict() if evaluator_snapshot.available and evaluator_snapshot.prediction is not None else {}
    decision = DecisionResult(
        action=action,
        size=size,
        size_bucket=size_bucket,
        action_probabilities=probabilities,
        reason_tags=context.reason_tags,
        debug_notes=context.notes,
        model_outputs=model_outputs,
    )
    return decision, context


def build_active_profile(
    *,
    preset_key: str,
    bot_mode: str,
    custom_profile_values: dict[str, Any] | None,
    custom_bot_name: str | None,
) -> StyleProfile:
    base_profile = PRESET_PROFILES[preset_key]
    if bot_mode != "custom":
        return base_profile.clone(name=custom_bot_name.strip() if custom_bot_name and custom_bot_name.strip() else base_profile.name)

    overrides = {}
    for field_name in STYLE_FIELDS:
        raw_value = (custom_profile_values or {}).get(field_name, getattr(base_profile, field_name))
        try:
            value = int(round(float(raw_value)))
        except (TypeError, ValueError):
            value = getattr(base_profile, field_name)
        overrides[field_name] = min(100, max(0, value))

    custom_name = custom_bot_name.strip() if custom_bot_name and custom_bot_name.strip() else f"{base_profile.name} Custom"
    return base_profile.clone(name=custom_name, **overrides)


def resolve_scenario(scenario_id: str | None) -> DemoScenario:
    scenario_map = {scenario_key(item): item for item in get_demo_scenarios()}
    if scenario_id in scenario_map:
        return scenario_map[scenario_id]
    if DEFAULT_SCENARIO_KEY in scenario_map:
        return scenario_map[DEFAULT_SCENARIO_KEY]
    return get_demo_scenarios()[0]


def serialize_style_profile(profile: StyleProfile) -> dict[str, Any]:
    return {"name": profile.name, **{field_name: getattr(profile, field_name) for field_name in STYLE_FIELDS}}


def serialize_game_state(state: GameState) -> dict[str, Any]:
    return {
        "street": state.street,
        "hero_name": state.hero_name,
        "hero_position": state.hero_position,
        "hero_hole_cards": [str(card) for card in state.hero_hole_cards],
        "board_cards": [str(card) for card in state.board_cards],
        "pot_size": round(state.pot_size, 2),
        "effective_stack": round(state.effective_stack, 2),
        "amount_to_call": round(state.amount_to_call, 2),
        "min_raise": round(state.min_raise, 2),
        "max_raise": round(state.max_raise, 2),
        "active_players": list(state.active_players),
        "legal_actions": state.legal_actions.available(),
        "players_to_act_behind": state.players_to_act_behind,
        "is_preflop_aggressor": state.is_preflop_aggressor,
        "facing_bet": state.facing_bet,
        "facing_raise": state.facing_raise,
        "last_aggressor_position": state.last_aggressor_position,
        "action_history": [
            {
                "street": record.street,
                "player_name": record.player_name,
                "position": record.position,
                "action": record.action,
                "amount": round(record.amount, 2),
            }
            for record in state.action_history
        ],
    }


def serialize_decision_result(result: DecisionResult) -> dict[str, Any]:
    return {
        "action": result.action,
        "size": None if result.size is None else round(result.size, 2),
        "size_bucket": result.size_bucket,
        "action_probabilities": result.action_probabilities,
        "reason_tags": result.reason_tags,
        "debug_notes": result.debug_notes,
        "model_outputs": result.model_outputs,
    }


def build_chat_context_package(
    *,
    scenario: DemoScenario,
    state: GameState,
    profile: StyleProfile,
    decision: DecisionResult,
    context: Any,
    preset_key: str,
    bot_mode: str,
) -> dict[str, Any]:
    return {
        "scenario": {"key": scenario_key(scenario), "label": scenario.label},
        "game_state": serialize_game_state(state),
        "style_profile": {
            "mode": bot_mode,
            "preset_key": preset_key,
            **serialize_style_profile(profile),
        },
        "decision": serialize_decision_result(decision),
        "evaluator_summary": {
            "source": context.evaluator_snapshot.source,
            "available": context.evaluator_snapshot.available,
            "hand_bucket": context.hand_bucket,
            "hand_score": round(context.hand_score, 4),
            "board_texture": context.board_texture,
            "board_tags": context.board_tags,
            "model_outputs": decision.model_outputs,
        },
        "policy_summary": {
            "reason_tags": context.reason_tags,
            "notes": context.notes,
            "action_probabilities": decision.action_probabilities,
            "selected_size_bucket": decision.size_bucket,
        },
    }


def scenario_key(item: DemoScenario) -> str:
    return item.label.lower().replace(" ", "_").replace("-", "_")
