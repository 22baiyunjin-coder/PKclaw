"use client";

import { useEffect, useMemo, useState } from "react";

import { PersonaAvatar } from "@/components/persona/PersonaAvatar";
import { PersonaCard } from "@/components/persona/PersonaCard";
import {
  DEFAULT_PERSONA,
  PERSONA_LIBRARY,
  getPersonaById,
} from "@/lib/persona";
import {
  loadActivePersonaId,
  loadStoredPersonas,
  saveActivePersonaId,
  saveStoredPersonas,
} from "@/lib/personaStorage";
import type {
  AvatarAccent,
  AvatarExpression,
  AvatarFrame,
  AvatarPalette,
  PersonaProfile,
} from "@/types/persona";

const paletteOptions: AvatarPalette[] = ["amber", "emerald", "indigo", "rose", "ice"];
const accentOptions: AvatarAccent[] = ["visor", "hood", "slick", "crown", "bot"];
const expressionOptions: AvatarExpression[] = ["calm", "focus", "smirk", "grin"];
const frameOptions: AvatarFrame[] = ["shield", "orb", "hex"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);
}

function buildEmptyDraft(): PersonaProfile {
  return {
    ...DEFAULT_PERSONA,
    id: "custom-draft",
    name: "New Persona",
    style: "Custom Style",
    tagline: "Describe what this persona should feel like at the table.",
    description:
      "Write a clear identity, strategic bias, and emotional tone. This becomes the reusable persona package for the table.",
    prompt:
      "Describe how this persona should think, speak, and pressure opponents at a poker table.",
    specialty: "Custom table identity",
    likes: 0,
    downloads: 0,
    isPublished: false,
    createdAt: new Date().toISOString(),
  };
}

