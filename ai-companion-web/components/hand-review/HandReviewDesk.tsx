"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Library, MessageSquare, Pause, Play, RotateCcw } from "lucide-react"

import { GameChatPanel } from "@/components/game-chat-panel"
import { ReplayBattleTable } from "@/components/hand-review/ReplayBattleTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { buildReplayFromHandPayload } from "@/lib/hand-review"
import type { Locale } from "@/lib/i18n"
import type { HandRecordDetail } from "@/types/hand-review"
import type { ChatApiResponse, ChatHandContext, ChatMessage, ChatMessagePayload, CompanionState, ReplyProvider } from "@/types/chat"
import type { ReplayEvent, ReplayHand } from "@/types/replay"

function buildId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function formatProfit(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`
}

function serializeMessages(messages: ChatMessage[]): ChatMessagePayload[] {
  return messages.map(({ role, content }) => ({ role, content }))
}

function buildChatContext(event: ReplayEvent | null): ChatHandContext | null {
  if (!event) {
    return null
  }

  const snapshot = event.snapshot
  const hero = snapshot.players.find((player) => player.seatKey === "bottom") ?? snapshot.players[0]

  return {
    snapshot: {
      street: snapshot.street,
      pot: snapshot.pot,
      currentBet: Math.max(...snapshot.players.map((player) => player.streetBet), 0),
      actingPlayer: snapshot.actingPlayer || hero.name,
      board: snapshot.board,
      hero: {
        name: hero.name,
        chips: hero.stack,
        bet: hero.streetBet,
        cards: hero.holeCards,
      },
      seats: snapshot.players.map((player, index) => ({
        seat: index + 1,
        name: player.name,
        chips: player.stack,
        bet: player.streetBet,
        folded: !player.inHand,
        isAI: player.seatKey !== "bottom",
        lastAction: player.lastAction,
        personaStyle: player.position,
      })),
    },
    event: {
      street: snapshot.street,
      actionLog: [event.label],
      lastAction: event.label,
    },
  }
}

interface HandReviewDeskProps {
  record: HandRecordDetail
  locale: Locale
}

export function HandReviewDesk({ record, locale }: HandReviewDeskProps) {
  const replay = useMemo<ReplayHand | null>(() => {
    if (record.replayPayload) {
      return record.replayPayload
    }

    if (record.handPayload) {
      return buildReplayFromHandPayload(record.handPayload, {
        handId: record.id,
        tableName: record.tableName,
        title: record.title,
      })
    }

    return null
  }, [record])

  const [stepIndex, setStepIndex] = useState(0)
  const [speed, setSpeed] = useState(1100)
  const [isPlaying, setIsPlaying] = useState(Boolean(replay))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatState, setChatState] = useState<CompanionState>("idle")
  const [provider, setProvider] = useState<ReplyProvider>("mock")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const playbackTimerRef = useRef<number | null>(null)

  const currentEvent: ReplayEvent | null = replay?.events[stepIndex] ?? null
  const handContext = buildChatContext(currentEvent)

  const copy = {
    replay: locale === "zh" ? "手牌复盘模式" : "Hand Review Mode",
    summary: locale === "zh" ? "复盘摘要" : "Review Summary",
    timeline: locale === "zh" ? "动作时间线" : "Action Timeline",
    rawInput: locale === "zh" ? "原始输入" : "Raw Input",
    noReplay: locale === "zh" ? "这手牌还没有结构化到可视化回放。" : "This hand has not been structured into a visual replay yet.",
    openChat: locale === "zh" ? "打开复盘聊天" : "Open review chat",
    playedAt: locale === "zh" ? "记录时间" : "Recorded At",
    source: locale === "zh" ? "来源" : "Source",
    step: locale === "zh" ? "步骤" : "Step",
    profit: locale === "zh" ? "Hero 盈亏" : "Hero P/L",
    previous: locale === "zh" ? "上一步" : "Previous",
    next: locale === "zh" ? "下一步" : "Next",
    restart: locale === "zh" ? "回到开头" : "Restart",
    play: locale === "zh" ? "播放" : "Play",
    pause: locale === "zh" ? "暂停" : "Pause",
    draft: locale === "zh" ? "待结构化草稿" : "Draft awaiting structuring",
  }

  const openingPrompts =
    locale === "zh"
      ? [
          "这里 Hero 的关键错误是什么？",
          "如果从这里开始重新模拟，哪一边范围更有优势？",
          "请按 preflop / flop / turn / river 重新拆这手牌。",
        ]
      : [
          "What is the key mistake for Hero in this hand?",
          "If we branch the hand from here, whose range benefits most?",
          "Break this hand down street by street for me.",
        ]

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!replay) {
      setIsPlaying(false)
      return
    }

    setStepIndex(0)
    setIsPlaying(true)
  }, [replay])

  useEffect(() => {
    if (!isPlaying || !replay) {
      return
    }

    if (stepIndex >= replay.events.length - 1) {
      setIsPlaying(false)
      return
    }

    playbackTimerRef.current = window.setTimeout(() => {
      setStepIndex((current) => Math.min(current + 1, replay.events.length - 1))
    }, speed)

    return () => {
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current)
      }
    }
  }, [isPlaying, replay, speed, stepIndex])

  async function sendMessage(overrideText?: string) {
    const content = (overrideText ?? draft).trim()

    if (!content || loading) {
      return
    }

    const userMessage: ChatMessage = {
      id: buildId(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setDraft("")
    setError(null)
    setLoading(true)
    setChatState("thinking")
    setIsChatOpen(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: serializeMessages(nextMessages),
          handContext,
        }),
      })

      const payload = (await response.json()) as ChatApiResponse | { error?: string }

      if (!response.ok || !("reply" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : locale === "zh"
              ? "复盘聊天暂时不可用，请稍后再试。"
              : "Review chat is temporarily unavailable.",
        )
      }

      setMessages((current) => [...current, payload.reply])
      setProvider(payload.provider)
      setChatState("replying")

      window.setTimeout(() => {
        setChatState("idle")
      }, 500)
    } catch (requestError) {
      setChatState("error")
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === "zh"
            ? "复盘聊天失败。"
            : "Failed to review the hand.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        {replay ? (
          <ReplayBattleTable
            hand={replay}
            currentStep={stepIndex}
            currentEvent={currentEvent}
            companionState={chatState}
            locale={locale}
          />
        ) : (
          <Card className="min-h-[860px] border-slate-800 bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-white">{copy.replay}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">{copy.noReplay}</CardContent>
          </Card>
        )}

        <Card className="border-slate-800 bg-slate-900/80">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                setIsPlaying(false)
                setStepIndex(0)
              }}
              disabled={!replay}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {copy.restart}
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              disabled={!replay || stepIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {copy.previous}
            </Button>
            <Button
              className="bg-violet-600 text-white hover:bg-violet-500"
              onClick={() => setIsPlaying((current) => !current)}
              disabled={!replay}
            >
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? copy.pause : copy.play}
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                if (!replay) return
                setStepIndex((current) => Math.min(current + 1, replay.events.length - 1))
              }}
              disabled={!replay || !replay.events[stepIndex + 1]}
            >
              {copy.next}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
              onClick={() => setIsChatOpen(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {copy.openChat}
            </Button>
            {replay ? (
              <div className="ml-auto rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-300">
                {copy.step}: {stepIndex + 1} / {replay.events.length}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-slate-800 bg-slate-900/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Library className="h-5 w-5 text-violet-400" />
              {copy.summary}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{copy.playedAt}</div>
                <div className="mt-2 text-base font-semibold text-white">{formatDate(record.createdAt)}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{copy.source}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-violet-600/20 text-violet-100 hover:bg-violet-600/20">{record.source}</Badge>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">{record.status}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{copy.profit}</div>
                <div className={`mt-2 text-base font-semibold ${record.heroProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatProfit(record.heroProfit)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{copy.step}</div>
                <div className="mt-2 text-base font-semibold text-white">{record.actionCount} actions</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 leading-7">
              <h3 className="mb-2 text-base font-semibold text-white">{record.title}</h3>
              <p>{record.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {record.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-slate-700 text-slate-300">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80">
          <CardHeader>
            <CardTitle className="text-white">{copy.timeline}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-3">
                {replay?.events.map((event, index) => (
                  <button
                    key={`${event.label}-${index}`}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false)
                      setStepIndex(index)
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      index === stepIndex
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {event.street}
                      </span>
                      <span className="text-xs text-slate-500">#{index + 1}</span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">{event.label}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{event.snapshot.headline}</div>
                  </button>
                ))}

                {!replay ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
                    {record.status === "draft" ? copy.draft : copy.noReplay}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {record.rawInput ? (
          <Card className="border-slate-800 bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-white">{copy.rawInput}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-7 text-slate-300">
                {record.rawInput}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <GameChatPanel
        locale={locale}
        isOpen={isChatOpen}
        messages={messages}
        draft={draft}
        loading={loading}
        error={error}
        state={chatState}
        provider={provider}
        handContext={handContext}
        openingPrompts={openingPrompts}
        onToggle={() => setIsChatOpen((current) => !current)}
        onDraftChange={setDraft}
        onSend={() => void sendMessage()}
        onPromptSelect={(prompt) => void sendMessage(prompt)}
      />
    </div>
  )
}
