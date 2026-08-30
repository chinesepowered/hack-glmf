// Core data model for World Battle fighters.
// Adding a character = adding one CharacterDef object (see lib/characters.ts).

export type SpecialType =
  | "projectile"
  | "dash"
  | "buff"
  | "shockwave"
  | "confuse";

export const SPECIAL_TYPES: { type: SpecialType; label: string; hint: string }[] = [
  { type: "projectile", label: "Projectile", hint: "Fires a fast energy ball across the arena" },
  { type: "dash", label: "Dash Attack", hint: "Lunges forward with a heavy shoulder strike" },
  { type: "buff", label: "Self Buff", hint: "Temporarily boosts own speed and power" },
  { type: "shockwave", label: "Shockwave", hint: "Slams the ground, blasting nearby enemies away" },
  { type: "confuse", label: "Confuse", hint: "Scrambles the opponent's left/right controls" },
];

export type HairStyle = "swoop" | "fluff" | "bun" | "short" | "spiky" | "long" | "bald";
export type Accessory = "none" | "glasses" | "cap" | "earrings";
export type Build = "slim" | "normal" | "wide";

export const HAIR_STYLES: HairStyle[] = ["swoop", "fluff", "bun", "short", "spiky", "long", "bald"];
export const ACCESSORIES: Accessory[] = ["none", "glasses", "cap", "earrings"];
export const BUILDS: Build[] = ["slim", "normal", "wide"];

export interface LookDef {
  skin: string;
  hair: string;
  suit: string;
  tie: string;
  accent: string;
  hairStyle: HairStyle;
  accessory: Accessory;
  build: Build;
}

export interface CharacterStats {
  hp: number; // 80..120
  speed: number; // 1.0..1.6 walk-speed multiplier
  power: number; // 1.0..1.4 damage multiplier
}

export interface SpecialDef {
  type: SpecialType;
  name: string;
  taunt: string;
  power: number; // 0.8..1.5 damage multiplier
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  stats: CharacterStats;
  special: SpecialDef;
  look: LookDef;
  intro: string;
  win: string;
  custom?: boolean;
}
