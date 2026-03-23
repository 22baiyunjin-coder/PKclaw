"use client"

import { Coins, PlayCircle, TimerReset } from "lucide-react"

import { PlayerSeat } from "@/components/player-seat"
import { PokerCard } from "@/components/poker-card"
import { cn } from "@/lib/utils"
import type { Card as PokerPlayingCard, Player } from "@/lib/poker-types"
import type { CompanionState } from "@/types/chat"
import type { ReplayEvent, ReplayHand, ReplayPlayer } from "@/types/replay"

const stateGlow: Record<CompanionState, string> = {
  idle: "shadow-[0_0_40px_rgba(99,102,241,0.08)]",
  thinking: "shadow-[0_0_50px_rgba(168,85,247,0.16)]",
  replying: "shadow-[0_0_50px_rgba(16,185,129,0.14)]",
  error: "shadow-[0_0_50px_rgba(244,63,94,0.14)]",
}

const suitMap: Record<string, string> = {
  s: "\u2660",
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
}

function parseReplayCard(cardText?: string): PokerPlayingCard | undefined {
  if (!cardText || cardText === "??" || cardText.length < 2) {
    return undefined
  }

  const suitKey = cardText.slice(-1).toLowerCase()
  const rankText = cardText.slice(0, -1).toUpperCase()
  const suit = suitMap[suitKey]

  if (!suit) {
    return undefined
  }

  return {
    rank: rankText as PokerPlayingCard["rank"],
    suit: suit as PokerPlayingCard["suit"],
  }
}

function getPlayerPosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI + Math.PI / 2
  const radiusX = 42
  const radiusY = 35

  return {
    x: 50 + radiusX * Math.cos(angle),
    y: 50 + radiusY * Math.sin(angle),
  }
}

function replayPlayerToPlayer(player: ReplayPlayer, index: number): Player {
  return {
    id: index,
    name: player.name,
    chips: Math.round(player.stack),
    cards: [parseReplayCard(player.holeCards[0]), parseReplayCard(player.holeCards[1])] as unknown as PokerPlayingCard[],
    bet: Math.round(player.streetBet),
    folded: !player.inHand,
    isAI: player.seatKey !== "bottom",
    position: index,
    lastAction: player.lastAction || null,
    totalHandBet: Math.round(player.totalCommitted),
  }
}

function isDealer(position: string) {
  return position.toUpperCase() === "BTN"
}

function isSmallBlind(position: string) {
  return position.toUpperCase() === "SB"
}

function isBigBlind(position: string) {
  return position.toUpperCase() === "BB"
}

interface ReplayBattleTableProps {
  hand: ReplayHand | null
  currentStep: number
  currentEvent: ReplayEvent | null
  companionState: CompanionState
  locale: "zh" | "en"
}

