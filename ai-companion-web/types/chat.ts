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

export interface PersonaProfile {
  name: string;
  roleLabel: string;
  tagline: string;
  description: string;
  statusHeadline: string;
  systemTraits: string[];
  openingPrompts: string[];
  visualMode: "card-2d" | "live2d" | "3d";
}

export interface ChatApiRequest {
  messages: ChatMessagePayload[];
}

export interface ChatApiResponse {
  reply: ChatMessage;
  provider: ReplyProvider;
}

export interface MinimaxReply {
  content: string;
  provider: ReplyProvider;
}
