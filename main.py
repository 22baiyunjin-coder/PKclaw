from __future__ import annotations

import argparse
import json
import os
from functools import lru_cache, partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from random import Random
from urllib.parse import parse_qs, urlparse

from pkbot.ab_test import run_engine_ab_test
from pkbot.calibration_sweep import run_calibration_sweep, strong_fold_bias_local_grid
from pkbot.candidate_validation import run_candidate_validation
from pkbot.chat_service import ChatServiceError, chat_about_hand, export_chat_sft_dataset, get_chat_status
from pkbot.dataset_export import count_samples_by_street, export_evaluator_dataset
from pkbot.engine import TableSimulator
from pkbot.evaluator_tuning import river_clamp_candidate_tuning
from pkbot.exporter import export_hand_results
from pkbot.heads_up_postflop_validation import run_heads_up_postflop_teacher_v2_validation
from pkbot.live_bridge import build_live_decision_payload
from pkbot.model_interface import load_evaluator_model
from pkbot.product_entry import build_product_entry_payload
from pkbot.policy_dataset_export import POLICY_V1_1_SPOT_TARGETS, export_policy_dataset
from pkbot.policy_interface import load_policy_model
from pkbot.policy_validation import run_policy_teacher_validation
from pkbot.preflop_validation import run_preflop_teacher_v2_validation
from pkbot.replay import build_hand_replay
from pkbot.test_scenarios import run_demo_scenarios
from pkbot.train_policy import print_policy_training_report, save_policy_training_report, train_lightgbm_policy
from pkbot.train_evaluator import print_training_report, save_training_report, train_lightgbm_evaluator

HOST = "0.0.0.0"
PORT = 8000
DEFAULT_EVALUATOR_MODEL_CANDIDATES = [
    "outputs/evaluator_v1/evaluator_v1_baseline.joblib",
    "outputs/evaluator_v1/evaluator_model.joblib",
]
DEFAULT_POLICY_MODEL_CANDIDATES = [
    "outputs/policy_v1_1/policy_model_v1_1.joblib",
    "outputs/policy_baseline_v1/policy_baseline_v1.joblib",
    "outputs/policy_v1/policy_model_v1.joblib",
]


