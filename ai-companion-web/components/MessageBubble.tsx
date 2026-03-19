import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  companionName: string;
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function MessageBubble({
  message,
  companionName,
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[90%] rounded-[28px] px-4 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.28)] sm:max-w-[82%] ${
          isAssistant
            ? "border border-white/10 bg-white/[0.08] text-slate-100"
            : "bg-gradient-to-br from-amber-400 to-orange-500 text-black"
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em]">
          <span className={isAssistant ? "text-amber-200" : "text-black/70"}>
            {isAssistant ? companionName : "You"}
          </span>
          <span className={isAssistant ? "text-slate-500" : "text-black/45"}>
            {formatTime(message.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[0.95rem]">
          {message.content}
        </p>
      </div>
    </article>
  );
}
