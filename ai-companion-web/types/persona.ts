export type AvatarPalette = "amber" | "emerald" | "indigo" | "rose" | "ice";
export type AvatarAccent = "visor" | "hood" | "slick" | "crown" | "bot";
export type AvatarExpression = "calm" | "smirk" | "focus" | "grin";
export type AvatarFrame = "orb" | "shield" | "hex";

export interface PersonaAvatarConfig {
  palette: AvatarPalette;
  accent: AvatarAccent;
  expression: AvatarExpression;
  frame: AvatarFrame;
  aura: boolean;
}

export interface PersonaProfile {
  id: string;
  name: string;
  style: string;
  roleLabel: string;
  tagline: string;
  description: string;
  prompt: string;
  statusHeadline: string;
  systemTraits: string[];
  openingPrompts: string[];
  visualMode: "card-2d" | "live2d" | "3d";
  voiceTone: string;
  aggression: number;
  vpip: number;
  pfr: number;
  specialty: string;
  isPublished: boolean;
  likes: number;
  downloads: number;
  createdAt: string;
  avatar: PersonaAvatarConfig;
}