class DemoRequestHandler(SimpleHTTPRequestHandler):
    server_version = "PKclawDemo/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/replay":
            self._serve_replay(parsed.query)
            return
        if parsed.path in {"/health", "/api/health"}:
            self._serve_health()
            return
        if parsed.path == "/api/product-state":
            self._serve_product_state()
            return
        if parsed.path == "/api/chat/status":
            self._serve_chat_status()
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/product-state":
            self._handle_product_state_request()
            return
        if parsed.path == "/api/decision":
            self._handle_decision_request()
            return
        if parsed.path == "/api/chat":
            self._handle_chat_request()
            return
        self.send_error(404, "Unknown API endpoint")

    def _serve_replay(self, query: str) -> None:
        params = parse_qs(query)
        seed_values = params.get("seed")
        if seed_values:
            try:
                seed = int(seed_values[0])
            except ValueError:
                seed = Random().randint(1, 10_000_000)
        else:
            seed = Random().randint(1, 10_000_000)

        simulator = TableSimulator(seed=seed)
        result = simulator.simulate_hand(hand_seed=seed, verbose=False)
        payload = {"seed": seed, "replay": build_hand_replay(result)}
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_chat_status(self) -> None:
        try:
            status = get_chat_status().to_dict()
            self._send_json(200, status)
        except ChatServiceError as exc:
            self._send_json(
                400,
                {
                    "provider": "remote",
                    "configured": False,
                    "model": "",
                    "base_url": "",
                    "message": str(exc),
                },
            )

    def _serve_health(self) -> None:
        self._send_json(
            200,
            {
                "status": "ok",
                "service": "pkclaw-backend",
                "host": HOST,
                "port": PORT,
                "chat": get_chat_status().to_dict() if _can_read_chat_status() else None,
            },
        )

    def _handle_chat_request(self) -> None:
        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        messages = payload.get("messages", [])
        context_package = payload.get("context_package")
        hand_context = payload.get("hand_context")
        request_type = payload.get("request_type")
        request_meta = payload.get("request_meta")
        try:
            completion = chat_about_hand(
                messages,
                context_package=context_package,
                hand_context=hand_context,
                request_type=request_type,
                request_meta=request_meta,
            )
        except ChatServiceError as exc:
            try:
                status_payload = get_chat_status().to_dict()
            except ChatServiceError:
                status_payload = {
                    "provider": "remote",
                    "configured": False,
                    "model": "",
                    "base_url": "",
                    "message": str(exc),
                }
            self._send_json(
                400,
                {
                    "error": str(exc),
                    "status": status_payload,
                },
            )
            return
        except Exception as exc:  # pragma: no cover - defensive API guard
            self._send_json(500, {"error": f"Unexpected chat server error: {exc}"})
            return

        self._send_json(
            200,
            {
                "reply": completion.to_dict(),
                "status": get_chat_status().to_dict(),
            },
        )

    def _serve_product_state(self) -> None:
        self._send_product_state({})

    def _handle_product_state_request(self) -> None:
        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_product_state(payload)

    def _handle_decision_request(self) -> None:
        try:
            payload = self._read_json_body()
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        try:
            response_payload = build_live_decision_payload(
                payload,
                evaluator_model=_load_default_product_evaluator(),
                policy_model=_load_default_product_policy(),
            )
        except Exception as exc:  # pragma: no cover - defensive API guard
            self._send_json(500, {"error": f"Failed to build live decision: {exc}"})
            return

        self._send_json(200, response_payload)

    def _send_product_state(self, payload: dict) -> None:
        try:
            response_payload = build_product_entry_payload(
                scenario_id=payload.get("scenario_id"),
                preset_key=payload.get("preset_key"),
                bot_mode=payload.get("bot_mode"),
                custom_profile_values=payload.get("custom_profile"),
                custom_bot_name=payload.get("custom_bot_name"),
                evaluator_model=_load_default_product_evaluator(),
                policy_model=_load_default_product_policy(),
            )
        except Exception as exc:  # pragma: no cover - defensive API guard
            self._send_json(500, {"error": f"Failed to build product state: {exc}"})
            return
        self._send_json(200, response_payload)

    def _read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Request body must be valid JSON.") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def serve_ui() -> None:
    root_dir = Path(__file__).resolve().parent
    handler = partial(DemoRequestHandler, directory=str(root_dir))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    print(f"PKclaw demo running at http://{HOST}:{PORT}/demo/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down demo server.")
    finally:
        server.server_close()


def _can_read_chat_status() -> bool:
    try:
        get_chat_status()
        return True
    except ChatServiceError:
        return False


def _load_model_if_requested(model_path: str | None):
    if not model_path:
        return None
    return _load_evaluator_model_cached(str(Path(model_path)))


def _load_policy_if_requested(policy_path: str | None):
    if not policy_path:
        return None
    return _load_policy_model_cached(str(Path(policy_path)))


@lru_cache(maxsize=8)
def _load_evaluator_model_cached(model_path: str):
    return load_evaluator_model(model_path)


@lru_cache(maxsize=8)
def _load_policy_model_cached(policy_path: str):
    return load_policy_model(policy_path)


def _resolve_existing_model_path(candidates: list[str]) -> str | None:
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def _load_default_product_evaluator():
    model_path = _resolve_existing_model_path(DEFAULT_EVALUATOR_MODEL_CANDIDATES)
    return _load_model_if_requested(model_path)


def _load_default_product_policy():
    policy_path = _resolve_existing_model_path(DEFAULT_POLICY_MODEL_CANDIDATES)
    return _load_policy_if_requested(policy_path)