export function ReplayBattleTable({
  hand,
  currentStep,
  currentEvent,
  companionState,
  locale,
}: ReplayBattleTableProps) {
  const snapshot = currentEvent?.snapshot

  if (!hand || !snapshot || !currentEvent) {
    return (
      <div className="flex min-h-[860px] items-center justify-center rounded-[32px] border border-white/10 bg-slate-950/70 text-slate-200">
        Loading replay...
      </div>
    )
  }

  const players = snapshot.players.map(replayPlayerToPlayer)
  const isShowdownFrame =
    currentEvent.kind === "showdown" ||
    currentEvent.kind === "hand_complete" ||
    snapshot.winners.length > 0

  return (
    <section className={cn("min-h-[860px] rounded-[34px] border border-white/10 bg-slate-950/80 p-4 backdrop-blur-xl", stateGlow[companionState])}>
      <div className="mb-4 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-violet-300/70">
            Replay Arena
          </div>
          <h2 className="mt-1 text-2xl font-black text-white">{hand.tableName}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{currentEvent.label}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Street
            </div>
            <div className="mt-1 text-base font-semibold text-white">{snapshot.street}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Step
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {currentStep + 1} / {hand.events.length}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Status
            </div>
            <div className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
              {companionState === "replying" ? <PlayCircle className="h-4 w-4 text-emerald-400" /> : <TimerReset className="h-4 w-4 text-violet-300" />}
              {locale === "zh" ? "自动回放中" : "Auto replay"}
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[760px] overflow-hidden rounded-[32px] bg-zinc-950 text-zinc-100">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

        <main className="absolute inset-0 flex items-center justify-center overflow-hidden p-2 sm:p-3 md:p-4">
          <div className="relative h-full w-full max-w-[1400px]" style={{ aspectRatio: "2.2/1", maxHeight: "calc(100vh - 120px)" }}>
            <div className="absolute inset-0 rounded-[100px] border border-white/10 bg-zinc-950/40 backdrop-blur-3xl shadow-2xl ring-1 ring-white/5 md:rounded-[200px]">
              <div className="absolute inset-0 rounded-[100px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none md:rounded-[200px]" />
              <div className="absolute inset-[10px] rounded-[90px] border border-white/5 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] md:inset-[20px] md:rounded-[180px]" />

              <div className="absolute left-1/2 top-[38%] z-10 flex -translate-x-1/2 -translate-y-1/2 gap-1 sm:gap-1.5 md:top-[45%] md:gap-3">
                {snapshot.board.map((card, index) => (
                  <div key={`${card}-${index}`} className="animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
                    <PokerCard card={parseReplayCard(card)} className="h-11 w-8 shadow-2xl ring-1 ring-black/20 xs:h-13 xs:w-9 sm:h-16 sm:w-12 md:h-28 md:w-20" />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - snapshot.board.length) }).map((_, index) => (
                  <div key={`empty-${index}`} className="h-11 w-8 rounded-lg border-2 border-dashed border-white/5 bg-white/5 xs:h-13 xs:w-9 sm:h-16 sm:w-12 md:h-28 md:w-20" />
                ))}
              </div>

              <div className="absolute left-1/2 top-[22%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 md:top-[28%]">
                <div className="flex items-center gap-1 rounded-full border border-violet-500/20 bg-black/40 px-1.5 py-0.5 shadow-[0_0_15px_rgba(139,92,246,0.2)] backdrop-blur-md md:gap-2 md:px-3 md:py-1">
                  <Coins className="h-2.5 w-2.5 text-violet-300 md:h-4 md:w-4" />
                  <span className="font-mono text-sm font-bold tracking-wider text-violet-300 md:text-xl">
                    ${Math.round(snapshot.pot)}
                  </span>
                </div>
              </div>

              {snapshot.actingPlayer ? (
                <div className="absolute left-1/2 top-[65%] z-20 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 backdrop-blur-md animate-pulse md:gap-1.5 md:px-3 md:py-1">
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce md:h-1.5 md:w-1.5" />
                    <span className="text-[8px] font-medium text-zinc-300 md:text-[10px]">
                      {snapshot.actingPlayer} {locale === "zh" ? "正在行动..." : "is acting..."}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {players.map((player, index) => {
              const pos = getPlayerPosition(index, players.length)
              const replayPlayer = snapshot.players[index]

              return (
                <div
                  key={`${player.id}-${player.name}`}
                  className="absolute z-30 transition-all duration-500"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <PlayerSeat
                    player={player}
                    isCurrentPlayer={snapshot.actingPlayer === player.name}
                    isDealer={isDealer(replayPlayer.position)}
                    isSmallBlind={isSmallBlind(replayPlayer.position)}
                    isBigBlind={isBigBlind(replayPlayer.position)}
                    isMainPlayer={replayPlayer.seatKey === "bottom"}
                    showCards={isShowdownFrame}
                  />
                </div>
              )
            })}
          </div>
        </main>

        <div className="absolute bottom-5 left-1/2 z-20 w-[82%] -translate-x-1/2 rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-center text-sm leading-6 text-slate-200 backdrop-blur">
          {snapshot.headline}
        </div>
      </div>
    </section>
  )
}
