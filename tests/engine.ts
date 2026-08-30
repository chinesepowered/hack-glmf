// World Battle fight engine — a fixed-timestep (60 Hz) 2D fighter.
// Pure simulation: no DOM, no canvas, no timers. The React component feeds it
// Inputs and calls step() once per frame; the renderer reads public fields.

import type { CharacterDef, SpecialType, SpecialVisual } from "./types.ts";

export const ARENA_W = 960;
export const ARENA_H = 540;
export const GROUND_Y = 462;
export const WALL_PAD = 46;
export const ROUND_SECONDS = 99;

export type FighterState =
  | "idle"
  | "walk"
  | "jump"
  | "block"
  | "attack"
  | "hit"
  | "launched"
  | "ko";
export type BattlePhase = "intro" | "fight" | "ko";
export type AttackKind = "punch" | "kick" | "special" | "riposte";

export interface Inputs {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
}

export function emptyInputs(): Inputs {
  return { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false };
}

interface AttackSpec {
  startup: number;
  active: number;
  recovery: number;
  range: number;
  damage: number;
  kbX: number;
  kbY: number;
  hitstun: number;
}

const PUNCH: AttackSpec = { startup: 4, active: 4, recovery: 7, range: 66, damage: 6, kbX: 3.4, kbY: 0, hitstun: 12 };
const KICK: AttackSpec = { startup: 8, active: 5, recovery: 13, range: 94, damage: 10, kbX: 7, kbY: -4.5, hitstun: 18 };
const AIR_PUNCH: AttackSpec = { startup: 3, active: 7, recovery: 5, range: 62, damage: 7, kbX: 4, kbY: 2, hitstun: 14 };
const AIR_KICK: AttackSpec = { startup: 6, active: 9, recovery: 8, range: 88, damage: 11, kbX: 7.5, kbY: 3, hitstun: 20 };

const GRAVITY = 0.85;
const JUMP_VY = -17.5;
const AIR_JUMP_VY = -15;
const WALK_SPEED = 3.6;
const COMBO_WINDOW = 72;
const MIN_COMBO_SCALE = 0.4;
const MAX_WORDS = 2;

export interface SpecialTiming {
  total: number;
  cooldown: number;
}

export const SPECIAL_DATA: Record<SpecialType, SpecialTiming> = {
  projectile: { total: 32, cooldown: 40 },
  dash: { total: 40, cooldown: 52 },
  buff: { total: 30, cooldown: 110 },
  shockwave: { total: 42, cooldown: 58 },
  confuse: { total: 34, cooldown: 50 },
  nap: { total: 100, cooldown: 80 },
  vanish: { total: 34, cooldown: 44 },
  uppercut: { total: 40, cooldown: 50 },
  barrage: { total: 58, cooldown: 66 },
  counter: { total: 44, cooldown: 54 },
  ai: { total: 40, cooldown: 110 },
};

export type AiAction =
  | "approach"
  | "retreat"
  | "attack"
  | "block"
  | "jump"
  | "special"
  | "antiair"
  | "wait";

export interface Fighter {
  def: CharacterDef;
  index: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  state: FighterState;
  stateFrame: number;
  attackKind: AttackKind | null;
  airborneAttack: boolean;
  hasHit: boolean;
  hitCount: number;
  hitstun: number;
  cooldown: number;
  confused: number;
  buff: number;
  invuln: number; // untouchable frames (Identity Shift)
  sleeping: number; // napping frames (Sleepy Joe: half damage taken)
  armor: number;
  parry: number;
  blockStun: number;
  flashFrames: number;
  comboHits: number;
  comboTimer: number;
  jumps: number;
  heldUp: boolean;
  walkPhase: number;
  hairPhase: number;
  aiTimer: number;
  aiReact: number;
  aiAction: AiAction;
  aiPress: "punch" | "kick" | null;
}

export interface Projectile {
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grow: number;
  life: number;
  maxLife: number;
  damage: number;
  color: string;
  kind: "projectile" | "shockwave";
  visual: SpecialVisual; // how the renderer draws the projectile
  spin: number;
  hasHit: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
  shape: "dot" | "square" | "streak";
}

export interface Word {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  rot: number;
  size: number;
  color: string;
}

export interface Bubble {
  text: string;
  side: 0 | 1;
  life: number;
  maxLife: number;
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
  ground: boolean;
}

export interface Ghost {
  x: number;
  y: number;
  facing: 1 | -1;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface Burst {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  spikes: number;
  rot: number;
}

const HIT_WORDS = ["POW!", "BAM!", "WHAM!", "SOCK!", "BONK!", "ZAP!", "KRAK!", "THWAP!"];

export class WorldBattle {
  fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  words: Word[] = [];
  bubbles: Bubble[] = [];
  rings: Ring[] = [];
  ghosts: Ghost[] = [];
  bursts: Burst[] = [];
  shake = 0;
  flash = 0;
  flashColor = "#ffffff";
  phase: BattlePhase = "intro";
  phaseTimer = 110;
  framesLeft = ROUND_SECONDS * 60;
  winner: number | null = null;
  cpu: boolean;
  tick = 0;
  hitstop = 0; // impact-freeze frames for punchy game feel
  slowmo = 0;
  seed: number;

  private inputP1: Inputs = emptyInputs();
  private inputP2: Inputs = emptyInputs();
  private rngState: number;

  constructor(defs: [CharacterDef, CharacterDef], cpu: boolean, seed?: number) {
    this.cpu = cpu;
    this.seed = seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.rngState = this.seed || 1;
    this.fighters = [
      createFighter(defs[0], 0, ARENA_W * 0.32, 1),
      createFighter(defs[1], 1, ARENA_W * 0.68, -1),
    ];
    for (const f of this.fighters) this.say(f.index, f.def.intro, 130);
  }

