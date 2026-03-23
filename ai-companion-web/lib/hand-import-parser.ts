import type { ReplyProvider } from "@/types/chat"

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.com/v1"
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5"

const HAND_IMPORT_SYSTEM_PROMPT = `You convert poker hand descriptions into strict JSON for a replay system.

Return JSON only. No markdown, no code fences, no explanation.

Output schema:
{
  "title": string,
  "smallBlind": number,
  "bigBlind": number,
  "heroSeat": number,
  "dealerSeat": number,
  "players": [
    {
      "name": string,
      "seatIndex": number,
      "isHero": boolean,
      "isAI": boolean,
      "holeCards": string[],
      "startingStack": number,
      "endingStack": number,
      "totalCommitted": number,
      "winnings": number,
      "positionLabel": string,
      "folded": boolean
    }
  ],
  "boardByStreet": {
    "preflop": string[],
    "flop": string[],
    "turn": string[],
    "river": string[]
  },
  "finalBoard": string[],
  "finalStreet": "preflop" | "flop" | "turn" | "river" | "showdown",
  "actions": string[],
  "winners": [
    {
      "playerId": number,
      "playerName": string,
      "amount": number,
      "handLabel": string,
      "handRankValue": number
    }
  ],
  "notes": string[]
}

Rules:
- Preserve uncertainty instead of inventing hidden cards. Use "??" only when cards are unknown.
- Use action strings in this format: "street: Player Action [amount]". Example: "flop: Hero Bet 80".
- Streets must be one of preflop, flop, turn, river.
- If only partial information is available, still produce a valid replay-ready draft with reasonable defaults.
- Default blinds to 10/20 if missing.
- Default to 2 players if seat count is unclear.
- Keep notes short and include any ambiguity or missing details.
- Use card strings like "As", "Kh", "10d", "7c".`

export interface StructuredHandImportResult {
  payload: Record<string, unknown>
  provider: ReplyProvider
}

function normalizeBaseUrl() {
  const rawBaseUrl = process.env.MINIMAX_BASE_URL?.trim()
  return (rawBaseUrl || DEFAULT_MINIMAX_BASE_URL).replace(/\/$/, "")
}

function getModelName() {
  return process.env.MINIMAX_MODEL?.trim() || DEFAULT_MINIMAX_MODEL
}

function getApiKey() {
  return process.env.MINIMAX_API_KEY?.trim() || ""
}

function extractTextContent(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices)
  ) {
    return ""
  }

  const firstChoice = payload.choices[0]

  if (
    !firstChoice ||
    typeof firstChoice !== "object" ||
    !("message" in firstChoice) ||
    !firstChoice.message ||
    typeof firstChoice.message !== "object" ||
    !("content" in firstChoice.message)
  ) {
    return ""
  }

  const { content } = firstChoice.message as {
    content?: string | Array<{ text?: string }>
  }

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim()
  }

  return ""
}

function stripJsonFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function buildFallbackPayload(input: string): Record<string, unknown> {
  const firstLine =
    input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || "Imported discussion hand"

  return {
    title: firstLine.slice(0, 80),
    smallBlind: 10,
    bigBlind: 20,
    heroSeat: 0,
    dealerSeat: 1,
    players: [
      {
        name: "Hero",
        seatIndex: 0,
        isHero: true,
        isAI: false,
        holeCards: ["??", "??"],
        startingStack: 4000,
        endingStack: 4000,
        totalCommitted: 0,
        winnings: 0,
        positionLabel: "Hero",
        folded: false,
      },
      {
        name: "Villain",
        seatIndex: 1,
        isHero: false,
        isAI: true,
        holeCards: ["??", "??"],
        startingStack: 4000,
        endingStack: 4000,
        totalCommitted: 0,
        winnings: 0,
        positionLabel: "Villain",
        folded: false,
      },
    ],
    boardByStreet: {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
    },
    finalBoard: [],
    finalStreet: "preflop",
    actions: [],
    winners: [],
    notes: [
      "mock_parse",
      "Structured without a live LLM provider.",
      `source_text:${input.slice(0, 240)}`,
    ],
  }
}

async function requestMinimax(input: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${normalizeBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModelName(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: HAND_IMPORT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: input,
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`MiniMax parse failed with status ${response.status}. ${detail.slice(0, 300)}`)
  }

  const payload = (await response.json()) as unknown
  const content = stripJsonFence(extractTextContent(payload))

  if (!content) {
    throw new Error("MiniMax returned an empty hand-parse response.")
  }

  return JSON.parse(content) as Record<string, unknown>
}

export async function generateStructuredHandImport(
  input: string,
): Promise<StructuredHandImportResult> {
  if (!getApiKey()) {
    return {
      payload: buildFallbackPayload(input),
      provider: "mock",
    }
  }

  try {
    return {
      payload: await requestMinimax(input),
      provider: "minimax",
    }
  } catch (error) {
    console.error("[hand-import-parser] Falling back to mock parse", error)

    return {
      payload: buildFallbackPayload(input),
      provider: "mock",
    }
  }
}
