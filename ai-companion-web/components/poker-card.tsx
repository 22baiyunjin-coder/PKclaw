import type { Card as CardType } from "@/lib/poker-types"
import { cn } from "@/lib/utils"

interface PokerCardProps {
  card?: CardType
  faceDown?: boolean
  className?: string
}

export function PokerCard({ card, faceDown = false, className }: PokerCardProps) {
  if (!card || faceDown) {
    return (
      <div
        className={cn(
          "relative w-16 h-24 rounded-lg flex items-center justify-center shadow-lg",
          "bg-gradient-to-br from-red-800 via-red-900 to-black",
          "border-2 border-red-950",
          "before:absolute before:inset-2 before:border before:border-red-700/30 before:rounded",
          className,
        )}
      >
        <div className="text-4xl text-red-600/40">♠</div>
      </div>
    )
  }

  const isRed = card.suit === "♥" || card.suit === "♦"

  return (
    <div
      className={cn(
        "relative w-16 h-24 rounded-lg flex flex-col items-center justify-center shadow-lg",
        "bg-white border-2 border-zinc-200",
        className,
      )}
    >
      {/* 左上角 */}
      <div className="absolute top-[5%] left-[8%] flex flex-col items-center leading-none">
        <div className={cn("text-[0.8em] font-bold", isRed ? "text-red-600" : "text-black")}>{card.rank}</div>
        <div className={cn("text-[1em] leading-none", isRed ? "text-red-600" : "text-black")}>{card.suit}</div>
      </div>

      {/* 中心 */}
      <div className={cn("text-[2.5em]", isRed ? "text-red-600" : "text-black")}>{card.suit}</div>

      {/* 右下角（倒置） */}
      <div className="absolute bottom-[5%] right-[8%] flex flex-col-reverse items-center leading-none rotate-180">
        <div className={cn("text-[0.8em] font-bold", isRed ? "text-red-600" : "text-black")}>{card.rank}</div>
        <div className={cn("text-[1em] leading-none", isRed ? "text-red-600" : "text-black")}>{card.suit}</div>
      </div>
    </div>
  )
}