  setInputs(p1: Inputs, p2: Inputs): void {
    this.inputP1 = p1;
    this.inputP2 = p2;
  }

  private rand(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private randRange(a: number, b: number): number {
    return a + this.rand() * (b - a);
  }

  step(): void {
    this.tick++;
    this.shake *= 0.88;
    if (this.shake < 0.3) this.shake = 0;
    this.flash *= 0.82;
    if (this.flash < 0.02) this.flash = 0;

    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateOverlays();
      return;
    }

    if (this.slowmo > 0) {
      this.slowmo--;
      if (this.tick % 3 !== 0) {
        this.updateOverlays();
        return;
      }
    }

    if (this.phase === "intro") {
      this.phaseTimer--;
      if (this.phaseTimer <= 0) this.phase = "fight";
      this.updateEffects();
      return;
    }

    if (this.phase === "ko") {
      this.phaseTimer--;
      for (const f of this.fighters) this.applyPhysics(f);
      this.updateEffects();
      this.updateProjectiles();
      return;
    }

    this.framesLeft = Math.max(0, this.framesLeft - 1);
    const [a, b] = this.fighters;
    const in1 = this.inputP1;
    const in2 = this.cpu ? this.aiInputs(1) : this.inputP2;

    this.updateFighter(a, b, in1);
    this.updateFighter(b, a, in2);
    this.separate(a, b);
    this.applyPhysics(a);
    this.applyPhysics(b);
    this.updateProjectiles();
    this.updateEffects();

    if (a.hp <= 0 || b.hp <= 0) {
      this.endRound(a.hp <= 0 ? (b.hp <= 0 ? null : 1) : 0);
    } else if (this.framesLeft === 0) {
      const fa = a.hp / a.maxHp;
      const fb = b.hp / b.maxHp;
      this.endRound(fa === fb ? null : fa > fb ? 0 : 1);
    }
  }

  private endRound(winner: 0 | 1 | null): void {
    if (this.phase === "ko") return;
    this.phase = "ko";
    this.winner = winner;
    this.phaseTimer = 9999;
    this.shake = 22;
    this.flash = 1;
    this.flashColor = "#ffffff";
    this.slowmo = 80;
    const loser = winner === null ? null : winner === 0 ? 1 : 0;
    if (winner !== null && loser !== null) {
      const lf = this.fighters[loser];
      lf.state = "ko";
      lf.stateFrame = 0;
      lf.vy = -11;
      lf.vx = -lf.facing * 6;
      const wf = this.fighters[winner];
      this.say(winner, wf.def.win, 260);
      this.words.length = 0;
      this.spawnWord("K.O.!", wf.x, 196, "#ff2a2a", 76, true);
      this.spawnBurst(lf.x, lf.y - 80, 96, "#fff200", 12);
      this.spawnRing(lf.x, lf.y - 70, 20, 9, 40, "#ffffff", 10, false);
      this.confetti();
    } else {
      this.words.length = 0;
      this.spawnWord("DRAW!", ARENA_W / 2, 196, "#ffd166", 68, true);
      this.confetti();
    }
  }