export function PersonaWorkshop() {
  const [customPersonas, setCustomPersonas] = useState<PersonaProfile[]>([]);
  const [draft, setDraft] = useState<PersonaProfile>(buildEmptyDraft);
  const [activePersonaId, setActivePersonaId] = useState<string>(DEFAULT_PERSONA.id);
  const [notice, setNotice] = useState("Create, tweak, and save personas locally in this browser.");

  useEffect(() => {
    const stored = loadStoredPersonas();
    const storedActiveId = loadActivePersonaId();

    setCustomPersonas(stored);
    setActivePersonaId(storedActiveId || DEFAULT_PERSONA.id);

    if (storedActiveId) {
      const matchedPersona =
        stored.find((persona) => persona.id === storedActiveId) ??
        getPersonaById(storedActiveId);

      if (matchedPersona) {
        setDraft(matchedPersona);
      }
    }
  }, []);

  const combinedLibrary = useMemo(
    () => [...PERSONA_LIBRARY, ...customPersonas],
    [customPersonas],
  );

  function handleDraftChange<K extends keyof PersonaProfile>(key: K, value: PersonaProfile[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
      id:
        key === "name" && typeof value === "string"
          ? `custom-${slugify(value) || Date.now()}`
          : currentDraft.id,
    }));
  }

  function savePersona() {
    const nextPersona: PersonaProfile = {
      ...draft,
      id:
        draft.id === "custom-draft"
          ? `custom-${slugify(draft.name) || Date.now()}`
          : draft.id.startsWith("custom-")
            ? draft.id
            : `custom-${slugify(draft.name)}`,
      isPublished: false,
      likes: draft.likes ?? 0,
      downloads: draft.downloads ?? 0,
      createdAt: draft.createdAt || new Date().toISOString(),
    };

    const nextPersonas = [...customPersonas.filter((persona) => persona.id !== nextPersona.id), nextPersona];

    setCustomPersonas(nextPersonas);
    saveStoredPersonas(nextPersonas);
    setNotice(`Saved ${nextPersona.name}. It is now available to the table and marketplace clone flow.`);
  }

  function editPersona(persona: PersonaProfile) {
    setDraft(persona);
    setNotice(`Editing ${persona.name}.`);
  }

  function setAsActivePersona(persona: PersonaProfile) {
    setActivePersonaId(persona.id);
    saveActivePersonaId(persona.id);
    setDraft(persona);
    setNotice(`${persona.name} is now the active hero persona for the arena.`);
  }

  function resetDraft() {
    setDraft(buildEmptyDraft());
    setNotice("Started a fresh persona draft.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <aside className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
              Persona Library
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Current roster</h2>
          </div>
          <button
            type="button"
            onClick={resetDraft}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            New Draft
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {combinedLibrary.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              compact
              active={persona.id === activePersonaId}
              actionLabel="Edit"
              secondaryLabel="Set Active"
              onPrimaryAction={() => editPersona(persona)}
              onSecondaryAction={() => setAsActivePersona(persona)}
            />
          ))}
        </div>
      </aside>

      <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.4)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-amber-300/70">
              Builder
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Design a player identity</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              This is the feature you called out from the reference product. Here it is as a working first version:
              custom name, strategy style, prompt, and a composable visual avatar that can be reused in the arena.
            </p>
          </div>
          <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            {notice}
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.74fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => handleDraftChange("name", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Style</span>
                <input
                  value={draft.style}
                  onChange={(event) => handleDraftChange("style", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Tagline</span>
              <input
                value={draft.tagline}
                onChange={(event) => handleDraftChange("tagline", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Behavior prompt</span>
              <textarea
                value={draft.prompt}
                onChange={(event) => handleDraftChange("prompt", event.target.value)}
                rows={5}
                className="w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Table description</span>
              <textarea
                value={draft.description}
                onChange={(event) => handleDraftChange("description", event.target.value)}
                rows={5}
                className="w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-300">
                <span>VPIP</span>
                <input
                  type="number"
                  value={draft.vpip}
                  onChange={(event) => handleDraftChange("vpip", Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>PFR</span>
                <input
                  type="number"
                  value={draft.pfr}
                  onChange={(event) => handleDraftChange("pfr", Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Aggression</span>
                <input
                  type="number"
                  value={draft.aggression}
                  onChange={(event) =>
                    handleDraftChange("aggression", Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Palette</span>
                <select
                  value={draft.avatar.palette}
                  onChange={(event) =>
                    handleDraftChange("avatar", {
                      ...draft.avatar,
                      palette: event.target.value as AvatarPalette,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                >
                  {paletteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Accent</span>
                <select
                  value={draft.avatar.accent}
                  onChange={(event) =>
                    handleDraftChange("avatar", {
                      ...draft.avatar,
                      accent: event.target.value as AvatarAccent,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                >
                  {accentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Expression</span>
                <select
                  value={draft.avatar.expression}
                  onChange={(event) =>
                    handleDraftChange("avatar", {
                      ...draft.avatar,
                      expression: event.target.value as AvatarExpression,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                >
                  {expressionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Frame</span>
                <select
                  value={draft.avatar.frame}
                  onChange={(event) =>
                    handleDraftChange("avatar", {
                      ...draft.avatar,
                      frame: event.target.value as AvatarFrame,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
                >
                  {frameOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={savePersona}
                className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Save Persona
              </button>
              <button
                type="button"
                onClick={() => setAsActivePersona(draft)}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
              >
                Use as Hero
              </button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
              Live Preview
            </p>
            <div className="mt-5 flex flex-col items-center rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_45%),rgba(2,6,23,0.72)] p-6 text-center">
              <PersonaAvatar config={draft.avatar} name={draft.name} size="lg" />
              <h3 className="mt-5 text-2xl font-semibold text-white">{draft.name}</h3>
              <p className="mt-2 text-sm text-amber-200">{draft.style}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{draft.tagline}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  VPIP {draft.vpip}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  PFR {draft.pfr}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  Aggro {draft.aggression}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-medium text-white">Arena behavior hook</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Once saved, this persona can become the hero seat on the replay table and can later drive tone,
                strategy bias, and bot identity through the same object shape.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
