import type { Card, Suit, Rank, HandEvaluation } from "./poker-types"

const suits: Suit[] = ["♠", "♥", "♦", "♣"]
const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getRankValue(rank: Rank): number {
  const rankValues: Record<Rank, number> = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  }
  return rankValues[rank]
}

function sortCardsByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
}

function isFlush(cards: Card[]): boolean {
  const suits = cards.map((c) => c.suit)
  return suits.every((s) => s === suits[0])
}

function isStraight(cards: Card[]): boolean {
  const sorted = sortCardsByRank(cards)
  const values = sorted.map((c) => getRankValue(c.rank))

  // Check regular straight
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // Check for A-2-3-4-5 straight (wheel)
      if (values[0] === 14) {
        const wheelValues = [14, 5, 4, 3, 2]
        // Check if we have A, 5, 4, 3, 2
        // Note: Input cards are sorted descending, so A is at 0. 
        // We need to check if other cards are 5, 4, 3, 2
        const hasWheel = wheelValues.slice(1).every(v => values.includes(v))
        return hasWheel
      }
      return false
    }
  }
  return true
}

// 辅助函数：将牌型转换为可比较的数值
// Base score:
// High Card: 10000000000 * 1
// Pair: 10000000000 * 2
// ...
// Royal Flush: 10000000000 * 10
// 加上踢脚分：
// c1 * 100000000 + c2 * 1000000 + c3 * 10000 + c4 * 100 + c5
function calculateScore(typeScore: number, kickers: number[]): number {
  let score = typeScore * 10000000000
  let multiplier = 100000000
  for (const kicker of kickers) {
    score += kicker * multiplier
    multiplier /= 100
  }
  return score
}

export function evaluateHand(playerCards: Card[], communityCards: Card[]): HandEvaluation {
  const allCards = [...playerCards, ...communityCards]

  // Generate all possible 5-card combinations
  const combinations: Card[][] = []
  if (allCards.length < 5) {
     // 处理手牌不足5张的情况（例如只发了2张牌时预估）
     // 此时只评估手牌
     return evaluateFiveCards(allCards.length > 5 ? allCards.slice(0, 5) : allCards)
  }

  // 简单的组合生成
  const getCombinations = (arr: Card[], k: number): Card[][] => {
      if (k === 1) return arr.map(e => [e]);
      const res: Card[][] = [];
      arr.forEach((e, i) => {
          const sub = getCombinations(arr.slice(i + 1), k - 1);
          sub.forEach(s => res.push([e, ...s]));
      });
      return res;
  }
  
  const combos = getCombinations(allCards, 5)

  let bestHand: HandEvaluation | null = null

  for (const combo of combos) {
    const evaluation = evaluateFiveCards(combo)
    if (!bestHand || evaluation.rankValue > bestHand.rankValue) {
      bestHand = evaluation
    }
  }

  return bestHand!
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const sorted = sortCardsByRank(cards)
  const ranks = sorted.map((c) => getRankValue(c.rank))
  const rankCounts = new Map<number, number>()

  ranks.forEach((rank) => {
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1)
  })

  // 按数量分组：[[count, rank], ...]
  const countEntries = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1] // Count descending
    return b[0] - a[0] // Rank descending
  })

  const isFlushHand = isFlush(cards)
  const isStraightHand = isStraight(cards)
  
  // 处理 A-5 顺子的特殊排序 (5, 4, 3, 2, A) 用于踢脚计算
  // 如果是 A-5 顺子，最大牌应该是 5
  let straightHighCard = ranks[0]
  if (isStraightHand && ranks[0] === 14 && ranks[1] === 5) {
      straightHighCard = 5
  }

  // Royal Flush
  if (isFlushHand && isStraightHand && straightHighCard === 14 && ranks[1] === 13) { // Ensure it's A-K-Q-J-10
    return {
      rank: "Royal Flush",
      rankValue: calculateScore(10, []),
      description: "皇家同花顺！",
      bestCards: sorted,
    }
  }

  // Straight Flush
  if (isFlushHand && isStraightHand) {
    return {
      rank: "Straight Flush",
      rankValue: calculateScore(9, [straightHighCard]),
      description: "同花顺",
      bestCards: sorted,
    }
  }

  // Four of a Kind
  if (countEntries.length > 0 && countEntries[0][1] === 4) {
    return {
      rank: "Four of a Kind",
      rankValue: calculateScore(8, [countEntries[0][0], countEntries[1]?.[0] || 0]),
      description: "四条",
      bestCards: sorted,
    }
  }

  // Full House
  if (countEntries.length > 1 && countEntries[0][1] === 3 && countEntries[1][1] === 2) {
    return {
      rank: "Full House",
      rankValue: calculateScore(7, [countEntries[0][0], countEntries[1][0]]),
      description: "葫芦",
      bestCards: sorted,
    }
  }

  // Flush
  if (isFlushHand) {
    return {
      rank: "Flush",
      rankValue: calculateScore(6, ranks),
      description: "同花",
      bestCards: sorted,
    }
  }

  // Straight
  if (isStraightHand) {
    return {
      rank: "Straight",
      rankValue: calculateScore(5, [straightHighCard]),
      description: "顺子",
      bestCards: sorted,
    }
  }

  // Three of a Kind
  if (countEntries.length > 0 && countEntries[0][1] === 3) {
    return {
      rank: "Three of a Kind",
      rankValue: calculateScore(4, [countEntries[0][0], countEntries[1]?.[0] || 0, countEntries[2]?.[0] || 0]),
      description: "三条",
      bestCards: sorted,
    }
  }

  // Two Pair
  if (countEntries.length > 1 && countEntries[0][1] === 2 && countEntries[1][1] === 2) {
    return {
      rank: "Two Pair",
      rankValue: calculateScore(3, [countEntries[0][0], countEntries[1][0], countEntries[2]?.[0] || 0]),
      description: "两对",
      bestCards: sorted,
    }
  }

  // Pair
  if (countEntries.length > 0 && countEntries[0][1] === 2) {
    return {
      rank: "Pair",
      rankValue: calculateScore(2, [
        countEntries[0][0], 
        countEntries[1]?.[0] || 0, 
        countEntries[2]?.[0] || 0, 
        countEntries[3]?.[0] || 0
      ]),
      description: "一对",
      bestCards: sorted,
    }
  }

  // High Card
  return {
    rank: "High Card",
    rankValue: calculateScore(1, ranks),
    description: "高牌",
    bestCards: sorted,
  }
}

