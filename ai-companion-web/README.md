# PocketMuse MVP

A first-pass AI companion and chat website built with Next.js App Router. The product focuses on three things for version one:

- a polished desktop-style companion interface
- a visible AI character panel with live status changes
- a clean `/api/chat` path that can use MiniMax or fall back to a local mock reply

The default companion is **Mira**: rational, concise, emotionally steady, and good with Texas Hold'em probability language such as pot odds, range thinking, and quick EV framing.

## Tech stack

- Next.js 14+ with App Router
- React + TypeScript
- Tailwind CSS
- Route Handler API (`app/api/chat/route.ts`)
- Simple client state with React hooks

## Project structure

```text
ai-companion-web/
  app/
    api/chat/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    CharacterPanel.tsx
    ChatInput.tsx
    ChatWindow.tsx
    CompanionDesk.tsx
    MessageBubble.tsx
    TopBar.tsx
  lib/
    minimax.ts
    mockReply.ts
    persona.ts
  public/
    companion-portrait.svg
  types/
    chat.ts
  .env.example
  package.json
  tailwind.config.ts
  README.md
```

## Install

Recommended environment:

- Node.js 18.18+ or 20+
- npm 9+

From the repository root:

```bash
cd ai-companion-web
npm install
```

## Run locally

```bash
cd ai-companion-web
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` inside `ai-companion-web/` and add:

```bash
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M2.5
```

Windows PowerShell shortcut:

```powershell
Copy-Item .env.example .env.local
```

Notes:

- If `MINIMAX_API_KEY` is empty, the app uses the local mock reply flow automatically.
- `MINIMAX_BASE_URL` is written as a base URL on purpose. The current wrapper appends `/chat/completions`.
- `MINIMAX_MODEL` is kept separate so you can swap models without editing the API route.

## How MiniMax is wired

The chat API is intentionally isolated in `lib/minimax.ts`.

Flow:

1. The browser sends the current conversation to `POST /api/chat`.
2. The route handler validates input and calls `generateChatReply(messages)`.
3. `generateChatReply` checks `MINIMAX_API_KEY`.
4. If no key exists, it returns a mock companion reply from `lib/mockReply.ts`.
5. If a key exists, it sends an OpenAI-compatible chat request to MiniMax.

Important files:

- `lib/persona.ts`: default persona profile + system prompt builder
- `lib/minimax.ts`: MiniMax request wrapper + env handling
- `lib/mockReply.ts`: local fallback response style

## How to switch to the real MiniMax API

1. Get a valid MiniMax API key.
2. Create `ai-companion-web/.env.local`.
3. Fill in:

```bash
MINIMAX_API_KEY=your_real_key
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M2.5
```

4. Restart the dev server.
5. Send a message from the UI. The header badge should switch from `Mock Ready` to `MiniMax Live`.

If your MiniMax account uses a different compatible base path or model name, only update the env values first. The rest of the app should not need changes for basic testing. MiniMax's official docs currently show `https://api.minimaxi.com/v1` for domestic access and `https://api.minimax.io/v1` for international access.

## MVP features included

- Desktop-first landing/chat page
- Top bar with product name, companion name, and settings button
- Character card with visual portrait, persona notes, and live state tags
- Companion state changes: `idle`, `thinking`, `replying`, `error`
- Chat bubbles for user and assistant
- Loading indicator while waiting for a reply
- Auto-scroll to the latest message
- In-page session memory using React state
- Friendly empty state with prompt chips
- Real API path with mock fallback for local demo use

## Suggested next steps

- Add persistent chat history with a database
- Add auth and user profiles
- Add memory layers for long-term personalization
- Add voice input/output
- Replace the SVG card portrait with Live2D or 3D rendering
- Add multiple companion personas
- Add poker hand upload / structured analysis cards

## Notes

- This MVP does not include database, login, payments, or role switching.
- The visual layer is intentionally separated so `CharacterPanel.tsx` can later swap the static portrait for Live2D or a 3D canvas without rewriting the chat flow.
