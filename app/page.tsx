"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import { deleteCustomCharacter, getFullRoster } from "@/lib/storage";
import type { CharacterDef } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [roster, setRoster] = useState<CharacterDef[]>([]);
  const [p1, setP1] = useState("trump");
  const [p2, setP2] = useState("biden");
  const [cpu, setCpu] = useState(true);
  const [picking, setPicking] = useState<0 | 1>(0);

  useEffect(() => {
    // localStorage is a client-only external store; it can only be read
    // after mount, so setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoster(getFullRoster());
  }, []);

  const pick = (id: string) => {
    if (picking === 0) {
      setP1(id);
      setPicking(1);
    } else {
      setP2(id);
      setPicking(0);
    }
  };

  const removeCustom = (id: string) => {
    deleteCustomCharacter(id);
    setRoster(getFullRoster());
    if (p1 === id) setP1("trump");
    if (p2 === id) setP2("biden");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="text-center mb-6">
        <h1 className="title-comic font-display text-6xl sm:text-7xl">CELEB FIGHTER</h1>
        <p className="font-display text-xl mt-2">
          Famous-ish people brawling since 2026. Pick two and throw hands.
        </p>
      </header>

      <div className="comic-panel p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="font-display text-lg">
          <span className={picking === 0 ? "text-red-600" : ""}>
            P1: {roster.find((c) => c.id === p1)?.name ?? "?"}
          </span>
          <span className="mx-2">VS</span>
          <span className={picking === 1 ? "text-red-600" : ""}>
            P2: {roster.find((c) => c.id === p2)?.name ?? "?"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={cpu}
              onChange={(e) => setCpu(e.target.checked)}
              className="w-5 h-5 accent-red-600"
            />
            P2 is CPU
          </label>
          <button
            className="btn-comic btn-comic-red text-2xl"
            onClick={() => router.push(`/play?p1=${p1}&p2=${p2}${cpu ? "&cpu=1" : ""}`)}
          >
            FIGHT!
          </button>
        </div>
      </div>

      <p className="font-display text-lg mb-2">
        Now selecting for <span className="text-red-600">P{picking + 1}</span> — click a fighter:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {roster.map((c) => (
          <div key={c.id} className="relative">
            {(p1 === c.id || p2 === c.id) && (
              <div className="absolute -top-3 -left-2 z-10 font-display text-sm bg-[#141414] text-white px-2 py-0.5 rounded-md rotate-[-4deg]">
                {p1 === c.id ? "P1" : "P2"}
              </div>
            )}
            <CharacterCard def={c} selected={p1 === c.id || p2 === c.id} onSelect={() => pick(c.id)} />
            {c.custom && (
              <button
                className="absolute top-1 right-1 z-10 text-xs font-bold bg-[#141414] text-white rounded-md px-1.5 py-0.5"
                title="Delete custom fighter"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustom(c.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link href="/create" className="btn-comic btn-comic-blue text-xl">
          + Create a fighter
        </Link>
        <Link href="/share" className="btn-comic btn-comic-green text-xl">
          Import a share code
        </Link>
      </div>

      <section className="comic-panel p-4 mt-8 text-sm">
        <h2 className="font-display text-2xl mb-2">Controls</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <b>P1</b>: A/D move · W jump · S block · F punch · G kick · H special (needs full meter)
          </div>
          <div>
            <b>P2</b>: Arrows move/jump/block · J punch · K kick · L special · <b>R</b> rematch after K.O.
          </div>
        </div>
      </section>
    </main>
  );
}
