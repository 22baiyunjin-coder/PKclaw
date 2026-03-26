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

export type DecisionSource =
  | "pkclaw_local"
  | "remote_model"
  | "heuristic_fallback"
  | "safe_fallback"

export interface AIResponse {
  action: "fold" | "check" | "call" | "raise" | "all-in"
  amount?: number
  reason: string
  message?: string
  source: DecisionSource
}

export interface DecisionBackendStatus {
  pkclawConfigured: boolean
  pkclawHealthy: boolean
  pkclawBaseUrl: string | null
  pkclawMessage?: string
  remoteModelEnabled: boolean
  heuristicFallbackEnabled: boolean
  requirePkclawLocal: boolean
}

const DEFAULT_PRODUCTION_PKCLAW_BASE_URL = "http://192.144.205.163:8000"

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

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return defaultValue
}

function getPkclawBaseUrl(): string | null {
  const configuredBaseUrl = process.env.PKCLAW_API_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "")
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:8000"
  }

  return DEFAULT_PRODUCTION_PKCLAW_BASE_URL
}

function isRemoteModelDecisionEnabled(): boolean {
  return parseBooleanEnv(process.env.PKCLAW_ALLOW_REMOTE_MODEL_DECISION, false)
}

function isHeuristicFallbackEnabled(): boolean {
  return parseBooleanEnv(
    process.env.PKCLAW_ALLOW_HEURISTIC_FALLBACK,
    process.env.NODE_ENV !== "production",
  )
}

function isPkclawLocalRequired(): boolean {
  return parseBooleanEnv(process.env.PKCLAW_REQUIRE_LOCAL_DECISION, process.env.NODE_ENV === "production")
}

export async function getDecisionBackendStatus(): Promise<DecisionBackendStatus> {
  const baseUrl = getPkclawBaseUrl()
  const pkclawConfigured = Boolean(baseUrl)
  let pkclawHealthy = false
  let pkclawMessage = pkclawConfigured
    ? "PKclaw backend has not been health-checked yet."
    : "PKclaw backend URL is not configured."

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      })

      if (response.ok) {
        pkclawHealthy = true
        pkclawMessage = `PKclaw backend responded from ${baseUrl}.`
      } else {
        pkclawMessage = `PKclaw backend health check failed with ${response.status} ${response.statusText}.`
      }
    } catch (error) {
      pkclawMessage =
        error instanceof Error
          ? `PKclaw backend health check failed: ${error.message}`
          : "PKclaw backend health check failed."
    }
  }

  return {
    pkclawConfigured,
    pkclawHealthy,
    pkclawBaseUrl: baseUrl,
    pkclawMessage,
    remoteModelEnabled: isRemoteModelDecisionEnabled(),
    heuristicFallbackEnabled: isHeuristicFallbackEnabled(),
    requirePkclawLocal: isPkclawLocalRequired(),
  }
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
  source: DecisionSource = "pkclaw_local",
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
      source,
    }
  }

  return {
    action,
    amount,
    reason,
    message,
    source,
  }
}

function rankToValue(rank: string): number {
  if (rank === "A") return 14
  if (rank === "K") return 13
  if (rank === "Q") return 12
  if (rank === "J") return 11
  if (rank === "10") return 10
  return Number(rank)
}

function hasFlushDraw(cards: Card[]): boolean {
  const suitCounts = new Map<string, number>()

  for (const card of cards) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1)
  }

  return Array.from(suitCounts.values()).some((count) => count >= 4)
}

