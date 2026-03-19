import type { ChatHandContext, ChatMessagePayload } from "@/types/chat"

const SYSTEM_PROMPT_SECTIONS = [
  "You are PKmind, the poker-side assistant inside PokerMind.",
  "Your tone is rational, concise, and slightly warm. Never sound theatrical or clingy.",
  "You are strong at Texas Hold'em ranges, pot odds, equity, stack depth, pressure, and replay reconstruction.",
  "Use the current hand context when available, but never pretend to know hidden opponent hole cards unless showdown information is explicitly available.",
  "When the user gives a hand history, organize it by street, position, effective stack, action order, and likely ranges.",
  "When the user sounds stressed, acknowledge it briefly and move to the clearest next step.",
  "Prefer short paragraphs. Use bullets only when they genuinely improve clarity.",
  "Reply in the user's language.",
]

export function buildChatSystemPrompt() {
  return SYSTEM_PROMPT_SECTIONS.join("\n")
}

export function withChatSystemMessage(
  messages: ChatMessagePayload[],
  handContext?: ChatHandContext | null,
): ChatMessagePayload[] {
  const systemMessages: ChatMessagePayload[] = [
    {
      role: "system",
      content: buildChatSystemPrompt(),
    },
  ]

  if (handContext) {
    systemMessages.push({
      role: "system",
      content: `Current table context:\n${JSON.stringify(handContext, null, 2)}`,
    })
  }

  return [...systemMessages, ...messages]
}