export function calculateWinProbability(playerCards: Card[], communityCards: Card[]): number {
  // Simplified Monte Carlo simulation
  // 如果牌局未开始或刚开始，减少模拟次数以提高性能
  const simulations = communityCards.length === 0 ? 500 : 1000
  let wins = 0
  let ties = 0

  const myDeck = createDeck()
  // Remove known cards
  const knownCards = [...playerCards, ...communityCards]
  const remainingCards = myDeck.filter(
    (card) => !knownCards.some((k) => k.rank === card.rank && k.suit === card.suit)
  )

  for (let i = 0; i < simulations; i++) {
    const shuffled = shuffleDeck([...remainingCards]) // Use a copy
    
    // Simulate opponent (1 random opponent)
    const opponentCards = [shuffled[0], shuffled[1]]
    
    // Simulate community
    const neededCommunity = 5 - communityCards.length
    const simulatedCommunity = [...communityCards, ...shuffled.slice(2, 2 + neededCommunity)]

    const playerEval = evaluateHand(playerCards, simulatedCommunity)
    const opponentEval = evaluateHand(opponentCards, simulatedCommunity)

    if (playerEval.rankValue > opponentEval.rankValue) {
      wins++
    } else if (playerEval.rankValue === opponentEval.rankValue) {
      ties++
    }
  }

  // Return win rate + half of tie rate
  return Math.round(((wins + ties / 2) / simulations) * 100)
}

export function getActionRecommendation(
  playerCards: Card[],
  communityCards: Card[],
  currentBet: number,
  playerChips: number,
  pot: number,
): string {
  const winProb = calculateWinProbability(playerCards, communityCards)
  // Pot odds = Cost to Call / (Total Pot after Call)
  // If currentBet is 0, pot odds are 0 (free to check)
  const callAmount = currentBet
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0

  if (winProb > 80) return "绝佳牌力！建议加注或 All-in"
  if (winProb > 60) return "强牌！建议加注"
  
  if (callAmount === 0) {
      return "免费看牌 (Check)"
  }

  // Basic Expected Value check: WinProb > PotOdds
  if (winProb / 100 > potOdds + 0.1) return "赔率合适，建议跟注" // Add buffer
  if (winProb / 100 > potOdds) return "勉强可跟，注意观察"
  
  if (winProb < 20) return "建议弃牌"
  
  return "建议弃牌"
}
