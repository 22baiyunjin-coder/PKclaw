import { withChatSystemMessage } from "@/lib/chat-persona"
import { generateMockChatReply } from "@/lib/mock-chat-reply"
import type { ChatHandContext, ChatMessagePayload, ModelReply } from "@/types/chat"

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.com/anthropic"
const DEFAULT_MINIMAX_API_PATH = "/v1/messages"
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7-highspeed"
const MAX_CONTEXT_MESSAGES = 14

function normalizeBaseUrl() {
  const rawBaseUrl = process.env.MINIMAX_BASE_URL?.trim()
  return (rawBaseUrl || DEFAULT_MINIMAX_BASE_URL).replace(/\/$/, "")
}

function getModelName() {
  return process.env.MINIMAX_MODEL?.trim() || DEFAULT_MINIMAX_MODEL
}

function getApiKey() {
  return process.env.NEXT_PUBLIC_MINIMAX_API_KEY?.trim() || process.env.MINIMAX_API_KEY?.trim() || ""
}

function compactConversation(messages: ChatMessagePayload[]) {
  return messages.filter((message) => message.role !== "system").slice(-MAX_CONTEXT_MESSAGES)
}

function extractTextContent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ""
  }

  const p = payload as Record<string, unknown>

  // Anthropic format: content is an array
  const content = p.content
  if (Array.isArray(content)) {
    // Find the text block (skip thinking blocks)
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>
        if (b.type === "text" && typeof b.text === "string") {
          return b.text.trim()
        }
      }
    }
    return ""
  }

  // OpenAI format (fallback)
  if (
    !("choices" in p) ||
    !Array.isArray(p.choices) ||
    !p.choices[0] ||
    typeof p.choices[0] !== "object"
  ) {
    return ""
  }

  const firstChoice = p.choices[0] as Record<string, unknown>

  if (
    !("message" in firstChoice) ||
    !firstChoice.message ||
    typeof firstChoice.message !== "object"
  ) {
    return ""
  }

  const msg = firstChoice.message as Record<string, unknown>

  if (typeof msg.content === "string") {
    return msg.content.trim()
  }

  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part: unknown) => {
        if (typeof part === "object" && part !== null) {
          const p2 = part as Record<string, unknown>
          return typeof p2.text === "string" ? p2.text : ""
        }
        return ""
      })
      .join("\n")
      .trim()
  }

  return ""
}

async function requestMinimax(
  messages: ChatMessagePayload[],
  handContext?: ChatHandContext | null,
): Promise<ModelReply> {
  const url = `${normalizeBaseUrl()}${DEFAULT_MINIMAX_API_PATH}`
  console.log("[MiniMax] Request to:", url)
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: getModelName(),
        temperature: 0.72,
        messages: withChatSystemMessage(compactConversation(messages), handContext),
      }),
    })

    console.log("[MiniMax] Response status:", response.status)
    
    if (!response.ok) {
      const detail = await response.text()
      console.error("[MiniMax] Error response:", detail)
      throw new Error(`MiniMax request failed with status ${response.status}. ${detail.slice(0, 400)}`)
    }

    const payload = (await response.json()) as unknown
    console.log("[MiniMax] Response payload:", JSON.stringify(payload).slice(0, 500))
    
    const content = extractTextContent(payload)

    if (!content) {
      throw new Error("MiniMax returned an empty assistant reply.")
    }

    return {
      content,
      provider: "minimax",
    }
  } catch (err) {
    console.error("[MiniMax] Exception:", err)
    throw err
  }
}

export async function generateChatReply(
  messages: ChatMessagePayload[],
  handContext?: ChatHandContext | null,
): Promise<ModelReply> {
  const apiKey = getApiKey()
  console.log("[MiniMax] API Key present:", !!apiKey, "length:", apiKey?.length)
  console.log("[MiniMax] URL:", `${normalizeBaseUrl()}${DEFAULT_MINIMAX_API_PATH}`)
  console.log("[MiniMax] Model:", getModelName())
  
  if (!apiKey) {
    return {
      content: generateMockChatReply(messages, handContext),
      provider: "mock",
    }
  }

  return requestMinimax(messages, handContext)
}
