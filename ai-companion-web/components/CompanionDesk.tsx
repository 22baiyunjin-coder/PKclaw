"use client";

import { useEffect, useRef, useState } from "react";

import { CharacterPanel } from "@/components/CharacterPanel";
import { ChatInput } from "@/components/ChatInput";
import { ChatWindow } from "@/components/ChatWindow";
import { TopBar } from "@/components/TopBar";
import type {
  ChatApiResponse,
  ChatMessage,
  ChatMessagePayload,
  CompanionState,
  PersonaProfile,
  ReplyProvider,
} from "@/types/chat";

interface CompanionDeskProps {
  persona: PersonaProfile;
}

function buildId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeMessages(messages: ChatMessage[]): ChatMessagePayload[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function CompanionDesk({ persona }: CompanionDeskProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companionState, setCompanionState] = useState<CompanionState>("idle");
  const [provider, setProvider] = useState<ReplyProvider>("mock");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function sendMessage(nextInput?: string) {
    const text = (typeof nextInput === "string" ? nextInput : input).trim();

    if (!text || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: buildId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    setCompanionState("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: serializeMessages(nextMessages),
        }),
      });

      const payload = (await response.json()) as ChatApiResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "出错了，请稍后重试。");
      }

      setProvider(payload.provider);
      setCompanionState("replying");
      setMessages((currentMessages) => [...currentMessages, payload.reply]);

      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setCompanionState("idle");
      }, 1200);
    } catch (requestError) {
      setCompanionState("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "出错了，请稍后重试。",
      );
    } finally {
      setLoading(false);
    }
  }

  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col">
      <TopBar
        productName="PocketMuse"
        companionName={persona.name}
        companionRole={persona.roleLabel}
        state={companionState}
        provider={provider}
      />

      <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <CharacterPanel
          persona={persona}
          state={companionState}
          provider={provider}
          latestAssistantMessage={latestAssistantMessage}
        />

        <section className="glass-panel flex min-h-[720px] flex-col overflow-hidden rounded-[32px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-400">
                Conversation
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Desktop companion chat
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Session memory: current page only
            </div>
          </div>

          <ChatWindow
            messages={messages}
            loading={loading}
            companionName={persona.name}
            openingPrompts={persona.openingPrompts}
            onPromptSelect={(prompt) => {
              setInput(prompt);
              void sendMessage(prompt);
            }}
          />

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage()}
            loading={loading}
            error={error}
            disabled={loading}
          />
        </section>
      </div>
    </div>
  );
}
