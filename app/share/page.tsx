"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import { decodeCharacterCode, extractShareCode, type ShareResult } from "@/lib/share";
import { saveCustomCharacter } from "@/lib/storage";

function ShareInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Auto-verify when arriving via /share?c=<code> or /share?import=<code-or-url>
  useEffect(() => {
    const raw = params.get("c") ?? params.get("import");
    if (!raw) return;
    const c = extractShareCode(raw);
    // External input (URL) seeding local state after mount is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(decodeCharacterCode(c));
    setCode(c);
    setSaved(false);
  }, [params]);

  const verify = () => {
    setResult(decodeCharacterCode(extractShareCode(code)));
    setSaved(false);
  };

  const add = () => {
    if (result && result.ok) {
      if (saveCustomCharacter(result.character)) {
        setSaved(true);
      } else {
        setSaved(false);
        setResult({ ok: false, error: "Could not save to local storage." });
      }
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="title-comic font-display text-5xl text-center mb-6">IMPORT FIGHTER</h1>

      <div className="comic-panel p-4">
        <label className="block text-sm font-bold">
          Paste a share code or a share link (starts with WBC1):
          <textarea
            className="field-input font-mono text-xs h-24 mt-1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WBC1.… or https://…/share?import=WBC1.…"
          />
        </label>
        <button className="btn-comic btn-comic-blue mt-3 text-xl" onClick={verify} disabled={!code.trim()}>
          Verify code
        </button>
      </div>

      {result && !result.ok && (
        <div className="comic-panel p-4 mt-4 border-red-600" style={{ borderColor: "#dc2626" }}>
          <p className="font-display text-2xl text-red-600">✘ INVALID CODE</p>
          <p className="text-sm mt-1">{result.error}</p>
        </div>
      )}

      {result && result.ok && (
        <div className="comic-panel p-4 mt-4 text-center">
          <p className="font-display text-2xl text-green-700 mb-2">✔ VERIFIED — this fighter is legit</p>
          <div className="max-w-[240px] mx-auto">
            <CharacterCard def={result.character} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 justify-center">
            <button className="btn-comic btn-comic-green text-xl" onClick={add} disabled={saved}>
              {saved ? "Added!" : "Add to my roster"}
            </button>
            <button className="btn-comic text-xl" onClick={() => router.push("/")}>
              Back to roster
            </button>
          </div>
          {saved && (
            <p className="font-display text-lg text-green-700 mt-2">
              &quot;{result.character.name}&quot; joined your roster. Go fight!
            </p>
          )}
        </div>
      )}

      <p className="text-center text-sm mt-6">
        Got no code?{" "}
        <Link href="/create" className="font-bold underline">
          Create your own fighter
        </Link>
        .
      </p>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="title-comic font-display text-5xl">LOADING...</h1>
        </main>
      }
    >
      <ShareInner />
    </Suspense>
  );
}
