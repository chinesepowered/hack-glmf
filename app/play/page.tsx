"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Game from "@/components/Game";
import { resolveCharacterById } from "@/lib/storage";

function PlayInner() {
  const params = useSearchParams();
  const p1 = resolveCharacterById(params.get("p1") ?? "trump");
  const p2 = resolveCharacterById(params.get("p2") ?? "biden");
  const cpu = params.get("cpu") !== "0";

  if (!p1 || !p2) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="title-comic font-display text-5xl mb-4">FIGHTER NOT FOUND</h1>
        <p className="mb-6">That fighter isn&apos;t in this roster (custom fighters live in your browser).</p>
        <Link href="/" className="btn-comic text-xl">
          Back to select
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1000px] px-3 py-6">
      <div className="flex items-center justify-between mb-3">
        <Link href="/" className="btn-comic text-lg">
          ← Roster
        </Link>
        <span className="font-display text-2xl">
          {p1.name} <span className="text-red-600">VS</span> {p2.name}
          {cpu ? " (CPU)" : ""}
        </span>
        <span />
      </div>
      <div className="flex justify-center">
        <Game p1={p1} p2={p2} cpu={cpu} />
      </div>
      <p className="text-center text-sm mt-3">
        P1: A/D move · W jump · S block · F punch · G kick · H special — P2: Arrows · J punch · K
        kick · L special — R rematch
      </p>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="title-comic font-display text-5xl">LOADING...</h1>
        </main>
      }
    >
      <PlayInner />
    </Suspense>
  );
}
