'use server'

import { createClient } from '@/utils/supabase/server'
import { buildHandRecordInsert, buildReplayFromHandPayload, buildSampleHandRecord, normalizeHandRecordDetail, normalizeHandRecordList, toHandRecordSummary } from '@/lib/hand-review'
import { getSupabaseMissingMessage, hasSupabaseEnv } from '@/lib/supabase-env'
import type { HandRecordDetail, HandRecordPayload, HandRecordSummary, HandRecordUpsertInput } from '@/types/hand-review'

interface ActionResult {
  ok: boolean
  id?: string
  message?: string
}

const IMPORT_STREETS = new Set(['preflop', 'flop', 'turn', 'river', 'showdown'])

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeImportedPayload(raw: any): HandRecordPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const payload = raw.handPayload && typeof raw.handPayload === 'object' ? raw.handPayload : raw
  const players = Array.isArray(payload.players) ? payload.players : null
  const actions = Array.isArray(payload.actions) ? payload.actions : null

  if (!players || players.length < 2 || !actions) {
    return null
  }

  const boardByStreet = payload.boardByStreet && typeof payload.boardByStreet === 'object'
    ? payload.boardByStreet
    : {}

  const normalizedPlayers = players.map((player: any, index: number) => ({
    id: Number(player.id ?? index),
    seatIndex: Number(player.seatIndex ?? index),
    name: String(player.name ?? `Seat ${index + 1}`),
    isAI: Boolean(player.isAI ?? index !== 0),
    isHero: Boolean(player.isHero ?? index === Number(payload.heroSeat ?? 0)),
    personaId: player.personaId ? String(player.personaId) : null,
    personaStyle: player.personaStyle ? String(player.personaStyle) : null,
    avatar: player.avatar ? String(player.avatar) : null,
    positionLabel: String(player.positionLabel ?? `Seat ${index + 1}`),
    holeCards: stringList(player.holeCards).slice(0, 2),
    startingStack: Number(player.startingStack ?? player.stack ?? 4000),
    endingStack: Number(player.endingStack ?? player.stack ?? 4000),
    totalCommitted: Number(player.totalCommitted ?? 0),
    winnings: Number(player.winnings ?? 0),
    folded: Boolean(player.folded ?? false),
  }))

  return {
    heroSeat: Number(payload.heroSeat ?? 0),
    dealerSeat: Number(payload.dealerSeat ?? 0),
    seatCount: Number(payload.seatCount ?? normalizedPlayers.length),
    blinds: {
      smallBlind: Number(payload.blinds?.smallBlind ?? raw.smallBlind ?? 10),
      bigBlind: Number(payload.blinds?.bigBlind ?? raw.bigBlind ?? 20),
      smallBlindSeat: Number(payload.blinds?.smallBlindSeat ?? 1),
      bigBlindSeat: Number(payload.blinds?.bigBlindSeat ?? 2),
    },
    finalStreet: IMPORT_STREETS.has(String(payload.finalStreet))
      ? payload.finalStreet
      : 'showdown',
    boardByStreet: {
      preflop: stringList(boardByStreet.preflop),
      flop: stringList(boardByStreet.flop),
      turn: stringList(boardByStreet.turn),
      river: stringList(boardByStreet.river),
    },
    finalBoard: stringList(payload.finalBoard),
    players: normalizedPlayers,
    actions: actions.filter((action: unknown): action is string => typeof action === 'string'),
    winners: Array.isArray(payload.winners)
      ? payload.winners.map((winner: any) => ({
          playerId: Number(winner.playerId ?? 0),
          playerName: String(winner.playerName ?? 'Winner'),
          amount: Number(winner.amount ?? 0),
          handRankValue: Number(winner.handRankValue ?? winner.handRank ?? 0),
          handLabel: String(winner.handLabel ?? 'Showdown'),
        }))
      : [],
    notes: stringList(payload.notes),
  }
}

