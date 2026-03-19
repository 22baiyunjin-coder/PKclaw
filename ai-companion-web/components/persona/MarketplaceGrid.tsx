"use client";

import { useMemo, useState } from "react";

import { PersonaCard } from "@/components/persona/PersonaCard";
import { PERSONA_LIBRARY } from "@/lib/persona";
import { loadStoredPersonas, saveStoredPersonas } from "@/lib/personaStorage";
import type { PersonaProfile } from "@/types/persona";

type MarketplaceSort = "popular" | "newest";

function clonePersona(persona: PersonaProfile): PersonaProfile {
  return {
    ...persona,
    id: `custom-${persona.id}`,
    isPublished: false,
    createdAt: new Date().toISOString(),
  };
}

export function MarketplaceGrid() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MarketplaceSort>("popular");
  const [notice, setNotice] = useState("Browse preset personas and clone any of them into your workshop.");

  const filteredPersonas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextList = PERSONA_LIBRARY.filter((persona) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        persona.name.toLowerCase().includes(normalizedQuery) ||
        persona.style.toLowerCase().includes(normalizedQuery) ||
        persona.specialty.toLowerCase().includes(normalizedQuery)
      );
    });

    return [...nextList].sort((left, right) => {
      if (sort === "newest") {
        return right.createdAt.localeCompare(left.createdAt);
      }

      return right.likes + right.downloads - (left.likes + left.downloads);
    });
  }, [query, sort]);

  function cloneToWorkshop(persona: PersonaProfile) {
    const stored = loadStoredPersonas();
    const clonedPersona = clonePersona(persona);
    const nextPersonas = [...stored.filter((item) => item.id !== clonedPersona.id), clonedPersona];

    saveStoredPersonas(nextPersonas);
    setNotice(`${persona.name} has been cloned into your local workshop.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
              Search
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, style, or specialty..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-amber-400/40"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => setSort("popular")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sort === "popular"
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Most Popular
          </button>
          <button
            type="button"
            onClick={() => setSort("newest")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sort === "newest"
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
        {notice}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {filteredPersonas.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            actionLabel="Clone to Workshop"
            onPrimaryAction={() => cloneToWorkshop(persona)}
          />
        ))}
      </div>
    </div>
  );
}
