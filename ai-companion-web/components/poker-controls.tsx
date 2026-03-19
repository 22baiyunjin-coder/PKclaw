"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { type Locale, pickText } from "@/lib/i18n"
import { GameState, Player } from "@/lib/poker-types"

interface PokerControlsProps {
  locale: Locale
  gameState: GameState
  player: Player
  raiseAmount: number
  sliderMin: number
  sliderMax: number
  setRaiseAmount: (amount: number) => void
  onAction: (
    action: "fold" | "check" | "call" | "raise" | "all-in",
    amount?: number,
  ) => void
}

export function PokerControls({
  locale,
  gameState,
  player,
  raiseAmount,
  sliderMin,
  sliderMax,
  setRaiseAmount,
  onAction,
}: PokerControlsProps) {
  const [viewMode, setViewMode] = useState<"collapsed" | "compact" | "expanded">(
    "compact",
  )
  const callAmount = gameState.currentBet - player.bet

  const copy = useMemo(
    () => ({
      yourTurn: pickText(locale, { zh: "轮到你了", en: "Your Turn" }),
      needCall: pickText(locale, { zh: "需跟", en: "Call" }),
      fold: pickText(locale, { zh: "弃牌", en: "Fold" }),
      check: pickText(locale, { zh: "过牌", en: "Check" }),
      call: pickText(locale, { zh: "跟注", en: "Call" }),
      raise: pickText(locale, { zh: "加注", en: "Raise" }),
      amount: pickText(locale, { zh: "加注额度", en: "Raise Size" }),
      halfPot: pickText(locale, { zh: "半池", en: "Half Pot" }),
      fullPot: pickText(locale, { zh: "满池", en: "Pot" }),
      back: pickText(locale, { zh: "返回", en: "Back" }),
      confirmRaise: pickText(locale, { zh: "确认加注", en: "Confirm Raise" }),
      pot: "POT",
    }),
    [locale],
  )

  const renderCollapsedMode = () => (
    <div
      className="flex cursor-pointer items-center justify-between border-t border-white/20 bg-zinc-900/90 px-4 py-2 backdrop-blur-xl transition-colors hover:bg-zinc-800/90"
      onClick={() => setViewMode("compact")}
    >
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-sm font-bold text-white">{copy.yourTurn}</span>
      </div>
      <div className="flex items-center gap-2">
        {callAmount > 0 ? (
          <span className="font-mono text-xs text-red-400">
            {copy.needCall} ${callAmount}
          </span>
        ) : null}
        <ChevronUp className="h-4 w-4 text-zinc-400" />
      </div>
    </div>
  )

  const renderCompactMode = () => (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5 md:gap-3">
        <Button
          size="lg"
          variant="destructive"
          className="h-10 rounded-lg bg-red-600 text-xs font-black text-white shadow-xl shadow-red-900/40 transition-all hover:scale-105 hover:bg-red-700 active:scale-95 sm:h-12 sm:rounded-xl sm:text-sm md:h-16 md:rounded-2xl md:text-xl"
          onClick={() => onAction("fold")}
        >
          {copy.fold}
        </Button>

        {callAmount === 0 ? (
          <Button
            size="lg"
            className="h-10 rounded-lg bg-emerald-500 text-xs font-black text-white shadow-xl shadow-emerald-900/40 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 sm:h-12 sm:rounded-xl sm:text-sm md:h-16 md:rounded-2xl md:text-xl"
            onClick={() => onAction("check")}
          >
            {copy.check}
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex h-10 flex-col items-center justify-center rounded-lg bg-emerald-500 text-[10px] font-black text-white shadow-xl shadow-emerald-900/40 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 sm:h-12 sm:rounded-xl sm:text-xs md:h-16 md:rounded-2xl md:text-base"
            onClick={() => onAction("call")}
          >
            <span className="text-sm font-black sm:text-base md:text-xl">
              {copy.call}
            </span>
            <span className="text-[9px] font-bold sm:text-[10px] md:text-sm">
              ${callAmount}
            </span>
          </Button>
        )}

        <Button
          size="lg"
          className="relative flex h-10 flex-col items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-black text-white shadow-xl shadow-indigo-900/40 transition-all hover:scale-105 hover:bg-indigo-500 active:scale-95 sm:h-12 sm:rounded-xl sm:text-xs md:h-16 md:rounded-2xl md:text-base"
          onClick={() => setViewMode("expanded")}
        >
          <span className="text-sm font-black sm:text-base md:text-xl">{copy.raise}</span>
          <ChevronUp className="absolute right-1 top-1 h-3 w-3 opacity-50" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-t-3xl border-x-2 border-t-2 border-white/10 bg-black/80 shadow-2xl backdrop-blur-xl transition-all duration-300">
        {viewMode !== "collapsed" ? (
          <div
            className="flex cursor-pointer items-center justify-between border-b border-white/5 bg-white/5 px-3 py-2"
            onClick={() => setViewMode("collapsed")}
          >
            <div className="flex items-center gap-2">
              <div className="rounded border border-violet-500/30 bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                {copy.pot}: ${gameState.pot}
              </div>
              {callAmount > 0 ? (
                <div className="text-[10px] font-bold text-red-400">
                  {copy.needCall}: ${callAmount}
                </div>
              ) : null}
            </div>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </div>
        ) : null}

        {viewMode === "collapsed" ? renderCollapsedMode() : null}

        {viewMode === "compact" ? (
          <div className="animate-in slide-in-from-bottom-5 fade-in p-2 duration-200 sm:p-3">
            {renderCompactMode()}
          </div>
        ) : null}

        {viewMode === "expanded" ? (
          <div className="animate-in slide-in-from-bottom-10 fade-in max-h-[60vh] space-y-4 overflow-y-auto p-3 duration-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm font-bold text-zinc-400">
                <span>{copy.amount}</span>
                <span className="font-mono text-2xl font-black text-white">
                  ${raiseAmount}
                </span>
              </div>

              <Slider
                value={[raiseAmount]}
                min={sliderMin}
                max={sliderMax}
                step={10}
                onValueChange={(vals) => setRaiseAmount(vals[0])}
                className="h-4"
              />

              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRaiseAmount(Math.floor(gameState.pot / 2) + gameState.currentBet)
                  }
                >
                  {copy.halfPot}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRaiseAmount(gameState.pot + gameState.currentBet)}
                >
                  {copy.fullPot}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRaiseAmount(sliderMax)}
                >
                  All-in
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewMode("compact")}
                >
                  {copy.back}
                </Button>
              </div>

              <Button
                size="lg"
                className="h-14 w-full rounded-xl bg-indigo-600 text-xl font-black text-white shadow-lg hover:bg-indigo-500"
                onClick={() => onAction("raise", raiseAmount)}
              >
                {copy.confirmRaise} ${raiseAmount}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
