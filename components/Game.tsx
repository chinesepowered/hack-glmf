"use client";

// Canvas host for a fight: owns the requestAnimationFrame loop, the fixed
// timestep accumulator and keyboard mapping. All simulation lives in the
// engine; all drawing in the renderer.

import { useEffect, useRef } from "react";
import {
  ARENA_H,
  ARENA_W,
  WorldBattle,
  emptyInputs,
  type Inputs,
} from "@/lib/game/engine";
import { drawScene } from "@/lib/game/render";
import type { CharacterDef } from "@/lib/types";

const P1_KEYS: Record<string, keyof Inputs> = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
  KeyF: "punch",
  KeyG: "kick",
  KeyH: "special",
};

const P2_KEYS: Record<string, keyof Inputs> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyJ: "punch",
  KeyK: "kick",
  KeyL: "special",
};

export default function Game({
  p1,
  p2,
  cpu,
}: {
  p1: CharacterDef;
  p2: CharacterDef;
  cpu: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let battle = new WorldBattle([p1, p2], cpu);
    const in1 = emptyInputs();
    const in2 = emptyInputs();
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;

    const applyKey = (map: Record<string, keyof Inputs>, code: string, down: boolean) => {
      const action = map[code];
      if (!action) return false;
      const target = map === P1_KEYS ? in1 : in2;
      target[action] = down;
      return true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        if (applyKey(P1_KEYS, e.code, true) || applyKey(P2_KEYS, e.code, true)) e.preventDefault();
        return;
      }
      if (e.code === "KeyR" && battle.phase === "ko") {
        battle = new WorldBattle([p1, p2], cpu);
        return;
      }
      if (applyKey(P1_KEYS, e.code, true) || applyKey(P2_KEYS, e.code, true)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (applyKey(P1_KEYS, e.code, false) || applyKey(P2_KEYS, e.code, false)) {
        e.preventDefault();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = now - last;
      last = now;
      if (dt > 100) dt = 100; // tab-switch guard
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        battle.setInputs(in1, in2);
        battle.step();
        acc -= STEP;
        steps++;
      }
      drawScene(ctx, battle);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [p1, p2, cpu]);

  return (
    <canvas
      ref={canvasRef}
      width={ARENA_W}
      height={ARENA_H}
      className="comic-panel w-full max-w-[960px] touch-none select-none"
      aria-label="Celeb Fighter arena"
    />
  );
}
