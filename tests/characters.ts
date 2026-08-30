import type { CharacterDef } from "./types.ts";

// Starter roster. To add a fighter, define another CharacterDef here —
// the engine, renderer and select screen are fully data-driven.
export const STARTER_CHARACTERS: CharacterDef[] = [
  {
    id: "trump",
    name: "Donald Trump",
    tagline: "The Final Boss Tan",
    // Boss-tier: roughly 2x the baseline of the rest of the roster.
    stats: { hp: 240, speed: 1.0, power: 2.3 },
    special: {
      type: "dash",
      name: "MAGA RUSH",
      taunt: "Nobody rushes like me. Believe me!",
      power: 1.3,
    },
    look: {
      skin: "#f4a460",
      hair: "#f5d76e",
      suit: "#1a1a2e",
      tie: "#d31f2b",
      accent: "#d31f2b",
      hairStyle: "swoop",
      accessory: "cap",
      build: "wide",
    },
    intro: "This fight will be HUGE.",
    win: "Tremendous victory. The best win, ever!",
  },
  {
    id: "biden",
    name: "Joe Biden",
    tagline: "Ice Cream Enjoyer",
    stats: { hp: 130, speed: 0.9, power: 1.0 },
    special: {
      type: "confuse",
      name: "MEMORY LOSS",
      taunt: "Now where was I... where were YOU?",
      power: 1.0,
    },
    look: {
      skin: "#f2c9a0",
      hair: "#f4f4f4",
      suit: "#14213d",
      tie: "#3d5a80",
      accent: "#90e0ef",
      hairStyle: "fluff",
      accessory: "glasses",
      build: "normal",
    },
    intro: "C'mon, man! Let's do this thing.",
    win: "That's a big... uh... win. Jack!",
  },
  {
    id: "harris",
    name: "Kamala Harris",
    tagline: "Coconut Tree Climber",
    stats: { hp: 100, speed: 1.4, power: 0.95 },
    special: {
      type: "projectile",
      name: "COCONUT DROP",
      taunt: "You think you just fell out of a coconut tree?",
      power: 1.2,
    },
    look: {
      skin: "#c98b5e",
      hair: "#2b1a10",
      suit: "#3a3a44",
      tie: "#e0e0e0",
      accent: "#f2a65a",
      hairStyle: "bun",
      accessory: "earrings",
      build: "slim",
    },
    intro: "Let's fight with joy!",
    win: "I was told there would be coconuts.",
  },
  {
    id: "obama",
    name: "Barack Obama",
    tagline: "The Cool One",
    stats: { hp: 105, speed: 1.25, power: 1.1 },
    special: {
      type: "buff",
      name: "YES WE CAN",
      taunt: "Yes. We. CAN!",
      power: 1.0,
    },
    look: {
      skin: "#9c6b43",
      hair: "#101010",
      suit: "#4a4e57",
      tie: "#2a9d8f",
      accent: "#2a9d8f",
      hairStyle: "short",
      accessory: "none",
      build: "normal",
    },
    intro: "Yes we can... throw hands.",
    win: "There is no red state or blue state. Only wins.",
  },
  {
    id: "tangjie",
    name: "Tang Jie",
    tagline: "God-Tier Legend",
    // God-tier: overwhelmingly stronger than even boss-tier Trump.
    // Starters bypass the custom-character validator, so these values are
    // intentionally far beyond the 120/1.6/1.4 custom caps.
    stats: { hp: 999, speed: 1.9, power: 5.0 },
    special: {
      type: "shockwave",
      name: "TANG QUAKE",
      taunt: "The legend shakes the earth itself!",
      power: 3.0,
    },
    look: {
      skin: "#f0c8a0",
      hair: "#1a1a1a",
      suit: "#b91c1c",
      tie: "#facc15",
      accent: "#facc15",
      hairStyle: "spiky",
      accessory: "glasses",
      build: "normal",
    },
    intro: "The legend has descended.",
    win: "As expected. GG.",
  },
];

export const STARTERS_BY_ID: Record<string, CharacterDef> = Object.fromEntries(
  STARTER_CHARACTERS.map((c) => [c.id, c])
);

