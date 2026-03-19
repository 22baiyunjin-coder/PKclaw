import Link from "next/link";

import type { CompanionState, ReplyProvider } from "@/types/chat";

const stateCopy: Record<CompanionState, { label: string; tone: string }> = {
  idle: {
    label: "Idle",
    tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  },
  thinking: {
    label: "Thinking",
    tone: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  replying: {
    label: "Replying",
    tone: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  },
  error: {
    label: "Retry Needed",
    tone: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  },
};

interface TopBarProps {
  state: CompanionState;
  provider: ReplyProvider;
}

export function TopBar({ state, provider }: TopBarProps) {
  return (
    <header className="glass-panel flex flex-col gap-4 rounded-[30px] px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-sm font-black text-black shadow-[0_0_32px_-10px_rgba(251,191,36,0.8)]">
          PK
        </div>
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.34em] text-amber-300/80">
            PKmind Arena
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Replay, chat, and custom persona seats in one surface
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <nav className="flex items-center gap-2 text-sm text-slate-300">
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-white/20 hover:bg-white/10"
          >
            Home
          </Link>
          <Link
            href="/personas"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-white/20 hover:bg-white/10"
          >
            Workshop
          </Link>
          <Link
            href="/marketplace"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-white/20 hover:bg-white/10"
          >
            Marketplace
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${stateCopy[state].tone}`}
          >
            {stateCopy[state].label}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {provider === "minimax" ? "MiniMax Live" : "Mock Replay Mode"}
          </span>
        </div>
      </div>
    </header>
  );
}
