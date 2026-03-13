from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split

from .policy_interface import POLICY_ACTIONS, POLICY_SIZE_BUCKETS, LightGBMPolicyModel

TARGET_COLUMNS = {"action", "size_bucket"}


def train_lightgbm_policy(
    dataset_path: str | Path,
    model_output_path: str | Path,
    *,
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple[LightGBMPolicyModel, dict[str, dict[str, float]], list[tuple[str, float]], dict[str, object]]:
    frame = _load_dataset(dataset_path)
    feature_columns = [
        column
        for column in frame.columns
        if column
        not in {
            "hand_id",
            "sample_index",
            "street",
            "player_name",
            "position",
            "profile_name",
            "raw_state_json",
            "selected_size",
            "committed_amount",
            *TARGET_COLUMNS,
        }
        and not column.startswith("target_prob_")
    ]

    action_targets = frame["action"].map({action: index for index, action in enumerate(POLICY_ACTIONS)})
    size_targets = frame["size_bucket"].map({bucket: index for index, bucket in enumerate(POLICY_SIZE_BUCKETS)}).fillna(0).astype(int)

    x_train, x_test, y_action_train, y_action_test, y_size_train, y_size_test = train_test_split(
        frame[feature_columns],
        action_targets,
        size_targets,
        test_size=test_size,
        random_state=random_state,
        stratify=action_targets,
    )

    min_child_samples = max(6, min(24, len(x_train) // 12))
    action_model = LGBMClassifier(
        n_estimators=260,
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=min_child_samples,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=random_state,
        objective="multiclass",
        verbosity=-1,
    )
    size_model = LGBMClassifier(
        n_estimators=220,
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=min_child_samples,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=random_state,
        objective="multiclass",
        verbosity=-1,
    )

    action_model.fit(x_train, y_action_train)
    size_model.fit(x_train, y_size_train)

    action_predictions = action_model.predict(x_test)
    action_probabilities = action_model.predict_proba(x_test)
    size_predictions = size_model.predict(x_test)
    size_probabilities = size_model.predict_proba(x_test)

    metrics = {
        "action": {
            "accuracy": round(float(accuracy_score(y_action_test, action_predictions)), 5),
            "log_loss": round(float(log_loss(y_action_test, action_probabilities, labels=list(action_model.classes_))), 5),
        },
        "size_bucket": {
            "accuracy": round(float(accuracy_score(y_size_test, size_predictions)), 5),
            "log_loss": round(float(log_loss(y_size_test, size_probabilities, labels=list(size_model.classes_))), 5),
        },
    }
    non_none_mask = y_size_test != 0
    if int(non_none_mask.sum()) > 0:
        metrics["size_bucket"]["non_none_accuracy"] = round(
            float(accuracy_score(y_size_test[non_none_mask], size_predictions[non_none_mask])),
            5,
        )
        metrics["size_bucket"]["non_none_log_loss"] = round(
            float(log_loss(y_size_test[non_none_mask], size_probabilities[non_none_mask], labels=list(size_model.classes_))),
            5,
        )

    importances: dict[str, float] = {column: 0.0 for column in feature_columns}
    for feature_name, importance in zip(feature_columns, action_model.feature_importances_):
        importances[feature_name] += float(importance)
    for feature_name, importance in zip(feature_columns, size_model.feature_importances_):
        importances[feature_name] += float(importance)
    ranked_importance = sorted(
        ((name, round(score / 2.0, 2)) for name, score in importances.items()),
        key=lambda item: item[1],
        reverse=True,
    )

    trained = LightGBMPolicyModel(
        action_model=action_model,
        size_bucket_model=size_model,
        feature_names=feature_columns,
        metadata={
            "algorithm": "LightGBM",
            "targets": ["action", "size_bucket"],
            "train_rows": len(x_train),
            "test_rows": len(x_test),
            "random_state": random_state,
        },
    )
    trained.save(model_output_path)
    report = {
        "dataset_path": str(Path(dataset_path)),
        "train_rows": len(x_train),
        "validation_rows": len(x_test),
        "random_state": random_state,
        "test_size": test_size,
        "metrics": metrics,
        "top_feature_importance": [{"feature": name, "score": score} for name, score in ranked_importance[:20]],
    }
    return trained, metrics, ranked_importance, report


def print_policy_training_report(metrics: dict[str, dict[str, float]], ranked_importance: list[tuple[str, float]], *, top_n: int = 12) -> None:
    print("Policy training metrics")
    print(f"- action: accuracy={metrics['action']['accuracy']:.5f} log_loss={metrics['action']['log_loss']:.5f}")
    print(f"- size_bucket: accuracy={metrics['size_bucket']['accuracy']:.5f} log_loss={metrics['size_bucket']['log_loss']:.5f}")
    if "non_none_accuracy" in metrics["size_bucket"]:
        print(
            "- size_bucket (non-none): "
            f"accuracy={metrics['size_bucket']['non_none_accuracy']:.5f} "
            f"log_loss={metrics['size_bucket']['non_none_log_loss']:.5f}"
        )

    print("\nTop feature importance")
    for feature_name, score in ranked_importance[:top_n]:
        print(f"- {feature_name}: {score:.2f}")


def save_policy_training_report(report: dict[str, object], path: str | Path) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding="utf-8")
    return target


def _load_dataset(path: str | Path) -> pd.DataFrame:
    source = Path(path)
    if source.suffix.lower() == ".csv":
        return pd.read_csv(source)

    rows: list[dict[str, object]] = []
    with source.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            payload = json.loads(line)
            rows.append(
                {
                    **payload["meta"],
                    "raw_state_json": json.dumps(payload["raw_state"], ensure_ascii=True),
                    **payload["features"],
                    **payload["targets"],
                }
            )
    return pd.DataFrame(rows)
