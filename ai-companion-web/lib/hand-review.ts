import { buildReplayPreview } from "@/lib/replayPreview"
import type { HandRecordDetail, HandRecordPayload, HandRecordSummary, HandRecordUpsertInput } from "@/types/hand-review"
import type { ReplayEvent, ReplayHand, ReplayPlayer, ReplaySnapshot, TableSeatKey, TableStreet } from "@/types/replay"

const STREETS: TableStreet[] = ["preflop", "flop", "turn", "river"]
const TABLE_POSITIONS = ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"]
const SEAT_KEYS_BY_OFFSET: TableSeatKey[] = [
  "bottom",
  "lowerLeft",
  "midLeft",
  "upperLeft",
  "top",
  "upperRight",
  "midRight",
  "lowerRight",
]

interface ReplayBuildState {
  street: TableStreet
  board: string[]
  pot: number
  currentBet: number
  players: ReplayPlayer[]
  events: ReplayEvent[]
}

interface ParsedAction {
  street: TableStreet
  playerName: string
  action: "fold" | "check" | "call" | "bet" | "raise" | "all-in"
  amount: number
}

function clonePlayers(players: ReplayPlayer[]): ReplayPlayer[] {
  return players.map((player) => ({
    ...player,
    holeCards: [...player.holeCards] as [string, string],
  }))
}

function formatStreetLabel(street: TableStreet): string {
  return street.charAt(0).toUpperCase() + street.slice(1)
}

function createSnapshot(
  state: ReplayBuildState,
  headline: string,
  actingPlayer?: string | null,
  winners: string[] = [],
): ReplaySnapshot {
  return {
    street: state.street,
    board: [...state.board],
    pot: Math.max(0, state.pot),
    headline,
    actingPlayer: actingPlayer ?? null,
    winners,
    players: clonePlayers(state.players),
  }
}

function pushEvent(
  state: ReplayBuildState,
  kind: ReplayEvent["kind"],
  label: string,
  headline: string,
  actingPlayer?: string | null,
  action?: ReplayEvent["action"],
  winners: string[] = [],
) {
  state.events.push({
    kind,
    street: state.street,
    label,
    snapshot: createSnapshot(state, headline, actingPlayer, winners),
    action,
  })
}

function playerByName(state: ReplayBuildState, name: string): ReplayPlayer {
  const found = state.players.find((player) => player.name === name)

  if (!found) {
    throw new Error(`Unknown hand review player: ${name}`)
  }

  return found
}

function mapPositionLabel(seatIndex: number, dealerSeat: number, seatCount: number): string {
  const labels = TABLE_POSITIONS.slice(0, Math.max(2, seatCount))
  const offset = (seatIndex - dealerSeat + seatCount) % seatCount
  return labels[offset] ?? `Seat ${seatIndex + 1}`
}

function mapSeatKey(seatIndex: number, heroSeat: number): TableSeatKey {
  const offset = (seatIndex - heroSeat + SEAT_KEYS_BY_OFFSET.length) % SEAT_KEYS_BY_OFFSET.length
  return SEAT_KEYS_BY_OFFSET[offset] ?? "top"
}

function normalizeHoleCards(cards: string[]): [string, string] {
  if (cards.length >= 2) {
    return [cards[0], cards[1]]
  }

  if (cards.length === 1) {
    return [cards[0], "??"]
  }

  return ["??", "??"]
}

function buildReplayPlayers(payload: HandRecordPayload): ReplayPlayer[] {
  return payload.players
    .slice()
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player) => ({
      seatKey: mapSeatKey(player.seatIndex, payload.heroSeat),
      position: player.positionLabel || mapPositionLabel(player.seatIndex, payload.dealerSeat, payload.seatCount),
      name: player.name,
      personaId: player.personaId || "pkmind_core",
      stack: player.startingStack,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: player.isHero ? "hero ready" : "waiting",
      status: player.isHero ? "hero" : "waiting",
      holeCards: normalizeHoleCards(player.holeCards),
    }))
}

function resetStreetBets(state: ReplayBuildState) {
  state.currentBet = 0
  state.players.forEach((player) => {
    player.streetBet = 0
    if (player.inHand && !player.allIn) {
      player.status = player.seatKey === "bottom" ? "hero" : "waiting"
      player.lastAction = "waiting"
    }
  })
}

