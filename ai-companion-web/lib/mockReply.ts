import type { ChatMessagePayload } from "@/types/chat";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function extractLatestUserMessage(messages: ChatMessagePayload[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return messages[index].content.trim();
    }
  }

  return "";
}

function normalize(message: string): string {
  return message.trim().toLowerCase();
}

function summarizeHandContext(handContext?: Record<string, unknown> | null): string | null {
  if (!handContext || typeof handContext !== "object") {
    return null;
  }

  const snapshot = handContext.snapshot as
    | {
        board?: unknown;
        pot?: unknown;
        actingPlayer?: unknown;
      }
    | undefined;
  const event = handContext.event as
    | {
        street?: unknown;
      }
    | undefined;

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    !event ||
    typeof event !== "object"
  ) {
    return null;
  }

  const board = Array.isArray(snapshot.board) ? snapshot.board.join(" ") : "";
  const pot = typeof snapshot.pot === "number" ? `${snapshot.pot} pot` : "unknown pot";
  const actingPlayer =
    typeof snapshot.actingPlayer === "string" && snapshot.actingPlayer
      ? snapshot.actingPlayer
      : "table state";
  const street =
    typeof event.street === "string" && event.street ? event.street : "preflop";

  return `${street} / ${pot} / ${actingPlayer}${board ? ` / board ${board}` : ""}`;
}

function buildIdentityReply(): string {
  return "我是 PKmind。现在这版已经是一个带牌桌、聊天、角色工坊和市场入口的扑克产品原型，当前没有接真实模型时会先走 mock 回复。";
}

function buildGreetingReply(): string {
  return pick([
    "我在。你可以直接丢一手牌，也可以先说你现在最卡的是哪一街。",
    "在的。你想聊情绪、复盘牌局，还是让我们先还原一手 8 人桌，都可以。",
    "收到。你可以先给我一个问题，或者直接贴手牌过程。",
  ]);
}

function buildCanPlayReply(): string {
  return "会，尤其擅长德州的范围、赔率、下注逻辑和复盘结构。下一步我们还会把语音和手牌描述直接接进左边的牌桌可视化。";
}

function buildPokerReply(message: string, handContext?: Record<string, unknown> | null): string {
  const openings = [
    "先别急着拍结论，德州里最值钱的是把信息按街和位置拆干净。",
    "如果按理性流程看，这种 spot 先抓位置、有效筹码和范围交集。",
    "这种问题我会先看你的价格、对手范围，以及你是不是在一个被动跟注过多的节点上。",
  ];

  const closers = [
    "你把翻前到当前街的动作顺序补齐，我可以继续压成一个更具体的判断。",
    "如果你愿意，我下一条可以直接给你一个偏实战的 line，不写长文。",
    "把对手类型和筹码深度再补一下，我可以把建议缩到可执行级别。",
  ];

  const contextSummary = summarizeHandContext(handContext);
  const contextLine = contextSummary
    ? ` 当前回放上下文是 ${contextSummary}。`
    : "";

  return `${pick(openings)}${contextLine} 你刚才提到“${message.slice(
    0,
    32,
  )}”。这类点通常不能只看一句话，但已经足够开始分析。${pick(closers)}`;
}

function buildSupportReply(message: string): string {
  return `我接住了。你刚才提到“${message.slice(
    0,
    24,
  )}”。先不用一下子把所有问题都解决，我们先抓住最想处理的那个点。你继续说，我会尽量简短。`;
}

function buildGeneralReply(message: string, handContext?: Record<string, unknown> | null): string {
  const contextSummary = summarizeHandContext(handContext);
  const contextLine = contextSummary
    ? ` 我看到当前牌桌上下文是 ${contextSummary}。`
    : "";

  return `收到。${contextLine} 你刚才说“${message.slice(
    0,
    28,
  )}”。如果你想，我可以直接给判断；如果你想更稳一点，我们也可以按街拆。`;
}

export function generateMockReply(
  messages: ChatMessagePayload[],
  handContext?: Record<string, unknown> | null,
): string {
  const latestUserMessage = extractLatestUserMessage(messages);
  const normalized = normalize(latestUserMessage);

  if (!latestUserMessage) {
    return "我在。你可以直接贴一手德州牌局，或者先告诉我你现在最想解决的问题。";
  }

  if (
    normalized === "hi" ||
    normalized === "hello" ||
    normalized === "你好" ||
    normalized === "嗨" ||
    normalized === "在吗"
  ) {
    return buildGreetingReply();
  }

  if (
    normalized.includes("你是谁") ||
    normalized.includes("who are you") ||
    normalized.includes("介绍一下你自己")
  ) {
    return buildIdentityReply();
  }

  if (
    normalized.includes("你会打牌吗") ||
    normalized.includes("会打牌吗") ||
    normalized.includes("会打德州吗") ||
    normalized.includes("会扑克吗")
  ) {
    return buildCanPlayReply();
  }

  const pokerKeywords = [
    "德州",
    "扑克",
    "all in",
    "range",
    "equity",
    "pot odds",
    "概率",
    "胜率",
    "翻牌",
    "turn",
    "river",
    "call",
    "raise",
    "手牌",
    "牌桌",
    "复盘",
    "8人桌",
    "8 bot",
    "底池",
  ];

  if (pokerKeywords.some((keyword) => normalized.includes(keyword))) {
    return buildPokerReply(latestUserMessage, handContext);
  }

  const supportKeywords = [
    "累",
    "烦",
    "焦虑",
    "崩",
    "难受",
    "压力",
    "stress",
    "tired",
    "overwhelmed",
    "anxious",
  ];

  if (supportKeywords.some((keyword) => normalized.includes(keyword))) {
    return buildSupportReply(latestUserMessage);
  }

  return buildGeneralReply(latestUserMessage, handContext);
}
