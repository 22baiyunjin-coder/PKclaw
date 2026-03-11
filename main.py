from __future__ import annotations

import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from random import Random
from urllib.parse import parse_qs, urlparse

from pkbot.engine import TableSimulator
from pkbot.exporter import export_hand_results
from pkbot.replay import build_hand_replay
from pkbot.test_scenarios import run_demo_scenarios

HOST = "127.0.0.1"
PORT = 8000


class DemoRequestHandler(SimpleHTTPRequestHandler):
    server_version = "PKclawDemo/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/replay":
            self._serve_replay(parsed.query)
            return
        super().do_GET()

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


def run_simulation(hands: int, seed: int, export_dir: str | None) -> None:
    simulator = TableSimulator(seed=seed)
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="PKclaw local poker bot core")
    subparsers = parser.add_subparsers(dest="command")

    simulate = subparsers.add_parser("simulate", help="Run autonomous 8-max hands")
    simulate.add_argument("--hands", type=int, default=1)
    simulate.add_argument("--seed", type=int, default=42)
    simulate.add_argument("--export-dir", type=str, default="outputs")

    subparsers.add_parser("scenarios", help="Run decision test scenarios")
    subparsers.add_parser("ui", help="Serve the local demo UI")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "ui":
        serve_ui()
        return
    if args.command == "scenarios":
        run_demo_scenarios()
        return

    hands = getattr(args, "hands", 1)
    seed = getattr(args, "seed", 42)
    export_dir = getattr(args, "export_dir", "outputs")
    run_simulation(hands, seed, export_dir)


if __name__ == "__main__":
    main()
