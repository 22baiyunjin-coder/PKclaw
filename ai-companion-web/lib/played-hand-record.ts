import type { HandRecordUpsertInput } from "@/types/hand-review"
import type { Card, GameState } from "@/lib/poker-types"

const TABLE_POSITIONS = ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"]

function formatCard(card: Card): string {
  const suitMap: Record<string, string> = {
    "♠": "s",
    "♥": "h",
    "♦": "d",
    "♣": "c",
  }

  return `${card.rank}${suitMap[card.suit] ?? "s"}`
}

function positionLabel(seatIndex: number, dealerSeat: number, seatCount: number): string {
  const labels = TABLE_POSITIONS.slice(0, Math.max(2, seatCount))
  const offset = (seatIndex - dealerSeat + seatCount) % seatCount
  return labels[offset] ?? `Seat ${seatIndex + 1}`
}

export function buildPlayedHandRecordInput(state: GameState): HandRecordUpsertInput | null {
  const hero = state.players.find((player) => player.id === 0)

  if (!hero) {
    return null
  }

  const winners = state.winners ?? []
  const heroWinnings = winners
    .filter((winner) => winner.playerId === hero.id)
    .reduce((sum, winner) => sum + winner.amount, 0)
  const heroProfit = heroWinnings - hero.totalHandBet
  const finalBoard = state.communityCards.map(formatCard)
  const heroCardsLabel = hero.cards.map(formatCard).join(" ")
  const timestamp = new Date().toLocaleString("sv-SE", { hour12: false }).replace(" ", " ")

  const payloadPlayers = state.players.map((player, index) => {
    const winnings = winners
      .filter((winner) => winner.playerId === player.id)
      .reduce((sum, winner) => sum + winner.amount, 0)
    const startingStack = player.chips + player.totalHandBet - winnings

    return {
      id: player.id,
      seatIndex: index,
      name: player.name,
      isAI: player.isAI,
      isHero: player.id === hero.id,
      personaId: player.persona?.id ?? null,
      personaStyle: player.persona?.style ?? null,
      avatar: player.avatar ?? null,
      positionLabel: positionLabel(index, state.dealerIndex, state.players.length),
      holeCards: player.cards.map(formatCard),
      startingStack,
      endingStack: player.chips,
      totalCommitted: player.totalHandBet,
      winnings,
      folded: player.folded,
    }
  })

  const handPayload = {
    heroSeat: 0,
    dealerSeat: state.dealerIndex,
    seatCount: state.players.length,
    blinds: {
      smallBlind: 10,
      bigBlind: 20,
      smallBlindSeat: (state.dealerIndex + 1) % state.players.length,
      bigBlindSeat: (state.dealerIndex + 2) % state.players.length,
    },
    finalStreet: state.phase,
    boardByStreet: {
      preflop: [],
      flop: finalBoard.slice(0, 3),
      turn: finalBoard.slice(0, 4),
      river: finalBoard.slice(0, 5),
    },
    finalBoard,
    players: payloadPlayers,
    actions: state.actionLog,
    winners: winners.map((winner) => {
      const player = state.players.find((seat) => seat.id === winner.playerId)

      return {
        playerId: winner.playerId,
        playerName: player?.name ?? `Seat ${winner.playerId + 1}`,
        amount: winner.amount,
        handRankValue: winner.hand.rankValue,
        handLabel: winner.hand.rank,
      }
    }),
    notes: [
      hero.folded ? "hero_folded" : "hero_reached_showdown",
      heroProfit >= 0 ? "profitable" : "losing",
      `final_street:${state.phase}`,
    ],
  }

  const summary =
    heroProfit >= 0
      ? `Hero finished the hand up ${heroProfit} after reaching ${state.phase}.`
      : `Hero lost ${Math.abs(heroProfit)} in a hand ending on ${state.phase}.`

  return {
    source: "played",
    status: "recorded",
    title: `${heroCardsLabel} • ${timestamp}`,
    tableName: "PokerMind Hand Review",
    heroName: hero.name,
    heroSeat: 0,
    seatCount: state.players.length,
    smallBlind: 10,
    bigBlind: 20,
    finalStreet: state.phase,
    actionCount: state.actionLog.length,
    heroProfit,
    potSize: winners.reduce((sum, winner) => sum + winner.amount, 0),
    summary,
    tags: [
      "played",
      state.phase,
      heroProfit >= 0 ? "win" : "loss",
      hero.folded ? "folded" : "showdown",
    ],
    rawInput: null,
    handPayload,
    analysisPayload: {
      heroCards: hero.cards.map(formatCard),
      heroReachedShowdown: !hero.folded,
      winnerCount: winners.length,
    },
  }
}