function hasStraightPressure(cards: Card[]): boolean {
  const values = Array.from(
    new Set(
      cards.flatMap((card) => {
        const value = rankToValue(card.rank)
        return value === 14 ? [14, 1] : [value]
      }),
    ),
  ).sort((left, right) => left - right)

  let longestRun = 1
  let currentRun = 1

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] === values[index - 1] + 1) {
      currentRun += 1
      longestRun = Math.max(longestRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  return longestRun >= 4
}

function buildSafeFallbackDecision(data: AIRequest, reason: string): AIResponse {
  if (data.validActions.includes("check")) {
    return {
      action: "check",
      reason,
      message: buildTableMessage(data.locale, "check", data.persona),
      source: "safe_fallback",
    }
  }

  if (
    data.validActions.includes("call") &&
    data.currentBet - data.playerBet <= data.pot * 0.18
  ) {
    return {
      action: "call",
      reason,
      message: buildTableMessage(data.locale, "call", data.persona),
      source: "safe_fallback",
    }
  }

  return {
    action: "fold",
    reason,
    message: buildTableMessage(data.locale, "fold", data.persona),
    source: "safe_fallback",
  }
}

function buildHeuristicFallbackDecision(data: AIRequest): AIResponse {
  const toCall = Math.max(0, data.currentBet - data.playerBet)
  const canCheck = data.validActions.includes("check")
  const canCall = data.validActions.includes("call")
  const canRaise = data.validActions.includes("raise")
  const cheapContinue =
    toCall === 0 ||
    toCall <= Math.max(20, data.pot * 0.22, data.playerChips * 0.12)

  if (data.playerCards.length < 2) {
    return buildSafeFallbackDecision(
      data,
      "Safe fallback: missing hero cards for heuristic decision",
    )
  }

  if (data.phase === "preflop") {
    const [left, right] = data.playerCards
    const leftValue = rankToValue(left.rank)
    const rightValue = rankToValue(right.rank)
    const high = Math.max(leftValue, rightValue)
    const low = Math.min(leftValue, rightValue)
    const isPair = leftValue === rightValue
    const isSuited = left.suit === right.suit
    const isConnected = Math.abs(leftValue - rightValue) <= 1
    const isBroadwayHeavy = low >= 10
    const hasAce = high === 14
    const isPremium = isPair && high >= 10
    const isPlayable =
      isPremium ||
      isBroadwayHeavy ||
      (hasAce && isSuited) ||
      (isConnected && isSuited && high >= 9)

    if (isPremium && canRaise) {
      return {
        action: "raise",
        amount: normalizeAggressiveAmount("raise", data.currentBet * 2.5, data),
        reason:
          "Heuristic fallback: premium preflop continue while PKclaw is unavailable",
        message: buildTableMessage(data.locale, "raise", data.persona),
        source: "heuristic_fallback",
      }
    }

    if (isPlayable) {
      const action = canCheck ? "check" : canCall ? "call" : "fold"
      return {
        action,
        reason:
          "Heuristic fallback: playable preflop continue while PKclaw is unavailable",
        message: buildTableMessage(data.locale, action, data.persona),
        source: "heuristic_fallback",
      }
    }

    if (canCheck) {
      return {
        action: "check",
        reason:
          "Heuristic fallback: free preflop continue while PKclaw is unavailable",
        message: buildTableMessage(data.locale, "check", data.persona),
        source: "heuristic_fallback",
      }
    }

    return buildSafeFallbackDecision(
      data,
      "Safe fallback: weak preflop hand while PKclaw is unavailable",
    )
  }

  const allCards = [...data.playerCards, ...data.communityCards]
  const rankCounts = new Map<number, number>()

  for (const card of allCards) {
    const value = rankToValue(card.rank)
    rankCounts.set(value, (rankCounts.get(value) || 0) + 1)
  }

  const duplicateCounts = Array.from(rankCounts.values()).sort((left, right) => right - left)
  const hasTripsOrBetter = duplicateCounts[0] >= 3
  const pairCount = duplicateCounts.filter((count) => count >= 2).length
  const hasStrongMade = hasTripsOrBetter || pairCount >= 2
  const hasOnePair = duplicateCounts[0] === 2
  const hasDraw = hasFlushDraw(allCards) || hasStraightPressure(allCards)

  if (hasStrongMade && canRaise) {
    return {
      action: "raise",
      amount: normalizeAggressiveAmount(
        "raise",
        Math.max(data.currentBet * 2.2, data.pot * 0.65),
        data,
      ),
      reason:
        "Heuristic fallback: made hand pressure while PKclaw is unavailable",
      message: buildTableMessage(data.locale, "raise", data.persona),
      source: "heuristic_fallback",
    }
  }

  if (hasStrongMade || hasOnePair || hasDraw) {
    const action = canCheck ? "check" : canCall && cheapContinue ? "call" : "fold"
    return {
      action,
      reason:
        "Heuristic fallback: continue with showdown value or draw while PKclaw is unavailable",
      message: buildTableMessage(data.locale, action, data.persona),
      source: "heuristic_fallback",
    }
  }

  if (canCheck) {
    return {
      action: "check",
      reason:
        "Heuristic fallback: take the free card while PKclaw is unavailable",
      message: buildTableMessage(data.locale, "check", data.persona),
      source: "heuristic_fallback",
    }
  }

  if (canCall && cheapContinue) {
    return {
      action: "call",
      reason:
        "Heuristic fallback: cheap continue while PKclaw is unavailable",
      message: buildTableMessage(data.locale, "call", data.persona),
      source: "heuristic_fallback",
    }
  }

  return buildSafeFallbackDecision(
    data,
    "Safe fallback: no profitable continue found while PKclaw is unavailable",
  )
}

async function tryPkclawDecision(data: AIRequest): Promise<AIResponse | null> {
  const baseUrl = getPkclawBaseUrl()

  if (!baseUrl) {
    console.warn(
      "[PKclaw] PKCLAW_API_BASE_URL is missing in production. Skipping local decision bridge.",
    )
    return null
  }

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
      console.warn(
        `[PKclaw] Local decision bridge returned ${response.status} ${response.statusText}.`,
      )
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
      "pkclaw_local",
    )
  } catch (error) {
    console.warn("[PKclaw] Local decision bridge request failed.", error)
    return null
  }
}

async function tryRemoteModelDecision(data: AIRequest): Promise<AIResponse | null> {
  if (!isRemoteModelDecisionEnabled()) {
    return null
  }

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
      "remote_model",
    )
  } catch (error) {
    console.warn("[PKclaw] Remote model decision failed.", error)
    return null
  }
}

export async function getAIDecision(data: AIRequest): Promise<AIResponse> {
  const localDecision = await tryPkclawDecision(data)
  if (localDecision) {
    return localDecision
  }

  if (isPkclawLocalRequired()) {
    return buildSafeFallbackDecision(
      data,
      "PKclaw local decision backend is required but unavailable",
    )
  }

  const remoteDecision = await tryRemoteModelDecision(data)
  if (remoteDecision) {
    return remoteDecision
  }

  if (!isHeuristicFallbackEnabled()) {
    return buildSafeFallbackDecision(
      data,
      "PKclaw local decision backend is unavailable and heuristic fallback is disabled",
    )
  }

  try {
    return buildHeuristicFallbackDecision(data)
  } catch (error) {
    console.warn("[PKclaw] Heuristic fallback failed.", error)
    return buildSafeFallbackDecision(
      data,
      "Safe fallback: PKclaw, remote model, and heuristic decision all failed",
    )
  }
}
