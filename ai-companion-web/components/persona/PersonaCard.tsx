import { PersonaAvatar } from "@/components/persona/PersonaAvatar";
import type { PersonaProfile } from "@/types/persona";

interface PersonaCardProps {
  persona: PersonaProfile;
  active?: boolean;
  compact?: boolean;
  actionLabel?: string;
  secondaryLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
}

export function PersonaCard({
  persona,
  active = false,
  compact = false,
  actionLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: PersonaCardProps) {
  return (
    <article
      className={`rounded-[28px] border p-4 transition ${
        active
          ? "border-amber-400/40 bg-amber-500/10 shadow-[0_0_40px_-18px_rgba(245,158,11,0.55)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start gap-4">
        <PersonaAvatar config={persona.avatar} name={persona.name} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{persona.name}</h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-slate-300">
              {persona.style}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{persona.tagline}</p>
          {!compact ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                VPIP {persona.vpip}%
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                PFR {persona.pfr}%
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                Aggro {persona.aggression}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{persona.likes} likes</span>
          <span>{persona.downloads} clones</span>
        </div>
        {(actionLabel || secondaryLabel) && (
          <div className="flex flex-wrap gap-2">
            {secondaryLabel ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                {secondaryLabel}
              </button>
            ) : null}
            {actionLabel ? (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:brightness-110"
              >
                {actionLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
