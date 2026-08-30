// Comic-style canvas renderer for Celeb Fighter.
// Everything is drawn procedurally (no image assets) — exaggerated
// caricatures, thick ink outlines, halftone dots, speech bubbles and "POW!"s.

import {
  ARENA_H,
  ARENA_W,
  GROUND_Y,
  type WorldBattle,
  type Fighter,
} from "@/lib/game/engine";
import type { Projectile } from "@/lib/game/engine";
import type { CharacterDef } from "@/lib/types";

const INK = "#141414";

// next/font generates a hashed family name, exposed via the --font-display
// CSS variable (see app/layout.tsx). Resolve it once at runtime so canvas
// text uses the same display font as the UI.
let displayFamily: string | null = null;
function fontFamily(): string {
  if (displayFamily === null) {
    if (typeof document !== "undefined") {
      displayFamily =
        getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() ||
        '"Comic Sans MS"';
    } else {
      displayFamily = '"Comic Sans MS"';
    }
  }
  return displayFamily;
}
const DISPLAY = (px: number) =>
  `${px}px ${fontFamily()}, "Comic Sans MS", Impact, sans-serif`;

export { ARENA_W, ARENA_H };

export function drawScene(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawBackground(ctx, game);
  for (const f of game.fighters) drawShadow(ctx, f);
  for (const f of game.fighters) drawFighter(ctx, f, game);
  for (const p of game.projectiles) drawProjectile(ctx, p);
  drawParticles(ctx, game);
  drawWords(ctx, game);
  drawBubbles(ctx, game);
  ctx.restore();
  drawHUD(ctx, game);
}

// ---------------------------------------------------------------- background

