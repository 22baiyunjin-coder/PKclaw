# Remote Transformers Chat Service

Use this when the remote Qwen model is healthy under `transformers.generate()` but the `vLLM` path is unstable.

## Goal

Run a lightweight OpenAI-compatible chat service on the remote server and keep the local PKclaw product unchanged.

The local product keeps doing:

- evaluator
- strategy / policy
- current hand state
- current bot style / parameters
- UI
- `chat_service` orchestration

The remote service only does:

- explanation
- discussion
- conversational analysis

## Server Script

The server entrypoint is:

- `tools/transformers_qwen_openai_server.py`

It serves:

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`

## Remote Start Example

On the remote machine:

```bash
cd /path/to/PKclaw

export PKCLAW_QWEN_MODEL_PATH=/data/Brian/Qwen3-4B-Instruct-2507
export PKCLAW_QWEN_MODEL_NAME=Qwen3-4B-Instruct-2507
export PKCLAW_QWEN_HOST=0.0.0.0
export PKCLAW_QWEN_PORT=8001
export PKCLAW_QWEN_DTYPE=bfloat16
export PKCLAW_QWEN_MAX_NEW_TOKENS=220
export PKCLAW_QWEN_TEMPERATURE=0.2
export PKCLAW_QWEN_TOP_P=0.9

python3 tools/transformers_qwen_openai_server.py
```

Background example:

```bash
nohup python3 tools/transformers_qwen_openai_server.py > /tmp/pkclaw_qwen_server.log 2>&1 &
tail -f /tmp/pkclaw_qwen_server.log
```

## Remote Smoke Checks

```bash
curl -s http://127.0.0.1:8001/health
```

```bash
curl -s http://127.0.0.1:8001/v1/models
```

```bash
curl -s http://127.0.0.1:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model":"Qwen3-4B-Instruct-2507",
    "messages":[{"role":"user","content":"Explain what a c-bet is in two sentences."}],
    "temperature":0,
    "top_p":1,
    "max_tokens":80
  }'
```

## Local PKclaw Connection

Once the remote service is up, point the local PKclaw backend at it:

```powershell
$env:PKCLAW_CHAT_PROVIDER="remote"
$env:PKCLAW_BASE_URL="http://10.10.142.113:8001/v1"
$env:PKCLAW_MODEL="Qwen3-4B-Instruct-2507"
$env:PKCLAW_API_PATH="/chat/completions"
$env:PKCLAW_TIMEOUT_SECONDS="90"
$env:PKCLAW_MAX_OUTPUT_TOKENS="180"
.\.venv\Scripts\python.exe main.py ui
```

## Why This Exists

This path is a practical fallback for the current phase:

- `transformers` direct generation already produced sane output
- `vLLM` is currently unstable on the target MUSA setup
- the product needs a usable remote explanation backend now

This keeps the product moving while preserving the same backend contract for future model swaps.
