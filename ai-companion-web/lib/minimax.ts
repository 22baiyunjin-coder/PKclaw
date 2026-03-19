import { generateMockReply } from "@/lib/mockReply";
import { withPersonaSystemMessage } from "@/lib/persona";
import type { ChatMessagePayload, ModelReply } from "@/types/chat";

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.com/v1";
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5";
const MAX_CONTEXT_MESSAGES = 14;

function normalizeBaseUrl(): string {
  const rawBaseUrl = process.env.MINIMAX_BASE_URL?.trim();
  return (rawBaseUrl || DEFAULT_MINIMAX_BASE_URL).replace(/\/$/, "");
}

function getModelName(): string {
  return process.env.MINIMAX_MODEL?.trim() || DEFAULT_MINIMAX_MODEL;
}

function getApiKey(): string {
  return process.env.MINIMAX_API_KEY?.trim() || "";
}

function compactConversation(messages: ChatMessagePayload[]): ChatMessagePayload[] {
  return messages
    .filter((message) => message.role !== "system")
    .slice(-MAX_CONTEXT_MESSAGES);
}

function extractTextContent(payload: unknown): string {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices)
  ) {
    return "";
  }

  const firstChoice = payload.choices[0];

  if (
    !firstChoice ||
    typeof firstChoice !== "object" ||
    !("message" in firstChoice) ||
    !firstChoice.message ||
    typeof firstChoice.message !== "object" ||
    !("content" in firstChoice.message)
  ) {
    return "";
  }

  const { content } = firstChoice.message as {
    content?: string | Array<{ text?: string }>;
  };

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

async function requestMinimax(
  messages: ChatMessagePayload[],
  handContext?: Record<string, unknown> | null,
): Promise<ModelReply> {
  const response = await fetch(`${normalizeBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModelName(),
      temperature: 0.72,
      messages: withPersonaSystemMessage(
        compactConversation(messages),
        handContext,
      ),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `MiniMax request failed with status ${response.status}. ${detail.slice(
        0,
        400,
      )}`,
    );
  }

  const payload = (await response.json()) as unknown;
  const content = extractTextContent(payload);

  if (!content) {
    throw new Error("MiniMax returned an empty assistant reply.");
  }

  return {
    content,
    provider: "minimax",
  };
}

export async function generateChatReply(
  messages: ChatMessagePayload[],
  handContext?: Record<string, unknown> | null,
): Promise<ModelReply> {
  if (!getApiKey()) {
    return {
      content: generateMockReply(messages, handContext),
      provider: "mock",
    };
  }

  return requestMinimax(messages, handContext);
}
