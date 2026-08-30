// Comic-style canvas renderer for Celeb Fighter.
// Everything is drawn procedurally (no image assets) — exaggerated
// caricatures, thick ink outlines, halftone dots, speech bubbles and "POW!"s.

import {
  ARENA_H,
  ARENA_W,
  GROUND_Y,
  WALL_PAD,
  ROUND_SECONDS,
  SPECIAL_DATA,
  type WorldBattle,
  type Fighter,
  type Projectile,
  type Particle,
  type Ring,
  type Burst,
  type Ghost,
} from "@/lib/game/engine";
import type { CharacterDef, LookDef } from "@/lib/types";

const INK = "#141414";
const ROUND_FRAMES = ROUND_SECONDS * 60;
const HEAD_R = 35;
const HEAD_Y = -136;
const SHOULDER_Y = -98;
const HIP_Y = -48;
const ARM_BONE = 27;
const LEG_BONE = 29;

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

interface CameraState {
  x: number;
  y: number;
  zoom: number;
  ghost: [number, number];
  ready: boolean;
}

const cam: CameraState = { x: ARENA_W / 2, y: ARENA_H / 2, zoom: 1, ghost: [1, 1], ready: false };

export function drawScene(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const [a, b] = game.fighters;
  updateCamera(game);

  ctx.save();
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  ctx.save();
  ctx.translate(ARENA_W / 2, ARENA_H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  ctx.translate(-cam.x, -cam.y);

  drawBackground(ctx, game);
  drawGround(ctx);
  for (const g of game.ghosts) drawGhost(ctx, g);
  for (const f of game.fighters) drawShadow(ctx, f);
  for (const r of game.rings) if (r.ground) drawRing(ctx, r);
  const order = a.y <= b.y ? [a, b] : [b, a];
  for (const f of order) drawFighter(ctx, f, game);
  for (const p of game.projectiles) drawProjectile(ctx, p, game);
  for (const r of game.rings) if (!r.ground) drawRing(ctx, r);
  for (const bu of game.bursts) drawBurst(ctx, bu);
  for (const pt of game.particles) drawParticle(ctx, pt);
  drawForeground(ctx, game);
  drawWords(ctx, game);
  drawBubbles(ctx, game);
  ctx.restore();

  if (game.hitstop > 0 || game.shake > 9) drawSpeedLines(ctx, game);
  if (game.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, game.flash);
    ctx.fillStyle = game.flashColor;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.restore();
  }
  drawVignette(ctx);
  drawHUD(ctx, game);
  ctx.restore();
}

function updateCamera(game: WorldBattle): void {
  const [a, b] = game.fighters;
  const mid = (a.x + b.x) / 2;
  const gap = Math.abs(a.x - b.x);
  const targetZoom = Math.max(1.06, Math.min(1.32, 1.42 - gap / 1100));
  const lowest = Math.min(a.y, b.y);
  const targetY = ARENA_H / 2 - Math.max(0, (GROUND_Y - lowest - 60) * 0.16);

  if (!cam.ready || game.tick < 3) {
    cam.zoom = targetZoom;
    cam.x = mid;
    cam.y = targetY;
    cam.ghost = [a.hp / a.maxHp, b.hp / b.maxHp];
    cam.ready = true;
  } else {
    cam.zoom += (targetZoom - cam.zoom) * 0.06;
    cam.x += (mid - cam.x) * 0.09;
    cam.y += (targetY - cam.y) * 0.07;
  }

  const halfW = ARENA_W / cam.zoom / 2;
  const halfH = ARENA_H / cam.zoom / 2;
  cam.x = Math.max(halfW, Math.min(ARENA_W - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(ARENA_H - halfH, cam.y));

  for (const i of [0, 1] as const) {
    const target = game.fighters[i].hp / game.fighters[i].maxHp;
    cam.ghost[i] += (target - cam.ghost[i]) * (target > cam.ghost[i] ? 0.2 : 0.035);
  }
}

function par(factor: number): number {
  return (cam.x - ARENA_W / 2) * factor;
}

function drawBackground(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const t = game.tick;

  const sky = ctx.createLinearGradient(0, -80, 0, GROUND_Y);
  sky.addColorStop(0, "#3d7fd6");
  sky.addColorStop(0.45, "#79c6ff");
  sky.addColorStop(1, "#ffe9c9");
  ctx.fillStyle = sky;
  ctx.fillRect(-200, -200, ARENA_W + 400, ARENA_H + 200);

  ctx.save();
  ctx.translate(-par(0.04), 0);

  ctx.save();
  ctx.translate(806, 96);
  ctx.rotate(t * 0.0025);
  ctx.fillStyle = "rgba(255,226,130,0.85)";
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    ctx.beginPath();
    ctx.moveTo(-7, -60);
    ctx.lineTo(0, -104);
    ctx.lineTo(7, -60);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(806, 96, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 240 + t * (0.16 + i * 0.05)) % (ARENA_W + 320)) - 160;
    const cy = 52 + ((i * 61) % 96);
    puff(ctx, cx, cy, 26 + (i % 3) * 9);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-par(0.1), 0);
  drawSkyline(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(-par(0.2), 0);
  drawCapitol(ctx, t);
  ctx.restore();

  ctx.save();
  ctx.translate(-par(0.34), 0);
  drawFloodlights(ctx, t);
  drawCrowd(ctx, t);
  ctx.restore();

  const haze = ctx.createLinearGradient(0, GROUND_Y - 210, 0, GROUND_Y);
  haze.addColorStop(0, "rgba(14,20,42,0)");
  haze.addColorStop(1, "rgba(14,20,42,0.42)");
  ctx.fillStyle = haze;
  ctx.fillRect(-200, GROUND_Y - 210, ARENA_W + 400, 210);
}

