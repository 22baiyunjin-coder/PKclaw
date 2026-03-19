export type ChatRole = "system" | "user" | "assistant"
export type CompanionState = "idle" | "thinking" | "replying" | "error"
export type ReplyProvider = "mock" | "minimax"

export interface ChatMessage {
  id: string
  role: Exclude<ChatRole, "system">
  content: string
  createdAt: string
}

export interface ChatMessagePayload {
  role: ChatRole
  content: string
}

export interface ChatSeatSummary {
  seat: number
  name: string
  chips: number
  bet: number
  folded: boolean
  isAI: boolean
  lastAction?: string | null
  personaStyle?: string
}

export interface ChatHandContext {
  snapshot: {
    street: string
    pot: number
    currentBet: number
    actingPlayer: string
    board: string[]
    hero: {
      name: string
      chips: number
      bet: number
      cards: string[]
    }
    seats: ChatSeatSummary[]
  }
  event: {
    street: string
    actionLog: string[]
    lastAction: string | null
  }
}

export interface ChatApiRequest {
  messages: ChatMessagePayload[]
  handContext?: ChatHandContext | null
}

export interface ChatApiResponse {
  reply: ChatMessage
  provider: ReplyProvider
}

export interface ModelReply {
  content: string
  provider: ReplyProvider
}
