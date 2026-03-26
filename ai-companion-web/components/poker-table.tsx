"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { PokerCard } from "@/components/poker-card"
import { PlayerSeat } from "@/components/player-seat"
import { HandAnalysis } from "@/components/hand-analysis"
import { LandscapePrompt } from "@/components/landscape-prompt"
import type { GameState, Player, HandEvaluation, Winner, Persona } from "@/lib/poker-types"
import {
  createDeck,
  shuffleDeck,
  evaluateHand,
  calculateWinProbability,
  getActionRecommendation,
  getRankValue,
} from "@/lib/poker-logic"
import { cn } from "@/lib/utils"
import {
  getAIDecision,
  getDecisionBackendStatus,
  type DecisionBackendStatus,
  type DecisionSource,
} from "@/app/actions/poker-ai"
import { getUserProfile, saveGameResult } from "@/app/actions/game-history"
import { saveHandRecord } from "@/app/actions/hand-records"
import { getPersonas } from "@/app/actions/personas"
import { toast } from "sonner"
import { SessionScoreboard } from "@/components/session-scoreboard"
import { RebuyDialog } from "@/components/rebuy-dialog"
import { PokerControls } from "@/components/poker-controls"
import { LanguageSwitcher } from "@/components/language-switcher"
import { GameChatPanel } from "@/components/game-chat-panel"
import { ChevronRight, Settings2, LogOut, Trophy, Coins, User, Activity } from "lucide-react"
import { AI_PERSONAS as DEFAULT_PERSONAS } from "@/lib/ai-personas"
import { playSound } from "@/lib/audio"
import { buildPlayedHandRecordInput } from "@/lib/played-hand-record"
import { GameSetup } from "@/components/game-setup"
import { type Locale, pickText, readClientLocale } from "@/lib/i18n"
import type {
  ChatApiResponse,
  ChatHandContext,
  ChatMessage,
  ChatMessagePayload,
  CompanionState,
  ReplyProvider,
} from "@/types/chat"

const simulateHeuristicAction = (player: Player, state: GameState, validActions: string[]): { action: "fold" | "check" | "call" | "raise" | "all-in", amount?: number } => {
    const canCheck = validActions.includes("check")
    const callAmount = state.currentBet - player.bet
    const potOdds = callAmount / (state.pot + callAmount)
    
    // Safety check: Never call an All-in with trash (unless pot odds are astronomical, which is rare)
    // If call amount is > 30% of stack OR > 20% of Pot, be very careful
    const isBigBet = callAmount > 0 && (callAmount > state.pot * 0.3 || callAmount > player.chips * 0.3)

    // Preflop Logic
    if (state.phase === "preflop") {
        const c1 = player.cards[0]
        const c2 = player.cards[1]
        const r1 = getRankValue(c1.rank)
        const r2 = getRankValue(c2.rank)
        const isPair = r1 === r2
        const isHigh = r1 >= 10 || r2 >= 10
        const isConnected = Math.abs(r1 - r2) === 1
        const isSuited = c1.suit === c2.suit
        
        // Aggressive on pairs
        if (isPair) {
             if (r1 >= 10 && validActions.includes("raise")) return { action: "raise", amount: Math.max(state.currentBet * 2, 40) }
             return { action: "call" }
        }
        
        // Call on high cards or good potential, BUT fold if bet is too high
        if (isHigh || (isConnected && isSuited)) {
            if (isBigBet && !isHigh && !isSuited) return { action: "fold" } // Fold marginal hands to big bets
            return { action: canCheck ? "check" : "call" }
        }
        
        // Random bluff (10%) - ONLY if we can initiate action or it's cheap
        // NEVER call a big bet as a bluff. Bluff means RAISING.
        if (Math.random() < 0.1) {
             if (canCheck) return { action: "check" } // Slow play bluff?
             if (validActions.includes("raise") && !isBigBet) {
                 return { action: "raise", amount: Math.max(state.currentBet * 2, 40) }
             }
             // If we can't raise (e.g. facing all-in) or bet is big, FOLD trash
             if (isBigBet) return { action: "fold" }
             return { action: canCheck ? "check" : "call" }
        }
        
        return { action: canCheck ? "check" : "fold" }
    }
    
    // Postflop Logic
    const evaluation = evaluateHand(player.cards, state.communityCards)
    
    // Strong Hand Categories
    const strongHands = ["Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"]
    const mediumHands = ["Two Pair", "Pair"]
    
    if (strongHands.includes(evaluation.rank)) {
        if (validActions.includes("raise") && Math.random() > 0.3) {
             return { action: "raise", amount: Math.max(state.currentBet * 2, 40) }
        }
        return { action: "call" }
    }
    
    if (mediumHands.includes(evaluation.rank)) {
        // If it's just a low pair (e.g. rank < 8) and bet is huge, fold
        // For simplicity: Fold to All-in if pair is weak (< 10)
        // Extract pair rank? Hard with current helper.
        // Let's just say: If big bet, fold 30% of the time with weak pairs
        if (isBigBet && Math.random() < 0.3) return { action: "fold" }
        
        if (validActions.includes("call")) return { action: "call" }
        return { action: canCheck ? "check" : "fold" }
    }
    
    // High Card / Weak / Trash
    // Draw logic would go here (e.g. 4 to flush), but for heuristic we simplify.
    
    // Bluff Logic:
    // Only bluff if we can Check (to bet) or Raise.
    // NEVER Call to bluff.
    if (Math.random() < 0.15) { 
         if (validActions.includes("raise") && !isBigBet) {
             return { action: "raise", amount: Math.max(state.currentBet * 2, 40) }
         }
         // If we wanted to bluff but can't (facing bet), just fold.
         // DO NOT CALL.
    }
    
    return { action: canCheck ? "check" : "fold" }
}

function formatCardLabel(card: { rank: string; suit: string }) {
  return `${card.rank}${card.suit}`
}

