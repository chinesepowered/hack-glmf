"use client";

import { useEffect, useRef } from "react";
import { drawPortrait } from "@/lib/game/render";
import type { CharacterDef } from "@/lib/types";

export default function CharacterCard({
  def,
  selected,
  subtitle,
  onSelect,
  action,
}: {
  def: CharacterDef;
  selected?: boolean;
  subtitle?: string;
  onSelect?: () => void;
  action?: React.ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) drawPortrait(ctx, def, canvas.width, canvas.height);
  }, [def]);

  return (
    <div
      className={`comic-panel-tight select-card p-2 text-center ${
        selected ? "selected" : ""
      }`}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
    >
      <canvas ref={ref} width={110} height={120} className="mx-auto rounded-md" />
      <div className="font-display text-lg leading-tight mt-1 truncate">{def.name}</div>
      <div className="text-[11px] opacity-70 leading-tight truncate">
        {subtitle ?? def.tagline}
      </div>
      <div className="mt-1 text-[11px] flex justify-center gap-2">
        <span title="HP">❤ {def.stats.hp}</span>
        <span title="Speed">⚡ {def.stats.speed.toFixed(2)}</span>
        <span title="Power">💪 {def.stats.power.toFixed(2)}</span>
      </div>
      <div className="font-display text-[12px] mt-1" style={{ color: "#b3001b" }}>
        {def.special.name}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
