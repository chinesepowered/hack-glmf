"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CharacterCard from "@/components/CharacterCard";
import { encodeCharacterCode } from "@/lib/share";
import { saveCustomCharacter } from "@/lib/storage";
import {
  ACCESSORIES,
  BUILDS,
  HAIR_STYLES,
  SPECIAL_TYPES,
  type Accessory,
  type Build,
  type CharacterDef,
  type HairStyle,
  type LookDef,
  type SpecialType,
} from "@/lib/types";

const MAX_POINTS = 10;

const DEFAULT_LOOK: LookDef = {
  skin: "#f2c9a0",
  hair: "#3b2a1a",
  suit: "#33334d",
  tie: "#d31f2b",
  accent: "#ffd166",
  hairStyle: "short",
  accessory: "none",
  build: "normal",
};

export default function CreatePage() {
  const [name, setName] = useState("My Fighter");
  const [tagline, setTagline] = useState("Custom Challenger");
  const [intro, setIntro] = useState("Let's go!");
  const [win, setWin] = useState("GG!");
  const [pts, setPts] = useState({ hp: 3, speed: 4, power: 3 });
  const [specialType, setSpecialType] = useState<SpecialType>("projectile");
  const [specialName, setSpecialName] = useState("SIGNATURE MOVE");
  const [taunt, setTaunt] = useState("Take that!");
  const [specialPower, setSpecialPower] = useState(1.0);
  const [look, setLook] = useState<LookDef>(DEFAULT_LOOK);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const pointsLeft = MAX_POINTS - pts.hp - pts.speed - pts.power;

  const stats = useMemo(
    () => ({
      hp: 80 + pts.hp * 4,
      speed: 1 + pts.speed * 0.06,
      power: 1 + pts.power * 0.04,
    }),
    [pts]
  );

  const def: CharacterDef = useMemo(
    () => ({
      id: "preview",
      name: name.trim() || "Nameless",
      tagline: tagline.trim() || "Custom Challenger",
      custom: true,
      stats,
      special: {
        type: specialType,
        name: specialName.trim() || "SPECIAL",
        taunt: taunt.trim() || "Take that!",
        power: specialPower,
      },
      look,
      intro: intro.trim() || "Let's go!",
      win: win.trim() || "GG!",
    }),
    [name, tagline, stats, specialType, specialName, taunt, specialPower, look, intro, win]
  );

  const changePts = (key: "hp" | "speed" | "power", delta: number) => {
    setPts((p) => {
      const next = p[key] + delta;
      if (next < 0 || next > MAX_POINTS) return p;
      const total = p.hp + p.speed + p.power + delta;
      if (total > MAX_POINTS) return p;
      return { ...p, [key]: next };
    });
  };

  const generateCode = () => {
    setCode(encodeCharacterCode(def));
    setMsg("Share code generated — copy it and send it to anyone!");
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMsg("Copied to clipboard!");
    } catch {
      setMsg("Copy failed — select the code text manually.");
    }
  };

  const save = () => {
    const withId: CharacterDef = {
      ...def,
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    };
    if (saveCustomCharacter(withId)) {
      setMsg(`"${withId.name}" added to your roster!`);
    } else {
      setMsg("Could not save (storage unavailable or full).");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="btn-comic text-lg">
          ← Roster
        </Link>
        <h1 className="title-comic font-display text-4xl sm:text-5xl">FIGHTER LAB</h1>
        <span />
      </div>

      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        <div className="comic-panel p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm font-bold">
              Name (max 24)
              <input className="field-input mt-1" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm font-bold">
              Tagline (max 60)
              <input className="field-input mt-1" maxLength={60} value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </label>
          </div>

          {/* Stats point-buy */}
          <fieldset className="comic-panel-tight p-3">
            <legend className="font-display text-xl px-1">Stats — {pointsLeft} point(s) left</legend>
            {([
              ["hp", "HP", "+4 HP per point"],
              ["speed", "Speed", "+0.06 speed per point"],
              ["power", "Power", "+0.04 power per point"],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="flex items-center gap-3 py-1">
                <span className="w-16 font-bold text-sm">{label}</span>
                <button className="btn-comic !py-0.5 !px-3" onClick={() => changePts(key, -1)} disabled={pts[key] <= 0}>
                  −
                </button>
                <span className="font-display text-xl w-8 text-center">{pts[key]}</span>
                <button className="btn-comic !py-0.5 !px-3" onClick={() => changePts(key, 1)} disabled={pointsLeft <= 0}>
                  +
                </button>
                <span className="text-xs opacity-70">
                  {hint} (now {key === "hp" ? stats.hp : stats[key].toFixed(2)})
                </span>
              </div>
            ))}
          </fieldset>

          {/* Special move */}
          <fieldset className="comic-panel-tight p-3">
            <legend className="font-display text-xl px-1">Special move</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm font-bold">
                Type
                <select
                  className="field-input mt-1"
                  value={specialType}
                  onChange={(e) => setSpecialType(e.target.value as SpecialType)}
                >
                  {SPECIAL_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Move name (max 24)
                <input className="field-input mt-1" maxLength={24} value={specialName} onChange={(e) => setSpecialName(e.target.value)} />
              </label>
            </div>
            <p className="text-xs opacity-70 mt-1">{SPECIAL_TYPES.find((t) => t.type === specialType)?.hint}</p>
            <label className="block text-sm font-bold mt-2">
              Taunt (max 60)
              <input className="field-input mt-1" maxLength={60} value={taunt} onChange={(e) => setTaunt(e.target.value)} />
            </label>
            <label className="block text-sm font-bold mt-2">
              Special power: {specialPower.toFixed(1)}
              <input
                type="range"
                min={0.8}
                max={1.5}
                step={0.1}
                value={specialPower}
                onChange={(e) => setSpecialPower(Number(e.target.value))}
                className="w-full accent-red-600"
              />
            </label>
          </fieldset>

          {/* Look */}
          <fieldset className="comic-panel-tight p-3">
            <legend className="font-display text-xl px-1">Look</legend>
            <div className="flex flex-wrap gap-4 text-sm font-bold">
              {([
                ["skin", "Skin"],
                ["hair", "Hair"],
                ["suit", "Suit"],
                ["tie", "Tie"],
                ["accent", "Accent"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  {label}
                  <input
                    type="color"
                    value={look[key]}
                    onChange={(e) => setLook({ ...look, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm font-bold">
              <label>
                Hair
                <select className="field-input mt-1" value={look.hairStyle} onChange={(e) => setLook({ ...look, hairStyle: e.target.value as HairStyle })}>
                  {HAIR_STYLES.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label>
                Accessory
                <select className="field-input mt-1" value={look.accessory} onChange={(e) => setLook({ ...look, accessory: e.target.value as Accessory })}>
                  {ACCESSORIES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label>
                Build
                <select className="field-input mt-1" value={look.build} onChange={(e) => setLook({ ...look, build: e.target.value as Build })}>
                  {BUILDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {/* Quotes */}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm font-bold">
              Intro quote (max 80)
              <input className="field-input mt-1" maxLength={80} value={intro} onChange={(e) => setIntro(e.target.value)} />
            </label>
            <label className="block text-sm font-bold">
              Win quote (max 80)
              <input className="field-input mt-1" maxLength={80} value={win} onChange={(e) => setWin(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-comic btn-comic-green text-xl" onClick={save}>
              Save to roster
            </button>
            <button className="btn-comic btn-comic-blue text-xl" onClick={generateCode}>
              Generate share code
            </button>
            <button className="btn-comic text-xl" onClick={copyCode} disabled={!code}>
              Copy code
            </button>
          </div>
          {msg && <p className="font-display text-lg text-green-700">{msg}</p>}
          {code && (
            <textarea readOnly value={code} className="field-input font-mono text-xs h-24" onFocus={(e) => e.currentTarget.select()} />
          )}
        </div>

        <aside className="space-y-3">
          <h2 className="font-display text-2xl text-center">Preview</h2>
          <CharacterCard def={def} />
          <div className="comic-panel-tight p-3 text-xs">
            <b>Share codes</b> are verified: JSON + checksum + strict validation. Recipients always
            see exactly what you see here before adding.
          </div>
        </aside>
      </div>
    </main>
  );
}