function drawBackground(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const t = game.tick;
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#6fc3ff");
  sky.addColorStop(1, "#eaf9ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // sun with rays
  ctx.save();
  ctx.translate(830, 90);
  ctx.rotate(t * 0.003);
  ctx.fillStyle = "#ffd166";
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.fillRect(-6, -86, 12, 34);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // clouds (parallax)
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 280 + t * (0.2 + i * 0.07)) % (ARENA_W + 240)) - 120;
    const cy = 70 + ((i * 53) % 90);
    puff(ctx, cx, cy, 30 + (i % 2) * 10);
  }

  // parody capitol building
  drawCapitol(ctx);

  // crowd
  for (let i = 0; i < 26; i++) {
    const x = 14 + i * 37 + ((i * 31) % 9);
    const bob = Math.sin(t * 0.05 + i * 1.7) * 4;
    const hue = (i * 47) % 360;
    ctx.fillStyle = `hsl(${hue} 60% 62%)`;
    ctx.beginPath();
    ctx.arc(x, GROUND_Y - 116 + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `hsl(${(hue + 40) % 360} 55% 45%)`;
    ctx.fillRect(x - 13, GROUND_Y - 103 + bob, 26, 26);
  }

  // ground
  const gr = ctx.createLinearGradient(0, GROUND_Y, 0, ARENA_H);
  gr.addColorStop(0, "#cfd8dc");
  gr.addColorStop(1, "#90a4ae");
  ctx.fillStyle = gr;
  ctx.fillRect(0, GROUND_Y, ARENA_W, ARENA_H - GROUND_Y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(ARENA_W, GROUND_Y);
  ctx.stroke();
  // halftone dots
  ctx.fillStyle = "rgba(20,20,20,0.14)";
  for (let x = 12; x < ARENA_W; x += 26) {
    for (let y = GROUND_Y + 12; y < ARENA_H; y += 22) {
      const r = 1.5 + ((y - GROUND_Y) / 60) * 2.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y + 4, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x - r, y + 6, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, Math.PI * 1.9);
  ctx.stroke();
}

function drawCapitol(ctx: CanvasRenderingContext2D): void {
  const bx = ARENA_W / 2;
  const baseY = GROUND_Y - 96;
  ctx.save();
  ctx.fillStyle = "#f4f6f8";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // main block
  roundRect(ctx, bx - 150, baseY - 70, 300, 70, 4);
  ctx.fill();
  ctx.stroke();
  // columns
  for (let i = 0; i < 9; i++) {
    const cx = bx - 126 + i * 32;
    ctx.fillStyle = "#e3e8ec";
    ctx.fillRect(cx, baseY - 62, 12, 54);
    ctx.strokeRect(cx, baseY - 62, 12, 54);
  }
  // dome
  ctx.beginPath();
  ctx.arc(bx, baseY - 70, 44, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, baseY - 70, 24, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d64545";
  ctx.fillRect(bx - 3, baseY - 132, 6, 20);
  ctx.strokeRect(bx - 3, baseY - 132, 6, 20);
  ctx.restore();
}

// ------------------------------------------------------------------ fighters

function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter): void {
  const air = GROUND_Y - f.y;
  const scale = Math.max(0.45, 1 - air / 260);
  ctx.save();
  ctx.fillStyle = "rgba(20,20,20,0.25)";
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND_Y + 8, 42 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, game: WorldBattle): void {
  const build = f.def.look.build;
  const bw = build === "wide" ? 1.22 : build === "slim" ? 0.86 : 1;
  const t = game.tick;
  const ko = f.state === "ko";

  // Buff aura
  if (f.buff > 0) {
    const pulse = 1 + Math.sin(t * 0.25) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = f.def.look.accent;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 70, 56 * pulse, 92 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Confusion marker
  if (f.confused > 0) {
    ctx.save();
    ctx.font = DISPLAY(30);
    ctx.fillStyle = "#b388ff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.textAlign = "center";
    ctx.strokeText("?!", f.x, f.y - 158 + Math.sin(t * 0.3) * 4);
    ctx.fillText("?!", f.x, f.y - 158 + Math.sin(t * 0.3) * 4);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(f.x, f.y);
  if (ko) {
    ctx.rotate((f.facing as number) * (Math.PI / 2) * -1 * 0.9);
    ctx.translate(0, -18);
  } else {
    ctx.scale(f.facing, 1);
  }

  // Pose parameters ---------------------------------------------------------
  let lean = 0;
  let bob = Math.sin(t * 0.08) * 2;
  let armFront = 0.35; // angle of front arm (0 = horizontal punch)
  let armBack = 0.55;
  let legSwing = 0;
  let crouch = 0;
  let punchExtend = 0;
  let kickExtend = 0;

  if (f.state === "walk") legSwing = Math.sin(f.walkPhase) * 0.5;
  if (f.state === "idle") legSwing = 0;
  if (f.state === "block") {
    crouch = 8;
    armFront = -1.15;
    armBack = -0.9;
  }
  if (f.state === "hit") {
    lean = -0.22;
    bob = 0;
  }
  if (f.state === "jump") {
    legSwing = 0.45;
    armFront = -0.7;
    armBack = -0.9;
  }

  if (f.state === "attack" && f.attackKind) {
    bob = 0;
    if (f.attackKind === "punch") {
      punchExtend = attackProgress(f);
      lean = 0.08;
    } else if (f.attackKind === "kick") {
      kickExtend = attackProgress(f);
      lean = -0.05;
    } else {
      poseSpecial(f, { leanRef: (v) => (lean = v), armRef: (v) => (armFront = v) });
    }
  }

  ctx.rotate(lean);
  ctx.translate(0, crouch + bob);

  const hipY = -58;
  const shoulderY = -100;
  const headY = -124;
  const bodyW = 40 * bw;

  // ---- legs ----
  limb(ctx, -8, hipY, -12 + legSwing * -14, 0, 13, f.def.look.suit === "#000000" ? "#111" : "#6d7278");
  if (kickExtend > 0) {
    const kx = 14 + kickExtend * 62;
    const ky = -30 - Math.sin(kickExtend * Math.PI) * 26;
    limb(ctx, 8, hipY, kx, ky, 14, "#6d7278");
    shoe(ctx, kx, ky, 16, f.def.look.tie);
  } else {
    limb(ctx, 8, hipY, 14 + legSwing * 14, 0, 14, "#6d7278");
    shoe(ctx, 14 + legSwing * 14, 0, 16, f.def.look.tie);
  }
  shoe(ctx, -12 + legSwing * -14, 0, 15, f.def.look.tie);

  // ---- torso (suit) ----
  ctx.fillStyle = f.def.look.suit;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  roundRect(ctx, -bodyW / 2, shoulderY, bodyW, hipY - shoulderY + 10, 10);
  ctx.fill();
  ctx.stroke();
  // shirt + tie
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-9, shoulderY + 2);
  ctx.lineTo(9, shoulderY + 2);
  ctx.lineTo(0, shoulderY + 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = f.def.look.tie;
  ctx.beginPath();
  ctx.moveTo(-4, shoulderY + 4);
  ctx.lineTo(4, shoulderY + 4);
  ctx.lineTo(2, hipY + 2);
  ctx.lineTo(-2, hipY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ---- arms ----
  const shX = bodyW / 2 - 2;
  const punchLen = 34 + punchExtend * 46;
  if (f.state === "block") {
    limb(ctx, shX, shoulderY + 10, 22, shoulderY + 26, 11, f.def.look.suit);
    limb(ctx, -shX, shoulderY + 10, 20, shoulderY + 22, 11, f.def.look.suit);
    fist(ctx, 24, shoulderY + 26, 9, f.def.look.skin);
  } else {
    limb(ctx, shX, shoulderY + 8, shX + Math.cos(armFront) * punchLen, shoulderY + 8 + Math.sin(armFront) * punchLen * 0.6 + 4, 11, f.def.look.suit);
    fist(ctx, shX + Math.cos(armFront) * punchLen, shoulderY + 8 + Math.sin(armFront) * punchLen * 0.6 + 4, 10, f.def.look.skin);
    const backLen = 26;
    limb(ctx, -shX, shoulderY + 8, -shX - Math.cos(armBack) * backLen, shoulderY + 8 + Math.sin(armBack) * backLen * 0.8, 11, f.def.look.suit);
    fist(ctx, -shX - Math.cos(armBack) * backLen, shoulderY + 8 + Math.sin(armBack) * backLen * 0.8, 9, f.def.look.skin);
  }

  // ---- head ----
  drawHead(ctx, 0, headY, f);

  ctx.restore();
}

function attackProgress(f: Fighter): number {
  // 0..1..0 punch/kick extension curve
  const p = f.stateFrame;
  const peak = 10;
  return p <= peak ? Math.min(1, p / 5) : Math.max(0, 1 - (p - peak) / 8);
}

function poseSpecial(
  f: Fighter,
  refs: { leanRef: (v: number) => void; armRef: (v: number) => void }
): void {
  const type = f.def.special.type;
  const p = f.stateFrame;
  switch (type) {
    case "dash":
      refs.leanRef(0.35);
      refs.armRef(-0.5);
      break;
    case "projectile":
      refs.armRef(-0.1 + (p > 14 ? 0.25 : 0));
      refs.leanRef(p > 14 ? 0.12 : -0.05);
      break;
    case "shockwave":
      refs.armRef(-1.6);
      refs.leanRef(-0.1);
      break;
    case "buff":
      refs.armRef(-1.5);
      refs.leanRef(-0.08);
      break;
    case "confuse":
      refs.armRef(-0.9 + Math.sin(p * 0.4) * 0.3);
      refs.leanRef(0.05);
      break;
  }
}

// ------------------------------------------------------------- head & helpers

function drawHead(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  f: Fighter
): void {
  const look = f.def.look;
  const r = 19;
  ctx.save();
  ctx.translate(hx, hy);

  // neck
  ctx.fillStyle = look.skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(-7, r - 4, 14, 12);
  ctx.strokeRect(-7, r - 4, 14, 12);

  // head shape (slightly squashed)
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = look.skin;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // face expression
  const ko = f.state === "ko";
  const hit = f.state === "hit" || f.confused > 0;
  const attacking = f.state === "attack";

  // eyes
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  if (ko) {
    drawX(ctx, 4, -3, 5);
    drawX(ctx, 14, -3, 5);
  } else {
    for (const ex of [4, 14]) {
      ctx.beginPath();
      ctx.arc(ex, -3, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + 1.5, -3, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
    }
    // brows
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -10 - (attacking ? 2 : 0));
    ctx.lineTo(9, -11 + (attacking ? 3 : 0));
    ctx.moveTo(11, -11 + (attacking ? 3 : 0));
    ctx.lineTo(19, -10 - (attacking ? 2 : 0));
    ctx.stroke();
  }

  // mouth
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  if (ko) {
    ctx.beginPath();
    ctx.ellipse(9, 8, 4, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (hit) {
    ctx.beginPath();
    ctx.arc(9, 9, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (attacking) {
    ctx.beginPath();
    ctx.moveTo(3, 9);
    ctx.lineTo(15, 7);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(9, 5, 5.5, 0.25, Math.PI - 0.4);
    ctx.stroke();
  }

  // hair + accessories
  drawHair(ctx, look.hairStyle, look.hair, r);
  if (look.accessory === "glasses") {
    ctx.fillStyle = "rgba(30,40,60,0.85)";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.fillRect(-1, -7, 10, 8);
    ctx.fillRect(10, -7, 10, 8);
    ctx.strokeRect(-1, -7, 10, 8);
    ctx.strokeRect(10, -7, 10, 8);
  } else if (look.accessory === "cap") {
    ctx.fillStyle = "#d31f2b";
    ctx.beginPath();
    ctx.arc(0, -8, r * 1.06, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-2, -22, 14, 8);
    ctx.strokeRect(-2, -22, 14, 8);
    ctx.fillStyle = "#d31f2b";
    ctx.beginPath();
    ctx.ellipse(14, -7, 12, 4, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (look.accessory === "earrings") {
    ctx.fillStyle = "#f7f7f7";
    for (const ex of [-r + 2, r - 2]) {
      ctx.beginPath();
      ctx.arc(ex, 5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  style: string,
  color: string,
  r: number
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  switch (style) {
    case "swoop": {
      ctx.beginPath();
      ctx.moveTo(-r - 2, -4);
      ctx.quadraticCurveTo(-r - 3, -r * 1.5, 4, -r * 1.35);
      ctx.quadraticCurveTo(r + 4, -r * 1.25, r * 0.7, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.9, -r * 0.6, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "fluff": {
      for (const [ox, oy, rr] of [
        [-12, -14, 9],
        [-2, -19, 10],
        [9, -17, 9],
        [16, -10, 7],
        [-17, -8, 7],
      ] as const) {
        ctx.beginPath();
        ctx.arc(ox, oy, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "bun": {
      ctx.beginPath();
      ctx.arc(0, -r - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -6, r * 1.02, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(6, -14, -r, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "short": {
      ctx.beginPath();
      ctx.arc(0, -4, r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(-4, -16, -r * 0.98, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "spiky": {
      ctx.beginPath();
      ctx.moveTo(-r, -6);
      for (let i = 0; i < 5; i++) {
        const bx = -r + (i * (r * 2)) / 4;
        ctx.lineTo(bx + r / 4, -r - 8 - (i % 2) * 6);
        ctx.lineTo(bx + r / 2, -10);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "long": {
      ctx.beginPath();
      ctx.arc(0, -5, r * 1.05, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-r - 2, -8, 6, 34);
      ctx.strokeRect(-r - 2, -8, 6, 34);
      ctx.fillRect(r - 4, -8, 6, 34);
      ctx.strokeRect(r - 4, -8, 6, 34);
      break;
    }
    case "bald":
    default: {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(-5, -12, 7, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
  }
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s / 2);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.moveTo(x + s / 2, y - s / 2);
  ctx.lineTo(x - s / 2, y + s / 2);
  ctx.stroke();
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  w: number, color: string
): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function fist(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x - w / 2 - 2, y - 6, w + 6, 8, 4);
  ctx.fill();
  ctx.stroke();
}

// --------------------------------------------------------------- FX & HUD

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  if (p.kind === "shockwave") {
    ctx.globalAlpha = Math.max(0.15, p.life / 34);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0.1, p.life / 60);
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.65, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.rotate(p.x * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.55, 0.4, 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWords(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  for (const w of game.words) {
    const pop = 1 + Math.max(0, (w.life - w.maxLife + 8) / 8) * 0.5;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, w.life / 12);
    ctx.font = DISPLAY(w.size);
    ctx.textAlign = "center";
    ctx.lineWidth = w.size / 7;
    ctx.strokeStyle = INK;
    ctx.strokeText(w.text, 0, 0);
    ctx.fillStyle = w.color;
    ctx.fillText(w.text, 0, 0);
    ctx.restore();
  }
}

function drawBubbles(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  for (const b of game.bubbles) {
    const f = game.fighters[b.side];
    const bx = Math.max(140, Math.min(ARENA_W - 140, f.x + f.facing * 40));
    const by = f.y - 190;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 14);
    ctx.font = DISPLAY(20);
    ctx.textAlign = "center";
    const wText = Math.max(80, ctx.measureText(b.text).width + 26);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    roundRect(ctx, bx - wText / 2, by - 40, wText, 34, 12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 8, by - 7);
    ctx.lineTo(bx + 4, by + 6);
    ctx.lineTo(bx + 10, by - 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(b.text, bx, by - 16, wText - 10);
    ctx.restore();
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const [a, b] = game.fighters;

  // health bars
  bar(ctx, 24, 26, 380, 26, a.hp / a.maxHp, false);
  bar(ctx, ARENA_W - 404, 26, 380, 26, b.hp / b.maxHp, true);
  // name plates
  ctx.font = DISPLAY(22);
  ctx.textAlign = "left";
  plate(ctx, 24, 60, a.def.name, a.def.look.accent, false);
  ctx.textAlign = "right";
  plate(ctx, ARENA_W - 24, 60, b.def.name, b.def.look.accent, true);

  // timer
  const secs = Math.ceil(game.framesLeft / 60);
  ctx.font = DISPLAY(46);
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeText(String(secs).padStart(2, "0"), ARENA_W / 2, 60);
  ctx.fillStyle = secs <= 10 ? "#ff5252" : "#ffffff";
  ctx.fillText(String(secs).padStart(2, "0"), ARENA_W / 2, 60);

  // meter bars
  meterBar(ctx, 24, ARENA_H - 34, 240, a.meter, a.def.look.accent, false);
  meterBar(ctx, ARENA_W - 264, ARENA_H - 34, 240, b.meter, b.def.look.accent, true);

  // phase banners
  ctx.textAlign = "center";
  if (game.phase === "intro") {
    const text = game.phaseTimer > 45 ? "READY..." : "FIGHT!";
    ctx.font = DISPLAY(84);
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, ARENA_W / 2, ARENA_H / 2 - 20);
    ctx.fillStyle = game.phaseTimer > 45 ? "#ffd166" : "#ff2a2a";
    ctx.fillText(text, ARENA_W / 2, ARENA_H / 2 - 20);
  } else if (game.phase === "ko") {
    const label =
      game.winner === null
        ? "IT'S A DRAW!"
        : `${game.fighters[game.winner].def.name} WINS!`;
    ctx.font = DISPLAY(64);
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.strokeText(label, ARENA_W / 2, ARENA_H / 2 - 30);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(label, ARENA_W / 2, ARENA_H / 2 - 30);
    ctx.font = DISPLAY(26);
    ctx.lineWidth = 6;
    ctx.strokeText("Press R for a rematch", ARENA_W / 2, ARENA_H / 2 + 24);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Press R for a rematch", ARENA_W / 2, ARENA_H / 2 + 24);
  }
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ratio: number, mirrored: boolean
): void {
  ctx.save();
  if (mirrored) {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.fillStyle = "#141414";
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 8);
  ctx.fill();
  ctx.fillStyle = "#4a1420";
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  const fillW = Math.max(0, Math.min(1, ratio)) * w;
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "#ff2a2a");
  grad.addColorStop(0.5, "#ffb703");
  grad.addColorStop(1, "#2dd4a7");
  ctx.fillStyle = grad;
  if (fillW > 4) {
    roundRect(ctx, x, y, fillW, h, 6);
    ctx.fill();
  }
  ctx.restore();
}

function meterBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  value: number, color: string, mirrored: boolean
): void {
  const full = value >= 100;
  ctx.save();
  if (mirrored) {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.fillStyle = "#141414";
  roundRect(ctx, x - 2, y - 2, w + 4, 16, 6);
  ctx.fill();
  ctx.fillStyle = full ? (Math.floor(Date.now() / 150) % 2 === 0 ? color : "#ffffff") : color;
  if (value > 3) {
    roundRect(ctx, x, y, (value / 100) * w, 12, 4);
    ctx.fill();
  }
  ctx.restore();
  ctx.font = DISPLAY(15);
  ctx.textAlign = mirrored ? "right" : "left";
  ctx.fillStyle = "#141414";
  ctx.fillText(full ? "SPECIAL READY!" : "SPECIAL", mirrored ? x + w : x, y - 8);
}

function plate(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string, color: string, mirrored: boolean
): void {
  ctx.font = DISPLAY(22);
  const w = ctx.measureText(text).width + 20;
  const bx = mirrored ? x - w : x;
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, bx, y - 19, w, 25, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, mirrored ? x - 10 : x + 10, y);
}

/** Draws a bust portrait of a character (used on select/creator cards). */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  w: number,
  h: number
): void {
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, def.look.accent);
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h * 0.62);
  const scale = Math.min(w / 90, h / 110) * 1.35;
  ctx.scale(scale, scale);
  // shoulders
  ctx.fillStyle = def.look.suit;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, -30, 18, 60, 40, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(8, 18);
  ctx.lineTo(0, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = def.look.tie;
  ctx.beginPath();
  ctx.moveTo(-3, 20);
  ctx.lineTo(3, 20);
  ctx.lineTo(2, 40);
  ctx.lineTo(-2, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawPortraitHead(ctx, def);
  ctx.restore();
}

function drawPortraitHead(ctx: CanvasRenderingContext2D, def: CharacterDef): void {
  const look = def.look;
  const r = 19;
  ctx.fillStyle = look.skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(-7, r - 4, 14, 12);
  ctx.strokeRect(-7, r - 4, 14, 12);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const ex of [4, 14]) {
    ctx.beginPath();
    ctx.arc(ex, -3, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + 1.5, -3, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
  }
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(9, 5, 5.5, 0.25, Math.PI - 0.4);
  ctx.stroke();
  drawHair(ctx, look.hairStyle, look.hair, r);
  if (look.accessory === "glasses") {
    ctx.fillStyle = "rgba(30,40,60,0.85)";
    ctx.lineWidth = 2.4;
    ctx.fillRect(-1, -7, 10, 8);
    ctx.fillRect(10, -7, 10, 8);
    ctx.strokeRect(-1, -7, 10, 8);
    ctx.strokeRect(10, -7, 10, 8);
  } else if (look.accessory === "cap") {
    ctx.fillStyle = "#d31f2b";
    ctx.beginPath();
    ctx.arc(0, -8, r * 1.06, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-2, -22, 14, 8);
    ctx.strokeRect(-2, -22, 14, 8);
  } else if (look.accessory === "earrings") {
    ctx.fillStyle = "#f7f7f7";
    for (const ex of [-r + 2, r - 2]) {
      ctx.beginPath();
      ctx.arc(ex, 5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
