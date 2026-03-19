export type Suit = "♠" | "♥" | "♦" | "♣"
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A"

export interface Card {
  suit: Suit
  rank: Rank
}

export type HandRank =
  | "High Card"
  | "Pair"
  | "Two Pair"
  | "Three of a Kind"
  | "Straight"
  | "Flush"
  | "Full House"
  | "Four of a Kind"
  | "Straight Flush"
  | "Royal Flush"

export interface HandEvaluation {
  rank: HandRank
  rankValue: number
  description: string
  bestCards: Card[]
}

export interface Player {
  id: number
  name: string
  chips: number
  cards: Card[]
  bet: number
  folded: boolean
  isAI: boolean
  position: number
  avatar?: string
  lastAction?: string | null
  persona?: Persona
  currentMessage?: string
  totalHandBet: number // Track total bet across all rounds for side-pot calculation
}

export interface Persona {
  id: string
  name: string
  description: string // For the AI prompt
  style: string // Display name (e.g. "Loose Aggressive")
}

export type GamePhase = "preflop" | "flop" | "turn" | "river" | "showdown"

export interface Winner {
    playerId: number
    amount: number
    hand: HandEvaluation
}

export interface GameState {
  players: Player[]
  communityCards: Card[]
  pot: number
  currentBet: number
  currentPlayerIndex: number
  dealerIndex: number
  phase: GamePhase
  deck: Card[]
  winners?: Winner[]
  actionLog: string[]
}
