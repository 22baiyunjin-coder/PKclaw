import { PersonaAvatar } from "@/components/persona/PersonaAvatar";
import { getPersonaById } from "@/lib/persona";
import type { CompanionState } from "@/types/chat";
import type { PersonaProfile } from "@/types/persona";
import type { ReplayEvent, ReplayHand, ReplayPlayer, TableSeatKey } from "@/types/replay";

const seatPositionClasses: Record<TableSeatKey, string> = {
  top: "left-1/2 top-6 -translate-x-1/2",
  upperRight: "right-8 top-[20%]",
  midRight: "right-1 top-1/2 -translate-y-1/2 sm:right-4",
  lowerRight: "right-8 bottom-[20%]",
  bottom: "bottom-6 left-1/2 -translate-x-1/2",
  lowerLeft: "bottom-[20%] left-8",
  midLeft: "left-1 top-1/2 -translate-y-1/2 sm:left-4",
  upperLeft: "left-8 top-[20%]",
};

const stateGlow: Record<CompanionState, string> = {
  idle: "shadow-[0_0_44px_-24px_rgba(56,189,248,0.25)]",
  thinking: "shadow-[0_0_44px_-24px_rgba(251,191,36,0.25)]",
  replying: "shadow-[0_0_44px_-24px_rgba(52,211,153,0.25)]",
  error: "shadow-[0_0_44px_-24px_rgba(251,113,133,0.25)]",
};

function formatStreetLabel(street: string): string {
  return street.charAt(0).toUpperCase() + street.slice(1);
}

function formatPot(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} BB`;
}

function getPersonaForSeat(
  player: ReplayPlayer,
  activePersona: PersonaProfile,
  personaLibrary: PersonaProfile[],
): PersonaProfile {
  if (player.seatKey === "bottom") {
    return activePersona;
  }

  return (
    personaLibrary.find((persona) => persona.id === player.personaId) ??
    getPersonaById(player.personaId) ??
    activePersona
  );
}

function getSeatTone(player: ReplayPlayer, currentEvent: ReplayEvent | null): string {
  if (currentEvent?.snapshot.winners.includes(player.name)) {
    return "border-emerald-300/35 bg-emerald-300/12";
  }

  if (!player.inHand) {
    return "border-white/8 bg-slate-950/80 opacity-60";
  }

  if (currentEvent?.snapshot.actingPlayer === player.name) {
    return "border-amber-300/35 bg-amber-300/12";
  }

  if (player.seatKey === "bottom") {
    return "border-sky-300/35 bg-sky-300/12";
  }

  return "border-white/10 bg-slate-950/78";
}

function renderHoleCards(player: ReplayPlayer) {
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5">
      {player.holeCards.map((card) => (
        <div
          key={`${player.name}-${card}`}
          className={`flex h-8 w-6 items-center justify-center rounded-lg border text-[0.65rem] font-semibold ${
            card === "??"
              ? "border-white/10 bg-slate-950/70 text-slate-500"
              : "border-amber-200/35 bg-white text-slate-950"
          }`}
        >
          {card}
        </div>
      ))}
    </div>
  );
}

interface PokerTablePanelProps {
  hand: ReplayHand | null;
  currentStep: number;
  currentEvent: ReplayEvent | null;
  companionState: CompanionState;
  activePersona: PersonaProfile;
  personaLibrary: PersonaProfile[];
}

export function PokerTablePanel({
  hand,
  currentStep,
  currentEvent,
  companionState,
  activePersona,
  personaLibrary,
}: PokerTablePanelProps) {
  const snapshot = currentEvent?.snapshot;

  if (!hand || !currentEvent || !snapshot) {
    return (
      <section className="glass-panel flex min-h-[860px] items-center justify-center rounded-[34px] p-8">
        <div className="text-center">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
            Replay Arena
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Loading a sample hand...</h2>
        </div>
      </section>
    );
  }

  return (
    <section className={`glass-panel min-h-[860px] rounded-[34px] p-5 sm:p-6 ${stateGlow[companionState]}`}>
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
            Replay Surface
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{hand.tableName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">{hand.stageGoal}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Street</div>
            <div className="mt-1 text-base font-semibold text-white">{formatStreetLabel(snapshot.street)}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Pot</div>
            <div className="mt-1 text-base font-semibold text-white">{formatPot(snapshot.pot)}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
            <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Step</div>
            <div className="mt-1 text-base font-semibold text-white">
              {currentStep + 1} / {hand.events.length}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 min-h-[740px] overflow-hidden rounded-[30px] border border-emerald-300/10 bg-[radial-gradient(circle_at_50%_42%,rgba(14,116,84,0.98),rgba(4,47,46,1)_68%,rgba(2,12,18,1)_100%)] px-4 py-6 sm:px-6">
        <div className="absolute inset-[7%] rounded-[999px] border border-white/12 bg-[radial-gradient(circle_at_50%_38%,rgba(16,185,129,0.2),rgba(5,46,38,0.1)_70%,transparent)]" />
        <div className="absolute inset-[12%] rounded-[999px] border border-white/8" />

        <div className="relative z-20 mx-auto mb-5 flex max-w-3xl items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              {hand.seedLabel}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">{currentEvent.label}</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            {snapshot.headline}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 z-10 flex w-[270px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-[28px] border border-white/10 bg-slate-950/55 px-4 py-5 backdrop-blur">
          <div className="text-[0.68rem] uppercase tracking-[0.24em] text-emerald-100/80">
            Current Pot
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatPot(snapshot.pot)}</div>
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const card = snapshot.board[index] ?? "--";

              return (
                <div
                  key={`${card}-${index}`}
                  className={`flex h-14 w-10 items-center justify-center rounded-xl border text-sm font-semibold ${
                    card === "--"
                      ? "border-dashed border-white/10 bg-slate-950/55 text-slate-500"
                      : "border-amber-100/20 bg-white text-slate-950"
                  }`}
                >
                  {card}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-xs text-slate-200">
            {snapshot.actingPlayer ? `${snapshot.actingPlayer} is in focus` : "Static state frame"}
          </div>
        </div>

        {snapshot.players.map((player) => {
          const persona = getPersonaForSeat(player, activePersona, personaLibrary);

          return (
            <article
              key={`${player.seatKey}-${player.name}`}
              className={`absolute z-20 w-[152px] ${seatPositionClasses[player.seatKey]}`}
            >
              <div
                className={`rounded-[24px] border px-3 py-3 backdrop-blur ${getSeatTone(
                  player,
                  currentEvent,
                )}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <PersonaAvatar config={persona.avatar} name={persona.name} size="sm" />
                  <div className="text-right">
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                      {player.position}
                    </div>
                    <div className="text-sm font-semibold text-white">{player.name}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-center text-xs text-slate-200">
                  Stack {formatPot(player.stack)}
                </div>

                {renderHoleCards(player)}

                <div className="mt-3 text-center text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                  {player.lastAction}
                </div>
              </div>
            </article>
          );
        })}

        <div className="absolute bottom-5 left-1/2 z-10 w-[82%] -translate-x-1/2 rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-center text-sm leading-6 text-slate-200 backdrop-blur">
          {snapshot.headline}
        </div>
      </div>
    </section>
  );
}
