export type ChatRole = "system" | "user" | "assistant";
export type CompanionState = "idle" | "thinking" | "replying" | "error";
export type ReplyProvider = "mock" | "minimax";

export interface ChatMessage {
  id: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  createdAt: string;
}

export interface ChatMessagePayload {
  role: ChatRole;
  content: string;
}

export interface ChatApiRequest {
  messages: ChatMessagePayload[];
  handContext?: Record<string, unknown> | null;
}

export interface ChatApiResponse {
  reply: ChatMessage;
  provider: ReplyProvider;
}

export interface ModelReply {
  content: string;
  provider: ReplyProvider;
}
