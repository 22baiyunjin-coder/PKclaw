from __future__ import annotations

from .policy_interface import LEGAL_SIZE_BUCKETS_BY_STREET, PolicyModel
from .strategy.types import PolicyPlan, StrategyContext


class PolicyAdapter:
    def __init__(self, policy_model: PolicyModel, *, heuristic_blend: float = 0.35) -> None:
        self.policy_model = policy_model
        self.heuristic_blend = min(1.0, max(0.0, heuristic_blend))

    def adapt(self, context: StrategyContext, heuristic_plan: PolicyPlan) -> PolicyPlan:
        features = dict(context.evaluator_snapshot.features)
        prediction = context.evaluator_snapshot.prediction
        if prediction is not None:
            features["policy_equity_estimate"] = prediction.equity_estimate
            features["policy_showdown_strength_proxy"] = prediction.showdown_strength_proxy
        else:
            features["policy_equity_estimate"] = 0.0
            features["policy_showdown_strength_proxy"] = 0.0

        raw_prediction = self.policy_model.predict(features)
        legal_actions = set(context.state.legal_actions.available())
        learned_weights = {
            action: probability
            for action, probability in raw_prediction.action_probabilities.items()
            if action in legal_actions
        }
        if not learned_weights:
            return heuristic_plan

        heuristic_total = sum(max(value, 0.0) for value in heuristic_plan.action_weights.values()) or 1.0
        heuristic_probs = {
            action: max(value, 0.0) / heuristic_total
            for action, value in heuristic_plan.action_weights.items()
            if action in legal_actions
        }
        blended_weights: dict[str, float] = {}
        for action in legal_actions:
            learned_value = learned_weights.get(action, 0.0)
            heuristic_value = heuristic_probs.get(action, 0.0)
            blended_weights[action] = round(
                learned_value * (1.0 - self.heuristic_blend) + heuristic_value * self.heuristic_blend,
                6,
            )

        selected_bucket = raw_prediction.selected_size_bucket or heuristic_plan.size_bucket
        allowed_buckets = {"none", *LEGAL_SIZE_BUCKETS_BY_STREET.get(context.state.street, set())}
        if selected_bucket is not None and selected_bucket not in allowed_buckets:
            selected_bucket = heuristic_plan.size_bucket
        if selected_bucket == "none":
            selected_bucket = None
        context.reason_tags.append("policy_model_assisted")
        context.notes.append(
            f"Policy adapter blend={1.0 - self.heuristic_blend:.2f} learned / {self.heuristic_blend:.2f} heuristic."
        )
        return PolicyPlan(action_weights=blended_weights, size_bucket=selected_bucket)
