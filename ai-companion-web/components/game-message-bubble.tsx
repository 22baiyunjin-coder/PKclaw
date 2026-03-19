import type { ChatMessage } from "@/types/chat"

interface GameMessageBubbleProps {
  message: ChatMessage
  companionName: string
  locale: "zh" | "en"
}

function formatTime(timestamp: string, locale: "zh" | "en") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function GameMessageBubble({
  message,
  companionName,
  locale,
}: GameMessageBubbleProps) {
  const isAssistant = message.role === "assistant"

  return (
    <article className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[92%] rounded-[24px] px-4 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.24)] ${
          isAssistant
            ? "border border-white/10 bg-white/[0.08] text-slate-100"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em]">
          <span className={isAssistant ? "text-violet-200" : "text-white/70"}>
            {isAssistant ? companionName : locale === "zh" ? "你" : "You"}
          </span>
          <span className={isAssistant ? "text-slate-500" : "text-white/45"}>
            {formatTime(message.createdAt, locale)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7">
          {message.content}
        </p>
      </div>
    </article>
  )
}
