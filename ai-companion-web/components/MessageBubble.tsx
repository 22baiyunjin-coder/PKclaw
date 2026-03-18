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
        className={`max-w-[85%] rounded-[26px] px-4 py-3 shadow-lg shadow-slate-950/20 sm:max-w-[78%] ${
          isAssistant
            ? "border border-white/10 bg-white/10 text-slate-100"
            : "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950"
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em]">
          <span className={isAssistant ? "text-cyan-200" : "text-slate-950/70"}>
            {isAssistant ? companionName : "You"}
          </span>
          <span className={isAssistant ? "text-slate-500" : "text-slate-900/50"}>
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
