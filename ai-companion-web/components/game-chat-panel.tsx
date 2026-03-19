"use client"

import { Bot, ChevronLeft, MessageSquareMore, Sparkles, X } from "lucide-react"

import { GameChatInput } from "@/components/game-chat-input"
import { GameChatWindow } from "@/components/game-chat-window"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ChatHandContext,
  ChatMessage,
  CompanionState,
  ReplyProvider,
} from "@/types/chat"

interface GameChatPanelProps {
  locale: "zh" | "en"
  isOpen: boolean
  messages: ChatMessage[]
  draft: string
  loading: boolean
  error?: string | null
  state: CompanionState
  provider: ReplyProvider
  handContext?: ChatHandContext | null
  openingPrompts: string[]
  onToggle: () => void
  onDraftChange: (value: string) => void
  onSend: () => void
  onPromptSelect: (prompt: string) => void
}

const stateTone: Record<CompanionState, string> = {
  idle: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  thinking: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  replying: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-300/30 bg-rose-300/10 text-rose-100",
}

export function GameChatPanel({
  locale,
  isOpen,
  messages,
  draft,
  loading,
  error,
  state,
  provider,
  handContext,
  openingPrompts,
  onToggle,
  onDraftChange,
  onSend,
  onPromptSelect,
}: GameChatPanelProps) {
  const copy = {
    title: locale === "zh" ? "PKmind 侧边助手" : "PKmind Side Assistant",
    subtitle:
      locale === "zh"
        ? "边打边问，边复盘边还原"
        : "Ask, analyze, and reconstruct while the table stays live",
    street: locale === "zh" ? "街道" : "Street",
    pot: locale === "zh" ? "底池" : "Pot",
    hero: locale === "zh" ? "Hero" : "Hero",
    board: locale === "zh" ? "公共牌" : "Board",
    hiddenBoard: locale === "zh" ? "尚未发出" : "Not dealt yet",
    hiddenHero: locale === "zh" ? "等待发牌" : "Waiting for cards",
    close: locale === "zh" ? "收起聊天栏" : "Collapse chat",
    open: locale === "zh" ? "展开聊天栏" : "Open chat",
    provider: provider === "minimax" ? "MiniMax Live" : "Mock Mode",
    idle: locale === "zh" ? "待命" : "Idle",
    thinking: locale === "zh" ? "思考中" : "Thinking",
    replying: locale === "zh" ? "回复中" : "Replying",
    errorState: locale === "zh" ? "重试中" : "Retry Needed",
  }

  const stateLabel =
    state === "idle"
      ? copy.idle
      : state === "thinking"
        ? copy.thinking
        : state === "replying"
          ? copy.replying
          : copy.errorState

  const boardLine = handContext?.snapshot.board.join(" ") || copy.hiddenBoard
  const heroCards = handContext?.snapshot.hero.cards.join(" ") || copy.hiddenHero

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 right-4 top-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] max-w-full flex-col rounded-[30px] border border-white/10 bg-zinc-950/90 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl transition-all duration-300",
          isOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0 pointer-events-none",
        )}
      >
        <div className="border-b border-white/10 px-5 pb-4 pt-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_24px_rgba(139,92,246,0.35)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.32em] text-violet-300/80">
                    PokerMind
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    {copy.title}
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {copy.subtitle}
              </p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={onToggle}
              aria-label={copy.close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${stateTone[state]}`}>
              {stateLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {copy.provider}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {copy.street}: {handContext?.snapshot.street || "preflop"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
              <div className="mb-1 text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                {copy.pot}
              </div>
              <div className="text-base font-semibold text-violet-300">
                ${handContext?.snapshot.pot ?? 0}
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
              <div className="mb-1 text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                {copy.hero}
              </div>
              <div className="text-base font-semibold text-slate-100">
                {heroCards}
              </div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/5 bg-white/[0.04] p-3">
              <div className="mb-1 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                {copy.board}
              </div>
              <div className="text-sm font-medium text-slate-200">
                {boardLine}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-4">
          <GameChatWindow
            messages={messages}
            loading={loading}
            locale={locale}
            companionName="PKmind"
            openingPrompts={openingPrompts}
            onPromptSelect={onPromptSelect}
          />

          <GameChatInput
            locale={locale}
            value={draft}
            loading={loading}
            error={error}
            onChange={onDraftChange}
            onSend={onSend}
          />
        </div>
      </div>

      {!isOpen ? (
        <Button
          onClick={onToggle}
          className="fixed right-4 top-1/2 z-[60] h-14 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 text-white shadow-[0_20px_50px_rgba(139,92,246,0.35)] transition hover:brightness-110"
          aria-label={copy.open}
        >
          <MessageSquareMore className="mr-2 h-5 w-5" />
          <span className="hidden sm:inline">{locale === "zh" ? "聊天侧栏" : "Chat Panel"}</span>
          <ChevronLeft className="ml-2 h-4 w-4" />
        </Button>
      ) : null}
    </>
  )
}
