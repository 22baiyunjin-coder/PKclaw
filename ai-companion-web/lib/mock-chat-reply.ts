import type { ChatHandContext, ChatMessagePayload } from "@/types/chat"

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function extractLatestUserMessage(messages: ChatMessagePayload[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index].content.trim()
    }
  }

  return ""
}

function normalize(message: string) {
  return message.trim().toLowerCase()
}

function summarizeContext(handContext?: ChatHandContext | null) {
  if (!handContext) {
    return ""
  }

  const { street, pot, actingPlayer, board, hero } = handContext.snapshot
  const boardLine = board.length > 0 ? `board ${board.join(" ")}` : "no board yet"
  return `${street} · pot ${pot} · actor ${actingPlayer} · hero ${hero.cards.join(" ")} · ${boardLine}`
}

function buildGreetingReply(handContext?: ChatHandContext | null) {
  const contextSummary = summarizeContext(handContext)

  return pick([
    `我在。你可以直接贴一手牌，或者说现在最卡的是哪一街。${contextSummary ? ` 当前桌面是 ${contextSummary}。` : ""}`,
    `收到。你想让我做情绪承接、牌局判断，还是先帮你还原动作线？${contextSummary ? ` 我现在看到的是 ${contextSummary}。` : ""}`,
    `可以，直接开始。你发问题，我按牌局结构帮你拆。${contextSummary ? ` 当前上下文：${contextSummary}。` : ""}`,
  ])
}

function buildIdentityReply() {
  return "我是 PKmind，当前挂在牌桌右侧的扑克助手。现在这版已经能结合桌面上下文聊天；没接真实模型时会先走 mock 回复。"
}

function buildPokerReply(message: string, handContext?: ChatHandContext | null) {
  const contextSummary = summarizeContext(handContext)

  return `${pick([
    "先别急着下结论，这类 spot 最值钱的是把信息按街、位置和有效筹码拆开。",
    "这手牌我会先看行动顺序、底池价格和范围交集，而不是先看结果。",
    "如果按理性流程处理，先锁定你面对的下注、你的范围上限，以及你是否有足够的权益继续。",
  ])}${contextSummary ? ` 当前桌面是 ${contextSummary}。` : ""} 你刚才提到“${message.slice(0, 40)}”。如果你愿意，我下一条可以直接给你一个偏实战的建议线。`
}

function buildSupportReply(message: string) {
  return `我接住了。你刚才提到“${message.slice(0, 28)}”。先不用一次把所有问题都解决，我们先抓最想处理的那个点，我会尽量给你短、稳、能执行的下一步。`
}

function buildGeneralReply(message: string, handContext?: ChatHandContext | null) {
  const contextSummary = summarizeContext(handContext)

  return `收到。${contextSummary ? `我现在看到的桌面上下文是 ${contextSummary}。` : ""} 你刚才说“${message.slice(0, 36)}”。如果你要，我可以直接给判断；如果你想更稳一点，我也可以按街帮你拆。`
}

export function generateMockChatReply(
  messages: ChatMessagePayload[],
  handContext?: ChatHandContext | null,
) {
  const latestUserMessage = extractLatestUserMessage(messages)
  const normalized = normalize(latestUserMessage)

  if (!latestUserMessage) {
    return "我在。你可以直接贴一手牌、描述一个 leak，或者告诉我这手牌你最不确定的决策点。"
  }

  if (
    normalized === "hi" ||
    normalized === "hello" ||
    normalized === "你好" ||
    normalized === "嗨" ||
    normalized === "在吗"
  ) {
    return buildGreetingReply(handContext)
  }

  if (
    normalized.includes("你是谁") ||
    normalized.includes("who are you") ||
    normalized.includes("介绍一下你自己")
  ) {
    return buildIdentityReply()
  }

  const pokerKeywords = [
    "德州",
    "扑克",
    "all in",
    "equity",
    "pot odds",
    "翻牌",
    "turn",
    "river",
    "call",
    "raise",
    "手牌",
    "牌桌",
    "复盘",
    "范围",
    "胜率",
    "下注",
  ]

  if (pokerKeywords.some((keyword) => normalized.includes(keyword))) {
    return buildPokerReply(latestUserMessage, handContext)
  }

  const supportKeywords = ["累", "烦", "焦虑", "崩", "难受", "压力", "stress", "tired", "anxious"]
  if (supportKeywords.some((keyword) => normalized.includes(keyword))) {
    return buildSupportReply(latestUserMessage)
  }

  return buildGeneralReply(latestUserMessage, handContext)
}
