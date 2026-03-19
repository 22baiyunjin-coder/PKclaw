"use server"

import { fetchWithRateLimit } from "@/lib/api-rate-limiter"
import type { Locale } from "@/lib/i18n"
import type { Card, Persona } from "@/lib/poker-types"

interface OpponentInfo {
  position: number
  chips: number
  bet: number
  isFolded: boolean
  name: string
  isDealer: boolean
  persona?: Persona
}

interface AIRequest {
  playerCards: Card[]
  communityCards: Card[]
  pot: number
  currentBet: number
  playerChips: number
  playerBet: number
  validActions: ("fold" | "check" | "call" | "raise" | "all-in")[]
  phase: string
  position: number
  dealerIndex: number
  playersCount: number
  locale: Locale
  persona?: Persona
  opponents?: OpponentInfo[]
  actionLog?: string[]
}

interface AIResponse {
  action: "fold" | "check" | "call" | "raise" | "all-in"
  amount?: number
  reason: string
  message?: string
}

interface LocalDecisionResponse {
  decision?: {
    action: string
    amount?: number | null
    reason_tags?: string[]
    action_probabilities?: Record<string, number>
    engine?: string
    profile_name?: string
  }
}

const SUIT_TO_PKCLAW: Record<string, string> = {
  "♠": "s",
  "♥": "h",
  "♦": "d",
  "♣": "c",
}

function toPkclawCard(card: Card): string {
  const rank = card.rank === "10" ? "T" : card.rank
  const suit = SUIT_TO_PKCLAW[card.suit] ?? "s"
  return `${rank}${suit}`
}

function buildCacheKey(data: AIRequest): string {
  return [
    data.persona?.id || data.persona?.name || "default",
    data.phase,
    data.playerCards.map(toPkclawCard).join(""),
    data.communityCards.map(toPkclawCard).join(""),
    data.validActions.join("-"),
    data.actionLog?.slice(-4).join("|") || "no-log",
  ].join("::")
}

function buildTableMessage(
  locale: Locale,
  action: AIResponse["action"],
  persona?: Persona,
): string {
  const style = `${persona?.style || ""} ${persona?.description || ""}`.toLowerCase()
  const isAggressive =
    /aggro|aggressive|hyper|maniac|lag|pressure|loose/.test(style)
  const isTight =
    /tight|nit|cautious|conservative|teacher|balanced|gto/.test(style)

  const zhByAction: Record<AIResponse["action"], string[]> = {
    fold: isAggressive
      ? ["先让一步。", "这枪先收住。"]
      : ["这手先弃掉。", "这里先不扛。"],
    check: isAggressive
      ? ["先看你怎么说。", "先给一拍。"]
      : ["先过牌控制一下。", "先把街道留住。"],
    call: isAggressive
      ? ["我跟，继续。", "这笔我接住。"]
      : ["先跟注看下一张。", "赔率还可以。"],
    raise: isAggressive
      ? ["给点压力。", "这手我要拿回主动。"]
      : ["这里该抬一下。", "价值和压力一起拿。"],
    "all-in": isAggressive
      ? ["那就压满。", "这一枪直接到底。"]
      : ["这手范围够了，推。", "筹码就放这里。"],
  }

  const enByAction: Record<AIResponse["action"], string[]> = {
    fold: isAggressive
      ? ["Let this one breathe.", "Not the hill to die on."]
      : ["Easy fold here.", "We can pass this spot."],
    check: isAggressive
      ? ["I'll give it a beat.", "Let's see one more move."]
      : ["Check and keep it tidy.", "Control first."],
    call: isAggressive
      ? ["I'm in.", "Let's keep the line open."]
      : ["Call and realize.", "Price is still fine."],
    raise: isAggressive
      ? ["Apply pressure.", "Take back the lead."]
      : ["Time to size up.", "Value plus pressure."],
    "all-in": isAggressive
      ? ["Put it all in.", "No half measures now."]
      : ["Stack goes in here.", "This is the commitment point."],
  }

  const bank = locale === "zh" ? zhByAction : enByAction
  const options = bank[action]

  if (isTight && action === "raise") {
    return locale === "zh" ? "这手该拿价值了。" : "This is a value push."
  }

  return options[0]
}

