"use client";

import type { FormEvent, KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  loading: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInput({
  value,
  loading,
  disabled = false,
  error,
  onChange,
  onSend,
}: ChatInputProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-white/10 bg-slate-950/35 px-4 py-4 sm:px-6">
      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-inner shadow-slate-950/20">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say what is on your mind, or paste a poker spot for a clean read..."
            className="min-h-[104px] w-full resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-slate-500"
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Press Enter to send, Shift + Enter for a new line.
          </p>
          <button
            type="submit"
            disabled={disabled || loading || value.trim().length === 0}
            className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
