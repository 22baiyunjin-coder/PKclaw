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
    <div className="soft-scrollbar flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-5">
      {messages.length === 0 ? (
        <div className="flex min-h-[280px] flex-col justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-8">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
            Conversation
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            Start with one hand, one leak, or one question
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            PKmind can already discuss the current replay context. The next phase is to let this same panel
            drive structured hand reconstruction from text or voice.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {openingPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-amber-300/40 hover:bg-amber-400/10"
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
              <div className="max-w-[85%] rounded-[28px] border border-white/10 bg-white/[0.08] px-4 py-3 text-slate-100">
                <div className="mb-2 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-amber-200">
                  <span>{companionName}</span>
                  <span className="text-slate-500">thinking</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300 [animation-delay:200ms]" />
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300 [animation-delay:400ms]" />
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
