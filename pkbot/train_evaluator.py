from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import train_test_split

from .model_interface import LightGBMEvaluatorModel

TARGET_COLUMNS = [
    "equity_estimate",
    "showdown_strength_proxy",
]


def train_lightgbm_evaluator(
    dataset_path: str | Path,
    model_output_path: str | Path,
    *,
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple[LightGBMEvaluatorModel, dict[str, dict[str, float]], list[tuple[str, float]], dict[str, object]]:
    frame = _load_dataset(dataset_path)
    feature_columns = [column for column in frame.columns if column not in {"hand_id", "sample_index", "street", "player_name", "position", "profile_name", "action", "committed_amount", "selected_size", "raw_state_json", *TARGET_COLUMNS}]
    x_train, x_test, y_train, y_test = train_test_split(
        frame[feature_columns],
        frame[TARGET_COLUMNS],
        test_size=test_size,
        random_state=random_state,
    )

    models: dict[str, LGBMRegressor] = {}
    metrics: dict[str, dict[str, float]] = {}
    importances: dict[str, float] = {column: 0.0 for column in feature_columns}
    min_child_samples = max(4, min(20, len(x_train) // 12))
    num_leaves = 15 if len(x_train) < 250 else 31

    for target in TARGET_COLUMNS:
        model = LGBMRegressor(
            n_estimators=220,
            learning_rate=0.05,
            num_leaves=num_leaves,
            min_child_samples=min_child_samples,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=random_state,
            objective="regression",
            verbosity=-1,
        )
        model.fit(x_train, y_train[target])
        predictions = model.predict(x_test)
        metrics[target] = {
            "mae": round(float(mean_absolute_error(y_test[target], predictions)), 5),
            "rmse": round(float(root_mean_squared_error(y_test[target], predictions)), 5),
            "r2": round(float(r2_score(y_test[target], predictions)), 5),
        }
        for feature_name, importance in zip(feature_columns, model.feature_importances_):
            importances[feature_name] += float(importance)
        models[target] = model

    ranked_importance = sorted(
        ((name, round(score / max(len(TARGET_COLUMNS), 1), 2)) for name, score in importances.items()),
        key=lambda item: item[1],
        reverse=True,
    )
    training_summary = {
        "dataset_path": str(Path(dataset_path)),
        "train_rows": len(x_train),
        "validation_rows": len(x_test),
        "random_state": random_state,
        "test_size": test_size,
        "targets": TARGET_COLUMNS[:],
        "metrics": metrics,
        "top_feature_importance": [{"feature": name, "score": score} for name, score in ranked_importance[:20]],
    }
    trained = LightGBMEvaluatorModel(
        models=models,
        feature_names=feature_columns,
        metadata={
            "algorithm": "LightGBM",
            "targets": TARGET_COLUMNS,
            "train_rows": len(x_train),
            "test_rows": len(x_test),
            "random_state": random_state,
        },
    )
    trained.save(model_output_path)
    return trained, metrics, ranked_importance, training_summary


def print_training_report(metrics: dict[str, dict[str, float]], ranked_importance: list[tuple[str, float]], *, top_n: int = 12) -> None:
    print("Evaluator training metrics")
    for target, values in metrics.items():
        print(f"- {target}: MAE={values['mae']:.5f} RMSE={values['rmse']:.5f} R2={values['r2']:.5f}")

    print("\nTop feature importance")
    for feature_name, score in ranked_importance[:top_n]:
        print(f"- {feature_name}: {score:.2f}")


def save_training_report(report: dict[str, object], path: str | Path) -> Path:
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
                    **payload["labels"],
                }
            )
    return pd.DataFrame(rows)
