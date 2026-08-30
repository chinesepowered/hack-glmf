// Core data model for World Battle fighters.
// Adding a character = adding one CharacterDef object (see lib/characters.ts).

export type SpecialType =
  | "projectile"
  | "dash"
  | "buff"
  | "shockwave"
  | "confuse"
  | "nap"
  | "vanish"
  | "uppercut"
  | "barrage"
  | "counter"
  | "ai";

export const SPECIAL_TYPES: { type: SpecialType; label: string; hint: string }[] = [
  { type: "projectile", label: "Yell & Throw", hint: "Yell your catchphrase and hurl a flying object across the arena" },
  { type: "dash", label: "Dash Attack", hint: "Armoured shoulder rush that plows through hits and slams the opponent into the wall" },
  { type: "buff", label: "Self Buff", hint: "Blazing aura: more speed, more damage, and you shrug off knockback" },
  { type: "shockwave", label: "Shockwave Shout", hint: "Yell so loud the ground blasts open on both sides — also heals you a little" },
  { type: "confuse", label: "Confuse", hint: "Scrambles the opponent's left/right controls and slows them down" },
  { type: "nap", label: "Power Nap", hint: "Fall asleep to heal (half damage taken while asleep); waking up blasts the opponent awake too" },
  { type: "vanish", label: "Vanish", hint: "Turn untouchable and teleport clean behind the opponent for a free punish" },
  { type: "uppercut", label: "Rising Uppercut", hint: "Invincible rising launcher that pops the opponent sky-high for a juggle" },
  { type: "barrage", label: "Barrage", hint: "A storm of armoured rapid punches ending in a launching finisher" },
  { type: "counter", label: "Counter Stance", hint: "Brace yourself — the next hit you take is parried and answered with a devastating riposte" },
  { type: "ai", label: "Open-Source AI", hint: "Deploy the AI: overclock your speed and power while reading the opponent's source code to scramble their controls" },
];

export type SpecialVisual = "energy" | "eagle" | "flag" | "star" | "burger";
export const SPECIAL_VISUALS: SpecialVisual[] = ["energy", "eagle", "flag", "star", "burger"];

export const SPECIAL_VISUAL_LABELS: Record<SpecialVisual, string> = {
  energy: "Energy orb",
  eagle: "Bald eagle",
  flag: "Waving flag",
  star: "Spinning star",
  burger: "Fast-food burger",
};

export type HairStyle =
  | "swoop"
  | "fluff"
  | "bun"
  | "short"
  | "spiky"
  | "long"
  | "bald"
  | "wave"
  | "pomp";
export type Accessory =
  | "none"
  | "glasses"
  | "aviators"
  | "cap"
  | "earrings"
  | "pearls"
  | "flagpin";
export type Build = "slim" | "normal" | "wide";
export type Nose = "button" | "broad" | "hook" | "bulb";

export const HAIR_STYLES: HairStyle[] = [
  "swoop", "fluff", "bun", "short", "spiky", "long", "bald", "wave", "pomp",
];
export const ACCESSORIES: Accessory[] = [
  "none", "glasses", "aviators", "cap", "earrings", "pearls", "flagpin",
];
export const BUILDS: Build[] = ["slim", "normal", "wide"];
export const NOSES: Nose[] = ["button", "broad", "hook", "bulb"];

export interface LookDef {
  skin: string;
  hair: string;
  suit: string;
  tie: string;
  accent: string;
  hairStyle: HairStyle;
  accessory: Accessory;
  build: Build;
  nose?: Nose;
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
  visual?: SpecialVisual; // projectile look (default "energy")
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