def run_simulation(hands: int, seed: int, export_dir: str | None, model_path: str | None = None, policy_path: str | None = None) -> None:
    simulator = TableSimulator(
        seed=seed,
        evaluator_model=_load_model_if_requested(model_path),
        policy_model=_load_policy_if_requested(policy_path),
    )
    results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=hands <= 3)
    for index, result in enumerate(results, start=1):
        print(f"\nHand {index} summary")
        print(f"Board: {' '.join(str(card) for card in result.board)}")
        print(f"Winners: {', '.join(result.winners)} | Pot: {result.pot:.2f} BB | Showdown: {result.showdown}")
        print("Stacks:")
        for name, stack in result.stacks.items():
            print(f"  {name}: {stack:.2f} BB")
        print("-" * 60)
    if export_dir:
        hand_path, decision_path, hand_csv_path, summary_csv_path, summary_json_path = export_hand_results(results, export_dir)
        print(f"Exported hand history to {hand_path}")
        print(f"Exported decision samples to {decision_path}")
        print(f"Exported hand summary CSV to {hand_csv_path}")
        print(f"Exported profile summary CSV to {summary_csv_path}")
        print(f"Exported profile summary JSON to {summary_json_path}")


def run_evaluator_dataset_export(
    hands: int,
    seed: int,
    export_dir: str,
    rollout_trials: int,
    model_path: str | None = None,
) -> tuple[Path, Path]:
    simulator = TableSimulator(seed=seed, evaluator_model=_load_model_if_requested(model_path))
    results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    export_hand_results(results, export_dir)
    dataset_jsonl, dataset_csv, _metadata = export_evaluator_dataset(results, export_dir, rollout_trials=rollout_trials, seed=seed)
    print(f"Exported evaluator dataset JSONL to {dataset_jsonl}")
    print(f"Exported evaluator dataset CSV to {dataset_csv}")
    return dataset_jsonl, dataset_csv


def run_policy_dataset_export(
    hands: int,
    seed: int,
    export_dir: str,
    model_path: str,
    dataset_name: str = "policy_dataset",
    street_targets: int | dict[str, int] | None = None,
) -> tuple[Path, Path, Path]:
    simulator = TableSimulator(
        seed=seed,
        evaluator_model=_load_model_if_requested(model_path),
        evaluator_tuning=river_clamp_candidate_tuning(),
    )
    results = simulator.simulate_batch(hands=hands, seed=seed, reset_stacks_each_hand=True, verbose=False)
    export_hand_results(results, export_dir)
    dataset_jsonl, dataset_csv, metadata_path = export_policy_dataset(
        results,
        export_dir,
        dataset_name=dataset_name,
        target_samples_per_street=street_targets,
        seed=seed,
    )
    print(f"Exported policy dataset JSONL to {dataset_jsonl}")
    print(f"Exported policy dataset CSV to {dataset_csv}")
    print(f"Exported policy dataset metadata to {metadata_path}")
    return dataset_jsonl, dataset_csv, metadata_path


def run_build_policy_dataset_v1(
    max_hands: int,
    batch_size: int,
    seed: int,
    export_dir: str,
    street_targets: dict[str, int],
    model_path: str,
    dataset_name: str = "policy_dataset_v1",
    spot_targets: dict[str, dict[str, int]] | None = None,
) -> tuple[Path, Path, Path]:
    simulator = TableSimulator(
        seed=seed,
        evaluator_model=_load_model_if_requested(model_path),
        evaluator_tuning=river_clamp_candidate_tuning(),
    )
    results = []
    hands_generated = 0

    while hands_generated < max_hands:
        current_batch = min(batch_size, max_hands - hands_generated)
        results.extend(simulator.simulate_batch(hands=current_batch, seed=seed + hands_generated, reset_stacks_each_hand=True, verbose=False))
        hands_generated += current_batch
        street_counts = count_samples_by_street(results)
        if all(street_counts[street] >= target for street, target in street_targets.items()):
            break

    export_hand_results(results, export_dir)
    dataset_jsonl, dataset_csv, metadata_path = export_policy_dataset(
        results,
        export_dir,
        dataset_name=dataset_name,
        target_samples_per_street=street_targets,
        seed=seed,
        spot_targets=spot_targets,
    )
    final_counts = count_samples_by_street(results)
    print(f"Policy dataset v1 candidate street coverage: {final_counts}")
    print(f"Exported policy dataset v1 JSONL to {dataset_jsonl}")
    print(f"Exported policy dataset v1 CSV to {dataset_csv}")
    print(f"Exported policy dataset v1 metadata to {metadata_path}")
    if any(final_counts[street] < target for street, target in street_targets.items()):
        print("Warning: max_hands reached before hitting the target samples per street.")
    return dataset_jsonl, dataset_csv, metadata_path


