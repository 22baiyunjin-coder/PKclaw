"use client"

import { useMemo } from "react"

import { type Locale, pickText } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface HandAnalysisProps {
  winProbability: number
  locale: Locale
}

export function HandAnalysis({ winProbability, locale }: HandAnalysisProps) {
  const label = useMemo(
    () => pickText(locale, { zh: "胜率", en: "Win Rate" }),
    [locale],
  )

  const getProbabilityColor = (prob: number) => {
    if (prob > 70) return "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
    if (prob > 40) return "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
    return "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
  }

  return (
    <div className="flex min-w-[120px] flex-col gap-2">
      <div className="flex items-end justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="tabular-nums text-2xl font-black tracking-tighter text-white">
          {winProbability}
          <span className="ml-0.5 text-sm text-zinc-500">%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getProbabilityColor(winProbability),
          )}
          style={{ width: `${winProbability}%` }}
        />
      </div>
    </div>
  )
}