function normalizeAggressiveAmount(
  action: string,
  rawAmount: number | null | undefined,
  data: AIRequest,
): number | undefined {
  if (action !== "raise" && action !== "bet" && action !== "all-in") {
    return undefined
  }

  const maxTarget = data.playerBet + data.playerChips
  if (action === "all-in") {
    return Math.round(maxTarget)
  }

  const bigBlind = 20
  const minTarget =
    data.currentBet > 0
      ? Math.max(data.currentBet * 2, bigBlind * 2)
      : bigBlind * 2

  let target = rawAmount ?? minTarget

  // PKclaw preflop opens are expressed in BB multiples.
  if (data.phase === "preflop" && target > 0 && target <= 10) {
    target *= bigBlind
  }

  if (target <= data.currentBet) {
    target =
      data.currentBet > 0
        ? Math.max(data.currentBet * 2.5, minTarget)
        : Math.max(bigBlind * 3, minTarget)
  }

  return Math.round(Math.min(maxTarget, Math.max(minTarget, target)))
}

function normalizeAction(
  rawAction: string,
  rawAmount: number | null | undefined,
  data: AIRequest,
  reason: string,
  message?: string,
): AIResponse {
  const normalized =
    rawAction === "bet"
      ? "raise"
      : rawAction === "all-in"
        ? "all-in"
        : (rawAction as AIResponse["action"])

  const allowed = new Set(data.validActions)
  let action: AIResponse["action"] = normalized

  if (!allowed.has(action)) {
    if (allowed.has("check")) {
      action = "check"
    } else if (allowed.has("call")) {
      action = "call"
    } else {
      action = "fold"
    }
  }

  const amount = normalizeAggressiveAmount(action, rawAmount, data)
  if (action === "all-in" && !allowed.has("all-in") && allowed.has("raise")) {
    return {
      action: "raise",
      amount: normalizeAggressiveAmount("raise", amount, data),
      reason,
      message,
    }
  }

  return {
    action,
    amount,
    reason,
    message,
  }
}

