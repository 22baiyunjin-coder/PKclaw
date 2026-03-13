# PKclaw

PKclaw now has two parallel layers:

- A polished local product demo UI in `demo/`
- A runnable backend poker bot core with a formal v1 evaluator pipeline in `pkbot/`

## Commands

Use the project virtual environment.

If you need to rebuild dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Run autonomous 8-max hands

```powershell
.\.venv\Scripts\python.exe main.py simulate --hands 10 --seed 42 --export-dir outputs
```

### Run decision test scenarios

```powershell
.\.venv\Scripts\python.exe main.py scenarios
```

### Run scenarios with a trained evaluator

```powershell
.\.venv\Scripts\python.exe main.py scenarios --model-path outputs\evaluator\evaluator_model.joblib
```

### Open the UI demo locally

```powershell
.\.venv\Scripts\python.exe main.py ui
```

Then open [http://127.0.0.1:8000/demo/](http://127.0.0.1:8000/demo/)

### Build evaluator dataset v1

```powershell
.\.venv\Scripts\python.exe main.py build-dataset-v1 --max-hands 300 --batch-size 25 --seed 42 --export-dir outputs\evaluator_v1 --preflop-target 15000 --flop-target 30000 --turn-target 20000 --river-target 15000 --rollouts 120
```

### Train the LightGBM evaluator

```powershell
.\.venv\Scripts\python.exe main.py train-evaluator --dataset outputs\evaluator_v1\dataset_v1.jsonl --model-out outputs\evaluator_v1\evaluator_model.joblib --seed 42
```

### Export a baseline policy dataset from the current strategy pipeline

```powershell
.\.venv\Scripts\python.exe main.py export-policy-dataset --hands 50 --seed 42 --export-dir outputs\policy_baseline --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib
```

### Build the formal Policy Dataset v1

```powershell
.\.venv\Scripts\python.exe main.py build-policy-dataset-v1 --max-hands 700 --batch-size 50 --seed 42 --export-dir outputs\policy_v1 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --preflop-target 1200 --flop-target 1600 --turn-target 1000 --river-target 800
```

### Build the targeted Policy Dataset v1.1

```powershell
.\.venv\Scripts\python.exe main.py build-policy-dataset-v1_1 --max-hands 900 --batch-size 50 --seed 42 --export-dir outputs\policy_v1_1 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --preflop-target 1400 --flop-target 1600 --turn-target 1000 --river-target 800
```

### Train a first baseline learned policy

```powershell
.\.venv\Scripts\python.exe main.py train-policy --dataset outputs\policy_baseline\policy_dataset.jsonl --model-out outputs\policy_baseline\policy_model.joblib --seed 42
```

### Train Policy Baseline v1.1

```powershell
.\.venv\Scripts\python.exe main.py train-policy --dataset outputs\policy_v1_1\policy_dataset_v1_1.jsonl --model-out outputs\policy_v1_1\policy_model_v1_1.joblib --seed 42
```

### Validate teacher strategy vs learned policy behavior

```powershell
.\.venv\Scripts\python.exe main.py validate-policy-baseline --hands 300 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --policy-path outputs\policy_v1\policy_model_v1.joblib --output outputs\policy_v1\policy_validation.json
```

### Validate Policy Baseline v1.1 against the teacher

```powershell
.\.venv\Scripts\python.exe main.py validate-policy-baseline --hands 300 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --policy-path outputs\policy_v1_1\policy_model_v1_1.joblib --output outputs\policy_v1_1\policy_validation_v1_1.json
```

### Compare heuristic vs evaluator-assisted engine

```powershell
.\.venv\Scripts\python.exe main.py ab-test-evaluator --hands 50 --seed 42 --model-path outputs\evaluator_v1\evaluator_model.joblib --output outputs\evaluator_v1\ab_test_summary.json
```

### Run decision-engine calibration sweep against the frozen Evaluator v1 baseline

```powershell
.\.venv\Scripts\python.exe main.py calibration-sweep --hands 120 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\calibration
```

### Run the second-pass local calibration around `strong_fold_bias`

```powershell
.\.venv\Scripts\python.exe main.py calibration-sweep-local --hands 200 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\calibration_local
```

### Run long fixed-seed validation for the top local candidates

```powershell
.\.venv\Scripts\python.exe main.py validate-candidates --hands 2000 --seed 42 --model-path outputs\evaluator_v1\evaluator_v1_baseline.joblib --output-dir outputs\evaluator_v1\validation
```

### Run the end-to-end evaluator demo

```powershell
.\.venv\Scripts\python.exe main.py evaluator-demo --hands 25 --seed 42 --export-dir outputs\evaluator --rollouts 80
```

## Current backend scope

- 8-max seat and blind setup
- Single-hand and batch local simulation
- Rule-based autonomous decisions for 8 bots
- Style presets with distinct personalities
- Structured decision output with reason tags
- Scenario runner for spot-level testing
- JSONL export for hand history and decision samples
- Balanced dataset v1 export with raw state + flat features + labels
- Flat feature builder for model-ready tabular inputs
- Standardized Monte Carlo rollout labeling for `equity_estimate` and `showdown_strength_proxy`
- Rule-based opponent range assumptions for label generation (`rule_based_range_v1`)
- Stratified sampling with forced coverage across street, position, player bucket, spot type, hand class, and board texture
- LightGBM evaluator training, save/load, and model-assisted decision integration
- Standard evaluator service component for model-agnostic evaluator access
- Strategy-layer framework with separate preflop, flop, turn, and river policy modules
- Size-bucket planning before final sizing resolution
- Policy interface and adapter layer on top of StrategyLayer
- Policy dataset export from the current teacher strategy pipeline
- Baseline LightGBM learned policy training and load/save support
- A/B comparison flow between heuristic-only and evaluator-assisted engines
- A local chat layer for hand discussion, backed by a configurable external LLM API through `/api/chat`

## Chat Layer Setup

The UI now includes a ChatGPT-style hand discussion panel. The browser only talks to the local PKclaw server. Your API key stays on the backend.

PowerShell example for an OpenAI-compatible endpoint:

```powershell
$env:PKCLAW_CHAT_BASE_URL="https://your-provider.example/v1"
$env:PKCLAW_CHAT_API_KEY="your-api-key"
$env:PKCLAW_CHAT_MODEL="your-model-id"
.\.venv\Scripts\python.exe main.py ui
```

Optional configuration:

```powershell
$env:PKCLAW_CHAT_API_PATH="/chat/completions"
$env:PKCLAW_CHAT_TEMPERATURE="0.35"
$env:PKCLAW_CHAT_TIMEOUT_SECONDS="45"
$env:PKCLAW_CHAT_EXTRA_HEADERS='{"HTTP-Referer":"https://your-app.example"}'
```

If you just want to verify the UI wiring locally before adding a real provider:

```powershell
$env:PKCLAW_CHAT_PROVIDER="mock"
.\.venv\Scripts\python.exe main.py ui
```

## Export files

Running `simulate` writes:

- `outputs/hand_history.jsonl`
- `outputs/decision_samples.jsonl`

Running `build-dataset-v1` writes:

- `outputs/evaluator_v1/dataset_v1.jsonl`
- `outputs/evaluator_v1/dataset_v1.csv`
- `outputs/evaluator_v1/dataset_v1_metadata.json`

Running `train-evaluator` writes:

- `outputs/evaluator_v1/evaluator_model.joblib`
- `outputs/evaluator_v1/evaluator_model_report.json`

Running `export-policy-dataset` writes:

- `outputs/policy_baseline/policy_dataset.jsonl`
- `outputs/policy_baseline/policy_dataset.csv`
- `outputs/policy_baseline/policy_dataset_metadata.json`

Running `build-policy-dataset-v1` writes:

- `outputs/policy_v1/policy_dataset_v1.jsonl`
- `outputs/policy_v1/policy_dataset_v1.csv`
- `outputs/policy_v1/policy_dataset_v1_metadata.json`

Running `build-policy-dataset-v1_1` writes:

- `outputs/policy_v1_1/policy_dataset_v1_1.jsonl`
- `outputs/policy_v1_1/policy_dataset_v1_1.csv`
- `outputs/policy_v1_1/policy_dataset_v1_1_metadata.json`

Running `train-policy` writes:

- `outputs/policy_baseline/policy_model.joblib`
- `outputs/policy_baseline/policy_model_report.json`

Formal v1 policy training can write:

- `outputs/policy_v1/policy_model_v1.joblib`
- `outputs/policy_v1/policy_model_v1_report.json`

Formal v1.1 policy training can write:

- `outputs/policy_v1_1/policy_model_v1_1.joblib`
- `outputs/policy_v1_1/policy_model_v1_1_report.json`

Running `validate-policy-baseline` writes:

- `outputs/policy_v1/policy_validation.json`
- `outputs/policy_v1_1/policy_validation_v1_1.json`

Running `calibration-sweep` writes:

- `outputs/evaluator_v1/calibration/calibration_sweep.json`
- `outputs/evaluator_v1/calibration/calibration_sweep.csv`

Running `calibration-sweep-local` writes:

- `outputs/evaluator_v1/calibration_local/calibration_sweep.json`
- `outputs/evaluator_v1/calibration_local/calibration_sweep.csv`

Running `validate-candidates` writes:

- `outputs/evaluator_v1/validation/candidate_validation.json`
- `outputs/evaluator_v1/validation/candidate_validation.csv`

## Not done yet

- Side-pot handling for complex all-in situations
- Opponent modeling
- Richer range assumptions beyond the first rule-based rollout policy
- Large-scale evaluator calibration
- Strategy model training on top of evaluator outputs
- Real platform integration
