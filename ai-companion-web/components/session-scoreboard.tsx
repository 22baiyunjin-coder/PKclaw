"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Clock, Trophy, TrendingDown, TrendingUp, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type Locale, pickText } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export interface PlayerSessionStats {
  id: number
  name: string
  avatar?: string
  isUser: boolean
  totalBuyIn: number
  currentChips: number
  handsPlayed?: number
  wins?: number
}

interface SessionScoreboardProps {
  locale: Locale
  isOpen: boolean
  onClose: () => void
  initialChips: number
  currentChips: number
  handsPlayed: number
  wins: number
  startTime: number
  players?: PlayerSessionStats[]
}

export function SessionScoreboard({
  locale,
  isOpen,
  onClose,
  initialChips,
  currentChips,
  handsPlayed,
  wins,
  startTime,
  players = [],
}: SessionScoreboardProps) {
  const [duration, setDuration] = useState("00:00:00")

  const userProfit = currentChips - initialChips
  const isUserProfit = userProfit >= 0
  const winRate = handsPlayed > 0 ? ((wins / handsPlayed) * 100).toFixed(1) : "0.0"

  const leaderboard = players
    .map((player) => ({
      ...player,
      profit: player.currentChips - player.totalBuyIn,
    }))
    .sort((a, b) => b.profit - a.profit)

  const copy = useMemo(
    () => ({
      title: pickText(locale, { zh: "本局战绩统计", en: "Session Results" }),
      profit: pickText(locale, { zh: "本局盈亏", en: "Profit / Loss" }),
      buyIn: pickText(locale, { zh: "初始带入", en: "Initial Buy-in" }),
      chips: pickText(locale, { zh: "当前筹码", en: "Current Chips" }),
      hands: pickText(locale, { zh: "总手数", en: "Hands Played" }),
      winRate: pickText(locale, { zh: "胜率", en: "Win Rate" }),
      hotRun: pickText(locale, { zh: "手感火热", en: "On a Heater" }),
      leaderboard: pickText(locale, { zh: "全场盈亏排行", en: "Table Leaderboard" }),
      players: pickText(locale, { zh: "名玩家", en: "players" }),
      rank: pickText(locale, { zh: "排名", en: "Rank" }),
      player: pickText(locale, { zh: "玩家", en: "Player" }),
      totalBuyIn: pickText(locale, { zh: "总买入", en: "Total Buy-in" }),
      net: pickText(locale, { zh: "净盈亏", en: "Net P/L" }),
      you: pickText(locale, { zh: "你", en: "YOU" }),
    }),
    [locale],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const timer = setInterval(() => {
      const diff = Date.now() - startTime
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setDuration(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, startTime])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative flex max-h-[90vh] w-full max-w-2xl flex-col border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 z-10 text-slate-400 hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <CardHeader className="flex-shrink-0 pb-2 text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl text-white">
            <Activity className="h-5 w-5 text-indigo-500" />
            {copy.title}
          </CardTitle>
          <div className="mt-1 flex items-center justify-center gap-2 font-mono text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            {duration}
          </div>
        </CardHeader>

        <CardContent className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-slate-950/50 py-6 text-center">
              <div className="mb-1 text-sm text-slate-400">{copy.profit}</div>
              <div
                className={cn(
                  "flex items-center justify-center gap-2 text-4xl font-black tracking-tight",
                  isUserProfit ? "text-green-400" : "text-red-400",
                )}
              >
                {isUserProfit ? (
                  <TrendingUp className="h-8 w-8" />
                ) : (
                  <TrendingDown className="h-8 w-8" />
                )}
                {isUserProfit ? "+" : ""}
                {userProfit.toLocaleString()}
              </div>
              {userProfit > 5000 ? (
                <div className="mt-2 text-xs text-green-400/80">{copy.hotRun}</div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/30 p-3">
                <div className="mb-1 text-xs text-slate-500">{copy.buyIn}</div>
                <div className="text-lg font-bold text-slate-200">
                  {initialChips.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/30 p-3">
                <div className="mb-1 text-xs text-slate-500">{copy.chips}</div>
                <div className="text-lg font-bold text-violet-400">
                  {currentChips.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/30 p-3">
                <div className="mb-1 text-xs text-slate-500">{copy.hands}</div>
                <div className="text-lg font-bold text-slate-200">{handsPlayed}</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/50 bg-slate-950/30 p-3">
                <div className="mb-1 text-xs text-slate-500">{copy.winRate}</div>
                <div className="text-lg font-bold text-indigo-400">{winRate}%</div>
              </div>
            </div>
          </div>

          {leaderboard.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300">
                  <Trophy className="h-4 w-4 text-violet-400" />
                  {copy.leaderboard}
                </h3>
                <div className="text-xs text-slate-500">
                  {leaderboard.length} {copy.players}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/30">
                <Table>
                  <TableHeader className="bg-slate-950/50">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="w-12 text-center text-xs font-bold text-slate-500">
                        {copy.rank}
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">
                        {copy.player}
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-500">
                        {copy.totalBuyIn}
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-500">
                        {copy.chips}
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-500">
                        {copy.net}
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {leaderboard.map((player, index) => {
                      const isWinner = index === 0 && player.profit > 0
                      const isMe = player.isUser

                      return (
                        <TableRow
                          key={player.id}
                          className={cn(
                            "border-slate-800/50 transition-colors",
                            isMe ? "bg-indigo-500/10 hover:bg-indigo-500/20" : "hover:bg-white/5",
                          )}
                        >
                          <TableCell className="text-center font-mono text-slate-500">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isWinner ? <Trophy className="h-3 w-3 text-violet-400" /> : null}
                              <span
                                className={cn(
                                  "text-sm font-bold",
                                  isMe ? "text-indigo-400" : "text-slate-300",
                                )}
                              >
                                {player.name}
                              </span>
                              {isMe ? (
                                <Badge className="h-4 border-0 bg-indigo-500/20 px-1 text-[10px] text-indigo-300">
                                  {copy.you}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-400">
                            ${player.totalBuyIn.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold text-violet-400/90">
                            ${player.currentChips.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "font-mono font-bold",
                                player.profit > 0
                                  ? "text-green-400"
                                  : player.profit < 0
                                    ? "text-red-400"
                                    : "text-slate-500",
                              )}
                            >
                              {player.profit > 0 ? "+" : ""}
                              {player.profit.toLocaleString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