def run_build_dataset_v1(
    max_hands: int,
    batch_size: int,
    seed: int,
    export_dir: str,
    street_targets: dict[str, int],
    rollout_trials: int,
) -> tuple[Path, Path, Path]:
    simulator = TableSimulator(seed=seed)
    results = []
    hands_generated = 0

    while hands_generated < max_hands:
        current_batch = min(batch_size, max_hands - hands_generated)
        results.extend(simulator.simulate_batch(hands=current_batch, seed=seed + hands_generated, reset_stacks_each_hand=True, verbose=False))
        hands_generated += current_batch
        street_counts = count_samples_by_street(results)
        if all(street_counts[street] >= target for street, target in street_targets.items()):
            break

    export_hand_results(results, export_dir)
    dataset_jsonl, dataset_csv, metadata_path = export_evaluator_dataset(
        results,
        export_dir,
        rollout_trials=rollout_trials,
        seed=seed,
        target_samples_per_street=street_targets,
        dataset_name="dataset_v1",
    )
    final_counts = count_samples_by_street(results)
    print(f"Dataset v1 candidate street coverage: {final_counts}")
    print(f"Exported dataset v1 JSONL to {dataset_jsonl}")
    print(f"Exported dataset v1 CSV to {dataset_csv}")
    print(f"Exported dataset v1 metadata to {metadata_path}")
    if any(final_counts[street] < target for street, target in street_targets.items()):
        print("Warning: max_hands reached before hitting the target samples per street.")
    return dataset_jsonl, dataset_csv, metadata_path


def run_training(dataset_path: str, model_output_path: str, seed: int) -> tuple[Path, Path]:
    _trained_model, metrics, importances, report = train_lightgbm_evaluator(dataset_path, model_output_path, random_state=seed)
    print_training_report(metrics, importances)
    saved_path = Path(model_output_path)
    report_path = save_training_report(report, saved_path.with_name(f"{saved_path.stem}_report.json"))
    print(f"\nSaved evaluator model to {saved_path}")
    print(f"Saved evaluator report to {report_path}")
    return saved_path, report_path


def run_policy_training(dataset_path: str, model_output_path: str, seed: int) -> tuple[Path, Path]:
    _trained_model, metrics, importances, report = train_lightgbm_policy(dataset_path, model_output_path, random_state=seed)
    print_policy_training_report(metrics, importances)
    saved_path = Path(model_output_path)
    report_path = save_policy_training_report(report, saved_path.with_name(f"{saved_path.stem}_report.json"))
    print(f"\nSaved policy model to {saved_path}")
    print(f"Saved policy report to {report_path}")
    return saved_path, report_path


def run_policy_validation(hands: int, seed: int, model_path: str, policy_path: str, output_path: str | None) -> None:
    summary = run_policy_teacher_validation(
        hands=hands,
        seed=seed,
        evaluator_model=load_evaluator_model(model_path),
        policy_model=load_policy_model(policy_path),
        evaluator_tuning=river_clamp_candidate_tuning(),
        output_path=output_path,
    )
    print("Teacher vs learned policy validation")
    print(json.dumps(summary, ensure_ascii=True, indent=2))


