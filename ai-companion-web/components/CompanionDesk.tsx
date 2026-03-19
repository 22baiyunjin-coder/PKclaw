"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChatInput } from "@/components/ChatInput";
import { ChatWindow } from "@/components/ChatWindow";
import { PersonaAvatar } from "@/components/persona/PersonaAvatar";
import { PokerTablePanel } from "@/components/PokerTablePanel";
import { TopBar } from "@/components/TopBar";
import { DEFAULT_PERSONA, PERSONA_LIBRARY, getPersonaById } from "@/lib/persona";
import { loadActivePersonaId, loadStoredPersonas } from "@/lib/personaStorage";
import { buildReplayContext } from "@/lib/replayPreview";
import type {
  ChatApiResponse,
  ChatMessage,
  ChatMessagePayload,
  CompanionState,
  ReplyProvider,
} from "@/types/chat";
import type { PersonaProfile } from "@/types/persona";
import type { ReplayEvent, ReplayHand, ReplayPlayer } from "@/types/replay";

function buildId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeMessages(messages: ChatMessage[]): ChatMessagePayload[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

function formatPot(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} BB`;
}

function resolveSeatPersona(
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
    DEFAULT_PERSONA
  );
}

function resolveHeroPersona(): PersonaProfile {
  const storedPersonas = loadStoredPersonas();
  const activePersonaId = loadActivePersonaId();

  if (!activePersonaId) {
    return DEFAULT_PERSONA;
  }

  return (
    storedPersonas.find((persona) => persona.id === activePersonaId) ??
    PERSONA_LIBRARY.find((persona) => persona.id === activePersonaId) ??
    DEFAULT_PERSONA
  );
}

export function CompanionDesk() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companionState, setCompanionState] = useState<CompanionState>("idle");
  const [provider, setProvider] = useState<ReplyProvider>("mock");
  const [replay, setReplay] = useState<ReplayHand | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [speed, setSpeed] = useState(900);
  const [isPlaying, setIsPlaying] = useState(false);
  const [heroPersona, setHeroPersona] = useState<PersonaProfile>(DEFAULT_PERSONA);
  const [customPersonas, setCustomPersonas] = useState<PersonaProfile[]>([]);
  const resetTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  const personaLibrary = useMemo(() => [...PERSONA_LIBRARY, ...customPersonas], [customPersonas]);
  const currentEvent: ReplayEvent | null = replay?.events[stepIndex] ?? null;
  const snapshot = currentEvent?.snapshot ?? null;

  const seatLineup = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.players.map((player) => ({
      player,
      persona: resolveSeatPersona(player, heroPersona, personaLibrary),
    }));
  }, [heroPersona, personaLibrary, snapshot]);

  const actionTrail = useMemo(() => {
    if (!replay) {
      return [];
    }

    return replay.events.slice(Math.max(0, stepIndex - 6), stepIndex + 1);
  }, [replay, stepIndex]);

  useEffect(() => {
    setCustomPersonas(loadStoredPersonas());
    setHeroPersona(resolveHeroPersona());
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }

      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void loadReplay();
  }, []);

  useEffect(() => {
    if (!isPlaying || !replay) {
      return;
    }

    if (stepIndex >= replay.events.length - 1) {
      setIsPlaying(false);
      return;
    }

    playbackTimerRef.current = window.setTimeout(() => {
      setStepIndex((currentStep) =>
        replay ? Math.min(currentStep + 1, replay.events.length - 1) : currentStep,
      );
    }, speed);

    return () => {
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, replay, speed, stepIndex]);

  async function loadReplay() {
    setIsPlaying(false);

    try {
      const response = await fetch("/api/replay", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load replay preview.");
      }

      const payload = (await response.json()) as { replay: ReplayHand };

      setError(null);
      setReplay(payload.replay);
      setStepIndex(0);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load replay preview.",
      );
    }
  }

  function stepForward() {
    if (!replay) {
      return;
    }

    setIsPlaying(false);
    setStepIndex((currentStep) => Math.min(currentStep + 1, replay.events.length - 1));
  }

  function togglePlayback() {
    if (!replay) {
      return;
    }

    if (stepIndex >= replay.events.length - 1) {
      setStepIndex(0);
    }

    setIsPlaying((currentState) => !currentState);
  }

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
          handContext: replay ? buildReplayContext(replay, stepIndex) : null,
        }),
      });

      const payload = (await response.json()) as ChatApiResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Something went wrong. Please try again.");
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
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const activePlayers = snapshot?.players.filter((player) => player.inHand).length ?? 0;
  const chipLeader = snapshot?.players.reduce<ReplayPlayer | null>((leader, player) => {
    if (!leader || player.stack > leader.stack) {
      return player;
    }

    return leader;
  }, null);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[1480px] flex-col">
      <TopBar state={companionState} provider={provider} />

      <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-[1.06fr_0.94fr]">
        <PokerTablePanel
          hand={replay}
          currentStep={stepIndex}
          currentEvent={currentEvent}
          companionState={companionState}
          activePersona={heroPersona}
          personaLibrary={personaLibrary}
        />

        <section className="glass-panel flex min-h-[860px] flex-col overflow-hidden rounded-[34px]">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
                  Arena Controls
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Drive the replay and ask about any node</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  This page is now shaped like the product you pointed to: table replay, persona lineup,
                  and a discussion panel that can inherit live hand context.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadReplay()}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  Load Sample Hand
                </button>
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  {isPlaying ? "Pause" : stepIndex >= (replay?.events.length ?? 1) - 1 ? "Replay" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={stepForward}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  Next Step
                </button>
                <select
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white outline-none"
                >
                  <option value={1200}>Slow</option>
                  <option value={900}>Normal</option>
                  <option value={600}>Fast</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Hero Persona</div>
                <div className="mt-1 text-base font-semibold text-white">{heroPersona.name}</div>
                <div className="mt-1 text-sm text-slate-400">{heroPersona.style}</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Players in Pot</div>
                <div className="mt-1 text-base font-semibold text-white">{activePlayers}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {chipLeader ? `${chipLeader.name} leads with ${formatPot(chipLeader.stack)}` : "Loading..."}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">Model Status</div>
                <div className="mt-1 text-base font-semibold text-white">
                  {provider === "minimax" ? "MiniMax connected" : "Mock fallback active"}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {provider === "minimax"
                    ? "Real model replies are flowing into the chat panel."
                    : "Add MINIMAX_API_KEY in .env.local to switch from local mock mode."}
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-0 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
                  Seat Lineup
                </p>
                <div className="mt-4 space-y-3">
                  {seatLineup.map(({ player, persona }) => (
                    <div
                      key={`${player.name}-${persona.id}`}
                      className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/65 px-3 py-3"
                    >
                      <PersonaAvatar config={persona.avatar} name={persona.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-white">
                            {player.seatKey === "bottom" ? heroPersona.name : player.name}
                          </span>
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {player.position}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{persona.style}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
                  Action Trail
                </p>
                <div className="mt-4 space-y-3">
                  {actionTrail.map((event, index) => {
                    const isCurrent = replay ? replay.events.indexOf(event) === stepIndex : false;

                    return (
                      <div
                        key={`${event.label}-${index}`}
                        className={`rounded-[22px] border px-3 py-3 ${
                          isCurrent
                            ? "border-amber-300/25 bg-amber-300/10"
                            : "border-white/10 bg-slate-950/70"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {event.kind}
                        </div>
                        <div className="mt-1 text-sm font-medium text-white">{event.label}</div>
                        <div className="mt-1 text-sm text-slate-400">{event.snapshot.headline}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
                      Hand Discussion
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Chat with PKmind about the current replay node
                    </h3>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    Context attached: {replay ? "yes" : "no"}
                  </div>
                </div>
              </div>

              <ChatWindow
                messages={messages}
                loading={loading}
                companionName={heroPersona.name}
                openingPrompts={heroPersona.openingPrompts}
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
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
