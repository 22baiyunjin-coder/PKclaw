"use client"

import { useEffect, useRef } from "react"

import { GameMessageBubble } from "@/components/game-message-bubble"
import type { ChatMessage } from "@/types/chat"

interface GameChatWindowProps {
  messages: ChatMessage[]
  loading: boolean
  locale: "zh" | "en"
  companionName: string
  openingPrompts: string[]
  onPromptSelect: (prompt: string) => void
}

export function GameChatWindow({
  messages,
  loading,
  locale,
  companionName,
  openingPrompts,
  onPromptSelect,
}: GameChatWindowProps) {
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading])

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-1 flex-col justify-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-6">
        <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
          {locale === "zh" ? "侧边聊天" : "Side Chat"}
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          {locale === "zh"
            ? "边打边聊，边还原手牌"
            : "Talk through the hand while the table stays live"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          {locale === "zh"
            ? "右侧面板已经接入牌桌上下文。你可以直接问一手牌，也可以先用语音把动作线转成文字。"
            : "This panel already receives live table context. Ask about one hand, one leak, or use speech-to-text first."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {openingPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-violet-300/40 hover:bg-violet-400/10"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <div className="space-y-4">
        {messages.map((message) => (
          <GameMessageBubble
            key={message.id}
            message={message}
            companionName={companionName}
            locale={locale}
          />
        ))}

        {loading ? (
          <article className="flex justify-start">
            <div className="max-w-[85%] rounded-[24px] border border-white/10 bg-white/[0.08] px-4 py-3 text-slate-100">
              <div className="mb-2 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-violet-200">
                <span>{companionName}</span>
                <span className="text-slate-500">
                  {locale === "zh" ? "思考中" : "thinking"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-300" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-300 [animation-delay:200ms]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-300 [animation-delay:400ms]" />
              </div>
            </div>
          </article>
        ) : null}

        <div ref={bottomAnchorRef} />
      </div>
    </div>
  )
}