  private confetti(): void {
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: this.randRange(0, ARENA_W),
        y: this.randRange(-140, 0),
        vx: this.randRange(-1.4, 1.4),
        vy: this.randRange(1.5, 4.5),
        life: 120 + Math.floor(this.rand() * 90),
        maxLife: 210,
        color: `hsl(${Math.floor(this.rand() * 360)} 85% 60%)`,
        size: this.randRange(3, 7),
        gravity: 0.02,
        shape: "square",
      });
    }
  }

  private effSpeed(f: Fighter): number {
    const buffed = f.buff > 0 ? 1.3 : 1;
    const dazed = f.confused > 0 ? 0.85 : 1;
    return f.def.stats.speed * buffed * dazed;
  }

  private effPower(f: Fighter): number {
    return f.def.stats.power * (f.buff > 0 ? 1.35 : 1);
  }

  private comboScale(f: Fighter): number {
    return Math.max(MIN_COMBO_SCALE, 1 - f.comboHits * 0.09);
  }

  private updateFighter(f: Fighter, opp: Fighter, input: Inputs): void {
    if (f.confused > 0) f.confused--;
    if (f.buff > 0) f.buff--;
    if (f.invuln > 0) f.invuln--;
    if (f.sleeping > 0) f.sleeping--;
    if (f.cooldown > 0) f.cooldown--;
    if (f.armor > 0) f.armor--;
    if (f.parry > 0) f.parry--;
    if (f.blockStun > 0) f.blockStun--;
    if (f.flashFrames > 0) f.flashFrames--;
    if (f.comboTimer > 0 && --f.comboTimer === 0) f.comboHits = 0;
    f.stateFrame++;
    f.hairPhase += 0.12 + Math.abs(f.vx) * 0.02;

    if (f.buff > 0 && this.tick % 4 === 0) {
      this.particles.push({
        x: f.x + this.randRange(-24, 24),
        y: f.y - this.randRange(0, 130),
        vx: this.randRange(-0.5, 0.5),
        vy: -this.randRange(1, 2.6),
        life: 18,
        maxLife: 18,
        color: f.def.look.accent,
        size: this.randRange(2, 5),
        gravity: -0.02,
        shape: "dot",
      });
    }

    if (f.state === "ko") return;

    const onGround = f.y >= GROUND_Y - 0.01;
    if (onGround) f.jumps = 0;

    // Confusion scrambles left/right (the classic Memory Loss effect).
    const left = f.confused > 0 ? input.right : input.left;
    const right = f.confused > 0 ? input.left : input.right;
    const jumpPressed = input.up && !f.heldUp;
    f.heldUp = input.up;

    if (f.state === "launched") {
      if (onGround && f.vy >= 0) {
        f.state = "hit";
        f.stateFrame = 0;
        f.hitstun = 16;
        this.dust(f.x, GROUND_Y, 10);
        this.shake = Math.max(this.shake, 5);
      }
      return;
    }

    if (f.state === "hit") {
      if (f.stateFrame >= f.hitstun && onGround) f.state = "idle";
      return;
    }

    if (f.state === "attack") {
      this.updateAttack(f, opp);
      return;
    }

    if (f.blockStun > 0) {
      f.state = "block";
      f.vx *= 0.7;
      return;
    }

    if (onGround) f.facing = opp.x >= f.x ? 1 : -1;

    if (onGround && input.down) {
      f.state = "block";
      f.vx = 0;
      return;
    }

    if (f.cooldown <= 0) {
      if (input.punch) return this.startAttack(f, "punch", !onGround);
      if (input.kick) return this.startAttack(f, "kick", !onGround);
      if (input.special && onGround) return this.startSpecial(f, opp);
    }

    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (onGround) {
      if (dir !== 0) {
        f.vx = dir * WALK_SPEED * this.effSpeed(f);
        f.state = "walk";
        f.walkPhase += 0.25 * this.effSpeed(f);
      } else {
        f.vx = 0;
        f.state = "idle";
      }
      if (jumpPressed) {
        f.vy = JUMP_VY;
        f.state = "jump";
        f.jumps = 1;
        this.dust(f.x, GROUND_Y, 5);
      }
    } else {
      f.state = "jump";
      if (dir !== 0) f.vx += dir * 0.38 * this.effSpeed(f);
      f.vx = Math.max(-7.5, Math.min(7.5, f.vx));
      if (jumpPressed && f.jumps < 2) {
        f.vy = AIR_JUMP_VY;
        f.jumps++;
        this.spawnRing(f.x, f.y - 30, 8, 3.4, 14, f.def.look.accent, 4, false);
      }
    }
  }

  private startAttack(f: Fighter, kind: "punch" | "kick", airborne: boolean): void {
    f.state = "attack";
    f.attackKind = kind;
    f.airborneAttack = airborne;
    f.stateFrame = 0;
    f.hasHit = false;
    f.hitCount = 0;
    f.cooldown = kind === "punch" ? 15 : 24;
  }

  private startSpecial(f: Fighter, opp: Fighter): void {
    const sp = f.def.special;
    f.state = "attack";
    f.attackKind = "special";
    f.airborneAttack = false;
    f.stateFrame = 0;
    f.hasHit = false;
    f.hitCount = 0;
    f.cooldown = SPECIAL_DATA[sp.type].cooldown;
    f.facing = opp.x >= f.x ? 1 : -1;
    this.say(f.index, sp.taunt, 150);
    this.spawnWord(`${sp.name}!`, f.x, 128, f.def.look.accent, 30);
    this.spawnRing(f.x, f.y - 70, 14, 5.5, 22, f.def.look.accent, 6, false);
    this.flashScreen(0.18, f.def.look.accent);
    if (sp.type === "dash" || sp.type === "shockwave" || sp.type === "barrage") {
      this.shake = Math.max(this.shake, 6);
    }
    if (sp.type === "ai") this.flash = Math.max(this.flash, 0.28);
  }

  private updateAttack(f: Fighter, opp: Fighter): void {
    const kind = f.attackKind;

    if (kind === "riposte") {
      if (f.stateFrame >= 26) this.endAttack(f);
      return;
    }

    if (kind === "punch" || kind === "kick") {
      const air = f.airborneAttack;
      const spec = kind === "punch" ? (air ? AIR_PUNCH : PUNCH) : air ? AIR_KICK : KICK;
      if (!air && f.stateFrame <= spec.startup) f.vx = f.facing * (kind === "punch" ? 2.0 : 2.8);
      if (f.stateFrame > spec.startup && f.stateFrame <= spec.startup + spec.active && !f.hasHit) {
        this.tryMeleeHit(f, opp, {
          range: spec.range,
          damage: spec.damage * this.effPower(f),
          kbX: spec.kbX,
          kbY: spec.kbY,
          hitstun: spec.hitstun,
          color: kind === "kick" ? "#ffd166" : "#ffffff",
          yOffset: air ? -40 : -70,
        });
        if (f.state !== "attack") return;
      }
      if (f.stateFrame >= spec.startup + spec.active + spec.recovery) this.endAttack(f);
      return;
    }

    const sp = f.def.special;
    const pw = sp.power;
    const total = SPECIAL_DATA[sp.type].total;
    const p = f.stateFrame;

    switch (sp.type) {
      case "projectile": {
        if (p >= 4 && p < 12 && p % 2 === 0) {
          this.spawnSpark(f.x + f.facing * 40, f.y - 86, f.def.look.accent, 3);
        }
        if (p === 12) {
          this.projectiles.push({
            owner: f.index,
            x: f.x + f.facing * 46,
            y: f.y - 84,
            vx: f.facing * 10,
            vy: 0,
            r: 19,
            grow: 0,
            life: 130,
            maxLife: 130,
            damage: 11 * pw * this.effPower(f),
            color: f.def.look.accent,
            kind: "projectile",
            visual: sp.visual ?? "energy",
            spin: 0,
            hasHit: false,
          });
          this.spawnRing(f.x + f.facing * 46, f.y - 84, 10, 4, 16, f.def.look.accent, 5, false);
          this.shake = Math.max(this.shake, 4);
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "dash": {
        if (p >= 6 && p <= 26) {
          f.armor = 3;
          f.vx = f.facing * 15;
          if (p % 2 === 0) this.spawnGhost(f);
          if (!f.hasHit) {
            const hit = this.tryMeleeHit(f, opp, {
              range: 76,
              damage: 15 * pw * this.effPower(f),
              kbX: 13,
              kbY: -6,
              hitstun: 26,
              color: f.def.look.accent,
            });
            if (f.state !== "attack") return;
            if (hit) {
              this.shake = Math.max(this.shake, 14);
              this.spawnBurst(opp.x, opp.y - 70, 60, f.def.look.accent, 9);
              f.stateFrame = Math.max(f.stateFrame, 28);
            }
          }
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "buff": {
        if (p === 10) {
          f.buff = 240;
          this.spawnWord("POWER UP!", f.x, f.y - 190, f.def.look.accent, 30);
          this.spawnSpark(f.x, f.y - 60, f.def.look.accent, 24);
          this.spawnRing(f.x, f.y - 70, 12, 6, 26, f.def.look.accent, 8, false);
          this.spawnRing(f.x, GROUND_Y, 16, 7, 24, f.def.look.accent, 6, true);
          this.flashScreen(0.3, f.def.look.accent);
          this.shake = Math.max(this.shake, 7);
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "shockwave": {
        if (p === 14) {
          // Yelling heals you a little (Obama's healthcare energy).
          f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.08);
          this.shake = Math.max(this.shake, 15);
          this.flashScreen(0.35, f.def.look.accent);
          this.spawnSpark(f.x, f.y - 40, f.def.look.accent, 20);
          this.spawnRing(f.x, GROUND_Y, 18, 9, 30, f.def.look.accent, 9, true);
          for (const dir of [1, -1] as const) {
            this.projectiles.push({
              owner: f.index,
              x: f.x + dir * 26,
              y: GROUND_Y,
              vx: dir * 7,
              vy: 0,
              r: 26,
              grow: 1.1,
              life: 46,
              maxLife: 46,
              damage: 13 * pw * this.effPower(f),
              color: f.def.look.accent,
              kind: "shockwave",
              visual: "energy",
              spin: 0,
              hasHit: false,
            });
          }
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "confuse": {
        if (p >= 8 && p <= 22 && !f.hasHit) {
          const hit = this.tryMeleeHit(f, opp, {
            range: 96,
            damage: 6 * pw * this.effPower(f),
            kbX: 2,
            kbY: 0,
            hitstun: 16,
            color: "#b388ff",
          });
          if (f.state !== "attack") return;
          if (hit) {
            opp.confused = 280;
            this.spawnRing(opp.x, opp.y - 80, 10, 5, 24, "#b388ff", 6, false);
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * Math.PI * 2;
              this.particles.push({
                x: opp.x + Math.cos(a) * 30,
                y: opp.y - 80 + Math.sin(a) * 30,
                vx: Math.cos(a) * 2,
                vy: Math.sin(a) * 2,
                life: 26,
                maxLife: 26,
                color: "#b388ff",
                size: 4,
                gravity: -0.03,
                shape: "dot",
              });
            }
          }
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "nap": {
        // Sleepy Joe: doze off on the spot — heal over time, take half damage,
        // and on waking the opponent forgets what they were doing.
        if (p <= 80) {
          f.sleeping = 2;
          f.vx *= 0.7;
          f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.0022);
        }
        if (p === 82) {
          this.spawnWord("WAKE UP!", f.x, f.y - 194, f.def.look.accent, 28);
          this.spawnRing(f.x, f.y - 70, 14, 8, 26, f.def.look.accent, 8, false);
          this.shake = Math.max(this.shake, 9);
          f.sleeping = 0;
          if (opp.state !== "ko" && Math.abs(opp.x - f.x) < 170) {
            this.applyHit(f, opp, {
              damage: 9 * pw * this.effPower(f),
              kbX: 10,
              kbY: -8,
              hitstun: 24,
              color: f.def.look.accent,
              dir: opp.x >= f.x ? 1 : -1,
            });
          }
          if (opp.state !== "ko") opp.confused = 200;
        }
        if (p >= total) {
          f.sleeping = 0;
          this.endAttack(f);
        }
        break;
      }

      case "vanish": {
        // Identity Shift: untouchable for a moment, then slip behind the opponent.
        if (p === 4) {
          f.invuln = 42;
          f.vx = 0;
          this.spawnSpark(f.x, f.y - 60, f.def.look.accent, 18);
          this.spawnRing(f.x, f.y - 70, 10, 6, 20, f.def.look.accent, 6, false);
        }
        if (p > 4 && p < 14 && p % 2 === 0) this.spawnGhost(f);
        if (p === 14) {
          const side: 1 | -1 = opp.x >= f.x ? 1 : -1;
          const from = f.x;
          const dest = clampX(opp.x + side * 70);
          for (let i = 1; i <= 5; i++) {
            this.spawnGhostAt(from + ((dest - from) * i) / 6, f.y, f.facing, f.def.look.accent);
          }
          f.x = dest;
          f.facing = opp.x >= f.x ? 1 : -1;
          this.spawnSpark(f.x, f.y - 60, f.def.look.accent, 18);
        }
        if (p === 20 && !f.hasHit) {
          const hit = this.tryMeleeHit(f, opp, {
            range: 86,
            damage: 12 * pw * this.effPower(f),
            kbX: 9,
            kbY: -7,
            hitstun: 26,
            color: f.def.look.accent,
            unblockable: true,
          });
          if (f.state !== "attack") return;
          if (hit) this.spawnBurst(opp.x, opp.y - 70, 54, f.def.look.accent, 8);
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "uppercut": {
        if (p === 8) {
          f.vy = -14.5;
          f.invuln = 14;
          f.vx = f.facing * 3.5;
          this.dust(f.x, GROUND_Y, 10);
          this.spawnRing(f.x, GROUND_Y, 12, 5, 18, f.def.look.accent, 6, true);
        }
        if (p > 8 && p <= 20) {
          if (p % 3 === 0) this.spawnGhost(f);
          if (!f.hasHit) {
            const hit = this.tryMeleeHit(f, opp, {
              range: 80,
              damage: 14 * pw * this.effPower(f),
              kbX: 4,
              kbY: -17,
              hitstun: 32,
              color: f.def.look.accent,
              launch: true,
              yOffset: -60,
              yTolerance: 110,
            });
            if (f.state !== "attack") return;
            if (hit) {
              this.spawnBurst(opp.x, opp.y - 80, 58, "#fff200", 8);
              this.shake = Math.max(this.shake, 12);
            }
          }
        }
        if (p >= 22 && f.y >= GROUND_Y - 0.01) {
          this.dust(f.x, GROUND_Y, 8);
          this.endAttack(f);
        } else if (p >= total + 20) {
          this.endAttack(f);
        }
        break;
      }

      case "barrage": {
        if (p >= 8 && p <= 44) {
          f.armor = 3;
          f.vx = f.facing * 1.8;
          if (p % 4 === 0) {
            f.hasHit = false;
            const hit = this.tryMeleeHit(f, opp, {
              range: 74,
              damage: 4.2 * pw * this.effPower(f),
              kbX: 1.4,
              kbY: 0,
              hitstun: 9,
              color: f.def.look.accent,
              micro: true,
            });
            if (f.state !== "attack") return;
            if (hit) f.hitCount++;
          }
        }
        if (p === 48) {
          f.hasHit = false;
          const hit = this.tryMeleeHit(f, opp, {
            range: 84,
            damage: 11 * pw * this.effPower(f),
            kbX: 12,
            kbY: -12,
            hitstun: 30,
            color: f.def.look.accent,
            launch: true,
          });
          if (f.state !== "attack") return;
          if (hit) {
            this.spawnBurst(opp.x, opp.y - 70, 64, f.def.look.accent, 10);
            this.shake = Math.max(this.shake, 14);
          }
        }
        if (p >= total) this.endAttack(f);
        break;
      }

      case "counter": {
        if (p >= 4 && p <= 30) f.parry = 3;
        if (p >= total) this.endAttack(f);
        break;
      }

      case "ai": {
        // Open-source the opponent's moves: overclock yourself for a while
        // (speed + power) and scramble their controls by "reading their source".
        if (p === 8) {
          f.buff = Math.max(f.buff, 200);
          f.vx = 0;
          opp.confused = Math.max(opp.confused, 90);
          this.spawnWord("OPEN SOURCE!", f.x, f.y - 190, f.def.look.accent, 32);
          this.spawnSpark(f.x, f.y - 60, f.def.look.accent, 24);
          this.spawnRing(f.x, f.y - 70, 12, 6, 26, f.def.look.accent, 8, false);
          this.spawnRing(f.x, GROUND_Y, 16, 7, 24, f.def.look.accent, 6, true);
          this.flashScreen(0.4, f.def.look.accent);
          this.shake = Math.max(this.shake, 9);
        }
        if (p >= total) this.endAttack(f);
        break;
      }
    }
  }

  private endAttack(f: Fighter): void {
    f.attackKind = null;
    f.airborneAttack = false;
    f.hasHit = false;
    f.state = f.y >= GROUND_Y - 0.01 ? "idle" : "jump";
  }

  /** Attempts a body hitbox check; returns true if the opponent was struck. */
  private tryMeleeHit(
    f: Fighter,
    opp: Fighter,
    o: {
      range: number;
      damage: number;
      kbX: number;
      kbY: number;
      hitstun: number;
      color: string;
      launch?: boolean;
      unblockable?: boolean;
      micro?: boolean;
      yOffset?: number;
      yTolerance?: number;
    }
  ): boolean {
    if (opp.state === "ko" || opp.invuln > 0) return false;
    const hx = f.x + f.facing * (o.range / 2 + 14);
    const hy = f.y + (o.yOffset ?? -70);
    const oy = opp.y - 60;
    const tol = o.yTolerance ?? 74;
    if (Math.abs(hx - opp.x) >= o.range / 2 + 26 || Math.abs(hy - oy) >= tol) return false;
    f.hasHit = true;
    return this.applyHit(f, opp, o);
  }

  private applyHit(
    attacker: Fighter,
    defender: Fighter,
    o: {
      damage: number;
      kbX: number;
      kbY: number;
      hitstun: number;
      color: string;
      launch?: boolean;
      unblockable?: boolean;
      micro?: boolean;
      dir?: 1 | -1;
      allowCounter?: boolean;
    }
  ): boolean {
    if (defender.state === "ko" || defender.invuln > 0) return false;
    const dir: 1 | -1 = o.dir ?? attacker.facing;

    if (o.allowCounter !== false && defender.parry > 0) {
      defender.parry = 0;
      this.triggerRiposte(defender, attacker, dir);
      return false;
    }

    const onGround = defender.y >= GROUND_Y - 0.01;
    const facingHit = defender.facing === -dir;
    if (!o.unblockable && defender.state === "block" && onGround && facingHit) {
      defender.hp = Math.max(0, defender.hp - Math.max(1, o.damage * 0.14));
      defender.vx += dir * o.kbX * 0.4;
      defender.blockStun = Math.max(defender.blockStun, o.micro ? 4 : 10);
      this.spawnSpark(defender.x - dir * 18, defender.y - 80, "#9ad0ec", 6);
      this.spawnRing(defender.x - dir * 16, defender.y - 80, 8, 3.5, 12, "#9ad0ec", 4, false);
      this.shake = Math.max(this.shake, 2);
      this.hitstop = Math.max(this.hitstop, 1);
      attacker.comboHits = 0;
      attacker.comboTimer = 0;
      return true;
    }

    const scale = this.comboScale(attacker);
    let dmg = o.damage * scale;
    // Napping fighters sleep through half the pain (Sleepy Joe).
    if (defender.sleeping > 0) dmg *= 0.5;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.flashFrames = 6;

    attacker.comboHits++;
    attacker.comboTimer = COMBO_WINDOW;

    if (defender.armor > 0 && !o.launch) {
      this.spawnSpark(defender.x, defender.y - 70, "#ffb703", 8);
      this.spawnRing(defender.x, defender.y - 76, 8, 4, 12, "#ffb703", 5, false);
      this.hitstop = Math.max(this.hitstop, 2);
      this.shake = Math.max(this.shake, 3);
      if (defender.hp <= 0) this.knockOut(defender);
      return true;
    }

    const kbScale = defender.buff > 0 ? 0.65 : 1;
    defender.vx = dir * o.kbX * kbScale;
    if (o.launch) {
      defender.vy = o.kbY * kbScale;
      defender.state = "launched";
      defender.stateFrame = 0;
      defender.hitstun = o.hitstun;
      defender.facing = dir === 1 ? -1 : 1;
    } else {
      if (o.kbY !== 0) defender.vy = Math.min(defender.vy, o.kbY * kbScale);
      defender.state = "hit";
      defender.stateFrame = 0;
      defender.hitstun = Math.max(o.micro ? 4 : 6, o.hitstun);
    }
    defender.attackKind = null;
    defender.blockStun = 0;

    if (o.micro) {
      this.spawnSpark(defender.x, defender.y - 74, o.color, 5);
      this.hitstop = Math.max(this.hitstop, 1);
      this.shake = Math.max(this.shake, 2.5);
    } else {
      this.spawnSpark(defender.x, defender.y - 70, o.color, 10 + Math.floor(dmg / 2));
      this.spawnBurst(defender.x - dir * 10, defender.y - 72, 24 + dmg * 1.6, o.color, 7);
      this.shake = Math.max(this.shake, 4 + dmg * 0.5);
      this.hitstop = Math.max(this.hitstop, defender.hp <= 0 ? 8 : dmg > 11 ? 5 : 3);
      this.flashScreen(Math.min(0.35, 0.05 + dmg * 0.012), o.color);
      if (dmg >= 7 || attacker.comboHits === 1) {
        const word = HIT_WORDS[Math.floor(this.rand() * HIT_WORDS.length)];
        this.spawnWord(word, defender.x, defender.y - 176, "#fff200", Math.min(46, 24 + dmg * 1.2));
      }
    }

    if (defender.hp <= 0) this.knockOut(defender);
    return true;
  }

  private knockOut(f: Fighter): void {
    f.state = "ko";
    f.stateFrame = 0;
    this.shake = 22;
    this.flashScreen(0.8, "#ffffff");
    this.spawnBurst(f.x, f.y - 70, 90, "#fff200", 11);
  }

  private triggerRiposte(defender: Fighter, attacker: Fighter, incomingDir: 1 | -1): void {
    const sp = defender.def.special;
    defender.state = "attack";
    defender.attackKind = "riposte";
    defender.stateFrame = 0;
    defender.hasHit = true;
    defender.invuln = Math.max(defender.invuln, 10);
    defender.facing = incomingDir === 1 ? -1 : 1;
    this.spawnWord("COUNTER!", defender.x, 128, "#ffffff", 38);
    this.spawnRing(defender.x, defender.y - 70, 12, 8, 26, defender.def.look.accent, 9, false);
    this.flashScreen(0.55, defender.def.look.accent);
    this.shake = Math.max(this.shake, 16);
    this.hitstop = Math.max(this.hitstop, 8);
    this.applyHit(defender, attacker, {
      damage: 18 * sp.power * this.effPower(defender),
      kbX: 12,
      kbY: -13,
      hitstun: 34,
      color: defender.def.look.accent,
      launch: true,
      unblockable: true,
      allowCounter: false,
      dir: attacker.x >= defender.x ? 1 : -1,
    });
  }

  private applyPhysics(f: Fighter): void {
    f.x += f.vx;
    f.y += f.vy;
    if (f.y < GROUND_Y) {
      f.vy += GRAVITY;
      if (f.state !== "ko" && f.state !== "attack" && f.state !== "launched" && f.state !== "hit") {
        f.state = "jump";
      }
    } else {
      if (f.y > GROUND_Y && f.vy > 6) this.dust(f.x, GROUND_Y, 6);
      f.y = GROUND_Y;
      f.vy = 0;
      if (f.state === "ko") f.vx *= 0.9;
    }
    if (f.state !== "walk") f.vx *= f.y >= GROUND_Y ? 0.8 : 0.985;

    const clamped = clampX(f.x);
    if (clamped !== f.x) {
      const speed = Math.abs(f.vx);
      if ((f.state === "hit" || f.state === "launched") && speed > 8) {
        f.vx = -f.vx * 0.45;
        this.spawnWord("SLAM!", clamped, f.y - 186, "#ff5252", 32);
        this.spawnRing(clamped, f.y - 70, 12, 7, 22, "#ff5252", 7, false);
        this.spawnSpark(clamped, f.y - 70, "#ff5252", 14);
        this.shake = Math.max(this.shake, 12);
        this.hitstop = Math.max(this.hitstop, 4);
      } else {
        f.vx = 0;
      }
      f.x = clamped;
    }
  }

  private separate(a: Fighter, b: Fighter): void {
    const minDist = 52;
    const dx = b.x - a.x;
    const dist = Math.abs(dx);
    if (
      dist < minDist &&
      Math.abs(a.y - b.y) < 100 &&
      a.state !== "ko" && b.state !== "ko" &&
      a.invuln <= 0 && b.invuln <= 0
    ) {
      const push = (minDist - dist) / 2;
      const sign = dx >= 0 ? 1 : -1;
      a.x = clampX(a.x - sign * push);
      b.x = clampX(b.x + sign * push);
    }
  }

  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.grow;
      p.spin += 0.24;
      p.life--;

      if (p.kind === "projectile" && this.tick % 3 === 0) {
        this.particles.push({
          x: p.x - Math.sign(p.vx) * 8,
          y: p.y + this.randRange(-6, 6),
          vx: this.randRange(-0.8, 0.8) - p.vx * 0.08,
          vy: this.randRange(-0.8, 0.8),
          life: 16,
          maxLife: 16,
          color: p.color,
          size: this.randRange(2.5, 5),
          gravity: 0,
          shape: "dot",
        });
      }
      if (p.kind === "shockwave" && this.tick % 2 === 0) {
        this.particles.push({
          x: p.x + this.randRange(-p.r * 0.5, p.r * 0.5),
          y: GROUND_Y - this.rand() * 8,
          vx: this.randRange(-1, 1) + p.vx * 0.15,
          vy: -this.randRange(1.5, 4.5),
          life: 22,
          maxLife: 22,
          color: p.color,
          size: this.randRange(3, 7),
          gravity: 0.16,
          shape: "square",
        });
      }

      const target = this.fighters[p.owner === 0 ? 1 : 0];
      const owner = this.fighters[p.owner];
      if (!p.hasHit && target.state !== "ko" && target.invuln <= 0) {
        const dx = Math.abs(target.x - p.x);
        const dy = Math.abs(target.y - 60 - p.y);
        const inRange =
          p.kind === "shockwave"
            ? dx < p.r && target.y >= GROUND_Y - 70
            : dx < p.r + 24 && dy < 82;
        if (inRange) {
          p.hasHit = true;
          this.applyHit(owner, target, {
            damage: p.damage,
            kbX: p.kind === "shockwave" ? 9 : 5.5,
            kbY: p.kind === "shockwave" ? -12 : -3,
            hitstun: 22,
            color: p.color,
            dir: target.x >= p.x ? 1 : -1,
            launch: p.kind === "shockwave",
          });
          this.spawnBurst(p.x, p.y, 40, p.color, 8);
          p.life = Math.min(p.life, 5);
        }
      }

      if (p.life <= 0 || p.x < -80 || p.x > ARENA_W + 80) this.projectiles.splice(i, 1);
    }
  }

  private updateEffects(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.gravity;
      pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.grow;
      r.life--;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life--;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].life--;
      if (this.bursts[i].life <= 0) this.bursts.splice(i, 1);
    }
    this.updateOverlays();
  }

  private updateOverlays(): void {
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.y += w.vy;
      w.life--;
      if (w.life <= 0) this.words.splice(i, 1);
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].life--;
      if (this.bubbles[i].life <= 0) this.bubbles.splice(i, 1);
    }
  }

  private say(side: 0 | 1, text: string, life: number): void {
    // One bubble per fighter at a time: newest wins.
    this.bubbles = this.bubbles.filter((b) => b.side !== side);
    this.bubbles.push({ text: text.slice(0, 90), side, life, maxLife: life });
  }

  private flashScreen(amount: number, color: string): void {
    if (amount >= this.flash) {
      this.flash = Math.min(1, amount);
      this.flashColor = color;
    }
  }

  private spawnWord(
    text: string, x: number, y: number, color: string, size: number, force = false
  ): void {
    if (this.phase === "ko" && !force) return;
    const wx = Math.max(70, Math.min(ARENA_W - 70, x));
    let wy = Math.max(56, y);
    for (let guard = 0; guard < 4; guard++) {
      const clash = this.words.some(
        (w) => Math.abs(w.y - wy) < 54 && Math.abs(w.x - wx) < (w.size + size) * 3
      );
      if (!clash) break;
      wy -= 56;
      if (wy < 56) {
        wy = 56;
        break;
      }
    }
    this.words.push({
      text,
      x: wx,
      y: wy,
      vy: -1.4,
      life: 44,
      maxLife: 44,
      rot: this.randRange(-0.2, 0.2),
      size,
      color,
    });
    while (this.words.length > MAX_WORDS) this.words.shift();
  }

  private spawnSpark(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = this.rand() * Math.PI * 2;
      const speed = 2 + this.rand() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 1,
        life: 18 + Math.floor(this.rand() * 12),
        maxLife: 30,
        color: this.rand() < 0.5 ? color : "#fff200",
        size: 3 + this.rand() * 4,
        gravity: 0.12,
        shape: this.rand() < 0.3 ? "streak" : "dot",
      });
    }
  }

  private dust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const dir = this.rand() < 0.5 ? -1 : 1;
      this.particles.push({
        x: x + this.randRange(-10, 10),
        y: y - this.rand() * 6,
        vx: dir * this.randRange(0.8, 3),
        vy: -this.randRange(0.4, 2),
        life: 18 + Math.floor(this.rand() * 10),
        maxLife: 28,
        color: "#e6e1d5",
        size: this.randRange(3, 8),
        gravity: 0.08,
        shape: "dot",
      });
    }
  }

  private spawnRing(
    x: number, y: number, r: number, grow: number,
    life: number, color: string, width: number, ground: boolean
  ): void {
    this.rings.push({ x, y, r, grow, life, maxLife: life, color, width, ground });
  }

  private spawnBurst(x: number, y: number, size: number, color: string, spikes: number): void {
    this.bursts.push({
      x, y, size, color, spikes,
      life: 14, maxLife: 14,
      rot: this.rand() * Math.PI,
    });
  }

  private spawnGhost(f: Fighter): void {
    this.spawnGhostAt(f.x, f.y, f.facing, f.def.look.accent);
  }

  private spawnGhostAt(x: number, y: number, facing: 1 | -1, color: string): void {
    this.ghosts.push({ x, y, facing, life: 14, maxLife: 14, color, width: 40 });
  }

  private aiInputs(index: 0 | 1): Inputs {
    const input = emptyInputs();
    const me = this.fighters[index];
    const opp = this.fighters[index === 0 ? 1 : 0];
    if (this.phase !== "fight" || me.state === "ko") return input;

    const dist = Math.abs(opp.x - me.x);
    const toward: 1 | -1 = opp.x >= me.x ? 1 : -1;
    const type = me.def.special.type;
    const hpFrac = me.hp / me.maxHp;
    const cornered = me.x < WALL_PAD + 90 || me.x > ARENA_W - WALL_PAD - 90;

    let threat: Projectile | null = null;
    for (const p of this.projectiles) {
      if (p.owner === index || p.hasHit) continue;
      const closing = (opp.x - me.x) * (p.x - me.x) >= 0 || p.kind === "shockwave";
      const gap = Math.abs(p.x - me.x);
      if (closing && gap < 220) {
        if (!threat || gap < Math.abs(threat.x - me.x)) threat = p;
      }
    }

    if (me.aiReact > 0) me.aiReact--;
    me.aiTimer--;

    if (threat && me.aiReact <= 0 && Math.abs(threat.x - me.x) < 150) {
      me.aiAction = threat.kind === "shockwave" ? "jump" : this.rand() < 0.65 ? "block" : "jump";
      me.aiPress = null;
      me.aiTimer = 18;
      me.aiReact = 26;
    } else if (me.aiTimer <= 0) {
      const roll = this.rand();
      const oppRecovering =
        opp.state === "attack" && opp.stateFrame > 12 && dist < 130;
      const oppAirborne = opp.y < GROUND_Y - 60;
      const oppAttacking = opp.state === "attack" && opp.stateFrame < 10 && dist < 120;

      if (oppAirborne && dist < 150 && roll < 0.6) {
        me.aiAction = "antiair";
      } else if (oppRecovering) {
        me.aiAction = "attack";
      } else if (oppAttacking && roll < 0.55) {
        me.aiAction = type === "counter" ? "special" : "block";
      } else if (this.wantsSpecial(me, opp, dist, hpFrac, cornered) && roll < 0.55) {
        me.aiAction = "special";
      } else if (dist > 260) {
        me.aiAction = roll < 0.12 ? "jump" : "approach";
      } else if (dist < 110) {
        me.aiAction =
          roll < 0.42 ? "attack" : roll < 0.62 ? "block" : roll < 0.8 ? "retreat" : "approach";
      } else {
        me.aiAction = roll < 0.55 ? "approach" : roll < 0.78 ? "attack" : "wait";
      }

      me.aiPress =
        me.aiAction === "attack"
          ? dist < 70 || this.rand() < 0.5
            ? "punch"
            : "kick"
          : me.aiAction === "antiair"
            ? "kick"
            : null;
      me.aiTimer = 12 + Math.floor(this.rand() * 22);
      if (me.aiAction === "special") me.aiTimer += 24;
    }

    switch (me.aiAction) {
      case "approach":
      case "attack":
      case "special":
      case "antiair":
        if (dist > 58) {
          if (toward < 0) input.left = true;
          else input.right = true;
        }
        break;
      case "retreat":
        if (toward < 0) input.right = true;
        else input.left = true;
        break;
      case "block":
        input.down = true;
        break;
      case "jump":
        if (me.y >= GROUND_Y - 0.01 && me.aiTimer % 2 === 0) input.up = true;
        if (toward < 0) input.left = true;
        else input.right = true;
        break;
    }

    if (me.aiAction === "special" && (dist < 300 || type === "buff" || type === "nap" || type === "ai")) {
      input.special = true;
    }
    if (me.aiPress && me.aiTimer > 8) {
      if (me.aiPress === "punch") input.punch = true;
      else input.kick = true;
    }
    return input;
  }

  private wantsSpecial(
    me: Fighter, opp: Fighter, dist: number, hpFrac: number, cornered: boolean
  ): boolean {
    if (me.cooldown > 0) return false;
    switch (me.def.special.type) {
      case "projectile":
        return dist > 160;
      case "shockwave":
        return dist < 220;
      case "dash":
        return dist > 120 && dist < 340;
      case "buff":
        return me.buff <= 0;
      case "nap":
        return hpFrac < 0.55 && dist > 200;
      case "vanish":
        return cornered || dist < 140;
      case "confuse":
        return opp.confused <= 0 && dist < 150;
      case "uppercut":
        return dist < 120;
      case "barrage":
        return dist < 130;
      case "counter":
        return dist < 130 && opp.state === "attack";
      case "ai":
        return me.buff <= 0 && dist < 260;
      default:
        return dist < 220;
    }
  }
}

function clampX(x: number): number {
  return Math.max(WALL_PAD, Math.min(ARENA_W - WALL_PAD, x));
}

function createFighter(def: CharacterDef, index: 0 | 1, x: number, facing: 1 | -1): Fighter {
  return {
    def,
    index,
    x,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    state: "idle",
    stateFrame: 0,
    attackKind: null,
    airborneAttack: false,
    hasHit: false,
    hitCount: 0,
    hitstun: 14,
    cooldown: 0,
    confused: 0,
    buff: 0,
    invuln: 0,
    sleeping: 0,
    armor: 0,
    parry: 0,
    blockStun: 0,
    flashFrames: 0,
    comboHits: 0,
    comboTimer: 0,
    jumps: 0,
    heldUp: false,
    walkPhase: 0,
    hairPhase: 0,
    aiTimer: 0,
    aiReact: 0,
    aiAction: "approach",
    aiPress: null,
  };
}
