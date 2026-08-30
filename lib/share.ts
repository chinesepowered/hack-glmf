// Secure, verifiable share codes for custom characters.
//
// Format: WBC1.<base64url(utf8(json))>.<crc32-hex>
//
// Security properties:
//  - No eval / Function / innerHTML anywhere; output is consumed by React
//    (which escapes text) and drawn on canvas via fillText (inert).
//  - Strict whitelist schema: unknown fields are dropped, wrong types are
//    rejected (never coerced), enums are whitelists, colors must be #rrggbb.
//  - CRC32 integrity check catches corruption/tampering of the payload.
//  - Hard size cap + string length caps prevent memory abuse.
//  - Result is built as a fresh literal object, so keys like __proto__ in the
//    payload can never reach the output (no prototype pollution).

import {
  ACCESSORIES,
  BUILDS,
  HAIR_STYLES,
  NOSES,
  SPECIAL_TYPES,
  SPECIAL_VISUALS,
  type Accessory,
  type Build,
  type CharacterDef,
  type CharacterStats,
  type HairStyle,
  type LookDef,
  type Nose,
  type SpecialType,
  type SpecialVisual,
} from "@/lib/types";

const PREFIX = "WBC1";
const MAX_CODE_LENGTH = 4000;

function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToUtf8(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Strip control characters and collapse whitespace. */
function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0 || cleaned.length > maxLen) return null;
  return cleaned;
}

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

function isEnum<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

export type ShareResult =
  | { ok: true; character: CharacterDef }
  | { ok: false; error: string };

/**
 * Extracts a WBC1 share code from arbitrary pasted text — a bare code, or a
 * full share URL like https://host/share?c=WBC1.… or /share?import=WBC1.…
 * Returns the input trimmed when it is already a bare code.
 */
export function extractShareCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("WBC1.")) {
    const match = /WBC1\.[A-Za-z0-9_-]+\.[0-9a-fA-F]{8}/.exec(trimmed);
    if (match) return match[0];
  }
  return trimmed;
}

export function encodeCharacterCode(def: CharacterDef): string {
  const payload = {
    v: 1,
    c: {
      name: def.name,
      tagline: def.tagline,
      stats: def.stats,
      special: def.special,
      look: def.look,
      intro: def.intro,
      win: def.win,
    },
  };
  const bytes = utf8ToBytes(JSON.stringify(payload));
  return `${PREFIX}.${bytesToBase64Url(bytes)}.${crc32(bytes).toString(16).padStart(8, "0")}`;
}

export function decodeCharacterCode(code: string): ShareResult {
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (!trimmed) return { ok: false, error: "The share code is empty." };
  if (trimmed.length > MAX_CODE_LENGTH)
    return { ok: false, error: `Share code is too long (max ${MAX_CODE_LENGTH} characters).` };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX)
    return { ok: false, error: "Not a World Battle code — it must start with WBC1." };

  const [, payloadB64, checksumHex] = parts;
  if (!/^[0-9a-f]{8}$/.test(checksumHex))
    return { ok: false, error: "Invalid checksum format." };

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(payloadB64);
  } catch {
    return { ok: false, error: "The code payload is not valid base64." };
  }

  const actualCrc = crc32(bytes);
  if (actualCrc !== parseInt(checksumHex, 16))
    return { ok: false, error: "Checksum mismatch — the code was corrupted or tampered with." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToUtf8(bytes));
  } catch {
    return { ok: false, error: "The code payload is not valid JSON." };
  }

  return validateCharacterPayload(parsed);
}

/** Validates an already-parsed payload against the strict whitelist schema. */
export function validateCharacterPayload(raw: unknown): ShareResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ok: false, error: "Payload must be a JSON object." };
  const root = raw as Record<string, unknown>;

  if (root.v !== 1) return { ok: false, error: `Unsupported version: ${String(root.v)}.` };
  if (typeof root.c !== "object" || root.c === null || Array.isArray(root.c))
    return { ok: false, error: "Payload is missing the character object." };
  const c = root.c as Record<string, unknown>;

  const name = sanitizeText(c.name, 24);
  if (!name) return { ok: false, error: "Name is required (max 24 characters)." };

  const tagline = emptyToDefault(c.tagline, "Custom Challenger", 60);
  if (!tagline) return { ok: false, error: "Tagline must be text (max 60 characters)." };

  const intro = emptyToDefault(c.intro, "Let's go!", 80);
  if (!intro) return { ok: false, error: "Intro quote must be text (max 80 characters)." };

  const win = emptyToDefault(c.win, "GG!", 80);
  if (!win) return { ok: false, error: "Win quote must be text (max 80 characters)." };

  const stats = validateStats(c.stats);
  if (!stats.ok) return stats;

  const special = validateSpecial(c.special);
  if (!special.ok) return special;

  const look = validateLook(c.look);
  if (!look.ok) return look;

  // Fresh literal object: only whitelisted fields survive, so payload keys
  // like __proto__ / constructor can never pollute anything.
  const character: CharacterDef = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    tagline,
    custom: true,
    stats: stats.stats,
    special: special.special,
    look: look.look,
    intro,
    win,
  };

  return { ok: true, character };
}

