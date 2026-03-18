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

function buildPokerReply(message: string): string {
  const openings = [
    "这类德州问题，我会先看范围、底池赔率和有效筹码。",
    "先别急着下结论，这手牌更适合先拆成赔率和对手范围。",
    "如果把情绪拿掉，德州里最先要看的是你现在买到的价格。",
  ];

  const closers = [
    "你把具体位置、筹码深度和下注线给我，我可以继续帮你压缩到一个更清晰的判断。",
    "如果你愿意，把翻前到河牌的动作顺序发来，我会用更短更准的方式帮你看。",
    "告诉我公共牌、对手类型和下注尺度，我可以把这手牌算得更像实战。",
  ];

  return `${pick(openings)} 你刚提到“${message.slice(
    0,
    28,
  )}”，这通常意味着要先确认自己是不是在用感觉替代赔率。${pick(closers)}`;
}

function buildSupportReply(message: string): string {
  const openings = [
    "我在，先不用一下子把所有事情都处理完。",
    "收到。我们先把节奏放慢一点。",
    "我听见了，你现在更需要的是一个稳定的落点。",
  ];

  const closers = [
    "如果你愿意，我可以先陪你把这件事拆成“事实、担心、下一步”三层。",
    "先告诉我现在最卡的一点，我会尽量用最短的方式陪你理顺。",
    "你不用一次讲完整，先给我一个最想先解决的点就够了。",
  ];

  return `${pick(openings)} 你刚刚提到“${message.slice(
    0,
    24,
  )}”，我猜这背后可能不只是信息问题，也有一点负担感。${pick(closers)}`;
}

function buildGeneralReply(message: string): string {
  const openings = [
    "我在看。",
    "收到你的信号了。",
    "可以，我们就从这里接住。",
  ];

  const bridges = [
    "如果按理性一点的方式处理，先明确你想要的是陪伴、判断，还是一个可执行的下一步。",
    "这句话里最值得先抓的是你真正想解决的问题，而不是表面上的杂讯。",
    "我会先帮你把信息压缩成一个更容易行动的版本。",
  ];

  const closers = [
    "你可以继续展开一句，我会跟着你的节奏走。",
    "如果你想，我也可以直接给你一个简短判断，不绕弯。",
    "继续说，我会保持简洁。",
  ];

  return `${pick(openings)} ${pick(bridges)} 你刚才说“${message.slice(
    0,
    24,
  )}”。${pick(closers)}`;
}

export function generateMockReply(messages: ChatMessagePayload[]): string {
  const latestUserMessage = extractLatestUserMessage(messages);
  const normalized = latestUserMessage.toLowerCase();

  if (!latestUserMessage) {
    return "我在。你可以把今天的情绪、一个德州牌局，或者任何你想先梳理的事丢给我。";
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
  ];

  if (pokerKeywords.some((keyword) => normalized.includes(keyword))) {
    return buildPokerReply(latestUserMessage);
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

  return buildGeneralReply(latestUserMessage);
}
