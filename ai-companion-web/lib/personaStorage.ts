import { ACTIVE_PERSONA_STORAGE_KEY, PERSONA_STORAGE_KEY } from "@/lib/persona";
import type { PersonaProfile } from "@/types/persona";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function loadStoredPersonas(): PersonaProfile[] {
  if (!hasWindow()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(PERSONA_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return Array.isArray(parsedValue) ? (parsedValue as PersonaProfile[]) : [];
  } catch (error) {
    console.warn("[personaStorage] Failed to load personas", error);
    return [];
  }
}

export function saveStoredPersonas(personas: PersonaProfile[]): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(personas));
}

export function loadActivePersonaId(): string {
  if (!hasWindow()) {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_PERSONA_STORAGE_KEY) ?? "";
}

export function saveActivePersonaId(personaId: string): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_PERSONA_STORAGE_KEY, personaId);
}
