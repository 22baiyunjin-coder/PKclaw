# PKclaw

PKclaw now has two parallel layers:

- A polished local product demo UI in `demo/`
- A first runnable backend poker bot core in `pkbot/`

## Commands

Use the project virtual environment.

### Run autonomous 8-max hands

```powershell
.\.venv\Scripts\python.exe main.py simulate --hands 10 --seed 42 --export-dir outputs
```

### Run decision test scenarios

```powershell
.\.venv\Scripts\python.exe main.py scenarios
```

### Open the UI demo locally

```powershell
.\.venv\Scripts\python.exe main.py ui
```

Then open [http://127.0.0.1:8000/demo/](http://127.0.0.1:8000/demo/)

## Current backend scope

- 8-max seat and blind setup
- Single-hand and batch local simulation
- Rule-based autonomous decisions for 8 bots
- Style presets with distinct personalities
- Structured decision output with reason tags
- Scenario runner for spot-level testing
- JSONL export for hand history and decision samples

## Export files

Running `simulate` writes:

- `outputs/hand_history.jsonl`
- `outputs/decision_samples.jsonl`

## Not done yet

- Side-pot handling for complex all-in situations
- Opponent modeling
- Solver logic
- Real platform integration
