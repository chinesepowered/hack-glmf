// localStorage-backed roster of custom characters.
// Every entry is re-validated on read with the strict share-code schema,
// so tampered/stale storage can never inject a malformed character.

import { decodeCharacterCode, encodeCharacterCode } from "@/lib/share";
import { STARTER_CHARACTERS } from "@/lib/characters";
import type { CharacterDef } from "@/lib/types";

const STORAGE_KEY = "celebfighter.customs.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getCustomCharacters(): CharacterDef[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: CharacterDef[] = [];
    for (const entry of parsed.slice(0, 50)) {
      if (typeof entry !== "string") continue;
      const result = decodeCharacterCode(entry);
      if (result.ok) valid.push(result.character);
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveCustomCharacter(def: CharacterDef): boolean {
  if (!isBrowser()) return false;
  try {
    const codes = storedCodes();
    codes.push(encodeCharacterCode({ ...def, custom: true }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes.slice(-50)));
    return true;
  } catch {
    return false;
  }
}

export function deleteCustomCharacter(id: string): void {
  if (!isBrowser()) return;
  try {
    const customs = getCustomCharacters().filter((c) => c.id !== id);
    const codes = customs.map((c) => encodeCharacterCode({ ...c, custom: true }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

function storedCodes(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getFullRoster(): CharacterDef[] {
  return [...STARTER_CHARACTERS, ...getCustomCharacters()];
}

export function resolveCharacterById(id: string): CharacterDef | undefined {
  return STARTER_CHARACTERS.find((c) => c.id === id) ?? getCustomCharacters().find((c) => c.id === id);
}