function drawSkyline(ctx: CanvasRenderingContext2D): void {
  const baseY = GROUND_Y - 128;
  ctx.fillStyle = "rgba(84,110,158,0.55)";
  ctx.strokeStyle = "rgba(20,20,20,0.35)";
  ctx.lineWidth = 2;
  const towers = [
    [-40, 110, 96], [70, 74, 150], [150, 120, 108], [276, 60, 176],
    [340, 96, 128], [452, 82, 96], [548, 130, 152], [690, 70, 118],
    [768, 104, 96], [876, 88, 140],
  ] as const;
  for (const [x, w, h] of towers) {
    ctx.fillRect(x, baseY - h, w, h);
    ctx.strokeRect(x, baseY - h, w, h);
    ctx.save();
    ctx.fillStyle = "rgba(255,240,190,0.4)";
    for (let wy = baseY - h + 12; wy < baseY - 10; wy += 22) {
      for (let wx = x + 10; wx < x + w - 10; wx += 20) ctx.fillRect(wx, wy, 8, 10);
    }
    ctx.restore();
  }
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y + 5, r * 0.68, 0, Math.PI * 2);
  ctx.arc(x - r * 0.95, y + 7, r * 0.6, 0, Math.PI * 2);
  ctx.arc(x - r * 0.2, y - r * 0.6, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,20,20,0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function drawCapitol(ctx: CanvasRenderingContext2D, t: number): void {
  const bx = ARENA_W / 2;
  const baseY = GROUND_Y - 104;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;

  ctx.fillStyle = "#f6f8fa";
  roundRect(ctx, bx - 168, baseY - 74, 336, 74, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e2e8ee";
  for (let i = 0; i < 11; i++) {
    const cx = bx - 146 + i * 28;
    ctx.fillRect(cx, baseY - 64, 13, 56);
    ctx.strokeRect(cx, baseY - 64, 13, 56);
  }
  ctx.fillStyle = "#f6f8fa";
  roundRect(ctx, bx - 172, baseY - 84, 344, 14, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(bx - 62, baseY - 84);
  ctx.quadraticCurveTo(bx - 58, baseY - 150, bx, baseY - 158);
  ctx.quadraticCurveTo(bx + 58, baseY - 150, bx + 62, baseY - 84);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#eef2f6";
  ctx.beginPath();
  ctx.arc(bx, baseY - 158, 18, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const wave = Math.sin(t * 0.06) * 5;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, baseY - 176);
  ctx.lineTo(bx, baseY - 232);
  ctx.stroke();
  ctx.fillStyle = "#d64545";
  ctx.beginPath();
  ctx.moveTo(bx + 2, baseY - 230);
  ctx.quadraticCurveTo(bx + 22, baseY - 226 + wave, bx + 42, baseY - 230);
  ctx.lineTo(bx + 42, baseY - 210);
  ctx.quadraticCurveTo(bx + 22, baseY - 206 + wave, bx + 2, baseY - 210);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFloodlights(ctx: CanvasRenderingContext2D, t: number): void {
  for (const x of [96, ARENA_W - 96]) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 120);
    ctx.lineTo(x, GROUND_Y - 250);
    ctx.stroke();
    ctx.fillStyle = "#8d99a6";
    roundRect(ctx, x - 34, GROUND_Y - 274, 68, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff6c9";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x - 20 + i * 20, GROUND_Y - 261, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const beam = ctx.createLinearGradient(x, GROUND_Y - 248, x, GROUND_Y);
    beam.addColorStop(0, "rgba(255,247,204,0.42)");
    beam.addColorStop(1, "rgba(255,247,204,0)");
    ctx.fillStyle = beam;
    const spread = 110 + Math.sin(t * 0.02 + x) * 14;
    ctx.beginPath();
    ctx.moveTo(x - 26, GROUND_Y - 248);
    ctx.lineTo(x + 26, GROUND_Y - 248);
    ctx.lineTo(x + spread, GROUND_Y);
    ctx.lineTo(x - spread, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCrowd(ctx: CanvasRenderingContext2D, t: number): void {
  const rows = [
    { y: GROUND_Y - 150, scale: 0.78, step: 30, alpha: 0.42, sat: 22, light: 34 },
    { y: GROUND_Y - 118, scale: 1, step: 36, alpha: 0.62, sat: 28, light: 30 },
  ];
  for (const row of rows) {
    ctx.save();
    ctx.globalAlpha = row.alpha;
    for (let i = 0; i < Math.ceil(ARENA_W / row.step) + 2; i++) {
      const x = -20 + i * row.step + ((i * 17) % 11);
      const bob = Math.sin(t * 0.055 + i * 1.4 + row.y) * 5;
      const hue = (i * 53 + row.step) % 360;
      const s = row.scale;
      ctx.fillStyle = `hsl(${(hue + 40) % 360} ${row.sat}% ${row.light}%)`;
      roundRect(ctx, x - 13 * s, row.y + bob, 26 * s, 30 * s, 6);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `hsl(${hue} ${row.sat}% ${row.light + 12 + (i % 3) * 5}%)`;
      ctx.beginPath();
      ctx.arc(x, row.y - 10 * s + bob, 12 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (i % 11 === 4) {
        ctx.save();
        ctx.translate(x + 14 * s, row.y - 16 * s + bob);
        ctx.rotate(Math.sin(t * 0.09 + i) * 0.35);
        ctx.fillStyle = "#fffdf2";
        roundRect(ctx, -12, -22, 24, 18, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(20,20,20,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -16);
        ctx.lineTo(7, -16);
        ctx.moveTo(-7, -11);
        ctx.lineTo(4, -11);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  const flashSeed = Math.floor(t / 7);
  for (let i = 0; i < 3; i++) {
    const n = (flashSeed * 9301 + i * 49297) % 233280;
    if (n % 5 !== 0) continue;
    const fx = (n % ARENA_W);
    const fy = GROUND_Y - 120 - ((n / 7) % 40);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGround(ctx: CanvasRenderingContext2D): void {
  const gr = ctx.createLinearGradient(0, GROUND_Y, 0, ARENA_H);
  gr.addColorStop(0, "#d9c8a4");
  gr.addColorStop(1, "#9c8560");
  ctx.fillStyle = gr;
  ctx.fillRect(-200, GROUND_Y, ARENA_W + 400, ARENA_H - GROUND_Y + 200);

  ctx.save();
  ctx.strokeStyle = "rgba(20,20,20,0.18)";
  ctx.lineWidth = 2;
  for (let i = -6; i <= 26; i++) {
    const x = i * 60;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(ARENA_W / 2 + (x - ARENA_W / 2) * 2.4, ARENA_H + 60);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const y = GROUND_Y + i * i * 6;
    ctx.beginPath();
    ctx.moveTo(-200, y);
    ctx.lineTo(ARENA_W + 200, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(20,20,20,0.12)";
  for (let x = 8; x < ARENA_W + 40; x += 24) {
    for (let y = GROUND_Y + 10; y < ARENA_H; y += 20) {
      const r = 1.2 + ((y - GROUND_Y) / 60) * 2.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-200, GROUND_Y);
  ctx.lineTo(ARENA_W + 200, GROUND_Y);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = "rgba(20,20,20,0.35)";
  ctx.lineWidth = 4;
  for (const x of [WALL_PAD - 22, ARENA_W - WALL_PAD + 22]) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, GROUND_Y + 30);
    ctx.stroke();
  }
  ctx.restore();
}

function drawForeground(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  ctx.save();
  ctx.translate(-par(-0.06), 0);
  const y = ARENA_H - 26;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-40, y);
  ctx.lineTo(ARENA_W + 40, y);
  ctx.stroke();
  const colors = ["#d64545", "#ffffff", "#3d5a80"];
  for (let i = 0; i < 22; i++) {
    const x = -30 + i * 48;
    const sag = Math.sin(game.tick * 0.03 + i) * 3;
    ctx.fillStyle = colors[i % 3];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 44, y);
    ctx.lineTo(x + 22, y + 24 + sag);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  ctx.save();
  ctx.translate(ARENA_W / 2, ARENA_H / 2);
  ctx.globalAlpha = Math.min(0.5, 0.12 + game.shake * 0.03);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  const seed = Math.floor(game.tick / 2);
  for (let i = 0; i < 26; i++) {
    const ang = ((i * 7919 + seed * 131) % 360) * (Math.PI / 180);
    const inner = 210 + ((i * 37) % 90);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner * 0.66);
    ctx.lineTo(Math.cos(ang) * 720, Math.sin(ang) * 480);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(
    ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.42,
    ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.95
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(10,6,20,0.42)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter): void {
  const air = GROUND_Y - f.y;
  const scale = Math.max(0.4, 1 - air / 280);
  ctx.save();
  ctx.fillStyle = `rgba(20,20,20,${0.3 * scale})`;
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND_Y + 7, 44 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost): void {
  const k = g.life / g.maxLife;
  ctx.save();
  ctx.globalAlpha = 0.4 * k;
  ctx.fillStyle = g.color;
  ctx.translate(g.x, g.y);
  ctx.scale(g.facing, 1);
  roundRect(ctx, -23, SHOULDER_Y, 46, HIP_Y - SHOULDER_Y + 14, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y, HEAD_R * 1.02, HEAD_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-11, -22, 10, 24, 0.1, 0, Math.PI * 2);
  ctx.ellipse(13, -22, 10, 24, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

interface Pose {
  lean: number;
  bob: number;
  crouch: number;
  fx: number; fy: number;
  bx: number; by: number;
  ffx: number; ffy: number;
  bfx: number; bfy: number;
  headTilt: number;
  expr: "idle" | "angry" | "hurt" | "ko" | "sleep" | "shout" | "smug";
}

function attackProgress(f: Fighter, peak: number, fall: number): number {
  const p = f.stateFrame;
  return p <= peak ? Math.min(1, p / Math.max(1, peak - 3)) : Math.max(0, 1 - (p - peak) / fall);
}

function buildPose(f: Fighter, t: number): Pose {
  const breathe = Math.sin(t * 0.075 + f.index * 2) * 2.2;
  const pose: Pose = {
    lean: 0,
    bob: breathe,
    crouch: 0,
    fx: 28, fy: SHOULDER_Y + 4 + breathe,
    bx: -16, by: SHOULDER_Y + 10 + breathe,
    ffx: 18, ffy: 0,
    bfx: -18, bfy: 0,
    headTilt: 0,
    expr: "idle",
  };

  if (f.state === "walk") {
    const s = Math.sin(f.walkPhase);
    pose.ffx = 15 + s * 17;
    pose.ffy = -Math.max(0, s) * 9;
    pose.bfx = -15 - s * 17;
    pose.bfy = -Math.max(0, -s) * 9;
    pose.fx = 26 - s * 5;
    pose.bx = -16 + s * 5;
    pose.lean = 0.05;
  } else if (f.state === "jump") {
    pose.ffx = 20; pose.ffy = -22;
    pose.bfx = -12; pose.bfy = -34;
    pose.fx = 22; pose.fy = SHOULDER_Y - 22;
    pose.bx = -22; pose.by = SHOULDER_Y - 26;
    pose.lean = f.vy < 0 ? -0.12 : 0.1;
  } else if (f.state === "block") {
    pose.crouch = 7;
    pose.bob = 0;
    pose.fx = 20; pose.fy = SHOULDER_Y - 16;
    pose.bx = 8; pose.by = SHOULDER_Y - 4;
    pose.ffx = 16; pose.bfx = -18;
    pose.lean = -0.06;
    pose.expr = "angry";
  } else if (f.state === "hit") {
    pose.lean = -0.26;
    pose.bob = 0;
    pose.fx = 12; pose.fy = SHOULDER_Y - 12;
    pose.bx = -28; pose.by = SHOULDER_Y - 16;
    pose.ffx = 8; pose.bfx = -22;
    pose.headTilt = -0.25;
    pose.expr = "hurt";
  } else if (f.state === "launched") {
    pose.lean = -0.5 - Math.min(0.6, f.stateFrame * 0.03);
    pose.bob = 0;
    pose.fx = 6; pose.fy = SHOULDER_Y - 30;
    pose.bx = -26; pose.by = SHOULDER_Y - 32;
    pose.ffx = 4; pose.ffy = -30;
    pose.bfx = -24; pose.bfy = -22;
    pose.expr = "hurt";
  } else if (f.state === "ko") {
    pose.expr = "ko";
    pose.fx = 14; pose.fy = SHOULDER_Y - 26;
    pose.bx = -22; pose.by = SHOULDER_Y - 20;
    pose.ffx = 22; pose.ffy = -16;
    pose.bfx = -20; pose.bfy = -6;
  }

  if (f.state === "attack" && f.attackKind) {
    pose.bob = 0;
    if (f.attackKind === "punch") {
      const e = attackProgress(f, 8, 8);
      pose.fx = 24 + e * 48;
      pose.fy = SHOULDER_Y + 2 - (f.airborneAttack ? 6 : 0);
      pose.bx = -24;
      pose.lean = 0.12 * e;
      pose.expr = "angry";
      if (f.airborneAttack) { pose.ffx = 18; pose.ffy = -18; pose.bfx = -14; pose.bfy = -30; }
    } else if (f.attackKind === "kick") {
      const e = attackProgress(f, 11, 9);
      pose.ffx = 16 + e * 48;
      pose.ffy = (f.airborneAttack ? -14 : -34) - Math.sin(e * Math.PI) * 22;
      pose.bfx = -18;
      pose.fx = 10; pose.fy = SHOULDER_Y - 10;
      pose.bx = -30; pose.by = SHOULDER_Y - 18;
      pose.lean = -0.12 * e;
      pose.expr = "angry";
    } else if (f.attackKind === "riposte") {
      const e = attackProgress(f, 7, 14);
      pose.fx = 26 + e * 58;
      pose.fy = SHOULDER_Y - 4;
      pose.bx = -26; pose.by = SHOULDER_Y - 6;
      pose.lean = 0.18 * e;
      pose.expr = "shout";
    } else {
      poseSpecial(f, pose);
    }
  }

  return pose;
}

function poseSpecial(f: Fighter, pose: Pose): void {
  const p = f.stateFrame;
  switch (f.def.special.type) {
    case "projectile": {
      const wind = Math.min(1, p / 12);
      const rel = p > 12 ? Math.min(1, (p - 12) / 6) : 0;
      pose.fx = 22 - wind * 26 + rel * 76;
      pose.fy = SHOULDER_Y - 14 + rel * 12;
      pose.bx = -18 - wind * 10;
      pose.by = SHOULDER_Y - 6;
      pose.lean = -0.16 * wind + 0.24 * rel;
      pose.expr = "shout";
      break;
    }
    case "dash": {
      const go = p >= 6 && p <= 26;
      pose.lean = go ? 0.42 : 0.16;
      pose.fx = go ? 34 : 8; pose.fy = SHOULDER_Y + 16;
      pose.bx = -34; pose.by = SHOULDER_Y - 2;
      pose.ffx = go ? 26 : 12; pose.bfx = go ? -26 : -16;
      pose.crouch = 6;
      pose.expr = "angry";
      break;
    }
    case "buff": {
      const up = Math.min(1, p / 10);
      pose.fx = 18; pose.fy = SHOULDER_Y - 34 * up;
      pose.bx = -18; pose.by = SHOULDER_Y - 34 * up;
      pose.crouch = 6 * up;
      pose.lean = -0.1;
      pose.expr = "shout";
      break;
    }
    case "shockwave": {
      const roar = p >= 10 && p <= 26;
      pose.fx = roar ? 30 : 16; pose.fy = SHOULDER_Y - (roar ? 30 : 12);
      pose.bx = roar ? -30 : -16; pose.by = SHOULDER_Y - (roar ? 30 : 12);
      pose.lean = roar ? -0.2 : -0.05;
      pose.crouch = roar ? 4 : 0;
      pose.expr = "shout";
      break;
    }
    case "confuse": {
      const swirl = Math.sin(p * 0.42);
      pose.fx = 34 + swirl * 16;
      pose.fy = SHOULDER_Y - 12 + swirl * 12;
      pose.bx = -20; pose.by = SHOULDER_Y - 4;
      pose.lean = 0.08;
      pose.expr = "smug";
      break;
    }
    case "nap": {
      const asleep = p <= 82;
      pose.crouch = asleep ? 26 : 6;
      pose.lean = asleep ? -0.12 : 0.06;
      pose.fx = asleep ? 12 : 26; pose.fy = SHOULDER_Y + 26;
      pose.bx = -14; pose.by = SHOULDER_Y + 26;
      pose.ffx = 24; pose.bfx = -22;
      pose.headTilt = asleep ? 0.3 : 0;
      pose.expr = asleep ? "sleep" : "shout";
      break;
    }
    case "vanish": {
      pose.lean = -0.16;
      pose.fx = 20; pose.fy = SHOULDER_Y - 24;
      pose.bx = -20; pose.by = SHOULDER_Y - 10;
      if (p >= 18 && p <= 26) {
        const q = p - 18;
        const e = q <= 4 ? Math.min(1, q / 2) : Math.max(0, 1 - (q - 4) / 6);
        pose.fx = 24 + e * 56;
        pose.fy = SHOULDER_Y;
        pose.lean = 0.16;
      }
      pose.expr = "smug";
      break;
    }
    case "uppercut": {
      const rise = p >= 8 ? Math.min(1, (p - 8) / 6) : 0;
      pose.crouch = p < 8 ? 12 : 0;
      pose.fx = 16 + rise * 18;
      pose.fy = SHOULDER_Y + 10 - rise * 66;
      pose.bx = -22; pose.by = SHOULDER_Y + 6;
      pose.ffx = 12; pose.ffy = rise * -20;
      pose.bfx = -16; pose.bfy = rise * -8;
      pose.lean = -0.18 * rise;
      pose.expr = "shout";
      break;
    }
    case "barrage": {
      const active = p >= 8 && p <= 44;
      const beat = Math.sin(p * 1.1);
      if (p === 48 || (p > 44 && p < 54)) {
        const e = Math.max(0, 1 - (p - 48) / 6);
        pose.fx = 26 + e * 60; pose.fy = SHOULDER_Y - 8;
        pose.bx = -26; pose.lean = 0.2 * e;
      } else if (active) {
        pose.fx = 44 + beat * 26; pose.fy = SHOULDER_Y + 2;
        pose.bx = 30 - beat * 26; pose.by = SHOULDER_Y + 6;
        pose.lean = 0.16;
      }
      pose.crouch = 4;
      pose.expr = "angry";
      break;
    }
    case "counter": {
      const ready = p >= 4 && p <= 30;
      pose.crouch = 10;
      pose.lean = -0.14;
      pose.fx = ready ? 14 : 24; pose.fy = SHOULDER_Y - 22;
      pose.bx = ready ? -6 : -20; pose.by = SHOULDER_Y - 6;
      pose.expr = "smug";
      break;
    }
    case "ai": {
      const up = Math.min(1, p / 8);
      pose.fx = 20; pose.fy = SHOULDER_Y - 26 * up;
      pose.bx = -20; pose.by = SHOULDER_Y - 22 * up;
      pose.crouch = 8 * up;
      pose.lean = -0.16;
      pose.expr = "shout";
      break;
    }
  }
}

function ik(
  sx: number, sy: number, tx: number, ty: number,
  l1: number, l2: number, bend: number
): { hx: number; hy: number; ex: number; ey: number } {
  let dx = tx - sx;
  let dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.6;
  if (d > max) {
    const k = max / d;
    dx *= k; dy *= k; d = max;
  }
  if (d < 1) { dy = 1; d = 1; }
  const cos = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const ang = Math.atan2(dy, dx) + Math.acos(cos) * bend;
  return {
    hx: sx + dx,
    hy: sy + dy,
    ex: sx + Math.cos(ang) * l1,
    ey: sy + Math.sin(ang) * l1,
  };
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, game: WorldBattle): void {
  const look = f.def.look;
  const t = game.tick;
  const bw = look.build === "wide" ? 1.24 : look.build === "slim" ? 0.86 : 1;
  const ko = f.state === "ko";
  const pose = buildPose(f, t);

  if (f.buff > 0) drawAura(ctx, f, t);
  if (f.armor > 0 && f.state === "attack") drawArmorGlow(ctx, f, t);
  if (f.parry > 0) drawParryGlow(ctx, f, t);

  ctx.save();
  ctx.translate(f.x, f.y);
  if (ko) {
    ctx.rotate(-f.facing * 1.35);
    ctx.translate(0, -14);
    ctx.scale(f.facing, 1);
  } else {
    ctx.scale(f.facing, 1);
  }
  if (f.invuln > 0) ctx.globalAlpha = 0.42 + Math.sin(t * 0.5) * 0.1;
  if (f.sleeping > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.95);

  ctx.rotate(pose.lean);
  ctx.translate(0, pose.crouch + pose.bob);

  const bodyW = 50 * bw;
  const backShoulder = { x: -bodyW / 2 + 6, y: SHOULDER_Y + 12 };
  const frontShoulder = { x: bodyW / 2 - 6, y: SHOULDER_Y + 10 };
  const backHip = { x: -10 * bw, y: HIP_Y };
  const frontHip = { x: 10 * bw, y: HIP_Y };

  const suitDark = shade(look.suit, -0.34);
  const legColor = shade(look.suit, 0.1);
  const sleeveFront = shade(look.suit, 0.22);

  drawLeg(ctx, backHip, pose.bfx, pose.bfy, suitDark, look.tie, 15);
  drawArm(ctx, backShoulder, pose.bx, pose.by, suitDark, look.skin, 13);

  drawTorso(ctx, bodyW, look);

  drawLeg(ctx, frontHip, pose.ffx, pose.ffy, legColor, look.tie, 16);

  drawHead(ctx, 0, HEAD_Y, f, pose);

  drawArm(ctx, frontShoulder, pose.fx, pose.fy, sleeveFront, look.skin, 14);

  if (f.flashFrames > 0) {
    ctx.save();
    ctx.globalAlpha = (f.flashFrames / 6) * 0.7;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, -bodyW / 2 - 2, SHOULDER_Y - 2, bodyW + 4, HIP_Y - SHOULDER_Y + 16, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, HEAD_Y, HEAD_R * 1.06, HEAD_R * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  drawStatusIcons(ctx, f, game);
}

function drawTorso(
  ctx: CanvasRenderingContext2D, bodyW: number, look: LookDef
): void {
  const topW = bodyW;
  const botW = bodyW * 0.78;
  ctx.beginPath();
  ctx.moveTo(-topW / 2, SHOULDER_Y);
  ctx.quadraticCurveTo(-topW / 2 - 4, SHOULDER_Y + 24, -botW / 2, HIP_Y + 10);
  ctx.lineTo(botW / 2, HIP_Y + 10);
  ctx.quadraticCurveTo(topW / 2 + 4, SHOULDER_Y + 24, topW / 2, SHOULDER_Y);
  ctx.closePath();
  ctx.fillStyle = look.suit;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.fillStyle = "#fdfdfd";
  ctx.beginPath();
  ctx.moveTo(-11, SHOULDER_Y + 1);
  ctx.lineTo(11, SHOULDER_Y + 1);
  ctx.lineTo(0, SHOULDER_Y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.stroke();

  ctx.fillStyle = shade(look.suit, -0.28);
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(dir * 11, SHOULDER_Y + 1);
    ctx.lineTo(dir * (topW / 2 - 1), SHOULDER_Y + 4);
    ctx.lineTo(dir * 6, SHOULDER_Y + 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = look.tie;
  ctx.beginPath();
  ctx.moveTo(-5, SHOULDER_Y + 3);
  ctx.lineTo(5, SHOULDER_Y + 3);
  ctx.lineTo(7, SHOULDER_Y + 14);
  ctx.lineTo(3, HIP_Y + 8);
  ctx.lineTo(-3, HIP_Y + 8);
  ctx.lineTo(-7, SHOULDER_Y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.stroke();

  if (look.accessory === "flagpin") {
    ctx.fillStyle = "#d64545";
    ctx.fillRect(topW / 2 - 15, SHOULDER_Y + 12, 10, 7);
    ctx.fillStyle = "#3d5a80";
    ctx.fillRect(topW / 2 - 15, SHOULDER_Y + 12, 4, 4);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(topW / 2 - 15, SHOULDER_Y + 12, 10, 7);
  }
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulder: { x: number; y: number },
  tx: number, ty: number,
  sleeve: string, skin: string, w: number
): void {
  const j = ik(shoulder.x, shoulder.y, tx, ty, ARM_BONE, ARM_BONE, 1);
  segment(ctx, shoulder.x, shoulder.y, j.ex, j.ey, w, sleeve);
  segment(ctx, j.ex, j.ey, j.hx, j.hy, w - 2, sleeve);
  ctx.fillStyle = skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(j.hx, j.hy, w * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hip: { x: number; y: number },
  tx: number, ty: number,
  trouser: string, shoe: string, w: number
): void {
  const j = ik(hip.x, hip.y, tx, ty, LEG_BONE, LEG_BONE, -1);
  segment(ctx, hip.x, hip.y, j.ex, j.ey, w, trouser);
  segment(ctx, j.ex, j.ey, j.hx, j.hy, w - 2, trouser);
  ctx.save();
  ctx.translate(j.hx, j.hy);
  ctx.fillStyle = shoe;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  roundRect(ctx, -w / 2 - 3, -5, w + 11, 10, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function segment(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  w: number, color: string
): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3.5;
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

function drawAura(ctx: CanvasRenderingContext2D, f: Fighter, t: number): void {
  const pulse = 1 + Math.sin(t * 0.24) * 0.1;
  ctx.save();
  ctx.translate(f.x, f.y);
  const g = ctx.createRadialGradient(0, -76, 10, 0, -76, 110 * pulse);
  g.addColorStop(0, hexA(f.def.look.accent, 0.5));
  g.addColorStop(1, hexA(f.def.look.accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -76, 74 * pulse, 112 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexA(f.def.look.accent, 0.85);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + t * 0.06;
    const r = 62 + Math.sin(t * 0.2 + i) * 10;
    const x = Math.cos(a) * r * 0.8;
    const y = -76 + Math.sin(a) * r;
    ctx.moveTo(x, y);
    ctx.lineTo(x * 1.18, y - 14 - Math.sin(t * 0.3 + i) * 6);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArmorGlow(ctx: CanvasRenderingContext2D, f: Fighter, t: number): void {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.globalAlpha = 0.35 + Math.sin(t * 0.5) * 0.12;
  ctx.strokeStyle = "#ffb703";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(0, -74, 48, 96, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawParryGlow(ctx: CanvasRenderingContext2D, f: Fighter, t: number): void {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  const r = 56 + Math.sin(t * 0.6) * 5;
  ctx.beginPath();
  ctx.arc(f.facing * 14, -76, r, -1.1, 1.1);
  ctx.stroke();
  ctx.strokeStyle = f.def.look.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.facing * 14, -76, r - 7, -1.1, 1.1);
  ctx.stroke();
  ctx.restore();
}

function drawStatusIcons(ctx: CanvasRenderingContext2D, f: Fighter, game: WorldBattle): void {
  const t = game.tick;
  if (f.confused > 0 && f.state !== "ko") {
    ctx.save();
    ctx.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      const a = t * 0.09 + (i / 3) * Math.PI * 2;
      const x = f.x + Math.cos(a) * 30;
      const y = f.y - 186 + Math.sin(a) * 9;
      ctx.font = DISPLAY(20 + Math.sin(a) * 4);
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.strokeText("?", x, y);
      ctx.fillStyle = "#b388ff";
      ctx.fillText("?", x, y);
    }
    ctx.restore();
  }

  const napping =
    f.state === "attack" && f.attackKind === "special" && f.def.special.type === "nap";
  if (napping) {
    ctx.save();
    ctx.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.6 + i * 20) % 60) / 60;
      ctx.globalAlpha = 1 - k;
      ctx.font = DISPLAY(16 + k * 16);
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.strokeText("Z", f.x + 34 + k * 26, f.y - 150 - k * 70);
      ctx.fillStyle = "#7ec8ff";
      ctx.fillText("Z", f.x + 34 + k * 26, f.y - 150 - k * 70);
    }
    ctx.restore();
  }

  if (f.state === "ko") {
    ctx.save();
    ctx.textAlign = "center";
    for (let i = 0; i < 4; i++) {
      const a = t * 0.14 + (i / 4) * Math.PI * 2;
      star(ctx, f.x + Math.cos(a) * 36, f.y - 190 + Math.sin(a) * 12, 9, "#fff200");
    }
    ctx.restore();
  }

  if (f.hp / f.maxHp < 0.28 && f.state !== "ko") {
    ctx.save();
    ctx.fillStyle = "#9ad0ec";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.8 + i * 34) % 68) / 68;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(f.x + (i ? 26 : -26), f.y - 156 + k * 26, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number,
  f: Fighter, pose: Pose
): void {
  const look = f.def.look;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(pose.headTilt);

  ctx.fillStyle = look.skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, HEAD_R - 8);
  ctx.lineTo(9, HEAD_R - 8);
  ctx.lineTo(9, HEAD_R + 12);
  ctx.lineTo(-9, HEAD_R + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawFace(ctx, look, pose.expr, f.hairPhase);
  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  look: LookDef,
  expr: Pose["expr"],
  hairPhase: number
): void {
  const r = HEAD_R;
  const wide = look.build === "wide";

  ctx.fillStyle = shade(look.skin, -0.16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const ex of [-r * 1.02, r * 1.02]) {
    ctx.beginPath();
    ctx.ellipse(ex, 2, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-r * 1.04, -4);
  ctx.quadraticCurveTo(-r * 1.1, r * 0.62, -r * (wide ? 0.68 : 0.52), r * 0.92);
  ctx.quadraticCurveTo(0, r * 1.2, r * (wide ? 0.68 : 0.52), r * 0.92);
  ctx.quadraticCurveTo(r * 1.1, r * 0.62, r * 1.04, -4);
  ctx.quadraticCurveTo(r * 0.9, -r * 1.12, 0, -r * 1.12);
  ctx.quadraticCurveTo(-r * 0.9, -r * 1.12, -r * 1.04, -4);
  ctx.closePath();
  ctx.fillStyle = look.skin;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.stroke();

  if (wide) {
    ctx.strokeStyle = shade(look.skin, -0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, r * 0.52);
    ctx.quadraticCurveTo(-r * 0.48, r * 0.9, -r * 0.16, r * 0.94);
    ctx.moveTo(r * 0.62, r * 0.52);
    ctx.quadraticCurveTo(r * 0.48, r * 0.9, r * 0.16, r * 0.94);
    ctx.stroke();
  }

  const eyeY = -r * 0.14;
  const eyeDx = r * 0.36;
  const asleep = expr === "sleep";
  const ko = expr === "ko";
  const angry = expr === "angry" || expr === "shout";
  const hurt = expr === "hurt";

  ctx.strokeStyle = INK;
  if (ko) {
    for (const ex of [-eyeDx, eyeDx]) drawX(ctx, ex, eyeY, r * 0.34);
  } else if (asleep) {
    ctx.lineWidth = 3;
    for (const ex of [-eyeDx, eyeDx]) {
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.22, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  } else {
    const openY = hurt ? 1.25 : angry ? 0.82 : 1;
    for (const ex of [-eyeDx, eyeDx]) {
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, r * 0.23, r * 0.23 * openY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + r * 0.07, eyeY + (hurt ? -r * 0.04 : 0), r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = shade(look.hair, -0.1);
    const browIn = angry ? r * 0.18 : hurt ? -r * 0.12 : 0;
    ctx.beginPath();
    ctx.moveTo(-eyeDx - r * 0.28, eyeY - r * 0.4 - browIn * 0.4);
    ctx.lineTo(-eyeDx + r * 0.26, eyeY - r * 0.34 + browIn);
    ctx.moveTo(eyeDx - r * 0.26, eyeY - r * 0.34 + browIn);
    ctx.lineTo(eyeDx + r * 0.28, eyeY - r * 0.4 - browIn * 0.4);
    ctx.stroke();
  }

  drawNose(ctx, look, r);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillStyle = "#8d2b3a";
  const mouthY = r * 0.5;
  if (ko || asleep) {
    ctx.beginPath();
    ctx.ellipse(0, mouthY, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expr === "shout") {
    ctx.beginPath();
    ctx.ellipse(0, mouthY + 2, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, mouthY - r * 0.16, r * 0.2, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hurt) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.06, mouthY, r * 0.22, r * 0.16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (angry) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, mouthY + r * 0.08);
    ctx.quadraticCurveTo(0, mouthY - r * 0.16, r * 0.3, mouthY + r * 0.08);
    ctx.stroke();
  } else if (expr === "smug") {
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, mouthY);
    ctx.quadraticCurveTo(r * 0.06, mouthY + r * 0.24, r * 0.34, mouthY - r * 0.12);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, mouthY - r * 0.16, r * 0.3, 0.35, Math.PI - 0.35);
    ctx.stroke();
  }

  drawHair(ctx, look.hairStyle, look.hair, r, hairPhase);
  drawAccessory(ctx, look, r);
}

function drawNose(ctx: CanvasRenderingContext2D, look: LookDef, r: number): void {
  const kind = look.nose ?? "broad";
  ctx.fillStyle = shade(look.skin, -0.12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  switch (kind) {
    case "button":
      ctx.ellipse(r * 0.04, r * 0.16, r * 0.13, r * 0.11, 0, 0, Math.PI * 2);
      break;
    case "hook":
      ctx.moveTo(-r * 0.04, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.32, r * 0.06, r * 0.14, r * 0.3);
      ctx.quadraticCurveTo(r * 0.02, r * 0.34, -r * 0.08, r * 0.26);
      ctx.closePath();
      break;
    case "bulb":
      ctx.ellipse(r * 0.04, r * 0.2, r * 0.2, r * 0.17, 0, 0, Math.PI * 2);
      break;
    default:
      ctx.moveTo(-r * 0.02, -r * 0.08);
      ctx.quadraticCurveTo(r * 0.24, r * 0.12, r * 0.1, r * 0.28);
      ctx.quadraticCurveTo(-r * 0.06, r * 0.32, -r * 0.12, r * 0.22);
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  style: string,
  color: string,
  r: number,
  phase: number
): void {
  const sway = Math.sin(phase) * 2.2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  switch (style) {
    case "swoop": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, -r * 0.16);
      ctx.quadraticCurveTo(-r * 1.2, -r * 1.3, r * 0.1, -r * 1.28);
      ctx.quadraticCurveTo(r * 1.5 + sway, -r * 1.32, r * 0.86, -r * 0.42);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.9, -r * 0.5, -r * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = shade(color, -0.25);
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7 + i * r * 0.34, -r * 0.86);
        ctx.quadraticCurveTo(r * 0.4, -r * 1.16, r * 0.8, -r * 0.5);
        ctx.stroke();
      }
      break;
    }
    case "pomp": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.04, -r * 0.2);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.5 - sway, r * 0.1, -r * 1.44);
      ctx.quadraticCurveTo(r * 1.1, -r * 1.4, r * 1.02, -r * 0.24);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.86, -r * 1.04, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "fluff": {
      for (const [ox, oy, rr] of [
        [-r * 0.72, -r * 0.62, r * 0.34],
        [-r * 0.24, -r * 0.94, r * 0.36],
        [r * 0.3, -r * 0.88, r * 0.34],
        [r * 0.78, -r * 0.5, r * 0.28],
        [-r * 1.0, -r * 0.2, r * 0.26],
        [r * 1.0, -r * 0.16, r * 0.26],
      ] as const) {
        ctx.beginPath();
        ctx.arc(ox, oy + sway * 0.3, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "bun": {
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 1.28, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.05, -r * 1.14, 0, -r * 1.1);
      ctx.quadraticCurveTo(r * 1.05, -r * 1.06, r * 1.05, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.6, -r * 1.05, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "wave": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, -r * 0.06);
      ctx.quadraticCurveTo(-r * 1.06, -r * 1.16, 0, -r * 1.16);
      ctx.quadraticCurveTo(r * 1.06, -r * 1.16, r * 1.06, -r * 0.06);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.5, 0, -r * 0.46);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.5, -r * 1.06, -r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = shade(color, 0.35);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-r * 0.7 + i * r * 0.36, -r * 0.82, r * 0.18, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
      break;
    }
    case "short": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, -r * 0.12);
      ctx.quadraticCurveTo(-r * 1.05, -r * 1.2, 0, -r * 1.18);
      ctx.quadraticCurveTo(r * 1.05, -r * 1.16, r * 1.05, -r * 0.12);
      ctx.quadraticCurveTo(r * 0.6, -r * 0.62, -r * 0.2, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "spiky": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, -r * 0.2);
      for (let i = 0; i < 6; i++) {
        const bx = -r * 1.05 + (i * r * 2.1) / 5;
        const h = -r * (1.35 + (i % 2) * 0.3) - sway * (i % 2 ? 1 : -1);
        ctx.lineTo(bx + r * 0.18, h);
        ctx.lineTo(bx + r * 0.36, -r * 0.5);
      }
      ctx.lineTo(r * 1.05, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "long": {
      ctx.beginPath();
      ctx.moveTo(-r * 1.08, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.08, -r * 1.2, 0, -r * 1.2);
      ctx.quadraticCurveTo(r * 1.08, -r * 1.2, r * 1.08, -r * 0.1);
      ctx.lineTo(r * 1.08, r * 0.9 + sway);
      ctx.quadraticCurveTo(r * 0.8, r * 1.15, r * 0.66, r * 0.5);
      ctx.lineTo(r * 0.66, -r * 0.42);
      ctx.lineTo(-r * 0.66, -r * 0.42);
      ctx.lineTo(-r * 0.66, r * 0.5);
      ctx.quadraticCurveTo(-r * 0.8, r * 1.15, -r * 1.08, r * 0.9 - sway);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    default: {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.6, r * 0.3, r * 0.12, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = shade(color, 0.1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 1.03, -r * 0.1);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.55, -r * 0.55, -r * 0.62);
      ctx.moveTo(r * 1.03, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.55, r * 0.55, -r * 0.62);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawAccessory(
  ctx: CanvasRenderingContext2D, look: LookDef, r: number
): void {
  ctx.strokeStyle = INK;
  const eyeY = -r * 0.14;
  const eyeDx = r * 0.36;
  switch (look.accessory) {
    case "glasses": {
      ctx.lineWidth = 2.8;
      ctx.fillStyle = "rgba(220,240,255,0.4)";
      for (const ex of [-eyeDx, eyeDx]) {
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, r * 0.3, r * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-eyeDx + r * 0.3, eyeY);
      ctx.lineTo(eyeDx - r * 0.3, eyeY);
      ctx.moveTo(-eyeDx - r * 0.3, eyeY);
      ctx.lineTo(-r * 1.02, eyeY - r * 0.08);
      ctx.moveTo(eyeDx + r * 0.3, eyeY);
      ctx.lineTo(r * 1.02, eyeY - r * 0.08);
      ctx.stroke();
      break;
    }
    case "aviators": {
      ctx.lineWidth = 3;
      ctx.fillStyle = "#20242e";
      for (const ex of [-eyeDx, eyeDx]) {
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.34, eyeY - r * 0.2);
        ctx.lineTo(ex + r * 0.34, eyeY - r * 0.2);
        ctx.quadraticCurveTo(ex + r * 0.3, eyeY + r * 0.36, ex, eyeY + r * 0.34);
        ctx.quadraticCurveTo(ex - r * 0.3, eyeY + r * 0.36, ex - r * 0.34, eyeY - r * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      for (const ex of [-eyeDx, eyeDx]) {
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.2, eyeY + r * 0.16);
        ctx.lineTo(ex + r * 0.1, eyeY - r * 0.12);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-eyeDx + r * 0.34, eyeY - r * 0.14);
      ctx.lineTo(eyeDx - r * 0.34, eyeY - r * 0.14);
      ctx.moveTo(-eyeDx - r * 0.34, eyeY - r * 0.16);
      ctx.lineTo(-r * 1.02, eyeY - r * 0.24);
      ctx.moveTo(eyeDx + r * 0.34, eyeY - r * 0.16);
      ctx.lineTo(r * 1.02, eyeY - r * 0.24);
      ctx.stroke();
      break;
    }
    case "cap": {
      ctx.lineWidth = 3;
      ctx.fillStyle = "#d31f2b";
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, -r * 0.3);
      ctx.quadraticCurveTo(-r * 1.02, -r * 1.42, 0, -r * 1.42);
      ctx.quadraticCurveTo(r * 1.02, -r * 1.42, r * 1.06, -r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(r * 0.5, -r * 0.3, r * 0.95, r * 0.24, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, -r * 0.5, -r * 1.14, r * 1.0, r * 0.42, 3);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "earrings": {
      ctx.lineWidth = 2.4;
      ctx.fillStyle = "#f7f7f7";
      for (const ex of [-r * 1.02, r * 1.02]) {
        ctx.beginPath();
        ctx.arc(ex, r * 0.34, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "pearls": {
      ctx.lineWidth = 2;
      ctx.fillStyle = "#fbf6ec";
      for (let i = -3; i <= 3; i++) {
        const a = (i / 3) * 0.9;
        ctx.beginPath();
        ctx.arc(Math.sin(a) * r * 0.5, r * 1.16 + Math.cos(a) * r * 0.12, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s / 2);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.moveTo(x + s / 2, y - s / 2);
  ctx.lineTo(x - s / 2, y + s / 2);
  ctx.stroke();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D, p: Projectile, game: WorldBattle
): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;

  if (p.kind === "shockwave") {
    const k = Math.max(0.12, p.life / p.maxLife);
    ctx.globalAlpha = k;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 7;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = k * (1 - i * 0.28);
      ctx.beginPath();
      ctx.arc(-Math.sign(p.vx) * i * 16, 0, p.r - i * 7, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.globalAlpha = k;
    ctx.fillStyle = INK;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.1 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
      ctx.lineTo(Math.cos(a) * (p.r + 12), Math.sin(a) * (p.r + 12) - 6);
      ctx.lineTo(Math.cos(a + 0.1) * p.r, Math.sin(a + 0.1) * p.r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const dir = Math.sign(p.vx) || 1;
  ctx.scale(dir, 1);

  if (p.visual === "eagle") {
    const flap = Math.sin(game.tick * 0.4) * 10;
    ctx.fillStyle = "#6b4423";
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-6, s * (18 + flap), -30, s * (10 + flap));
      ctx.quadraticCurveTo(-12, s * 2, -2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#f7f7f2";
    ctx.beginPath();
    ctx.arc(15, -3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(18, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb703";
    ctx.beginPath();
    ctx.moveTo(21, -6);
    ctx.lineTo(32, -1);
    ctx.lineTo(21, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.visual === "flag") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-20, 20);
    ctx.stroke();
    const w = Math.sin(game.tick * 0.35) * 5;
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.quadraticCurveTo(0, -14 + w, 24, -18 - w);
    ctx.lineTo(24, 4 - w);
    ctx.quadraticCurveTo(0, 8 + w, -20, 4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#d64545";
    for (let i = 0; i < 4; i++) ctx.fillRect(-20, -18 + i * 6.5, 46, 3.2);
    ctx.fillStyle = "#2b3a67";
    ctx.fillRect(-20, -19, 20, 11);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.quadraticCurveTo(0, -14 + w, 24, -18 - w);
    ctx.lineTo(24, 4 - w);
    ctx.quadraticCurveTo(0, 8 + w, -20, 4);
    ctx.closePath();
    ctx.stroke();
  } else if (p.visual === "star") {
    ctx.rotate(p.spin);
    star(ctx, 0, 0, p.r + 4, p.color);
    star(ctx, 0, 0, (p.r + 4) * 0.5, "#fff200");
  } else if (p.visual === "burger") {
    ctx.rotate(Math.sin(p.spin) * 0.3);
    ctx.fillStyle = "#e8a94c";
    ctx.beginPath();
    ctx.ellipse(0, -6, 20, 12, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6ac16a";
    ctx.beginPath();
    ctx.ellipse(0, -1, 21, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7a4a2b";
    roundRect(ctx, -19, 1, 38, 8, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8a94c";
    ctx.beginPath();
    ctx.ellipse(0, 11, 19, 7, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff3c4";
    for (const sx of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.ellipse(sx, -12, 2.4, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(-p.r * 1.3, 0, p.r * 1.5, p.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.rotate(p.spin);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.72, 0.5, 2.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D, r: Ring): void {
  const k = r.life / r.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.max(0, k);
  ctx.strokeStyle = r.color;
  ctx.lineWidth = r.width * k + 1;
  ctx.beginPath();
  if (r.ground) ctx.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2);
  else ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, r.width * k * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, b: Burst): void {
  const k = b.life / b.maxLife;
  const size = b.size * (1.15 - k * 0.35);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = Math.min(1, k * 1.6);
  ctx.beginPath();
  for (let i = 0; i < b.spikes * 2; i++) {
    const a = (i / (b.spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? size : size * 0.42;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = b.color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < b.spikes * 2; i++) {
    const a = (i / (b.spikes * 2)) * Math.PI * 2;
    const rr = (i % 2 === 0 ? size : size * 0.42) * 0.5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, pt: Particle): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
  ctx.fillStyle = pt.color;
  if (pt.shape === "square") {
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.life * 0.2);
    ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
  } else if (pt.shape === "streak") {
    ctx.strokeStyle = pt.color;
    ctx.lineWidth = pt.size * 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x - pt.vx * 2.4, pt.y - pt.vy * 2.4);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWords(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  for (const w of game.words) {
    const pop = 1 + Math.max(0, (w.life - w.maxLife + 8) / 8) * 0.55;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, w.life / 12);
    ctx.font = DISPLAY(w.size);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = w.size / 5;
    ctx.strokeStyle = INK;
    ctx.strokeText(w.text, 0, 0);
    ctx.lineWidth = w.size / 12;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(w.text, 0, 0);
    ctx.fillStyle = w.color;
    ctx.fillText(w.text, 0, 0);
    ctx.restore();
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    const rest = text.slice(lines.join(" ").length).trim();
    if (rest) {
      while (last.length > 4 && ctx.measureText(`${last}...`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}...`;
    }
  }
  return lines;
}

function drawBubbles(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const stacked = game.bubbles.length > 1;
  for (const b of game.bubbles) {
    const f = game.fighters[b.side];
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 14);
    ctx.font = DISPLAY(17);
    ctx.textAlign = "center";
    const lines = wrapLines(ctx, b.text, 200, 2);
    const wText = Math.max(
      92,
      Math.min(230, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28)
    );
    const hText = 14 + lines.length * 21;
    const bx = Math.max(wText / 2 + 12, Math.min(ARENA_W - wText / 2 - 12, f.x + f.facing * 52));
    const by =
      f.y - (game.phase === "ko" ? 148 : 224) - (stacked && b.side === 1 ? hText + 20 : 0);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    roundRect(ctx, bx - wText / 2, by - hText - 8, wText, hText, 14);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - 10);
    ctx.lineTo(bx + 2, by + 9);
    ctx.lineTo(bx + 12, by - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = INK;
    lines.forEach((line, i) => {
      ctx.fillText(line, bx, by - hText + 13 + i * 21);
    });
    ctx.restore();
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, game: WorldBattle): void {
  const [a, b] = game.fighters;

  hudSide(ctx, a, 0);
  hudSide(ctx, b, 1);

  const secs = Math.ceil(game.framesLeft / 60);
  const cx = ARENA_W / 2;
  ctx.save();
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.arc(cx, 52, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff3c4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, 52, 36, -Math.PI / 2, -Math.PI / 2 + (game.framesLeft / (ROUND_FRAMES)) * Math.PI * 2);
  ctx.stroke();
  ctx.font = DISPLAY(38);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeText(String(secs).padStart(2, "0"), cx, 54);
  ctx.fillStyle = secs <= 10 ? "#ff5252" : "#ffffff";
  ctx.fillText(String(secs).padStart(2, "0"), cx, 54);
  ctx.textBaseline = "alphabetic";
  ctx.restore();

  for (const f of game.fighters) {
    if (f.comboHits >= 2 && f.comboTimer > 0 && game.phase === "fight") {
      const side = f.index === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(ARENA_W / 2 + side * 240, 172);
      ctx.rotate(side * 0.06);
      ctx.textAlign = "center";
      ctx.font = DISPLAY(44);
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.strokeText(String(f.comboHits), 0, 0);
      ctx.fillStyle = "#ff8ce0";
      ctx.fillText(String(f.comboHits), 0, 0);
      ctx.font = DISPLAY(18);
      ctx.lineWidth = 5;
      ctx.strokeText("HIT COMBO", 0, 22);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("HIT COMBO", 0, 22);
      ctx.restore();
    }
  }

  ctx.textAlign = "center";
  if (game.phase === "intro") {
    const ready = game.phaseTimer > 45;
    const text = ready ? "READY..." : "FIGHT!";
    const k = ready
      ? 1
      : 1 + Math.max(0, (45 - game.phaseTimer) < 10 ? (10 - (45 - game.phaseTimer)) / 10 : 0) * 0.5;
    ctx.save();
    ctx.translate(ARENA_W / 2, ARENA_H / 2 - 20);
    ctx.scale(k, k);
    ctx.font = DISPLAY(86);
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = ready ? "#ffd166" : "#ff2a2a";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else if (game.phase === "ko") {
    const label =
      game.winner === null ? "IT'S A DRAW!" : `${game.fighters[game.winner].def.name} WINS!`;
    ctx.save();
    ctx.translate(ARENA_W / 2, ARENA_H / 2 - 30);
    ctx.rotate(Math.sin(game.tick * 0.05) * 0.02);
    ctx.font = DISPLAY(58);
    ctx.lineJoin = "round";
    ctx.lineWidth = 11;
    ctx.strokeStyle = INK;
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(label, 0, 0);
    ctx.font = DISPLAY(24);
    ctx.lineWidth = 7;
    ctx.strokeText("Press R for a rematch", 0, 44);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Press R for a rematch", 0, 44);
    ctx.restore();
  }
}

function hudSide(
  ctx: CanvasRenderingContext2D, f: Fighter, side: 0 | 1
): void {
  const mirrored = side === 1;
  const w = 356;
  const x = mirrored ? ARENA_W - 24 - w : 24;
  const y = 24;

  ctx.save();
  ctx.fillStyle = "#141414";
  roundRect(ctx, x - 4, y - 4, w + 8, 38, 9);
  ctx.fill();

  ctx.save();
  if (mirrored) {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.fillStyle = "#3a1420";
  roundRect(ctx, x, y, w, 30, 6);
  ctx.fill();

  const ghost = Math.max(0, Math.min(1, cam.ghost[side]));
  const ratio = Math.max(0, Math.min(1, f.hp / f.maxHp));
  if (ghost > ratio) {
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, y, ghost * w, 30, 6);
    ctx.fill();
  }
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "#ff2a2a");
  grad.addColorStop(0.45, "#ffb703");
  grad.addColorStop(1, "#2dd4a7");
  ctx.fillStyle = grad;
  if (ratio * w > 3) {
    roundRect(ctx, x, y, ratio * w, 30, 6);
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, Math.max(0, ratio * w), 30, 6);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#ffffff";
  for (let i = -30; i < w; i += 16) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + 30);
    ctx.lineTo(x + i + 10, y + 30);
    ctx.lineTo(x + i + 24, y);
    ctx.lineTo(x + i + 14, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 2, y + 2, w - 4, 26, 5);
  ctx.stroke();

  ctx.font = DISPLAY(21);
  ctx.textAlign = mirrored ? "right" : "left";
  const nameX = mirrored ? x + w : x;
  const nameW = ctx.measureText(f.def.name).width + 22;
  ctx.fillStyle = f.def.look.accent;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, mirrored ? nameX - nameW : nameX, y + 34, nameW, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.strokeText(f.def.name, mirrored ? nameX - 11 : nameX + 11, y + 53);
  ctx.fillText(f.def.name, mirrored ? nameX - 11 : nameX + 11, y + 53);

  const cd = SPECIAL_DATA[f.def.special.type].cooldown;
  const readiness = 1 - Math.max(0, Math.min(1, f.cooldown / cd));
  const bx = mirrored ? x + w - 150 : x;
  ctx.fillStyle = "#141414";
  roundRect(ctx, bx - 3, y + 65, 156, 16, 5);
  ctx.fill();
  ctx.fillStyle = readiness >= 1 ? "#2dd4a7" : "#7a7f88";
  roundRect(ctx, bx, y + 68, 150 * readiness, 10, 4);
  ctx.fill();
  ctx.font = DISPLAY(13);
  ctx.textAlign = mirrored ? "right" : "left";
  ctx.fillStyle = "#141414";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  const label = f.def.special.name.slice(0, 22);
  ctx.strokeText(label, mirrored ? x + w : x, y + 94);
  ctx.fillText(label, mirrored ? x + w : x, y + 94);

  if (f.buff > 0) {
    const aiMode = f.def.special.type === "ai";
    statusChip(ctx, mirrored, x, w, y + 100, aiMode ? "AI MODE" : "POWERED UP", aiMode ? "#7ffcb0" : f.def.look.accent);
  } else if (f.confused > 0) statusChip(ctx, mirrored, x, w, y + 100, "CONFUSED", "#b388ff");
  else if (f.sleeping > 0) statusChip(ctx, mirrored, x, w, y + 100, "ASLEEP", "#7ec8ff");

  ctx.restore();
}

function statusChip(
  ctx: CanvasRenderingContext2D, mirrored: boolean,
  x: number, w: number, y: number, text: string, color: string
): void {
  ctx.font = DISPLAY(14);
  ctx.textAlign = mirrored ? "right" : "left";
  const tw = ctx.measureText(text).width + 16;
  const bx = mirrored ? x + w - tw : x;
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  roundRect(ctx, bx, y, tw, 19, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#141414";
  ctx.fillText(text, mirrored ? x + w - 8 : x + 8, y + 14);
}

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
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  for (let i = -2; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 20, 0);
    ctx.lineTo(i * 20 + 40, h);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(w / 2, h * 0.92);
  const scale = Math.min(w / 108, h / 132) * 1.02;
  ctx.scale(scale, scale);

  const look = def.look;
  const bodyW = look.build === "wide" ? 62 : look.build === "slim" ? 46 : 54;
  ctx.fillStyle = look.suit;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2, -18);
  ctx.quadraticCurveTo(-bodyW / 2 - 5, 8, -bodyW / 2 - 2, 24);
  ctx.lineTo(bodyW / 2 + 2, 24);
  ctx.quadraticCurveTo(bodyW / 2 + 5, 8, bodyW / 2, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fdfdfd";
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(10, -18);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.tie;
  ctx.beginPath();
  ctx.moveTo(-4, -17);
  ctx.lineTo(4, -17);
  ctx.lineTo(6, -8);
  ctx.lineTo(3, 16);
  ctx.lineTo(-3, 16);
  ctx.lineTo(-6, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.translate(0, -46);
  ctx.scale(0.86, 0.86);
  drawFace(ctx, look, "smug", 0);
  ctx.restore();
}

function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))))
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function hexA(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
