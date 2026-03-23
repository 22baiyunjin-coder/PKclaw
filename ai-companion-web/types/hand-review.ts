import type { ReplayHand } from "@/types/replay"

export type HandRecordSource =
  | "played"
  | "imported"
  | "reconstructed"
  | "simulated"

export type HandRecordStatus =
  | "recorded"
  | "draft"
  | "reconstructed"
  | "simulated"

export interface HandRecordPlayer {
  id: number
  seatIndex: number
  name: string
  isAI: boolean
  isHero: boolean
  personaId?: string | null
  personaStyle?: string | null
  avatar?: string | null
  positionLabel: string
  holeCards: string[]
  startingStack: number
  endingStack: number
  totalCommitted: number
  winnings: number
  folded: boolean
}

export interface HandRecordWinner {
  playerId: number
  playerName: string
  amount: number
  handRankValue: number
  handLabel: string
}

export interface HandRecordPayload {
  heroSeat: number
  dealerSeat: number
  seatCount: number
  blinds: {
    smallBlind: number
    bigBlind: number
    smallBlindSeat: number
    bigBlindSeat: number
  }
  finalStreet: "preflop" | "flop" | "turn" | "river" | "showdown"
  boardByStreet: {
    preflop: string[]
    flop: string[]
    turn: string[]
    river: string[]
  }
  finalBoard: string[]
  players: HandRecordPlayer[]
  actions: string[]
  winners: HandRecordWinner[]
  notes?: string[]
}

export interface HandRecordUpsertInput {
  source: HandRecordSource
  status: HandRecordStatus
  title: string
  tableName: string
  heroName: string
  heroSeat: number
  seatCount: number
  smallBlind: number
  bigBlind: number
  finalStreet: HandRecordPayload["finalStreet"]
  actionCount: number
  heroProfit: number
  potSize: number
  summary: string
  tags?: string[]
  rawInput?: string | null
  handPayload: HandRecordPayload | null
  replayPayload?: ReplayHand | null
  analysisPayload?: Record<string, unknown> | null
}

export interface HandRecordSummary {
  id: string
  source: HandRecordSource
  status: HandRecordStatus
  title: string
  tableName: string
  heroName: string
  heroSeat: number
  seatCount: number
  smallBlind: number
  bigBlind: number
  finalStreet: HandRecordPayload["finalStreet"]
  actionCount: number
  heroProfit: number
  potSize: number
  summary: string
  tags: string[]
  createdAt: string
}

export interface HandRecordDetail extends HandRecordSummary {
  rawInput?: string | null
  handPayload: HandRecordPayload | null
  replayPayload: ReplayHand | null
  analysisPayload?: Record<string, unknown> | null
}
