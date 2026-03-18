import Image from "next/image";

import type {
  ChatMessage,
  CompanionState,
  PersonaProfile,
  ReplyProvider,
} from "@/types/chat";

const stateMeta: Record<
  CompanionState,
  {
    label: string;
    bubble: string;
    ring: string;
    glow: string;
  }
> = {
  idle: {
    label: "Idle",
    bubble: "Waiting for your next signal.",
    ring: "border-cyan-300/20",
    glow: "from-cyan-400/15 via-sky-400/10 to-transparent",
  },
  thinking: {
    label: "Thinking",
    bubble: "Sorting signals, odds, and the cleanest next reply.",
    ring: "border-amber-300/30",
    glow: "from-amber-300/20 via-orange-300/10 to-transparent",
  },
  replying: {
    label: "Replying",
    bubble: "Response path is stable. Sending now.",
    ring: "border-emerald-300/30",
    glow: "from-emerald-300/20 via-cyan-300/10 to-transparent",
  },
  error: {
    label: "Error",
    bubble: "Connection slipped. Ready to try again.",
    ring: "border-rose-300/30",
    glow: "from-rose-300/20 via-pink-300/10 to-transparent",
  },
};

interface CharacterPanelProps {
  persona: PersonaProfile;
  state: CompanionState;
  provider: ReplyProvider;
  latestAssistantMessage?: ChatMessage;
}

export function CharacterPanel({
  persona,
  state,
  provider,
  latestAssistantMessage,
}: CharacterPanelProps) {
  const meta = stateMeta[state];

  return (
    <aside className="glass-panel relative overflow-hidden rounded-[32px] p-5 sm:p-6">
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />
      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-400">
              Virtual Presence
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{persona.name}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
              {persona.tagline}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium text-white/90 ${meta.ring} bg-white/5`}
          >
            {meta.label}
          </span>
        </div>

        <div
          className={`relative overflow-hidden rounded-[28px] border ${meta.ring} bg-slate-950/50 p-4`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.24),transparent_45%)]" />
          <div className="absolute right-5 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-slate-300">
            {persona.visualMode}
          </div>
          <div className="relative h-[270px] animate-drift">
            <Image
              src="/companion-portrait.svg"
              alt={`${persona.name} portrait`}
              fill
              priority
              className="object-contain"
            />
          </div>
          <div className="relative mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
            {meta.bubble}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              Status
            </p>
            <p className="mt-2 text-base font-medium text-white">{persona.statusHeadline}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Channel: {provider === "minimax" ? "MiniMax live response" : "Local mock fallback"}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              Last Cue
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {latestAssistantMessage?.content.slice(0, 108) ||
                "No reply yet. The first exchange will surface here as a live companion cue."}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
            Persona Notes
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{persona.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {persona.systemTraits.map((trait) => (
              <span
                key={trait}
                className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-xs text-slate-200"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
