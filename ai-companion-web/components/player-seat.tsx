import type { Player } from "@/lib/poker-types"
import { PokerCard } from "@/components/poker-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface PlayerSeatProps {
  player: Player
  isCurrentPlayer: boolean
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  isMainPlayer: boolean
  showCards?: boolean
}

export function PlayerSeat({ player, isCurrentPlayer, isDealer, isSmallBlind, isBigBlind, isMainPlayer, showCards = false }: PlayerSeatProps) {
  const getAvatarColor = (id: number) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
      "from-orange-500 to-orange-600",
      "from-teal-500 to-teal-600",
      "from-indigo-500 to-indigo-600",
      "from-cyan-500 to-cyan-600",
      "from-rose-500 to-rose-600",
    ]
    return colors[id % colors.length]
  }

  return (
    <div className="relative flex flex-col items-center gap-2 md:gap-3 transition-all duration-300">
      {/* 玩家状态光晕 */}
      {isCurrentPlayer && (
        <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full scale-150 animate-pulse" />
      )}

      {/* 头像区域 */}
      <div className="relative">
        <div
          className={cn(
            "w-10 h-10 xs:w-11 xs:h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-base md:text-lg shadow-2xl ring-2 md:ring-4 transition-all duration-300 bg-gradient-to-br",
            isCurrentPlayer ? "ring-accent scale-110" : "ring-white/10 grayscale-[0.5]",
            getAvatarColor(player.id),
          )}
        >
          {Array.from(player.name)[0]}
        </div>

        {/* 庄家按钮 */}
        {isDealer && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-violet-500 rounded-full flex items-center justify-center text-[7px] sm:text-[9px] md:text-[10px] font-black text-white border border-black shadow-lg z-10" title="Dealer">
            D
          </div>
        )}

        {/* 小盲按钮 */}
        {isSmallBlind && (
          <div className="absolute -top-1 -left-1 w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-indigo-500 rounded-full flex items-center justify-center text-[7px] sm:text-[9px] md:text-[10px] font-black text-white border border-black shadow-lg z-10" title="Small Blind">
            SB
          </div>
        )}

        {/* 大盲按钮 */}
        {isBigBlind && (
          <div className="absolute -top-1 -left-1 w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-rose-500 rounded-full flex items-center justify-center text-[7px] sm:text-[9px] md:text-[10px] font-black text-white border border-black shadow-lg z-10" title="Big Blind">
            BB
          </div>
        )}

        {/* 筹码信息 */}
        <div className="absolute -bottom-2 md:-bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-1.5 md:px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap z-20">
           <span className="text-[9px] md:text-xs font-mono text-emerald-400">${player.chips}</span>
        </div>
      </div>

      {/* 名字 */}
      <div className={cn("text-[9px] md:text-xs font-medium tracking-wide transition-colors max-w-[60px] truncate text-center", isCurrentPlayer ? "text-white" : "text-zinc-500")}>
        {player.name}
      </div>

      {/* 手牌 - 悬浮在下方 */}
      <div className={cn(
          "flex justify-center transition-all duration-500",
          // Main player: normal spacing
          (isMainPlayer || showCards) && !player.folded ? "-space-x-3 md:-space-x-4" : "-space-x-1 md:-space-x-2",
          player.folded ? "opacity-30 grayscale blur-[1px]" : "opacity-100"
      )}>
        {(isMainPlayer || showCards) && !player.folded ? (
          <>
            <div className="transform origin-bottom-left -rotate-6 hover:rotate-0 transition-transform z-10">
                <PokerCard card={player.cards[0]} className="w-9 h-12 xs:w-10 xs:h-14 sm:w-12 sm:h-17 md:w-14 md:h-20 shadow-2xl border border-black/20" />
            </div>
            <div className="transform origin-bottom-right rotate-6 hover:rotate-0 transition-transform z-20">
                <PokerCard card={player.cards[1]} className="w-9 h-12 xs:w-10 xs:h-14 sm:w-12 sm:h-17 md:w-14 md:h-20 shadow-2xl border border-black/20" />
            </div>
          </>
        ) : (
          <>
             {/* AI/Opponent Face Down Cards - Tiny Version */}
             <div className="transform origin-bottom-left -rotate-3 z-10">
                <PokerCard faceDown className="w-5 h-7 xs:w-6 xs:h-8 sm:w-8 sm:h-11 md:w-10 md:h-14 shadow-lg opacity-90 border border-white/10" />
            </div>
             <div className="transform origin-bottom-right rotate-3 z-20">
                <PokerCard faceDown className="w-5 h-7 xs:w-6 xs:h-8 sm:w-8 sm:h-11 md:w-10 md:h-14 shadow-lg opacity-90 border border-white/10" />
            </div>
          </>
        )}
      </div>

      {/* 当前下注气泡 - Moved higher to avoid overlap */}
      {player.bet > 0 && (
        <div className="absolute -top-8 md:-top-12 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 z-20">
          <div className="rounded-full border border-violet-400/50 bg-violet-500/90 px-1.5 py-0.5 text-[9px] font-black text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] backdrop-blur-sm md:px-3 md:py-1 md:text-xs">
            ${player.bet}
          </div>
        </div>
      )}

      {/* 弃牌标记 */}
      {player.folded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-12 z-30">
          <Badge variant="destructive" className="text-[9px] md:text-xs px-1.5 md:px-2 py-0.5 uppercase tracking-widest border border-red-900 bg-red-600 text-white shadow-lg">
            Fold
          </Badge>
        </div>
      )}

      {/* Action Badge - Positioned overlapping the top of avatar */}
      {player.lastAction && !player.folded && (
           <div className="absolute -top-4 md:-top-5 left-1/2 -translate-x-1/2 z-30 animate-in zoom-in fade-in slide-in-from-bottom-2 duration-300">
               <div className={cn(
                   "px-1.5 md:px-2 py-0.5 md:py-1 backdrop-blur-md border text-white text-[8px] md:text-[10px] font-black uppercase tracking-wider rounded-md shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center gap-1",
                   player.lastAction === "fold" ? "bg-red-500/90 border-red-400/50" :
                   player.lastAction === "check" ? "bg-emerald-500/90 border-emerald-400/50" :
                   player.lastAction === "call" ? "bg-blue-500/90 border-blue-400/50" :
                   player.lastAction === "raise" ? "bg-orange-500/90 border-orange-400/50" :
                   player.lastAction === "all-in" ? "bg-purple-600/90 border-purple-400/50 scale-110" :
                   "bg-zinc-700/90 border-zinc-600/50"
               )}>
                   {player.lastAction === "check" && <div className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-emerald-300 animate-pulse" />}
                   {player.lastAction === "raise" && <div className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-orange-300 animate-pulse" />}
                   {player.lastAction === "all-in" && <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-purple-300 animate-ping" />}
                   {player.lastAction}
               </div>
           </div>
       )}
    </div>
  )
}