function validateStats(
  value: unknown
): { ok: true; stats: CharacterStats } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, error: "Stats object is missing." };
  const s = value as Record<string, unknown>;
  const { hp, speed, power } = s;
  if (
    typeof hp !== "number" || typeof speed !== "number" || typeof power !== "number" ||
    !Number.isFinite(hp) || !Number.isFinite(speed) || !Number.isFinite(power)
  )
    return { ok: false, error: "Stats must be finite numbers." };
  if (hp < 80 || hp > 120) return { ok: false, error: "HP must be between 80 and 120." };
  if (speed < 0.8 || speed > 1.6) return { ok: false, error: "Speed must be between 0.8 and 1.6." };
  if (power < 0.8 || power > 1.4) return { ok: false, error: "Power must be between 0.8 and 1.4." };
  // Point-buy budget: 10 points, hp +4/pt, speed +0.06/pt, power +0.04/pt.
  const cost = (hp - 80) / 4 + (speed - 1.0) / 0.06 + (power - 1.0) / 0.04;
  if (cost > 10.05)
    return { ok: false, error: "Stat budget exceeded (10 points max across HP/Speed/Power)." };
  return { ok: true, stats: { hp: Math.round(hp), speed, power } };
}

function validateSpecial(
  value: unknown
): { ok: true; special: CharacterDef["special"] } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, error: "Special-move object is missing." };
  const sp = value as Record<string, unknown>;
  if (!isEnum<SpecialType>(sp.type, SPECIAL_TYPES.map((t) => t.type)))
    return { ok: false, error: `Special type must be one of: ${SPECIAL_TYPES.map((t) => t.type).join(", ")}.` };
  const visual =
    sp.visual === undefined ? undefined : isEnum<SpecialVisual>(sp.visual, SPECIAL_VISUALS) ? sp.visual : null;
  if (visual === null)
    return { ok: false, error: `Special visual must be one of: ${SPECIAL_VISUALS.join(", ")}.` };
  const specialName = sanitizeText(sp.name, 24);
  if (!specialName) return { ok: false, error: "Special-move name is required (max 24 characters)." };
  const taunt = emptyToDefault(sp.taunt, "Take that!", 60);
  if (!taunt) return { ok: false, error: "Special taunt must be text (max 60 characters)." };
  if (typeof sp.power !== "number" || !Number.isFinite(sp.power) || sp.power < 0.8 || sp.power > 1.5)
    return { ok: false, error: "Special power must be a number between 0.8 and 1.5." };
  return {
    ok: true,
    special: {
      type: sp.type,
      name: specialName,
      taunt,
      power: sp.power,
      ...(visual ? { visual } : {}),
    },
  };
}

function validateLook(value: unknown): { ok: true; look: LookDef } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, error: "Look object is missing." };
  const l = value as Record<string, unknown>;
  const colorFields = ["skin", "hair", "suit", "tie", "accent"] as const;
  const colors = {} as Record<(typeof colorFields)[number], string>;
  for (const f of colorFields) {
    if (!isHexColor(l[f]))
      return { ok: false, error: `Color "${f}" must be a #rrggbb hex color.` };
    colors[f] = l[f];
  }
  if (!isEnum<HairStyle>(l.hairStyle, HAIR_STYLES))
    return { ok: false, error: `hairStyle must be one of: ${HAIR_STYLES.join(", ")}.` };
  if (!isEnum<Accessory>(l.accessory, ACCESSORIES))
    return { ok: false, error: `accessory must be one of: ${ACCESSORIES.join(", ")}.` };
  if (!isEnum<Build>(l.build, BUILDS))
    return { ok: false, error: `build must be one of: ${BUILDS.join(", ")}.` };
  const nose = l.nose === undefined ? undefined : isEnum<Nose>(l.nose, NOSES) ? l.nose : null;
  if (nose === null) return { ok: false, error: `nose must be one of: ${NOSES.join(", ")}.` };
  return {
    ok: true,
    look: {
      skin: colors.skin,
      hair: colors.hair,
      suit: colors.suit,
      tie: colors.tie,
      accent: colors.accent,
      hairStyle: l.hairStyle,
      accessory: l.accessory,
      build: l.build,
      ...(nose ? { nose } : {}),
    },
  };
}

function emptyToDefault(value: unknown, fallback: string, maxLen: number): string | null {
  if (value === undefined || value === null || value === "") return fallback;
  return sanitizeText(value, maxLen);
}