async function tryPkclawDecision(data: AIRequest): Promise<AIResponse | null> {
  const baseUrl =
    process.env.PKCLAW_API_BASE_URL?.trim() || "http://127.0.0.1:8000"

  const heroName = data.persona?.name || "Bot"
  const payload = {
    table: {
      street: data.phase,
      pot: data.pot,
      current_bet: data.currentBet,
      players_count: data.playersCount,
      dealer_index: data.dealerIndex,
      small_blind: 10,
      big_blind: 20,
    },
    hero: {
      name: heroName,
      seat_index: data.position,
      chips: data.playerChips,
      bet: data.playerBet,
      cards: data.playerCards.map(toPkclawCard),
      persona: data.persona || null,
      is_hero: true,
      folded: false,
    },
    players: [
      {
        name: heroName,
        seat_index: data.position,
        chips: data.playerChips,
        bet: data.playerBet,
        cards: data.playerCards.map(toPkclawCard),
        persona: data.persona || null,
        is_hero: true,
        folded: false,
      },
      ...(data.opponents || []).map((opponent) => ({
        name: opponent.name,
        seat_index: opponent.position,
        chips: opponent.chips,
        bet: opponent.bet,
        cards: [],
        persona: opponent.persona || null,
        folded: opponent.isFolded,
        is_hero: false,
        is_dealer: opponent.isDealer,
      })),
    ],
    board: data.communityCards.map(toPkclawCard),
    valid_actions: data.validActions,
    action_log: data.actionLog || [],
  }

  try {
    const response = await fetch(`${baseUrl}/api/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) {
      return null
    }

    const parsed = (await response.json()) as LocalDecisionResponse
    const decision = parsed.decision

    if (!decision?.action) {
      return null
    }

    const reason =
      decision.reason_tags?.slice(0, 3).join(", ") ||
      decision.engine ||
      "PKclaw local decision"
    const message = buildTableMessage(
      data.locale,
      decision.action === "bet"
        ? "raise"
        : (decision.action as AIResponse["action"]),
      data.persona,
    )

    return normalizeAction(
      decision.action,
      decision.amount,
      data,
      reason,
      message,
    )
  } catch {
    return null
  }
}

async function tryRemoteModelDecision(data: AIRequest): Promise<AIResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY
  const baseUrl =
    process.env.GEMINI_API_BASE_URL?.trim() || "https://api.shubiaobiao.cn/v1"

  if (!apiKey) {
    return null
  }

  const systemPrompt = [
    "You are a strong Texas Hold'em assistant playing a table persona.",
    "Return raw JSON only.",
    'Schema: {"action":"fold|check|call|raise|all-in","amount":number,"reason":"short string","message":"short table talk"}',
    "Do not reveal private hole cards in message.",
  ].join(" ")

  const userPrompt = JSON.stringify(
    {
      locale: data.locale,
      phase: data.phase,
      hero_cards: data.playerCards.map(toPkclawCard),
      board: data.communityCards.map(toPkclawCard),
      pot: data.pot,
      current_bet: data.currentBet,
      hero_stack: data.playerChips,
      hero_bet: data.playerBet,
      seat_index: data.position,
      dealer_index: data.dealerIndex,
      valid_actions: data.validActions,
      persona: data.persona,
      opponents: data.opponents,
      action_log: data.actionLog?.slice(-16) || [],
    },
    null,
    2,
  )

  try {
    const result = await fetchWithRateLimit(
      `gemini-${Date.now()}`,
      async () => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.35,
            max_tokens: 300,
          }),
          signal: AbortSignal.timeout(12000),
        })

        if (!response.ok) {
          throw new Error(`Gemini API error (${response.status})`)
        }

        return response.json()
      },
      { cacheKey: buildCacheKey(data) },
    )

    const content = result?.choices?.[0]?.message?.content
    if (typeof content !== "string") {
      return null
    }

    const firstBrace = content.indexOf("{")
    const lastBrace = content.lastIndexOf("}")
    if (firstBrace === -1 || lastBrace === -1) {
      return null
    }

    const payload = JSON.parse(content.slice(firstBrace, lastBrace + 1)) as {
      action?: string
      amount?: number
      reason?: string
      message?: string
    }

    if (!payload.action) {
      return null
    }

    return normalizeAction(
      payload.action,
      payload.amount,
      data,
      payload.reason || "Remote model decision",
      payload.message,
    )
  } catch {
    return null
  }
}

function buildFallbackDecision(data: AIRequest): AIResponse {
  if (data.validActions.includes("check")) {
    return {
      action: "check",
      reason: data.locale === "zh" ? "安全降级到过牌" : "Safe fallback to check",
      message: buildTableMessage(data.locale, "check", data.persona),
    }
  }

  if (
    data.validActions.includes("call") &&
    data.currentBet - data.playerBet <= data.pot * 0.18
  ) {
    return {
      action: "call",
      reason: data.locale === "zh" ? "安全降级到跟注" : "Safe fallback to call",
      message: buildTableMessage(data.locale, "call", data.persona),
    }
  }

  return {
    action: "fold",
    reason: data.locale === "zh" ? "安全降级到弃牌" : "Safe fallback to fold",
    message: buildTableMessage(data.locale, "fold", data.persona),
  }
}

export async function getAIDecision(data: AIRequest): Promise<AIResponse> {
  const localDecision = await tryPkclawDecision(data)
  if (localDecision) {
    return localDecision
  }

  const remoteDecision = await tryRemoteModelDecision(data)
  if (remoteDecision) {
    return remoteDecision
  }

  return buildFallbackDecision(data)
}