def run_evaluator_demo(hands: int, seed: int, export_dir: str, rollout_trials: int) -> None:
    dataset_jsonl, _dataset_csv, _metadata = run_build_dataset_v1(
        max_hands=hands,
        batch_size=min(50, max(10, hands)),
        seed=seed,
        export_dir=export_dir,
        street_targets={
            "preflop": max(10, hands // 2),
            "flop": max(10, hands // 2),
            "turn": max(8, hands // 3),
            "river": max(6, hands // 4),
        },
        rollout_trials=rollout_trials,
    )
    model_output = str(Path(export_dir) / "evaluator_model.joblib")
    model_path, _report_path = run_training(str(dataset_jsonl), model_output, seed)
    print("\nRunning scenarios with the trained evaluator\n")
    run_demo_scenarios(evaluator_model=load_evaluator_model(model_path))


def run_ab_test(hands: int, seed: int, model_path: str, output_path: str | None) -> None:
    summary = run_engine_ab_test(
        hands=hands,
        seed=seed,
        evaluator_model=load_evaluator_model(model_path),
        output_path=output_path,
    )
    print("A/B test summary")
    print(json.dumps(summary, ensure_ascii=True, indent=2))


def run_calibration(hands: int, seed: int, model_path: str, output_dir: str) -> None:
    json_path, csv_path = run_calibration_sweep(
        hands=hands,
        seed=seed,
        evaluator_model=load_evaluator_model(model_path),
        output_dir=output_dir,
    )
    print(f"Saved calibration sweep JSON to {json_path}")
    print(f"Saved calibration sweep CSV to {csv_path}")


def run_local_calibration(hands: int, seed: int, model_path: str, output_dir: str) -> None:
    json_path, csv_path = run_calibration_sweep(
        hands=hands,
        seed=seed,
        evaluator_model=load_evaluator_model(model_path),
        output_dir=output_dir,
        tuning_grid=strong_fold_bias_local_grid(),
    )
    print(f"Saved local calibration JSON to {json_path}")
    print(f"Saved local calibration CSV to {csv_path}")


def run_candidate_long_validation(hands: int, seed: int, model_path: str, output_dir: str) -> None:
    json_path, csv_path = run_candidate_validation(
        hands=hands,
        seed=seed,
        evaluator_model=load_evaluator_model(model_path),
        output_dir=output_dir,
    )
    print(f"Saved candidate validation JSON to {json_path}")
    print(f"Saved candidate validation CSV to {csv_path}")


def run_preflop_v2_validation(hands: int, seed: int, export_dir: str, model_path: str | None = None) -> None:
    dataset_jsonl, dataset_csv, spot_report_path, sanity_report_path = run_preflop_teacher_v2_validation(
        hands=hands,
        seed=seed,
        export_dir=export_dir,
        evaluator_model=_load_model_if_requested(model_path),
    )
    print(f"Exported preflop teacher v2 dataset JSONL to {dataset_jsonl}")
    print(f"Exported preflop teacher v2 dataset CSV to {dataset_csv}")
    print(f"Saved preflop spot report to {spot_report_path}")
    print(f"Saved preflop sanity report to {sanity_report_path}")
    print("\nPreflop spot report")
    print(Path(spot_report_path).read_text(encoding='utf-8'))
    print("\nPreflop sanity report")
    print(Path(sanity_report_path).read_text(encoding='utf-8'))


def run_heads_up_postflop_v2_validation(hands: int, seed: int, export_dir: str, model_path: str | None = None) -> None:
    dataset_jsonl, dataset_csv, spot_report_path, sanity_report_path = run_heads_up_postflop_teacher_v2_validation(
        hands=hands,
        seed=seed,
        export_dir=export_dir,
        evaluator_model=_load_model_if_requested(model_path),
    )
    print(f"Exported heads-up postflop teacher v2 dataset JSONL to {dataset_jsonl}")
    print(f"Exported heads-up postflop teacher v2 dataset CSV to {dataset_csv}")
    print(f"Saved heads-up postflop spot report to {spot_report_path}")
    print(f"Saved heads-up postflop sanity report to {sanity_report_path}")
    print("\nHeads-up postflop spot report")
    print(Path(spot_report_path).read_text(encoding="utf-8"))
    print("\nHeads-up postflop sanity report")
    print(Path(sanity_report_path).read_text(encoding="utf-8"))


def run_chat_sft_export(log_dir: str, output_path: str, include_failures: bool) -> None:
    dataset_path = export_chat_sft_dataset(log_dir=log_dir, output_path=output_path, include_failures=include_failures)
    print(f"Exported chat SFT dataset to {dataset_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="PKclaw local poker bot core")
    subparsers = parser.add_subparsers(dest="command")

    simulate = subparsers.add_parser("simulate", help="Run autonomous 8-max hands")
    simulate.add_argument("--hands", type=int, default=1)
    simulate.add_argument("--seed", type=int, default=42)
    simulate.add_argument("--export-dir", type=str, default="outputs")
    simulate.add_argument("--model-path", type=str, default="")
    simulate.add_argument("--policy-path", type=str, default="")

    scenarios = subparsers.add_parser("scenarios", help="Run decision test scenarios")
    scenarios.add_argument("--model-path", type=str, default="")
    scenarios.add_argument("--policy-path", type=str, default="")
    subparsers.add_parser("ui", help="Serve the local demo UI")

    dataset_export = subparsers.add_parser("export-evaluator-dataset", help="Export evaluator-ready dataset with raw state, features, and rollout labels")
    dataset_export.add_argument("--hands", type=int, default=25)
    dataset_export.add_argument("--seed", type=int, default=42)
    dataset_export.add_argument("--export-dir", type=str, default="outputs/evaluator")
    dataset_export.add_argument("--rollouts", type=int, default=80)
    dataset_export.add_argument("--model-path", type=str, default="")

    policy_dataset_export = subparsers.add_parser("export-policy-dataset", help="Export imitation-learning policy dataset from the current strategy pipeline")
    policy_dataset_export.add_argument("--hands", type=int, default=50)
    policy_dataset_export.add_argument("--seed", type=int, default=42)
    policy_dataset_export.add_argument("--export-dir", type=str, default="outputs/policy_baseline")
    policy_dataset_export.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")

    policy_dataset_v1 = subparsers.add_parser("build-policy-dataset-v1", help="Build the formal policy dataset v1 from the stable teacher strategy pipeline")
    policy_dataset_v1.add_argument("--max-hands", type=int, default=300)
    policy_dataset_v1.add_argument("--batch-size", type=int, default=25)
    policy_dataset_v1.add_argument("--seed", type=int, default=42)
    policy_dataset_v1.add_argument("--export-dir", type=str, default="outputs/policy_v1")
    policy_dataset_v1.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    policy_dataset_v1.add_argument("--preflop-target", type=int, default=1200)
    policy_dataset_v1.add_argument("--flop-target", type=int, default=1600)
    policy_dataset_v1.add_argument("--turn-target", type=int, default=1000)
    policy_dataset_v1.add_argument("--river-target", type=int, default=800)

    policy_dataset_v1_1 = subparsers.add_parser("build-policy-dataset-v1_1", help="Build the targeted policy dataset v1.1 for preflop open and steal drift reduction")
    policy_dataset_v1_1.add_argument("--max-hands", type=int, default=900)
    policy_dataset_v1_1.add_argument("--batch-size", type=int, default=50)
    policy_dataset_v1_1.add_argument("--seed", type=int, default=42)
    policy_dataset_v1_1.add_argument("--export-dir", type=str, default="outputs/policy_v1_1")
    policy_dataset_v1_1.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    policy_dataset_v1_1.add_argument("--preflop-target", type=int, default=1400)
    policy_dataset_v1_1.add_argument("--flop-target", type=int, default=1600)
    policy_dataset_v1_1.add_argument("--turn-target", type=int, default=1000)
    policy_dataset_v1_1.add_argument("--river-target", type=int, default=800)

    dataset_v1 = subparsers.add_parser("build-dataset-v1", help="Build the formal balanced evaluator dataset v1")
    dataset_v1.add_argument("--max-hands", type=int, default=300)
    dataset_v1.add_argument("--batch-size", type=int, default=25)
    dataset_v1.add_argument("--seed", type=int, default=42)
    dataset_v1.add_argument("--export-dir", type=str, default="outputs/evaluator_v1")
    dataset_v1.add_argument("--preflop-target", type=int, default=250)
    dataset_v1.add_argument("--flop-target", type=int, default=250)
    dataset_v1.add_argument("--turn-target", type=int, default=250)
    dataset_v1.add_argument("--river-target", type=int, default=250)
    dataset_v1.add_argument("--rollouts", type=int, default=120)

    train = subparsers.add_parser("train-evaluator", help="Train LightGBM evaluator from exported dataset")
    train.add_argument("--dataset", type=str, default="outputs/evaluator_v1/dataset_v1.jsonl")
    train.add_argument("--model-out", type=str, default="outputs/evaluator_v1/evaluator_model.joblib")
    train.add_argument("--seed", type=int, default=42)

    train_policy = subparsers.add_parser("train-policy", help="Train a first baseline learned policy from exported teacher targets")
    train_policy.add_argument("--dataset", type=str, default="outputs/policy_baseline/policy_dataset.jsonl")
    train_policy.add_argument("--model-out", type=str, default="outputs/policy_baseline/policy_model.joblib")
    train_policy.add_argument("--seed", type=int, default=42)

    validate_policy = subparsers.add_parser("validate-policy-baseline", help="Compare stable teacher strategy vs learned policy behavior")
    validate_policy.add_argument("--hands", type=int, default=200)
    validate_policy.add_argument("--seed", type=int, default=42)
    validate_policy.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    validate_policy.add_argument("--policy-path", type=str, default="outputs/policy_v1/policy_model_v1.joblib")
    validate_policy.add_argument("--output", type=str, default="outputs/policy_v1/policy_validation.json")

    evaluator_demo = subparsers.add_parser("evaluator-demo", help="Run export + training + scenario demo for evaluator pipeline")
    evaluator_demo.add_argument("--hands", type=int, default=25)
    evaluator_demo.add_argument("--seed", type=int, default=42)
    evaluator_demo.add_argument("--export-dir", type=str, default="outputs/evaluator")
    evaluator_demo.add_argument("--rollouts", type=int, default=80)

    ab_test = subparsers.add_parser("ab-test-evaluator", help="Compare heuristic-only engine vs heuristic plus evaluator engine")
    ab_test.add_argument("--hands", type=int, default=50)
    ab_test.add_argument("--seed", type=int, default=42)
    ab_test.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_model.joblib")
    ab_test.add_argument("--output", type=str, default="outputs/evaluator_v1/ab_test_summary.json")

    calibration = subparsers.add_parser("calibration-sweep", help="Sweep decision-engine evaluator tuning against a frozen evaluator baseline")
    calibration.add_argument("--hands", type=int, default=120)
    calibration.add_argument("--seed", type=int, default=42)
    calibration.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    calibration.add_argument("--output-dir", type=str, default="outputs/evaluator_v1/calibration")

    calibration_local = subparsers.add_parser("calibration-sweep-local", help="Run a narrow second-pass calibration around strong_fold_bias")
    calibration_local.add_argument("--hands", type=int, default=200)
    calibration_local.add_argument("--seed", type=int, default=42)
    calibration_local.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    calibration_local.add_argument("--output-dir", type=str, default="outputs/evaluator_v1/calibration_local")

    validate_candidates = subparsers.add_parser("validate-candidates", help="Run longer fixed-seed validation for the top local calibration candidates")
    validate_candidates.add_argument("--hands", type=int, default=2000)
    validate_candidates.add_argument("--seed", type=int, default=42)
    validate_candidates.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")
    validate_candidates.add_argument("--output-dir", type=str, default="outputs/evaluator_v1/validation")

    preflop_v2 = subparsers.add_parser("validate-preflop-v2", help="Run PreflopTeacherV2 export, spot report, and sanity validation")
    preflop_v2.add_argument("--hands", type=int, default=300)
    preflop_v2.add_argument("--seed", type=int, default=42)
    preflop_v2.add_argument("--export-dir", type=str, default="outputs/preflop_v2")
    preflop_v2.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")

    heads_up_postflop_v2 = subparsers.add_parser("validate-heads-up-postflop-v2", help="Run HeadsUpPostflopTeacherV2 export, spot report, and sanity validation")
    heads_up_postflop_v2.add_argument("--hands", type=int, default=400)
    heads_up_postflop_v2.add_argument("--seed", type=int, default=42)
    heads_up_postflop_v2.add_argument("--export-dir", type=str, default="outputs/heads_up_postflop_v2")
    heads_up_postflop_v2.add_argument("--model-path", type=str, default="outputs/evaluator_v1/evaluator_v1_baseline.joblib")

    export_chat_sft = subparsers.add_parser("export-chat-sft-dataset", help="Export chat logs into an SFT-ready dataset JSONL")
    export_chat_sft.add_argument("--log-dir", type=str, default="outputs/chat_logs")
    export_chat_sft.add_argument("--output", type=str, default="outputs/chat_logs/chat_sft_dataset.jsonl")
    export_chat_sft.add_argument("--include-failures", action="store_true")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "ui":
        serve_ui()
        return
    if args.command == "scenarios":
        run_demo_scenarios(
            evaluator_model=_load_model_if_requested(getattr(args, "model_path", "")),
            policy_model=_load_policy_if_requested(getattr(args, "policy_path", "")),
        )
        return
    if args.command == "export-evaluator-dataset":
        run_evaluator_dataset_export(args.hands, args.seed, args.export_dir, args.rollouts, getattr(args, "model_path", ""))
        return
    if args.command == "export-policy-dataset":
        run_policy_dataset_export(args.hands, args.seed, args.export_dir, args.model_path)
        return
    if args.command == "build-policy-dataset-v1":
        run_build_policy_dataset_v1(
            args.max_hands,
            args.batch_size,
            args.seed,
            args.export_dir,
            {
                "preflop": args.preflop_target,
                "flop": args.flop_target,
                "turn": args.turn_target,
                "river": args.river_target,
            },
            args.model_path,
        )
        return
    if args.command == "build-policy-dataset-v1_1":
        run_build_policy_dataset_v1(
            args.max_hands,
            args.batch_size,
            args.seed,
            args.export_dir,
            {
                "preflop": args.preflop_target,
                "flop": args.flop_target,
                "turn": args.turn_target,
                "river": args.river_target,
            },
            args.model_path,
            dataset_name="policy_dataset_v1_1",
            spot_targets=POLICY_V1_1_SPOT_TARGETS,
        )
        return
    if args.command == "build-dataset-v1":
        run_build_dataset_v1(
            args.max_hands,
            args.batch_size,
            args.seed,
            args.export_dir,
            {
                "preflop": args.preflop_target,
                "flop": args.flop_target,
                "turn": args.turn_target,
                "river": args.river_target,
            },
            args.rollouts,
        )
        return
    if args.command == "train-evaluator":
        run_training(args.dataset, args.model_out, args.seed)
        return
    if args.command == "train-policy":
        run_policy_training(args.dataset, args.model_out, args.seed)
        return
    if args.command == "validate-policy-baseline":
        run_policy_validation(args.hands, args.seed, args.model_path, args.policy_path, args.output)
        return
    if args.command == "evaluator-demo":
        run_evaluator_demo(args.hands, args.seed, args.export_dir, args.rollouts)
        return
    if args.command == "ab-test-evaluator":
        run_ab_test(args.hands, args.seed, args.model_path, args.output)
        return
    if args.command == "calibration-sweep":
        run_calibration(args.hands, args.seed, args.model_path, args.output_dir)
        return
    if args.command == "calibration-sweep-local":
        run_local_calibration(args.hands, args.seed, args.model_path, args.output_dir)
        return
    if args.command == "validate-candidates":
        run_candidate_long_validation(args.hands, args.seed, args.model_path, args.output_dir)
        return
    if args.command == "validate-preflop-v2":
        run_preflop_v2_validation(args.hands, args.seed, args.export_dir, args.model_path)
        return
    if args.command == "validate-heads-up-postflop-v2":
        run_heads_up_postflop_v2_validation(args.hands, args.seed, args.export_dir, args.model_path)
        return
    if args.command == "export-chat-sft-dataset":
        run_chat_sft_export(args.log_dir, args.output, args.include_failures)
        return

    hands = getattr(args, "hands", 1)
    seed = getattr(args, "seed", 42)
    export_dir = getattr(args, "export_dir", "outputs")
    model_path = getattr(args, "model_path", "")
    policy_path = getattr(args, "policy_path", "")
    run_simulation(hands, seed, export_dir, model_path, policy_path)


if __name__ == "__main__":
    main()