function applyBlind(state: ReplayBuildState, playerName: string, amount: number, label: string) {
  const player = playerByName(state, playerName)

  player.stack -= amount
  player.streetBet += amount
  player.totalCommitted += amount
  player.lastAction = label
  player.status = "posted"
  state.pot += amount
  state.currentBet = Math.max(state.currentBet, player.streetBet)
}

function pushStreetDeal(state: ReplayBuildState, street: TableStreet, board: string[]) {
  state.street = street
  state.board = board
  resetStreetBets(state)
  pushEvent(
    state,
    "street_deal",
    `${formatStreetLabel(street)} dealt`,
    street === "flop"
      ? "The flop lands and the table resets."
      : street === "turn"
        ? "Turn card changes the pressure profile."
        : "River card freezes the final texture.",
  )
}

function parseAmount(fragment: string): number {
  const match = fragment.match(/(-?\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function parseActionLog(actionLog: string[]): ParsedAction[] {
  const parsed: ParsedAction[] = []

  for (const line of actionLog) {
    if (!line || !line.includes(":")) {
      continue
    }

    const [streetText, detailText] = line.split(":", 2)
    const street = streetText.trim().toLowerCase() as TableStreet

    if (!STREETS.includes(street)) {
      continue
    }

    const detail = detailText.trim()
    const actionMatchers: Array<{
      action: ParsedAction["action"]
      pattern: RegExp
    }> = [
      { action: "raise", pattern: /^(.*)\sRaise to\s([\d.]+)$/i },
      { action: "all-in", pattern: /^(.*)\sAll-in\s([\d.]+)$/i },
      { action: "call", pattern: /^(.*)\sCall\s([\d.]+)$/i },
      { action: "check", pattern: /^(.*)\sCheck$/i },
      { action: "fold", pattern: /^(.*)\sFold$/i },
      { action: "bet", pattern: /^(.*)\sBet\s([\d.]+)$/i },
    ]

    for (const matcher of actionMatchers) {
      const match = detail.match(matcher.pattern)
      if (!match) {
        continue
      }

      parsed.push({
        street,
        playerName: match[1].trim(),
        action: matcher.action,
        amount: match[2] ? Number(match[2]) : 0,
      })
      break
    }
  }

  return parsed
}

function applyParsedAction(state: ReplayBuildState, parsed: ParsedAction) {
  const player = playerByName(state, parsed.playerName)

  state.players.forEach((seat) => {
    if (seat.name !== player.name && seat.inHand && !seat.allIn && seat.status === "acting") {
      seat.status = seat.seatKey === "bottom" ? "hero" : "waiting"
    }
  })

  player.status = "acting"

  if (parsed.action === "fold") {
    player.inHand = false
    player.lastAction = "fold"
    player.status = "folded"
  } else if (parsed.action === "check") {
    player.lastAction = "check"
    player.status = "checked"
  } else if (parsed.action === "call") {
    player.stack -= parsed.amount
    player.streetBet += parsed.amount
    player.totalCommitted += parsed.amount
    player.lastAction = `call ${parsed.amount}`
    player.status = "called"
    state.pot += parsed.amount
  } else if (parsed.action === "raise" || parsed.action === "bet") {
    const targetBet = parsed.amount
    const needed = Math.max(0, targetBet - player.streetBet)

    player.stack -= needed
    player.streetBet = targetBet
    player.totalCommitted += needed
    player.lastAction = `${parsed.action} to ${targetBet}`
    player.status = parsed.action === "bet" ? "bet" : "raised"
    state.currentBet = Math.max(state.currentBet, targetBet)
    state.pot += needed
  } else if (parsed.action === "all-in") {
    player.stack -= parsed.amount
    player.streetBet += parsed.amount
    player.totalCommitted += parsed.amount
    player.lastAction = `all-in ${parsed.amount}`
    player.status = "raised"
    player.allIn = true
    state.currentBet = Math.max(state.currentBet, player.streetBet)
    state.pot += parsed.amount
  }

  if (player.stack <= 0) {
    player.stack = 0
    player.allIn = true
  }

  const actionLabel =
    parsed.action === "raise" || parsed.action === "bet"
      ? `${parsed.playerName} ${parsed.action}s to ${parsed.amount}`
      : parsed.amount > 0
        ? `${parsed.playerName} ${parsed.action} ${parsed.amount}`
        : `${parsed.playerName} ${parsed.action}`

  pushEvent(
    state,
    "action",
    actionLabel,
    `${parsed.playerName} chooses ${parsed.action}.`,
    parsed.playerName,
    {
      playerName: parsed.playerName,
      action: parsed.action,
      amount: parsed.amount || undefined,
    },
  )
}

export function buildReplayFromHandPayload(
  payload: HandRecordPayload,
  meta: {
    handId: string
    tableName: string
    title: string
  },
): ReplayHand {
  const players = buildReplayPlayers(payload)
  const state: ReplayBuildState = {
    street: "preflop",
    board: [],
    pot: 0,
    currentBet: 0,
    players,
    events: [],
  }

  pushEvent(
    state,
    "hand_start",
    "Hand start",
    meta.title,
    players.find((player) => player.seatKey === "bottom")?.name ?? null,
  )

  const sbPlayer = payload.players.find(
    (player) => player.seatIndex === payload.blinds.smallBlindSeat,
  )
  const bbPlayer = payload.players.find(
    (player) => player.seatIndex === payload.blinds.bigBlindSeat,
  )

  if (sbPlayer) {
    applyBlind(state, sbPlayer.name, payload.blinds.smallBlind, `posts ${payload.blinds.smallBlind}`)
    pushEvent(
      state,
      "blind_post",
      `${sbPlayer.name} posts small blind`,
      `${sbPlayer.name} opens the hand with the small blind.`,
      sbPlayer.name,
      { playerName: sbPlayer.name, action: "bet", amount: payload.blinds.smallBlind },
    )
  }

  if (bbPlayer) {
    applyBlind(state, bbPlayer.name, payload.blinds.bigBlind, `posts ${payload.blinds.bigBlind}`)
    pushEvent(
      state,
      "blind_post",
      `${bbPlayer.name} posts big blind`,
      `${bbPlayer.name} completes the forced blind.`,
      bbPlayer.name,
      { playerName: bbPlayer.name, action: "bet", amount: payload.blinds.bigBlind },
    )
  }

  const parsedActions = parseActionLog(payload.actions)
  const finalStreetIndex =
    payload.finalStreet === "showdown"
      ? STREETS.findLastIndex((street) => (payload.boardByStreet[street] ?? []).length > 0)
      : STREETS.indexOf(payload.finalStreet)

  for (const street of STREETS) {
    const streetIndex = STREETS.indexOf(street)
    const shouldRevealStreet =
      street !== "preflop" &&
      streetIndex <= finalStreetIndex &&
      (payload.boardByStreet[street] ?? []).length > state.board.length

    if (shouldRevealStreet) {
      pushStreetDeal(state, street, payload.boardByStreet[street] ?? [])
    }

    parsedActions
      .filter((action) => action.street === street)
      .forEach((action) => applyParsedAction(state, action))
  }

  const winnerNames = payload.winners.map((winner) => winner.playerName)

  payload.winners.forEach((winner) => {
    const player = state.players.find((item) => item.name === winner.playerName)
    if (!player) {
      return
    }

    player.stack += winner.amount
    player.lastAction = `wins ${winner.amount}`
    player.status = "winner"
  })

  pushEvent(
    state,
    "showdown",
    winnerNames.length > 0 ? `${winnerNames.join(", ")} win(s)` : "Showdown",
    winnerNames.length > 0
      ? `${winnerNames.join(", ")} collect the pot.`
      : "The hand reaches showdown.",
    winnerNames[0] ?? null,
    undefined,
    winnerNames,
  )

  state.pot = 0

  pushEvent(
    state,
    "hand_complete",
    "Hand complete",
    payload.winners.length > 0
      ? `Replay complete. ${payload.winners[0].playerName} takes the lead.`
      : "Replay complete.",
    null,
    undefined,
    winnerNames,
  )

  return {
    handId: meta.handId,
    tableName: meta.tableName,
    smallBlind: payload.blinds.smallBlind,
    bigBlind: payload.blinds.bigBlind,
    stageGoal: meta.title,
    seedLabel: "Recorded hand",
    events: state.events,
  }
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function normalizeRecord(raw: any): HandRecordDetail {
  return {
    id: String(raw.id),
    source: raw.source,
    status: raw.status,
    title: raw.title,
    tableName: raw.table_name,
    heroName: raw.hero_name,
    heroSeat: Number(raw.hero_seat ?? 0),
    seatCount: Number(raw.seat_count ?? 0),
    smallBlind: Number(raw.small_blind ?? 0),
    bigBlind: Number(raw.big_blind ?? 0),
    finalStreet: raw.final_street,
    actionCount: Number(raw.action_count ?? 0),
    heroProfit: Number(raw.hero_profit ?? 0),
    potSize: Number(raw.pot_size ?? 0),
    summary: raw.summary ?? "",
    tags: textArray(raw.tags),
    createdAt: raw.created_at ?? new Date().toISOString(),
    rawInput: raw.raw_input ?? null,
    handPayload: (raw.hand_payload as HandRecordPayload | null) ?? null,
    replayPayload: (raw.replay_payload as ReplayHand | null) ?? null,
    analysisPayload:
      raw.analysis_payload && typeof raw.analysis_payload === "object"
        ? raw.analysis_payload
        : null,
  }
}

export function toHandRecordSummary(detail: HandRecordDetail): HandRecordSummary {
  return {
    id: detail.id,
    source: detail.source,
    status: detail.status,
    title: detail.title,
    tableName: detail.tableName,
    heroName: detail.heroName,
    heroSeat: detail.heroSeat,
    seatCount: detail.seatCount,
    smallBlind: detail.smallBlind,
    bigBlind: detail.bigBlind,
    finalStreet: detail.finalStreet,
    actionCount: detail.actionCount,
    heroProfit: detail.heroProfit,
    potSize: detail.potSize,
    summary: detail.summary,
    tags: detail.tags,
    createdAt: detail.createdAt,
  }
}

export function normalizeHandRecordList(rows: any[]): HandRecordSummary[] {
  return rows.map((row) => toHandRecordSummary(normalizeRecord(row)))
}

export function normalizeHandRecordDetail(row: any): HandRecordDetail {
  return normalizeRecord(row)
}

export function buildHandRecordInsert(input: HandRecordUpsertInput) {
  return {
    source: input.source,
    status: input.status,
    title: input.title,
    table_name: input.tableName,
    hero_name: input.heroName,
    hero_seat: input.heroSeat,
    seat_count: input.seatCount,
    small_blind: input.smallBlind,
    big_blind: input.bigBlind,
    final_street: input.finalStreet,
    action_count: input.actionCount,
    hero_profit: input.heroProfit,
    pot_size: input.potSize,
    summary: input.summary,
    tags: input.tags ?? [],
    raw_input: input.rawInput ?? null,
    hand_payload: input.handPayload,
    replay_payload: input.replayPayload ?? null,
    analysis_payload: input.analysisPayload ?? null,
  }
}

export function buildSampleHandRecord(): HandRecordDetail {
  const replay = buildReplayPreview(2403)

  return {
    id: "demo-preview",
    source: "reconstructed",
    status: "reconstructed",
    title: "Demo replay: text import to reconstructed hand",
    tableName: replay.tableName,
    heroName: "Hero",
    heroSeat: 0,
    seatCount: 8,
    smallBlind: replay.smallBlind,
    bigBlind: replay.bigBlind,
    finalStreet: "river",
    actionCount: replay.events.filter((event) => event.kind === "action").length,
    heroProfit: 180,
    potSize: replay.events[replay.events.length - 2]?.snapshot.pot ?? 0,
    summary:
      "This sample shows how a stored hand can be replayed, discussed, and later branched into simulation.",
    tags: ["demo", "replay", "import"],
    createdAt: new Date().toISOString(),
    rawInput:
      "Hero defends AQs, flop goes c-bet call, turn pressure holds, river shifts range advantage back to Hero.",
    handPayload: null,
    replayPayload: replay,
    analysisPayload: null,
  }
}