function buildImportTitle(input: string, parsedPayload: HandRecordPayload | null): string {
  if (parsedPayload?.players?.length) {
    const hero = parsedPayload.players.find((player) => player.isHero) ?? parsedPayload.players[0]
    return `${hero.name} imported hand`
  }

  const firstLine = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine ? firstLine.slice(0, 60) : 'Imported hand draft'
}

function buildImportSummary(input: string, parsedPayload: HandRecordPayload | null): string {
  if (parsedPayload) {
    return `Imported hand with ${parsedPayload.players.length} seats and ${parsedPayload.actions.length} logged actions.`
  }

  return `Draft hand note saved for later structuring: ${input.slice(0, 120)}`
}

async function currentUser() {
  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user ?? null
}

export async function listHandRecords(limit = 40): Promise<HandRecordSummary[]> {
  if (!hasSupabaseEnv()) {
    return [toHandRecordSummary(buildSampleHandRecord())]
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('hand_records')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error listing hand records:', error)
    return []
  }

  return normalizeHandRecordList(data ?? [])
}

export async function getHandRecord(handId: string): Promise<HandRecordDetail | null> {
  if (handId === 'demo-preview') {
    return buildSampleHandRecord()
  }

  if (!hasSupabaseEnv()) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('hand_records')
    .select('*')
    .eq('id', handId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching hand record:', error)
    return null
  }

  return normalizeHandRecordDetail(data)
}

export async function saveHandRecord(input: HandRecordUpsertInput): Promise<ActionResult> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: getSupabaseMissingMessage() }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'Please sign in to save hand records.' }
  }

  const replayPayload = input.handPayload
    ? buildReplayFromHandPayload(input.handPayload, {
        handId: 'pending',
        tableName: input.tableName,
        title: input.title,
      })
    : null

  const { data, error } = await supabase
    .from('hand_records')
    .insert({
      user_id: user.id,
      ...buildHandRecordInsert({
        ...input,
        replayPayload,
      }),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving hand record:', error)
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    id: data?.id,
  }
}

export async function createImportedHandRecord(rawInput: string): Promise<ActionResult> {
  const input = rawInput.trim()

  if (!input) {
    return { ok: false, message: 'Please provide a hand description or structured payload.' }
  }

  const user = await currentUser()

  if (!user) {
    return {
      ok: false,
      message: hasSupabaseEnv()
        ? 'Please sign in before importing hands.'
        : getSupabaseMissingMessage(),
    }
  }

  let parsedPayload: HandRecordPayload | null = null

  try {
    parsedPayload = normalizeImportedPayload(JSON.parse(input))
  } catch {
    parsedPayload = null
  }

  return saveHandRecord({
    source: parsedPayload ? 'imported' : 'reconstructed',
    status: parsedPayload ? 'reconstructed' : 'draft',
    title: buildImportTitle(input, parsedPayload),
    tableName: 'PokerMind Review Desk',
    heroName:
      parsedPayload?.players.find((player) => player.isHero)?.name ??
      parsedPayload?.players[0]?.name ??
      'Hero',
    heroSeat: parsedPayload?.heroSeat ?? 0,
    seatCount: parsedPayload?.seatCount ?? 0,
    smallBlind: parsedPayload?.blinds.smallBlind ?? 10,
    bigBlind: parsedPayload?.blinds.bigBlind ?? 20,
    finalStreet: parsedPayload?.finalStreet ?? 'showdown',
    actionCount: parsedPayload?.actions.length ?? 0,
    heroProfit: parsedPayload
      ? (() => {
          const hero = parsedPayload.players.find((player) => player.isHero)
          return hero ? hero.winnings - hero.totalCommitted : 0
        })()
      : 0,
    potSize:
      parsedPayload?.winners.reduce((sum, winner) => sum + winner.amount, 0) ??
      0,
    summary: buildImportSummary(input, parsedPayload),
    tags: parsedPayload ? ['imported', 'replay-ready'] : ['draft', 'needs-structuring'],
    rawInput: input,
    handPayload: parsedPayload,
    analysisPayload: parsedPayload
      ? {
          importMode: 'structured',
          replayReady: true,
        }
      : {
          importMode: 'draft',
          replayReady: false,
        },
  })
}