export function PokerTable({
  initialProfile,
  initialPersonas,
  initialLocale,
}: {
  initialProfile?: any
  initialPersonas?: Persona[]
  initialLocale: Locale
}) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [userProfile, setUserProfile] = useState<any>(initialProfile)
  const [isLoadingProfile, setIsLoadingProfile] = useState(!initialProfile)
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas || DEFAULT_PERSONAS)
  const [showSetup, setShowSetup] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [showRebuy, setShowRebuy] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatDraft, setChatDraft] = useState("")
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatState, setChatState] = useState<CompanionState>("idle")
  const [chatProvider, setChatProvider] = useState<ReplyProvider>("mock")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMenuExpanded, setIsMenuExpanded] = useState(false) // 菜单展开状态
  const BUY_IN_AMOUNT = 4000 // 200BB (大盲注20)

  // Session Stats
  const [sessionStats, setSessionStats] = useState({
      initialChips: 0,
      startTime: Date.now(),
      handsPlayed: 0,
      wins: 0
  })

  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(0)
  const [layoutRadius, setLayoutRadius] = useState({ x: 42, y: 35 })
  const [playerBuyIns, setPlayerBuyIns] = useState<Record<number, number>>({})
  const [decisionBackendStatus, setDecisionBackendStatus] = useState<DecisionBackendStatus | null>(null)
  const [lastDecisionSource, setLastDecisionSource] = useState<DecisionSource | null>(null)
  const [lastDecisionReason, setLastDecisionReason] = useState<string | null>(null)
  const processingRef = useRef(false)
  const gameStateRef = useRef<GameState | null>(null)

  const copy = {
    loading: pickText(locale, { zh: "加载中...", en: "Loading..." }),
    welcomeBack: pickText(locale, { zh: "欢迎回来", en: "Welcome back" }),
    currentChips: pickText(locale, { zh: "当前筹码", en: "Current chips" }),
    networkLag: pickText(locale, { zh: "网络卡顿...", en: "Network lag..." }),
    stallDetected: pickText(locale, { zh: "检测到托管超时", en: "Stall detected" }),
    autoSkip: pickText(locale, { zh: "系统已自动托管跳过", en: "System auto-skipped the action" }),
    fillSeatsTitle: pickText(locale, { zh: "人数不足 8 人", en: "Table filled to 8 players" }),
    fillSeatsDesc: pickText(locale, { zh: "已自动补充电脑玩家", en: "Added AI players automatically" }),
    lowBalance: pickText(locale, { zh: "余额不足", en: "Insufficient balance" }),
    lowBalanceDesc: pickText(locale, {
      zh: `你至少需要 ${BUY_IN_AMOUNT} 筹码才能开始游戏。`,
      en: `You need at least ${BUY_IN_AMOUNT} chips to start a game.`,
    }),
    thinking: pickText(locale, { zh: "正在思考...", en: "is thinking..." }),
    winRate: pickText(locale, { zh: "胜率分析", en: "Win Rate" }),
    results: pickText(locale, { zh: "战绩", en: "Results" }),
    leaveConfirm: pickText(locale, { zh: "确定要退出当前牌局吗？", en: "Leave the current table?" }),
    leave: pickText(locale, { zh: "退出", en: "Exit" }),
    collapseMenu: pickText(locale, { zh: "收起菜单", en: "Collapse Menu" }),
    expandMenu: pickText(locale, { zh: "展开菜单", en: "Expand Menu" }),
    rebuySuccess: pickText(locale, { zh: "买入成功", en: "Rebuy successful" }),
    goodLuck: pickText(locale, { zh: "祝你好运。", en: "Good luck." }),
    roundSummary: pickText(locale, { zh: "本局结算", en: "Round Summary" }),
    you: pickText(locale, { zh: "你", en: "You" }),
    lost: pickText(locale, { zh: "失利", en: "Lost" }),
    nextRound: pickText(locale, { zh: "下一局", en: "Next Round" }),
    potTotal: pickText(locale, { zh: "底池总额", en: "Pot Total" }),
    holeCards: pickText(locale, { zh: "手牌", en: "Hole Cards" }),
    bestFive: pickText(locale, { zh: "最佳五张", en: "Best 5 Combination" }),
    bot: "Bot",
  }
  
  // Keep ref synced with state for async access
  gameStateRef.current = gameState

  // Responsive Layout Listener
  useEffect(() => {
    const updateLayout = () => {
      // Check for small screens (mobile landscape or small window)
      // Height < 600 usually means mobile landscape
      // Width < 1024 usually means tablet/mobile
      const isSmall = window.innerWidth < 1024 || window.innerHeight < 600
      setLayoutRadius({
        x: isSmall ? 44 : 42, // Push sides out more on mobile
        y: isSmall ? 26 : 35  // Much flatter on mobile to clear center area
      })
    }

    // Initial check
    updateLayout()

    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  useEffect(() => {
    const clientLocale = readClientLocale()
    if (clientLocale !== locale) {
      setLocale(clientLocale)
    }
  }, [locale])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth >= 1280) {
      setIsChatOpen(true)
    }
  }, [])

  useEffect(() => {
    const loadDecisionBackendStatus = async () => {
      try {
        const status = await getDecisionBackendStatus()
        setDecisionBackendStatus(status)

        if (!status.pkclawHealthy) {
          toast.warning(
            locale === "zh" ? "PKclaw 决策后端未连接" : "PKclaw decision backend is not connected",
            {
              description:
                status.pkclawMessage ||
                (locale === "zh"
                  ? "当前牌桌不会使用原始扑克逻辑，Bot 会退回到降级决策。"
                  : "The table is not using the original PKclaw engine. Bots will fall back to degraded decisions."),
            },
          )
        }
      } catch (error) {
        console.error("Failed to load PKclaw backend status", error)
      }
    }

    void loadDecisionBackendStatus()
  }, [locale])

  // Sync state with server props when they change (e.g. after revalidation)
  useEffect(() => {
    if (initialPersonas) {
        setPersonas(initialPersonas)
    }
  }, [initialPersonas])

  useEffect(() => {
    // Only load if not provided initially
    if (initialProfile) return

    const loadProfile = async () => {
      try {
        const profile = await getUserProfile()
        if (profile) {
          setUserProfile(profile)
          
          // Initialize Session Stats if not set
          // We don't initialize from profile chips anymore because we want to track "Session" (Table) stats.
          // setSessionStats(prev => { ... })
          
          toast.success(`${copy.welcomeBack} ${profile.username || copy.you}`, {
             description: `${copy.currentChips}: ${profile.chips}`,
          })
        }
      } catch (e) {
        console.error("Failed to load profile", e)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    if (!isLoadingProfile) {
        // Instead of auto-starting, show setup if no game state
        if (!gameState) {
            setShowSetup(true)
        }
    }
  }, [isLoadingProfile])

  useEffect(() => {
    if (!gameState || gameState.phase === "showdown") return
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    const activePlayers = gameState.players.filter(p => !p.folded)
    const playersWithChips = activePlayers.filter(p => p.chips > 0)

    // Check for All-In situation (Auto-Advance)
    // If fewer than 2 players have chips, no more betting can occur.
    // BUT only if all bets are equalized! (e.g. User All-in, Opponent must Call first)
    const allBetsSettled = activePlayers.every(p => p.chips === 0 || p.bet >= gameState.currentBet)

    if (activePlayers.length > 1 && playersWithChips.length < 2 && allBetsSettled) {
        // 1.5s delay to see cards, unless user folded (fast forward)
      const userFolded = gameState.players[0].folded
      const delay = userFolded ? 50 : 1500

      const timer = setTimeout(() => {
          // Clone state to avoid mutation issues in advancePhase if any
          const stateClone = JSON.parse(JSON.stringify(gameState))
          advancePhase(stateClone)
      }, delay) 
      return () => clearTimeout(timer)
    }
    
    // Reset raise amount when turn changes to user
    if (gameState.currentPlayerIndex === 0) {
        const minRaise = gameState.currentBet * 2 || 20 // Simplistic min raise logic
        // Use functional update or verify if we need to reset
        // If user already set a value higher than minRaise, keep it?
        // But if currentBet changed (someone else raised), we MUST update min.
        // Actually, just set default to minRaise if current raiseAmount is invalid.
        
        // BUG FIX: Don't forcefully overwrite raiseAmount if it's already valid!
        // This useEffect runs on EVERY gameState change.
        // If user drags slider (raiseAmount changes), this effect might NOT run unless gameState changes.
        // But if gameState changes (e.g. someone else bets), we should reset.
        
        // Wait, raiseAmount is state. 
        // If I drag slider to 300, raiseAmount=300.
        // If gameState updates (e.g. thinking indicator?), this effect runs.
        // And it RESETS raiseAmount to minRaise!
        
        // Fix: Only reset if the NEW minRaise is higher than current raiseAmount, 
        // OR if it's a new betting round for the user (how to detect?)
        
        // Simpler: Just set the floor.
        // setRaiseAmount(prev => Math.max(prev, Math.min(minRaise, currentPlayer.chips)))
        
        // Actually, best UX is to reset to Min Raise only when it BECOMES your turn.
        // We can check if `isPlayerTurn` just transitioned from false to true?
        // Hard in useEffect.
        
        // Let's just ensure we don't overwrite if the current value is valid for the NEW state.
        setRaiseAmount(prev => {
            const validMin = Math.min(minRaise, currentPlayer.chips)
            // If previous amount is still valid (>= min and <= max), keep it?
            // But usually players want to see the min raise by default.
            // The issue described: "Selected 300, click Raise -> Showed 120".
            // This means the click handler used a WRONG value or the value was reset right before click.
            
            // If the user drags the slider, `raiseAmount` updates.
            // If `handleAction` is called with `raiseAmount`, it should be 300.
            
            // BUT, look at the `handleAction` call in the button:
            // onClick={() => handleAction("raise", raiseAmount)}
            
            // If `handleAction` receives 120, it means `raiseAmount` state was 120 at click time.
            // Why?
            // Maybe this useEffect is fighting with the slider?
            // "Reset raise amount when turn changes to user"
            // This runs whenever `gameState` changes.
            // If `gameState` updates while user is dragging (e.g. AI thinking animation updates state?), 
            // then `raiseAmount` gets reset to `minRaise` (120)!
            
            // Fix: Only reset raiseAmount if it's effectively "uninitialized" or clearly from a previous round?
            // Or better: Only set it ONCE when turn starts.
            // We can track `currentPlayerIndex` in a ref to detect turn change.
            
            return prev < validMin ? validMin : prev
        })
    } else {
        // Ensure processingRef is false when it's NOT AI's turn?
        // No, we handle that in handleAction.
    }

    if (currentPlayer.isAI && !currentPlayer.folded && currentPlayer.chips > 0 && !isProcessingAI) {
      // Don't trigger AI if we are in auto-advance mode
      if (playersWithChips.length < 2 && allBetsSettled) return

      // BUG FIX: Small Blind logic
      // In preflop, SB and BB are forced bets. They are NOT considered "actions" in terms of "turn completed".
      // However, the game state initializes currentPlayerIndex to UTG (bbIndex + 1).
      // If the game loops back to SB/BB, they need to act.
      // The issue is likely that lastAction="SB" is treated as "already acted" somewhere?
      // No, `handleAction` sets lastAction. Initialization sets "SB"/"BB".
      
      if (processingRef.current) return
      processingRef.current = true
      setIsProcessingAI(true)
      
      const userFolded = gameState.players[0].folded
      const minDelay = userFolded ? 10 : 800
      const randomDelay = userFolded ? 40 : 1200
      
      let timerExecuted = false
      const timer = setTimeout(() => {
        timerExecuted = true
        aiAction(gameState)
      }, minDelay + Math.random() * randomDelay)

      return () => {
        clearTimeout(timer)
        if (!timerExecuted) {
            // If timer was cancelled before execution, reset processing flags
            processingRef.current = false
            setIsProcessingAI(false)
        }
      }
    }
  }, [gameState])

  // Watchdog: Force move if AI gets stuck for >70s
  useEffect(() => {
    if (!gameState) return
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    
    // Explicitly check for AI turn
    if (currentPlayer && currentPlayer.isAI && !currentPlayer.folded && currentPlayer.chips > 0) {
        // If isProcessingAI is false but it IS AI's turn, we might be stuck in a state where AI failed to trigger
        // This can happen if the previous effect dependency [gameState] didn't catch a subtle change or race condition
        
        const timer = setTimeout(() => {
             // Double check it's still AI turn
             if (gameState.currentPlayerIndex === currentPlayer.id) { // Assuming index matches ID for now, or just use index
                 console.warn("Watchdog: AI Turn Detected but no action for 5s. Triggering AI.")
                 if (!isProcessingAI) {
                     // Force trigger
                     // We can't call aiAction directly easily because of closure/ref issues usually, 
                     // but here we can try setting isProcessingAI to true to let the other effect run?
                     // No, the other effect depends on [gameState]. If gameState didn't change, it won't run.
                     // So we must manually call aiAction or force a state update.
                     
                     // Let's just try to call aiAction directly
                     aiAction(gameState)
                 }
             }
        }, 5000) // 5s watchdog for "not started"
        
        return () => clearTimeout(timer)
    }
  }, [gameState?.currentPlayerIndex, isProcessingAI]) // Re-run when turn changes

  // Long-running Watchdog (70s) for "Started but stuck"
  useEffect(() => {
    if (!gameState) return
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    
    if (currentPlayer && currentPlayer.isAI && isProcessingAI) {
        const timer = setTimeout(() => {
            console.error("Watchdog: AI Stuck. Forcing action.")
            processingRef.current = false
            setIsProcessingAI(false)
            
            // Try to check if possible, else fold
            const canCheck = gameState.currentBet === 0 || currentPlayer.bet >= gameState.currentBet
            handleAction(canCheck ? "check" : "fold", 0, copy.networkLag)
            
            toast.warning(`${copy.stallDetected}: ${currentPlayer.name}`, {
                description: copy.autoSkip,
            })
        }, 70000)
        
        return () => clearTimeout(timer)
    }
  }, [gameState?.currentPlayerIndex, isProcessingAI])

  const buildChatHandContext = (state: GameState | null): ChatHandContext | null => {
    if (!state) {
      return null
    }

    const hero = state.players[0]
    const actingPlayer = state.players[state.currentPlayerIndex]

    return {
      snapshot: {
        street: state.phase,
        pot: state.pot,
        currentBet: state.currentBet,
        actingPlayer: actingPlayer?.name || hero.name,
        board: state.communityCards.map(formatCardLabel),
        hero: {
          name: hero.name,
          chips: hero.chips,
          bet: hero.bet,
          cards: hero.cards.map(formatCardLabel),
        },
        seats: state.players.map((seat, index) => ({
          seat: index + 1,
          name: seat.name,
          chips: seat.chips,
          bet: seat.bet,
          folded: seat.folded,
          isAI: seat.isAI,
          lastAction: seat.lastAction || null,
          personaStyle: seat.persona?.style,
        })),
      },
      event: {
        street: state.phase,
        actionLog: state.actionLog || [],
        lastAction: state.actionLog?.[state.actionLog.length - 1] || null,
      },
    }
  }

  const sendChatMessage = async (overrideText?: string) => {
    const content = (overrideText ?? chatDraft).trim()
    if (!content) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }

    const nextMessages = [...chatMessages, userMessage]
    const payloadMessages: ChatMessagePayload[] = nextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }))

    setChatMessages(nextMessages)
    setChatDraft("")
    setChatError(null)
    setChatState("thinking")
    setIsChatOpen(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: payloadMessages,
          handContext: buildChatHandContext(gameState),
        }),
      })

      const payload = (await response.json()) as ChatApiResponse | { error?: string }

      if (!response.ok || !("reply" in payload)) {
        const errorMessage = "error" in payload ? payload.error : undefined

        throw new Error(
          errorMessage || (locale === "zh" ? "出错了，请稍后重试。" : "Something went wrong. Please try again."),
        )
      }

      setChatMessages((prev) => [...prev, payload.reply])
      setChatProvider(payload.provider)
      setChatState("replying")

      window.setTimeout(() => {
        setChatState("idle")
      }, 450)
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : locale === "zh"
            ? "出错了，请稍后重试。"
            : "Something went wrong. Please try again."

      setChatError(fallbackMessage)
      setChatState("error")
    }
  }

  const handlePromptSelect = (prompt: string) => {
    void sendChatMessage(prompt)
  }

  const startNewGame = (selectedPersonaIds?: string[], isRebuy = false) => {
    // Check for Bankruptcy Reset
    // If it is a rebuy, we skip this check because we know we are fixing it.
    if (!isRebuy && gameState && gameState.players[0].chips <= 0) {
        // Do not auto-restart. Show Rebuy.
        setShowRebuy(true)
        return
    }

    const deck = shuffleDeck(createDeck())
    let players: Player[] = []
    let dealerIndex = 0

    // Determine opponents based on selection
    let activePersonas: Persona[] = []
    
    if (selectedPersonaIds) {
        // Support Duplicates: We iterate through selectedPersonaIds and find the persona for each ID.
        // This allows ["gto", "gto", "pro"] to create 3 players.
        
        activePersonas = selectedPersonaIds.map(id => personas.find(p => p.id === id)).filter(Boolean) as Persona[]
        
        // Auto-fill logic: Only if we STILL don't have enough (which shouldn't happen for training mode if we passed 7 ids)
        const MAX_PLAYERS = 8
        const NEEDED_OPPONENTS = MAX_PLAYERS - 1 // minus user
        
        if (activePersonas.length < NEEDED_OPPONENTS) {
            const remaining = personas.filter(p => !selectedPersonaIds.includes(p.id))
            // Shuffle remaining
            const shuffled = remaining.sort(() => 0.5 - Math.random())
            const needed = NEEDED_OPPONENTS - activePersonas.length
            const fillers = shuffled.slice(0, needed)
            activePersonas = [...activePersonas, ...fillers]
            
            if (fillers.length > 0) {
                toast.info(copy.fillSeatsTitle, {
                    description: `${copy.fillSeatsDesc}: ${fillers.length}`,
                })
            }
        }
    }

    if (!selectedPersonaIds && gameState && (gameState.players[0].chips > 0 || isRebuy)) {
      // Logic for "Next Hand" (Keeping same players)
      dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length
      players = gameState.players.map((p, index) => {
        // AI Rebuy Logic: If AI is bust, give them BUY_IN_AMOUNT chips
        let currentChips = p.chips

        // Handle User Rebuy
        if (index === 0 && isRebuy) {
            currentChips = BUY_IN_AMOUNT
            // Track Rebuy in Ledger
            setPlayerBuyIns(prev => ({
                ...prev,
                [p.id]: (prev[p.id] || 0) + BUY_IN_AMOUNT
            }))
        }

        if (p.isAI && currentChips <= 0) {
            currentChips = BUY_IN_AMOUNT
            // Track AI Rebuy in Ledger
            setPlayerBuyIns(prev => ({
                ...prev,
                [p.id]: (prev[p.id] || 0) + BUY_IN_AMOUNT
            }))
        }

        return {
            ...p,
            chips: currentChips,
            cards: [deck[index * 2], deck[index * 2 + 1]],
            bet: 0,
            folded: false,
            lastAction: null,
            currentMessage: undefined,
            totalHandBet: 0,
        }
      })
    } else {
      // Logic for "Fresh Game" (New Players/Setup)
      // Check if user has enough chips for Buy-In
      if (userProfile && userProfile.chips < BUY_IN_AMOUNT) {
          toast.error(copy.lowBalance, {
              description: copy.lowBalanceDesc
          })
          // Optionally show Rebuy Dialog if we want to support "Top up" logic, 
          // but for now, if they are broke, they are broke. 
          // Assuming userProfile.chips IS the bankroll.
          if (userProfile.chips <= 0) {
              setShowRebuy(true)
          }
          return
      }

      const user = userProfile?.username || "你"
      
      let playerDefinitions: { name: string, isAI: boolean, persona?: Persona }[] = []
      
      if (activePersonas.length > 0) {
          playerDefinitions = [
              { name: user, isAI: false },
              ...activePersonas.map((p, idx) => ({ 
                  name: `${p.name}${idx > 0 && activePersonas.filter(ap => ap.id === p.id).length > 1 ? ` (${idx})` : ''}`, // Unique names for clones
                  isAI: true, 
                  persona: p 
              }))
          ]
      } else {
          // Fallback if no personas active (should not happen with proper setup)
          // Default logic: Just pick first 7 personas + User
          const defaultOpponents = personas.slice(0, 7)
          playerDefinitions = [
              { name: user, isAI: false },
              ...defaultOpponents.map(p => ({ name: p.name, isAI: true, persona: p }))
          ]
      }

      players = playerDefinitions.map((def, index) => {
        // 所有玩家（包括AI）都使用相同买入金额 (200BB)
        const initialChips = BUY_IN_AMOUNT

        return {
            id: index,
            name: def.name,
            chips: initialChips,
            cards: [deck[index * 2], deck[index * 2 + 1]],
            bet: 0,
            folded: false,
            isAI: def.isAI,
            position: index,
            lastAction: null,
            persona: def.persona,
            currentMessage: undefined,
            totalHandBet: 0,
            avatar: index === 0 ? userProfile?.avatar_url : undefined,
        }
      })
      
      // Update Session Stats Initial Chips to reflect the BUY IN, not the Bankroll
      setSessionStats(prev => ({
          ...prev,
          initialChips: BUY_IN_AMOUNT, // Reset session tracking base to buy-in amount
          startTime: Date.now(),
          handsPlayed: 0,
          wins: 0
      }))

      // Initialize Player Buy-ins
      const initialBuyIns: Record<number, number> = {}
      players.forEach(p => {
          initialBuyIns[p.id] = p.chips
      })
      setPlayerBuyIns(initialBuyIns)
    }

    const smallBlind = 10
    const bigBlind = 20
    const sbIndex = (dealerIndex + 1) % players.length
    const bbIndex = (dealerIndex + 2) % players.length

    let sbAmount = Math.min(smallBlind, players[sbIndex].chips)
    players[sbIndex].chips -= sbAmount
    players[sbIndex].bet = sbAmount
    players[sbIndex].totalHandBet = sbAmount
    players[sbIndex].lastAction = "SB"

    let bbAmount = Math.min(bigBlind, players[bbIndex].chips)
    players[bbIndex].chips -= bbAmount
    players[bbIndex].bet = bbAmount
    players[bbIndex].totalHandBet = bbAmount
    players[bbIndex].lastAction = "BB"

    const pot = sbAmount + bbAmount
    const currentBet = bigBlind
    const firstActorIndex = (bbIndex + 1) % players.length

    setGameState({
      players,
      communityCards: [],
      pot,
      currentBet,
      currentPlayerIndex: firstActorIndex,
      dealerIndex,
      phase: "preflop",
      deck: deck.slice(players.length * 2),
      winners: undefined,
      actionLog: [`Game Started. Blinds: ${smallBlind}/${bigBlind}`]
    })

    playSound("deal")
    
    processingRef.current = false
    setIsProcessingAI(false)
  }

  const handleAction = (action: "fold" | "check" | "call" | "raise" | "all-in", amount = 0, message?: string) => {
    // Always use the latest state from ref to avoid stale closures (especially from async AI actions)
    const currentState = gameStateRef.current
    if (!currentState) return

    // Play sound effect
    playSound(action)
    
    if (currentState.players[currentState.currentPlayerIndex].isAI) {
        processingRef.current = false
        setIsProcessingAI(false)
    }

    const newState = { ...currentState, actionLog: [...(currentState.actionLog || [])] }
    const currentPlayer = newState.players[newState.currentPlayerIndex]
    currentPlayer.lastAction = action
    currentPlayer.currentMessage = message

    if (action === "fold") {
      currentPlayer.folded = true
      newState.actionLog.push(`${newState.phase}: ${currentPlayer.name} Fold`)
    } else if (action === "check") {
      // Pass
      newState.actionLog.push(`${newState.phase}: ${currentPlayer.name} Check`)
    } else if (action === "call") {
      const callAmount = newState.currentBet - currentPlayer.bet
      const actualCallAmount = Math.min(callAmount, currentPlayer.chips)
      currentPlayer.chips -= actualCallAmount
      currentPlayer.bet += actualCallAmount
      currentPlayer.totalHandBet += actualCallAmount
      newState.pot += actualCallAmount
      newState.actionLog.push(`${newState.phase}: ${currentPlayer.name} Call ${actualCallAmount}`)
    } else if (action === "raise") {
      // Use the 'amount' parameter which is the TOTAL bet user wants to place
      // UI slider will provide this total amount (currentBet + raise)
      
      const totalBet = amount
      const needed = totalBet - currentPlayer.bet
      
      if (needed > currentPlayer.chips) {
          return handleAction("all-in")
      }
      
      // AI Logic often returns "Raise By" (increment) instead of "Raise To" (total).
      // If AI returns amount < currentBet, it likely meant "Raise By".
      // Or if AI returns amount < minRaise, we need to fix it.
      
      // Fix for AI: If amount is suspicious, assume it's incremental or fix it to min raise
      // But wait, user input (slider) is always TOTAL BET.
      // We need to differentiate or normalize.
      // If this is called by AI, `amount` might be just the increment.
      
      let finalTotalBet = totalBet
      if (currentPlayer.isAI) {
          // AI Normalization
          if (finalTotalBet < newState.currentBet + 20) {
               // AI probably returned "raise amount" (e.g. 20) instead of "total bet" (e.g. 60+20=80)
               // OR AI returned 0.
               // Let's assume AI meant "Raise +X" on top of current bet?
               // Or simply force it to be at least Min Raise.
               const minRaiseTotal = newState.currentBet + Math.max(newState.currentBet, 20)
               if (finalTotalBet < minRaiseTotal) {
                   // If AI said "Raise 120" but current bet is 60, and they already bet 60?
                   // If they bet 0, current bet 60. AI says 120. That is valid (Min Raise).
                   
                   // What if AI says "120" (amount) but `needed` calculation above assumed it was total?
                   // Let's look at the screenshot.
                   // Current Bet: 60. 
                   // AI ("邪恶库洛米") has bet 0? No, they are BB?
                   // If BB (60), and someone raised to 60 (limp/check).
                   // AI raises to 120. Total Bet = 120.
                   // Needed = 120 - 60 = 60.
                   // Chip stack > 60.
                   // This seems correct?
                   
                   // Wait, the screenshot shows "Raise $120". 
                   // But the user said "Selected 300, but showed 120".
                   // Oh, the user is the HUMAN player?
                   // "这里我数值选了300 raise之后显示数值是120"
                   // This implies the USER dragged the slider to 300, clicked Raise, but the game registered 120?
                   
                   // Let's check the onClick handler for Raise button.
               }
          }
      }
      
      currentPlayer.chips -= needed
      currentPlayer.bet = finalTotalBet
      currentPlayer.totalHandBet += needed
      newState.pot += needed
      newState.currentBet = finalTotalBet
      newState.actionLog.push(`${newState.phase}: ${currentPlayer.name} Raise to ${finalTotalBet}`)
      
      newState.players.forEach(p => {
          if (p.id !== currentPlayer.id && !p.folded && p.chips > 0) {
              p.lastAction = null 
          }
      })
      
    } else if (action === "all-in") {
      const allInAmount = currentPlayer.chips
      currentPlayer.chips = 0
      currentPlayer.bet += allInAmount
      currentPlayer.totalHandBet += allInAmount
      newState.pot += allInAmount
      newState.actionLog.push(`${newState.phase}: ${currentPlayer.name} All-in ${allInAmount}`)
      
      if (currentPlayer.bet > newState.currentBet) {
          newState.currentBet = currentPlayer.bet
          newState.players.forEach(p => {
            if (p.id !== currentPlayer.id && !p.folded && p.chips > 0) {
                p.lastAction = null 
            }
        })
      }
    }

    const activePlayers = newState.players.filter(p => !p.folded)
    if (activePlayers.length === 1) {
        distributePot(newState, activePlayers)
        return
    }

    const playersInGame = newState.players.filter(p => !p.folded && p.chips > 0)
    const allBetsEqual = playersInGame.every(p => p.bet === newState.currentBet)
    const allActed = playersInGame.every(p => p.lastAction !== null)
    
    if (allBetsEqual && allActed) {
        advancePhase(newState)
    } else {
        let nextIndex = (newState.currentPlayerIndex + 1) % newState.players.length
        let loops = 0
        while ((newState.players[nextIndex].folded || newState.players[nextIndex].chips === 0) && loops < newState.players.length) {
            nextIndex = (nextIndex + 1) % newState.players.length
            loops++
        }
        newState.currentPlayerIndex = nextIndex
        setGameState(newState)
    }

    // Auto-hide message after 4 seconds
    if (message) {
        const playerId = currentPlayer.id
        setTimeout(() => {
            setGameState(prev => {
                if (!prev) return null
                // Only clear if the message is still the same (avoid clearing new messages)
                const player = prev.players.find(p => p.id === playerId)
                if (player && player.currentMessage === message) {
                     return {
                        ...prev,
                        players: prev.players.map(p => 
                            p.id === playerId ? { ...p, currentMessage: undefined } : p
                        )
                    }
                }
                return prev
            })
        }, 4000)
    }
  }

  const aiAction = async (state: GameState) => {
    const currentPlayer = state.players[state.currentPlayerIndex]
    const validActions = ["fold"] as ("fold" | "check" | "call" | "raise" | "all-in")[]
    if (state.currentBet === 0 || currentPlayer.bet >= state.currentBet) validActions.push("check")
    else validActions.push("call")
    
    if (currentPlayer.chips > (state.currentBet - currentPlayer.bet)) {
         validActions.push("raise")
         validActions.push("all-in")
    }

    // Fast Forward Mode: If user folded, skip server AI and use local heuristic
    if (state.players[0].folded) {
        setLastDecisionSource("heuristic_fallback")
        setLastDecisionReason("Fast-forward mode after hero folded")
        const action = simulateHeuristicAction(currentPlayer, state, validActions)
        handleAction(action.action, action.amount, "⚡️")
        return
    }

    // Add opponents context
      const opponents = state.players
          .filter(p => p.id !== currentPlayer.id && !p.folded && p.chips > 0)
          .map(p => ({
              position: p.position,
              chips: p.chips,
              bet: p.bet,
              isFolded: p.folded,
              name: p.name,
              isDealer: state.dealerIndex === state.players.findIndex(pl => pl.id === p.id),
              persona: p.persona,
          }))

    // Call Server Action with client-side timeout
      try {
        const decisionPromise = getAIDecision({
          playerCards: currentPlayer.cards,
          communityCards: state.communityCards,
          pot: state.pot,
          currentBet: state.currentBet,
          playerChips: currentPlayer.chips,
          playerBet: currentPlayer.bet,
          validActions,
          phase: state.phase,
          position: currentPlayer.position,
          dealerIndex: state.dealerIndex,
          playersCount: state.players.length,
          locale,
          persona: currentPlayer.persona,
          opponents,
          actionLog: state.actionLog || [] // Pass action log
      })

    // 60s Timeout fallback (Allow AI enough time to respond)
    const timeoutPromise = new Promise<any>((resolve) => {
        setTimeout(() => {
            console.warn("AI Decision Timeout - Forcing Fallback")
            resolve({
                action: validActions.includes("check") ? "check" : "fold",
                reason: "思考时间过长",
                message: "快点吧..."
            })
        }, 60000)
    })

    const decision = await Promise.race([decisionPromise, timeoutPromise])

    if (decision?.source) {
        setLastDecisionSource(decision.source)
        setLastDecisionReason(decision.reason || null)
        if (decision.source !== "pkclaw_local") {
            console.warn("Bot decision did not come from PKclaw local engine:", decision.source, decision.reason)
        }
    }

    let action = decision.action
        let amount = decision.amount || 0

        if (!validActions.includes(action)) {
            if (validActions.includes("check")) action = "check"
            else if (validActions.includes("call")) action = "call"
            else action = "fold"
        }

        // For raise, AI might return incremental amount or total amount.
        // Let's assume AI returns 'Raise To' total amount logic, OR we just use a simple 2.5x BB or 3x logic if not provided
        if (action === "raise") {
             // If AI didn't provide amount, we calculate a standard raise
             if (!amount || amount <= state.currentBet) {
                 amount = state.currentBet * 2
                 if (amount < 20) amount = 20
             }
        }
        
        handleAction(action, amount, decision.message)

    } catch (error) {
        console.error("AI Action Failed", error)
        handleAction("fold")
    } finally {
        // Safety net: Always reset processing flags
        if (processingRef.current) {
            processingRef.current = false
            setIsProcessingAI(false)
        }
    }
  }

  const advancePhase = (state: GameState) => {
    state.players.forEach(p => {
        p.lastAction = null
        p.currentMessage = undefined
    })
    state.players.forEach(p => p.bet = 0)
    state.currentBet = 0
    
    if (state.phase === "preflop") {
      state.communityCards = [state.deck[0], state.deck[1], state.deck[2]]
      state.deck = state.deck.slice(3)
      state.phase = "flop"
      playSound("deal")
    } else if (state.phase === "flop") {
      state.communityCards.push(state.deck[0])
      state.deck = state.deck.slice(1)
      state.phase = "turn"
      playSound("deal")
    } else if (state.phase === "turn") {
      state.communityCards.push(state.deck[0])
      state.deck = state.deck.slice(1)
      state.phase = "river"
      playSound("deal")
    } else if (state.phase === "river") {
      state.phase = "showdown"
      distributePot(state, state.players.filter(p => !p.folded))
      setGameState(state) 
      return 
    }

    let nextIndex = (state.dealerIndex + 1) % state.players.length
    while (state.players[nextIndex].folded || state.players[nextIndex].chips === 0) {
        nextIndex = (nextIndex + 1) % state.players.length
        if (nextIndex === state.dealerIndex) break; 
    }
    state.currentPlayerIndex = nextIndex
    setGameState(state)
  }

  const distributePot = (state: GameState, activePlayers: Player[]) => {
      const allPlayers = state.players

      // 1. Cap folded players' bets to the Max Active Bet
      // This ensures "Dead Money" from a folded deep stack is accessible to the current active players
      // but doesn't create "Phantom Pots" above the active players' reach.
      const maxActiveBet = Math.max(...activePlayers.map(p => p.totalHandBet))

      const playersWithEffectiveBets = allPlayers.map(p => ({
          ...p,
          calculatedBet: p.folded ? Math.min(p.totalHandBet, maxActiveBet) : p.totalHandBet
      }))

      // 2. Identify all unique pot levels
      const uniqueLevels = Array.from(new Set(playersWithEffectiveBets.map(p => p.calculatedBet).filter(b => b > 0))).sort((a, b) => a - b)

      // 3. Evaluate ALL active players' hands once (before processing pots)
      // This is critical for proper tie handling across different bet levels
      const playerEvaluations = activePlayers.map(player => ({
          player,
          eval: evaluateHand(player.cards, state.communityCards)
      }))

      // Find global winners (same hand strength)
      playerEvaluations.sort((a, b) => b.eval.rankValue - a.eval.rankValue)
      const bestValue = playerEvaluations[0].eval.rankValue
      const globalWinners = playerEvaluations.filter(r => r.eval.rankValue === bestValue)

      console.log(`[底池分配] 平局情况: ${globalWinners.length}人牌力相同 (${globalWinners[0].eval.rank})`)

      let processedBet = 0
      const winnersData: Winner[] = []

      for (const levelBet of uniqueLevels) {
          const sidePotAmount = levelBet - processedBet

          // Contributors to this level
          const contributors = playersWithEffectiveBets.filter(p => p.calculatedBet >= levelBet)
          const currentPotSize = contributors.length * sidePotAmount

          if (currentPotSize <= 0) continue;

          // Eligible winners: Only those who actually contributed to THIS level
          const eligibleContributors = contributors.filter(c =>
              globalWinners.some(w => w.player.id === c.id)
          )

          if (eligibleContributors.length === 0) {
              console.warn("No eligible winners for this level, skipping")
              processedBet = levelBet
              continue
          }

          // Calculate each winner's fair share based on their contribution
          for (const winner of globalWinners) {
              const winnerContributor = contributors.find(c => c.id === winner.player.id)

              if (!winnerContributor) {
                  // This winner didn't contribute to this side pot
                  continue
              }

              // Calculate share: proportional to contribution
              const totalContributions = eligibleContributors.reduce((sum, c) => sum + c.calculatedBet, 0)
              const winnerShare = winnerContributor.calculatedBet / totalContributions
              const amount = Math.floor(winnerShare * currentPotSize)

              winner.player.chips += amount

              // Track for display
              const existingWinner = winnersData.find(wd => wd.playerId === winner.player.id)
              if (existingWinner) {
                  existingWinner.amount += amount
              } else {
                  winnersData.push({
                      playerId: winner.player.id,
                      amount: amount,
                      hand: winner.eval
                  })
              }

              console.log(`  层级${levelBet}: 玩家${winner.player.id} 贡献${winnerContributor.calculatedBet}，总贡献${totalContributions}，获得${amount}`)
          }

          processedBet = levelBet
      }
      
      state.winners = winnersData
      state.pot = 0
      state.phase = "showdown"
      playSound("win")
      setGameState(state)

      // Save result to DB
      if (userProfile) {
        const userPlayer = allPlayers.find(p => p.id === 0)
        if (userPlayer) {
            // Calculate Profit: Total Winnings - Total Bet
            const winnings = winnersData.filter(w => w.playerId === 0).reduce((acc, w) => acc + w.amount, 0)
            const profit = winnings - userPlayer.totalHandBet

            // 过滤出用户自己的操作日志
            const userName = userPlayer.name
            console.log(`[保存数据] 用户名: "${userName}", actionLog总长度: ${state.actionLog.length}`)

            const userActionLog = state.actionLog.filter(log => {
              const knownAINames = ['流年老师', '高额桌Pro', '河牌大使', '邪恶库洛米', '人形计算器李明阳', 'od骚男', 'GTO大神', '🐱17老师']
              return log.includes(userName) && !knownAINames.some(name => log.includes(name))
            })

            console.log(`[保存数据] 过滤后userActionLog长度: ${userActionLog.length}`, userActionLog.slice(0, 3))

            // 分析用户参与情况
            let userFoldedStage = null
            let userVoluntarilyEntered = false

            // 检查用户是否有Call/Raise/All-in（主动入局）
            const hasVoluntaryAction = userActionLog.some(log =>
              log.includes('Call') || log.includes('Raise') || log.includes('All-in')
            )

            // 【重要修正】检查是否在翻前Check（通常是Big Blind情况）
            // Big Blind翻前Check应该算作主动入局，因为玩家看了翻牌
            const hasPreflopCheck = userActionLog.some(log =>
              log.includes('Check') && log.toLowerCase().includes('preflop')
            )

            if (hasVoluntaryAction || hasPreflopCheck) {
              userVoluntarilyEntered = true
            }

            console.log(`[VPIP统计] hasVoluntaryAction: ${hasVoluntaryAction}, hasPreflopCheck: ${hasPreflopCheck}, voluntarilyEntered: ${userVoluntarilyEntered}`)

            // 检查用户在哪个阶段Fold了
            if (userPlayer.folded) {
              // 找最后一个Fold操作，看在哪个阶段
              const foldLog = userActionLog.filter(log => log.includes('Fold'))
              if (foldLog.length > 0) {
                const lastFold = foldLog[foldLog.length - 1].toLowerCase()
                if (lastFold.includes('preflop')) {
                  userFoldedStage = 'preflop'
                } else if (lastFold.includes('flop')) {
                  userFoldedStage = 'flop'
                } else if (lastFold.includes('turn')) {
                  userFoldedStage = 'turn'
                } else if (lastFold.includes('river')) {
                  userFoldedStage = 'river'
                }
              }
            }

            // 【重要修正】保存所有发到手里的牌，包括翻前弃牌的局
            // 这样才能正确计算VPIP（主动入局/总发牌数）
            // VPIP = (Call+Raise+All-in+翻前Check次数) / (所有发到手的牌)
            // 注意：翻前Check通常发生在Big Blind位置，也应计入VPIP

            const handDetails = {
              cards: userPlayer.cards,
              communityCards: state.communityCards,
              totalBet: userPlayer.totalHandBet,
              winnings: winnings,
              winners: winnersData.map(w => ({ playerId: w.playerId, amount: w.amount, handRank: w.hand.rankValue })),
              actionLog: userActionLog,  // 只保存用户自己的操作
              userMetadata: {
                voluntarilyEntered: userVoluntarilyEntered,
                foldedStage: userFoldedStage,
                finalPhase: state.phase,
                dealt: true  // 标记为已发牌（用于VPIP分母）
              }
            }

            // Update Session Stats（所有发到手的牌都算一局）
            const handRecordInput = buildPlayedHandRecordInput(state)

            setSessionStats(prev => ({
                ...prev,
                handsPlayed: prev.handsPlayed + 1,
                wins: profit > 0 ? prev.wins + 1 : prev.wins
            }))

            saveGameResult(profit, handDetails).then((newChips) => {
                if (newChips !== null) {
                    setUserProfile((prev: any) => ({ ...prev, chips: newChips }))
                    console.log("Game saved. New Balance:", newChips)
                }
            })

            if (handRecordInput) {
                saveHandRecord(handRecordInput).then((result) => {
                    if (!result.ok && result.message) {
                        console.warn("Hand record save skipped:", result.message)
                    }
                })
            }
        }
      }

      // Auto Start Removed - User must manually click Next Round
      // if (allPlayers.find(p => p.id === 0)?.folded) { ... }
  }

  if (!gameState) {
    if (showSetup) {
        return (
            <GameSetup 
                personas={personas} 
                userProfile={userProfile}
                locale={locale}
                onStart={(selectedIds) => {
                    setShowSetup(false)
                    startNewGame(selectedIds)
                }} 
            />
        )
    }
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">{copy.loading}</div>
  }

  const player = gameState.players[0]
  const winProb = calculateWinProbability(player.cards, gameState.communityCards)
  
  const getPlayerPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI + Math.PI / 2
    // Use dynamic layout from state
    const { x: radiusX, y: radiusY } = layoutRadius
    const x = 50 + radiusX * Math.cos(angle)
    const y = 50 + radiusY * Math.sin(angle)
    return { x, y }
  }

  const isPlayerTurn = gameState.currentPlayerIndex === 0 && gameState.phase !== "showdown"
  const callAmount = gameState.currentBet - player.bet
  const minRaise = Math.max(gameState.currentBet * 2, 20)
  
  // Update raise slider logic
  // Slider Value: Total Bet Amount
  // Min: Current Bet + Min Increment (Usually 1BB)
  // Max: Player Chips + Current Bet (Total Stack)
  // Fix: Ensure sliderMin matches the minRaise logic in useEffect to prevent resetting
  const minRaiseAmount = Math.max(gameState.currentBet * 2, 20)
  const sliderMin = minRaiseAmount 
  const sliderMax = player.chips + player.bet
  const currentChatContext = buildChatHandContext(gameState)
  const chatOpeningPrompts =
    locale === "zh"
      ? [
          "这手牌我该继续还是放弃？",
          "帮我按街拆一下这手牌的 EV 问题。",
          "我想用语音把整手牌说出来，你来帮我还原。",
        ]
      : [
          "Should I continue or let this one go?",
          "Break this hand down by street and EV.",
          "I want to describe the whole hand by voice and have you reconstruct it.",
        ]

  return (
    <>
      <LandscapePrompt />
      <div className="h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      {/* 左上角：筹码余额显示 */}
      {userProfile && (
        <div className="absolute top-3 left-3 z-50">
          <Button
            variant="ghost"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all border border-white/10 shadow-lg",
              sessionStats.initialChips > 0 && userProfile.chips > sessionStats.initialChips ? "text-green-400" :
              sessionStats.initialChips > 0 && userProfile.chips < sessionStats.initialChips ? "text-red-400" : "text-zinc-200"
            )}
            onClick={() => setShowScoreboard(true)}
          >
            <Coins className="w-4 h-4 text-violet-400" />
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-violet-400">${userProfile.chips.toLocaleString()}</span>
              {sessionStats.initialChips > 0 && (
                <span className="text-[9px] opacity-70">
                  ({userProfile.chips >= sessionStats.initialChips ? '+' : ''}
                  {(userProfile.chips - sessionStats.initialChips).toLocaleString()})
                </span>
              )}
            </div>
          </Button>
        </div>
      )}

      {/* 右上角：菜单按钮 */}
      <div className="absolute top-3 left-3 z-50 flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "rounded-full bg-black/40 backdrop-blur-md border text-[10px] md:text-xs font-semibold",
            decisionBackendStatus?.pkclawHealthy
              ? "border-emerald-400/30 text-emerald-200"
              : "border-amber-400/30 text-amber-200",
          )}
          title={decisionBackendStatus?.pkclawMessage || undefined}
        >
          {decisionBackendStatus?.pkclawHealthy
            ? locale === "zh"
              ? "PKclaw 已连接"
              : "PKclaw connected"
            : locale === "zh"
              ? "PKclaw 未连接"
              : "PKclaw disconnected"}
        </Badge>

        {lastDecisionSource && (
          <Badge
            variant="outline"
            title={lastDecisionReason ?? undefined}
            className={cn(
              "rounded-full bg-black/40 backdrop-blur-md border text-[10px] md:text-xs font-semibold",
              lastDecisionSource === "pkclaw_local"
                ? "border-emerald-400/30 text-emerald-200"
                : "border-amber-400/30 text-amber-200",
            )}
          >
            {lastDecisionSource === "pkclaw_local"
              ? locale === "zh"
                ? "决策来源：PKclaw"
                : "Decision: PKclaw"
              : locale === "zh"
                ? `决策来源：${lastDecisionSource}`
                : `Decision: ${lastDecisionSource}`}
          </Badge>
        )}
      </div>

      <div className={cn("absolute top-3 right-3 z-50 transition-all", isChatOpen && "xl:right-[400px]")}>
        {isMenuExpanded ? (
          // 展开状态：显示所有按钮
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5 duration-200">
            {showAnalysis && <HandAnalysis winProbability={winProb} locale={locale} />}
            <LanguageSwitcher locale={locale} compact />
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full hover:bg-white/10 h-9 w-9 bg-black/40 backdrop-blur-md border border-white/10"
              onClick={() => setShowAnalysis(!showAnalysis)}
              title={copy.winRate}
            >
              <Settings2 className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full hover:bg-white/10 h-9 w-9 bg-black/40 backdrop-blur-md border border-white/10"
              onClick={() => setShowScoreboard(true)}
              title={copy.results}
            >
              <Activity className="w-5 h-5 text-indigo-400" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirm(copy.leaveConfirm)) {
                  setGameState(null)
                  setShowSetup(true)
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-full px-3 h-9 shadow-lg backdrop-blur-md border border-red-400/20"
            >
              <LogOut className="w-4 h-4 mr-1" />
              {copy.leave}
            </Button>
            {/* 收起按钮 */}
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full hover:bg-white/10 h-9 w-9 bg-black/40 backdrop-blur-md border border-white/10"
              onClick={() => setIsMenuExpanded(false)}
              title={copy.collapseMenu}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          // 收起状态：只显示汉堡菜单图标
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full hover:bg-white/10 h-9 w-9 bg-black/40 backdrop-blur-md border border-white/10 animate-in fade-in zoom-in duration-200"
            onClick={() => setIsMenuExpanded(true)}
            title={copy.expandMenu}
          >
            <Settings2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Main Game Area - 全屏桌面 */}
      <main className={cn("absolute inset-0 flex items-center justify-center overflow-hidden p-2 sm:p-3 md:p-4", isChatOpen && "xl:right-[396px]")}>
        <div className="relative w-full h-full max-w-[1400px]" style={{ aspectRatio: '2.2/1', maxHeight: 'calc(100vh - 32px)' }}>
            {/* Table Surface - Frosted Glass */}
            <div className="absolute inset-0 rounded-[100px] md:rounded-[200px] bg-zinc-950/40 backdrop-blur-3xl border border-white/10 shadow-2xl ring-1 ring-white/5">
                {/* Glowing Ring Effect */}
                <div className="absolute inset-0 rounded-[100px] md:rounded-[200px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <div className="absolute inset-[10px] md:inset-[20px] rounded-[90px] md:rounded-[180px] border border-white/5 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]" />

                {/* Community Cards Area - Shifted Up for Mobile */}
                <div className="absolute top-[38%] md:top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-1.5 md:gap-3 z-10">
                    {gameState.communityCards.map((card, i) => (
                        <div key={i} className="animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
                            <PokerCard card={card} className="w-8 h-11 xs:w-9 xs:h-13 sm:w-12 sm:h-16 md:w-20 md:h-28 shadow-2xl ring-1 ring-black/20" />
                        </div>
                    ))}
                    {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-11 xs:w-9 xs:h-13 sm:w-12 sm:h-16 md:w-20 md:h-28 rounded-lg border-2 border-dashed border-white/5 bg-white/5" />
                    ))}
                </div>

                {/* Pot Info - Centered above cards */}
                <div className="absolute top-[22%] md:top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-20">
                     <div className="flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-0.5 md:py-1 rounded-full bg-black/40 backdrop-blur-md border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                         <Coins className="w-2.5 h-2.5 md:w-4 md:h-4 text-violet-300" />
                         <span className="text-violet-300 font-mono text-sm md:text-xl font-bold tracking-wider">${gameState.pot}</span>
                     </div>
                </div>

                {/* Game Status / Thinking Indicator */}
                {!isPlayerTurn && gameState.phase !== "showdown" && (
                     <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-3 py-0.5 md:py-1 rounded-full bg-white/5 backdrop-blur-md border border-white/10 animate-pulse">
                            <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                            <span className="text-[8px] md:text-[10px] font-medium text-zinc-300">
                                {locale === "zh"
                                  ? `${gameState.players[gameState.currentPlayerIndex].name} ${copy.thinking}`
                                  : `${gameState.players[gameState.currentPlayerIndex].name} ${copy.thinking}`}
                            </span>
                        </div>
                     </div>
                )}
            </div>

            {/* Players */}
            {gameState.players.map((p, index) => {
                const pos = getPlayerPosition(index, gameState.players.length)
                // Always show main player cards, but maybe differently? 
                // Actually PlayerSeat handles card visibility.
                
                return (
                    <div
                    key={p.id}
                    className="absolute transition-all duration-500 z-30"
                    style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: "translate(-50%, -50%)",
                    }}
                    >
                    <PlayerSeat
                        player={p}
                        isCurrentPlayer={gameState.currentPlayerIndex === index && gameState.phase !== "showdown"}
                        isDealer={gameState.dealerIndex === index}
                        isSmallBlind={index === (gameState.dealerIndex + 1) % gameState.players.length}
                        isBigBlind={index === (gameState.dealerIndex + 2) % gameState.players.length}
                        isMainPlayer={index === 0}
                        showCards={gameState.phase === "showdown"}
                    />
                    
                    {/* AI Message Bubble - Smart Positioning */}
                    {p.currentMessage && (
                        <div className={cn(
                            "absolute z-[100] w-32 pointer-events-none transition-all duration-300",
                            // Top Players (y < 40): Bubble Below (pushed further down to clear cards)
                            pos.y < 40 ? "top-[130%] left-1/2 -translate-x-1/2 pt-1" :
                            // Bottom Players (y > 60): Bubble Above (pushed further up to clear avatar)
                            pos.y > 60 ? "bottom-[140%] left-1/2 -translate-x-1/2 pb-1" :
                            // Left Players (x < 50): Bubble Right
                            pos.x < 50 ? "left-[120%] top-1/2 -translate-y-1/2 pl-1" :
                            // Right Players (x > 50): Bubble Left
                            "right-[120%] top-1/2 -translate-y-1/2 pr-1"
                        )}>
                            <div className={cn(
                                "relative bg-white/95 backdrop-blur-md text-black p-2 rounded-xl shadow-2xl border border-indigo-500/50 animate-in fade-in zoom-in duration-300",
                                "flex items-center justify-center min-h-[2rem]"
                            )}>
                                <div className="text-[10px] font-bold leading-tight text-center break-words">
                                    {p.currentMessage}
                                </div>
                                {/* Tail */}
                                <div className={cn(
                                    "absolute w-2 h-2 bg-white/95 border-indigo-500/50 rotate-45",
                                    pos.y < 40 ? "-top-1 left-1/2 -translate-x-1/2 border-t border-l" :
                                    pos.y > 60 ? "-bottom-1 left-1/2 -translate-x-1/2 border-b border-r" :
                                    pos.x < 50 ? "-left-1 top-1/2 -translate-y-1/2 border-b border-l" :
                                    "-right-1 top-1/2 -translate-y-1/2 border-t border-r"
                                )} />
                            </div>
                        </div>
                    )}

                    {/* Winner Animation */}
                    {gameState.winners?.some(w => w.playerId === p.id) && (
                         <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                             <div className="flex flex-col items-center">
                                 <Trophy className="w-8 h-8 text-violet-300 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                                 <span className="text-violet-300 font-black text-xl drop-shadow-md">+${gameState.winners.find(w => w.playerId === p.id)?.amount}</span>
                             </div>
                         </div>
                    )}
                    </div>
                )
            })}
        </div>
      </main>

      {/* 底部浮标 - 非玩家回合显示 */}
      {!isPlayerTurn && gameState.phase !== "showdown" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-xl">
            <Coins className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-white">${player.chips}</span>
          </div>
        </div>
      )}

      {/* Control Bar - 玩家回合时展开 */}
      {isPlayerTurn && (
          <PokerControls
              locale={locale}
              gameState={gameState}
              player={player}
              raiseAmount={raiseAmount}
              sliderMin={sliderMin}
              sliderMax={sliderMax}
              setRaiseAmount={setRaiseAmount}
              onAction={handleAction}
          />
      )}

      {/* Rebuy Dialog */}
      <RebuyDialog 
        isOpen={showRebuy}
        locale={locale}
        balance={userProfile?.chips || 0}
        buyInAmount={BUY_IN_AMOUNT}
        onRebuy={() => {
            // Check again for safety
            if (userProfile.chips >= BUY_IN_AMOUNT) {
                // To rebuy, we continue the current game session
                
                // 1. Close Dialog
                setShowRebuy(false)
                
                // 2. Update Stats & Profile
                const newBalance = userProfile.chips - BUY_IN_AMOUNT
                setUserProfile((prev: any) => ({ ...prev, chips: newBalance }))

                setSessionStats((prev: typeof sessionStats) => ({
                    ...prev,
                    initialChips: prev.initialChips + BUY_IN_AMOUNT // Add to cost basis
                }))
                
                // 3. Start Next Hand with Rebuy Flag
                if (gameState) {
                     startNewGame(undefined, true)
                     toast.success(copy.rebuySuccess, { description: copy.goodLuck })
                } else {
                    // Fallback
                    startNewGame()
                }
            }
        }}
        onExit={() => {
            setShowRebuy(false)
            setGameState(null)
            setShowSetup(true)
        }}
      />

      {/* Next Game Overlay - Visible when game is over */}
      <SessionScoreboard 
        locale={locale}
        isOpen={showScoreboard}
        onClose={() => setShowScoreboard(false)}
        initialChips={sessionStats.initialChips}
        currentChips={gameState ? gameState.players[0].chips : 0}
        handsPlayed={sessionStats.handsPlayed}
        wins={sessionStats.wins}
        startTime={sessionStats.startTime}
        players={gameState?.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            isUser: p.id === 0,
            totalBuyIn: playerBuyIns[p.id] || 0,
            currentChips: p.chips
        }))}
      />

      {gameState.phase === "showdown" && !showRebuy && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none">
            {/* Minimal Backdrop - Clickable to dismiss/do nothing, but transparent enough to see board */}
            <div className="absolute inset-0 bg-black/30 pointer-events-auto transition-opacity duration-500" />

            <div className="relative z-10 w-full max-w-2xl p-4 md:p-6 pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-500">
                <div className="bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                    <div className="p-5 flex flex-col gap-5">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">{copy.roundSummary}</h2>
                                <p className="text-slate-400 text-xs font-medium">Round Summary</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">{copy.potTotal}</div>
                                <div className="text-xl font-black text-violet-400">${gameState.winners?.reduce((acc, w) => acc + w.amount, 0)}</div>
                            </div>
                        </div>

                        {/* Showdown Results List */}
                        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                            {(() => {
                                const activePlayers = gameState.players.filter(p => !p.folded)
                                const results = activePlayers.map(p => {
                                    const evaluation = evaluateHand(p.cards, gameState.communityCards)
                                    const winInfo = gameState.winners?.find(w => w.playerId === p.id)
                                    return {
                                        player: p,
                                        evaluation,
                                        winAmount: winInfo ? winInfo.amount : 0,
                                        isWinner: !!winInfo
                                    }
                                }).sort((a, b) => {
                                    // Sort by Rank Value (Desc)
                                    if (b.evaluation.rankValue !== a.evaluation.rankValue) {
                                        return b.evaluation.rankValue - a.evaluation.rankValue
                                    }
                                    if (a.isWinner && !b.isWinner) return -1
                                    if (!a.isWinner && b.isWinner) return 1
                                    return 0
                                })

                                return results.map(({ player, evaluation, winAmount, isWinner }, idx) => (
                                    <div key={player.id} className={cn(
                                        "flex flex-col p-4 rounded-xl border transition-colors",
                                        isWinner 
                                            ? "bg-violet-500/10 border-violet-500/20" 
                                            : "bg-white/5 border-white/5"
                                    )}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {/* Avatar/Name */}
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-base border border-white/10 overflow-hidden">
                                                        {player.avatar ? (
                                                            <img src={player.avatar} className="w-full h-full object-cover" alt={player.name} />
                                                        ) : (
                                                            <span className="font-bold text-slate-400">{Array.from(player.name)[0]?.toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    {isWinner && (
                                                        <div className="absolute -bottom-1 -right-1 bg-violet-500 text-white text-[10px] font-bold px-1.5 rounded-full border border-black shadow-sm">
                                                            WIN
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-col">
                                                    <span className={cn("font-bold text-base", isWinner ? "text-violet-200" : "text-slate-200")}>
                                                        {player.name}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {player.isAI ? copy.bot : copy.you}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="text-right">
                                                {isWinner ? (
                                                    <div className="text-xl font-black text-violet-300">+${winAmount}</div>
                                                ) : (
                                                    <div className="text-sm font-medium text-slate-600">{copy.lost}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hand & Cards */}
                                         <div className="bg-black/20 rounded-lg p-4 mt-1">
                                             <div className="flex items-center justify-between mb-3">
                                                 <div className="flex items-center gap-2">
                                                     <span className={cn(
                                                         "text-sm font-bold px-2.5 py-0.5 rounded shadow-sm",
                                                         isWinner ? "bg-violet-500 text-white" : "text-slate-300 bg-slate-700"
                                                     )}>
                                                         {evaluation.description}
                                                     </span>
                                                     <span className="text-xs text-slate-500 font-mono">
                                                         {evaluation.rank}
                                                     </span>
                                                 </div>
                                             </div>
                                             
                                             <div className="flex items-center gap-6">
                                                 {/* Hole Cards (2) */}
                                                 <div className="flex flex-col gap-2 shrink-0">
                                                     <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider pl-0.5">{copy.holeCards}</span>
                                                     <div className="flex gap-2">
                                                         {player.cards.map((card, i) => (
                                                             <PokerCard key={i} card={card} className="w-12 h-16 text-sm shadow-md ring-1 ring-black/20" />
                                                         ))}
                                                     </div>
                                                 </div>

                                                 <div className="w-px h-14 bg-white/10 shrink-0 self-end mb-1" />

                                                 {/* Best Cards (5) */}
                                                 <div className="flex flex-col gap-2 shrink-0">
                                                     <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider pl-0.5">{copy.bestFive}</span>
                                                     <div className="flex gap-1.5">
                                                         {evaluation.bestCards.map((card, i) => (
                                                             <PokerCard key={i} card={card} className="w-12 h-16 text-sm shadow-md ring-1 ring-black/20" />
                                                         ))}
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                    </div>
                                ))
                            })()}
                        </div>

                        <Button
                            onClick={() => startNewGame()} // Keeps same players
                            className="w-full h-12 text-base font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                        >
                            {copy.nextRound}
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <GameChatPanel
        locale={locale}
        isOpen={isChatOpen}
        messages={chatMessages}
        draft={chatDraft}
        loading={chatState === "thinking"}
        error={chatError}
        state={chatState}
        provider={chatProvider}
        handContext={currentChatContext}
        openingPrompts={chatOpeningPrompts}
        onToggle={() => setIsChatOpen((prev) => !prev)}
        onDraftChange={setChatDraft}
        onSend={() => void sendChatMessage()}
        onPromptSelect={handlePromptSelect}
      />
    </div>
    </>
  )
}
