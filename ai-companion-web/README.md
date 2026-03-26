# PKclaw Edge Web

This is the Next.js web client that powers the public `poker-mind.xyz` experience.

## What this app does

- Renders the JavaScript poker table and public product pages
- Proxies chat requests to the configured chat backend
- Calls the original PKclaw Python decision engine when `PKCLAW_API_BASE_URL` is configured

## Important architecture note

The JavaScript table UI is **not** the source of truth for poker intelligence.

Real bot decision logic should come from the Python PKclaw backend through:

- `POST {PKCLAW_API_BASE_URL}/api/decision`

If that backend is unavailable, the web app can fall back to degraded logic for local testing, but that is not the intended production mode.

## Required production env

```bash
PKCLAW_API_BASE_URL=https://your-public-pkclaw-backend.example
PKCLAW_REQUIRE_LOCAL_DECISION=true
PKCLAW_ALLOW_HEURISTIC_FALLBACK=false
PKCLAW_ALLOW_REMOTE_MODEL_DECISION=false
```

Recommended chat env:

```bash
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M2.5
```

## Decision source behavior

The table will now surface the decision source in the UI:

- `pkclaw_local`: original PKclaw engine
- `heuristic_fallback`: degraded local heuristic
- `safe_fallback`: conservative emergency fallback
- `remote_model`: remote model decision path (disabled by default)

For production, the intended goal is that bots run from `pkclaw_local`.

## Local development

```bash
npm install
npm run dev
```

