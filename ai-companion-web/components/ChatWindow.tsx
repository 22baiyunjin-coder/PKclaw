"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/MessageBubble";
import type { ChatMessage } from "@/types/chat";

interface ChatWindowProps {
  messages: ChatMessage[];
  loading: boolean;
  companionName: string;
  openingPrompts: string[];
  onPromptSelect: (prompt: string) => void;
}

export function ChatWindow({
  messages,
  loading,
  companionName,
  openingPrompts,
  onPromptSelect,
}: ChatWindowProps) {
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="soft-scrollbar flex-1 overflow-y-auto px-4 pb-3 pt-4 sm:px-6 sm:pb-4">
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-200/80 via-cyan-400/80 to-sky-600/90 shadow-[0_0_35px_rgba(56,189,248,0.4)]" />
          <h3 className="mt-6 text-2xl font-semibold text-white">今天想聊点什么？</h3>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            {companionName} is ready to keep you company, help you think clearly, or switch into Texas Hold&apos;em odds mode when needed.
          </p>
          <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-3">
            {openingPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              companionName={companionName}
            />
          ))}
          {loading ? (
            <article className="flex justify-start">
              <div className="max-w-[85%] rounded-[26px] border border-white/10 bg-white/10 px-4 py-3 text-slate-100 shadow-lg shadow-slate-950/20 sm:max-w-[78%]">
                <div className="mb-2 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-cyan-200">
                  <span>{companionName}</span>
                  <span className="text-slate-500">typing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:200ms]" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:400ms]" />
                </div>
              </div>
            </article>
          ) : null}
          <div ref={bottomAnchorRef} />
        </div>
      )}
    </div>
  );
}
