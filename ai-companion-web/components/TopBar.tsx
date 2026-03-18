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

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.75v2.5" />
      <path d="M12 17.75v2.5" />
      <path d="M4.75 12h2.5" />
      <path d="M16.75 12h2.5" />
      <path d="m6.85 6.85 1.8 1.8" />
      <path d="m15.35 15.35 1.8 1.8" />
      <path d="m6.85 17.15 1.8-1.8" />
      <path d="m15.35 8.65 1.8-1.8" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  );
}

interface TopBarProps {
  productName: string;
  companionName: string;
  companionRole: string;
  state: CompanionState;
  provider: ReplyProvider;
}

export function TopBar({
  productName,
  companionName,
  companionRole,
  state,
  provider,
}: TopBarProps) {
  return (
    <header className="glass-panel relative mx-auto flex w-full max-w-[1440px] items-center justify-between rounded-[28px] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner shadow-cyan-200/10">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-200 via-cyan-400 to-sky-600 shadow-[0_0_25px_rgba(56,189,248,0.55)]" />
        </div>
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.28em] text-slate-400">
            {productName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-white">{companionName}</h1>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
              {companionRole}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${stateCopy[state].tone}`}
        >
          {stateCopy[state].label}
        </span>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 sm:inline-flex">
          {provider === "minimax" ? "MiniMax Live" : "Mock Ready"}
        </span>
        <button
          type="button"
          aria-label="Open settings"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
        >
          <GearIcon />
        </button>
      </div>
    </header>
  );
}
