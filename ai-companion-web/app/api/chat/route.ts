import { NextResponse } from "next/server";

import { generateChatReply } from "@/lib/minimax";
import type {
  ChatApiRequest,
  ChatApiResponse,
  ChatMessagePayload,
} from "@/types/chat";

function isMessagePayloadArray(value: unknown): value is ChatMessagePayload[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        "role" in item &&
        "content" in item &&
        typeof item.role === "string" &&
        typeof item.content === "string",
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatApiRequest;

    if (!isMessagePayloadArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "A non-empty messages array is required." },
        { status: 400 },
      );
    }

    const result = await generateChatReply(body.messages);

    const payload: ChatApiResponse = {
      reply: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        createdAt: new Date().toISOString(),
      },
      provider: result.provider,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[/api/chat] Failed to generate reply", error);

    return NextResponse.json(
      { error: "出错了，请稍后重试。" },
      { status: 500 },
    );
  }
}
