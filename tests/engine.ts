// World Battle fight engine — a fixed-timestep (60 Hz) 2D fighter.
// Pure simulation: no DOM, no canvas, no timers. The React component feeds it
// Inputs and calls step() once per frame; the renderer reads public fields.

import type { CharacterDef } from "./types.ts";

export const ARENA_W = 960;
export const ARENA_H = 540;
export const GROUND_Y = 462;
export const WALL_PAD = 46;
export const ROUND_SECONDS = 99;

export type FighterState = "idle" | "walk" | "jump" | "block" | "attack" | "hit" | "ko";
export type BattlePhase = "intro" | "fight" | "ko";

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

const PUNCH: AttackSpec = { startup: 5, active: 4, recovery: 8, range: 64, damage: 6, kbX: 3, kbY: 0, hitstun: 12 };
const KICK: AttackSpec = { startup: 9, active: 5, recovery: 14, range: 88, damage: 10, kbX: 6, kbY: -4, hitstun: 18 };
const GRAVITY = 0.85;
const JUMP_VY = -16.5;

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
  meter: number;
  state: FighterState;
  stateFrame: number;
  attackKind: "punch" | "kick" | "special" | null;
  hasHit: boolean;
  hitstun: number;
  cooldown: number;
  confused: number;
  buff: number;
  walkPhase: number;
  aiTimer: number;
  aiAction: "approach" | "retreat" | "attack" | "block" | "jump" | "special";
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
  damage: number;
  color: string;
  kind: string;
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

const HIT_WORDS = ["POW!", "BAM!", "WHAM!", "SOCK!", "BONK!", "ZAP!"];

export class WorldBattle {
  fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  words: Word[] = [];
  bubbles: Bubble[] = [];
  shake = 0;
  phase: BattlePhase = "intro";
  phaseTimer = 110;
  framesLeft = ROUND_SECONDS * 60;
  winner: number | null = null;
  cpu: boolean;
  tick = 0;

  private inputP1: Inputs = emptyInputs();
  private inputP2: Inputs = emptyInputs();

  constructor(defs: [CharacterDef, CharacterDef], cpu: boolean) {
    this.cpu = cpu;
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

  step(): void {
    this.tick++;
    this.shake *= 0.88;
    if (this.shake < 0.3) this.shake = 0;

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

    // ---- fight phase -------------------------------------------------------
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
    this.shake = 18;
    const loser = winner === null ? null : winner === 0 ? 1 : 0;
    if (winner !== null && loser !== null) {
      const lf = this.fighters[loser];
      lf.state = "ko";
      lf.vy = -9;
      lf.vx = -lf.facing * 5;
      const wf = this.fighters[winner];
      this.say(winner, wf.def.win, 260);
      this.spawnWord("K.O.!", wf.x, 180, "#ff2a2a", 72);
    } else {
      this.spawnWord("DRAW!", ARENA_W / 2, 180, "#ffd166", 64);
    }
  }

  // ---------------------------------------------------------------- movement

  private effSpeed(f: Fighter): number {
    return f.def.stats.speed * (f.buff > 0 ? 1.3 : 1);
  }

  private effPower(f: Fighter): number {
    return f.def.stats.power * (f.buff > 0 ? 1.35 : 1);
  }

  private updateFighter(f: Fighter, opp: Fighter, input: Inputs): void {
    if (f.confused > 0) f.confused--;
    if (f.buff > 0) f.buff--;
    if (f.cooldown > 0) f.cooldown--;
    f.stateFrame++;

    if (f.state === "ko") return;

    const onGround = f.y >= GROUND_Y - 0.01;
    // Confusion scrambles left/right (the classic Memory Loss effect).
    const left = f.confused > 0 ? input.right : input.left;
    const right = f.confused > 0 ? input.left : input.right;

    if (f.state === "hit") {
      if (f.stateFrame >= f.hitstun && onGround) f.state = "idle";
      return;
    }

    if (f.state === "attack") {
      this.updateAttack(f, opp);
      return;
    }

    // face the opponent while neutral
    if (onGround) f.facing = opp.x >= f.x ? 1 : -1;

    if (onGround && input.down) {
      f.state = "block";
      f.vx = 0;
      return;
    }

    // attacks
    if (onGround && f.cooldown <= 0) {
      if (input.punch) return this.startAttack(f, "punch");
      if (input.kick) return this.startAttack(f, "kick");
      if (input.special && f.meter >= 100) return this.startSpecial(f);
    }

    // movement
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (onGround) {
      if (dir !== 0) {
        f.vx = dir * 3.3 * this.effSpeed(f);
        f.state = "walk";
        f.walkPhase += 0.25 * this.effSpeed(f);
      } else {
        f.vx = 0;
        f.state = "idle";
      }
      if (input.up) {
        f.vy = JUMP_VY;
        f.state = "jump";
      }
    } else {
      f.state = "jump";
      if (dir !== 0) f.vx += dir * 0.35 * this.effSpeed(f);
      f.vx = Math.max(-7, Math.min(7, f.vx));
    }
  }

  private startAttack(f: Fighter, kind: "punch" | "kick"): void {
    f.state = "attack";
    f.attackKind = kind;
    f.stateFrame = 0;
    f.hasHit = false;
    f.cooldown = kind === "punch" ? 22 : 34;
  }

  private startSpecial(f: Fighter): void {
    f.meter = 0;
    f.state = "attack";
    f.attackKind = "special";
    f.stateFrame = 0;
    f.hasHit = false;
    f.cooldown = 55;
    const sp = f.def.special;
    this.say(f.index, `${sp.name}!`, 100);
    this.say(f.index, sp.taunt, 140);
    if (sp.type === "dash") this.shake = Math.max(this.shake, 5);
  }

  // ----------------------------------------------------------------- attacks

  private updateAttack(f: Fighter, opp: Fighter): void {
    const kind = f.attackKind;
    if (kind === "punch" || kind === "kick") {
      const spec = kind === "punch" ? PUNCH : KICK;
      if (f.stateFrame > spec.startup && f.stateFrame <= spec.startup + spec.active && !f.hasHit) {
        this.tryMeleeHit(f, opp, spec.range, spec.damage * this.effPower(f), spec.kbX, spec.kbY, spec.hitstun, kind === "kick" ? "#ffd166" : "#ffffff");
      }
      if (f.stateFrame >= spec.startup + spec.active + spec.recovery) {
        f.state = "idle";
        f.attackKind = null;
      }
      return;
    }

    // ---- special moves (simple shared system, names/animation differ) ----
    const sp = f.def.special;
    const spPower = sp.power;
    switch (sp.type) {
      case "dash": {
        if (f.stateFrame >= 4 && f.stateFrame <= 22) {
          f.vx = f.facing * 13;
          f.vy = 0;
        }
        if (f.stateFrame >= 6 && f.stateFrame <= 22 && !f.hasHit) {
          this.tryMeleeHit(f, opp, 78, 14 * spPower * this.effPower(f), 9, -3, 24, f.def.look.accent);
        }
        if (f.stateFrame >= 34) this.endAttack(f);
        break;
      }
      case "projectile": {
        if (f.stateFrame === 14) {
          this.projectiles.push({
            owner: f.index,
            x: f.x + f.facing * 46,
            y: f.y - 82,
            vx: f.facing * 9.5,
            vy: 0,
            r: 18,
            grow: 0,
            life: 130,
            damage: 10 * spPower * this.effPower(f),
            color: f.def.look.accent,
            kind: "projectile",
            hasHit: false,
          });
        }
        if (f.stateFrame >= 34) this.endAttack(f);
        break;
      }
      case "shockwave": {
        if (f.stateFrame === 16) {
          this.shake = Math.max(this.shake, 12);
          this.spawnSpark(f.x, f.y, f.def.look.accent, 16);
          this.projectiles.push({
            owner: f.index,
            x: f.x,
            y: GROUND_Y,
            vx: 0,
            vy: 0,
            r: 10,
            grow: 7,
            life: 34,
            damage: 12 * spPower * this.effPower(f),
            color: f.def.look.accent,
            kind: "shockwave",
            hasHit: false,
          });
        }
        if (f.stateFrame >= 40) this.endAttack(f);
        break;
      }
      case "buff": {
        if (f.stateFrame === 12) {
          f.buff = 300;
          this.spawnWord("POWER UP!", f.x, f.y - 170, f.def.look.accent, 30);
          this.spawnSpark(f.x, f.y - 60, f.def.look.accent, 18);
        }
        if (f.stateFrame >= 30) this.endAttack(f);
        break;
      }
      case "confuse": {
        if (f.stateFrame >= 10 && f.stateFrame <= 20 && !f.hasHit) {
          const hit = this.tryMeleeHit(f, opp, 92, 5 * spPower * this.effPower(f), 2, 0, 16, f.def.look.accent);
          if (hit && opp.confused <= 0) {
            opp.confused = 260;
            this.spawnWord("?!", opp.x, opp.y - 170, "#b388ff", 44);
          }
        }
        if (f.stateFrame >= 32) this.endAttack(f);
        break;
      }
    }
  }

  private endAttack(f: Fighter): void {
    f.state = "idle";
    f.attackKind = null;
  }

  /** Attempts a body hitbox check; returns true if the opponent was struck. */
  private tryMeleeHit(
    f: Fighter,
    opp: Fighter,
    range: number,
    damage: number,
    kbX: number,
    kbY: number,
    hitstun: number,
    color: string
  ): boolean {
    if (opp.state === "ko") return false;
    const hx = f.x + f.facing * (range / 2 + 14);
    const hy = f.y - 70;
    const ox = opp.x;
    const oy = opp.y - 60;
    const inRange = Math.abs(hx - ox) < range / 2 + 26 && Math.abs(hy - oy) < 70;
    if (!inRange) return false;
    f.hasHit = true;
    this.applyHit(f, opp, damage, kbX, kbY, hitstun, color);
    return true;
  }

  private applyHit(
    attacker: Fighter,
    defender: Fighter,
    damage: number,
    kbX: number,
    kbY: number,
    hitstun: number,
    color: string
  ): void {
    const dir = attacker.facing;
    const blocked = defender.state === "block" && defender.y >= GROUND_Y - 0.01;
    if (blocked) {
      defender.hp = Math.max(0, defender.hp - Math.max(1, damage * 0.15));
      defender.vx += dir * kbX * 0.4;
      attacker.meter = Math.min(100, attacker.meter + 4);
      defender.meter = Math.min(100, defender.meter + 10);
      this.spawnWord("BLOCKED", defender.x, defender.y - 160, "#9ad0ec", 22);
      this.spawnSpark(defender.x + dir * -18, defender.y - 80, "#9ad0ec", 6);
      this.shake = Math.max(this.shake, 2);
      return;
    }
    defender.hp = Math.max(0, defender.hp - damage);
    defender.vx = dir * kbX;
    if (kbY !== 0) defender.vy = Math.min(defender.vy, kbY);
    defender.state = "hit";
    defender.stateFrame = 0;
    defender.hitstun = Math.max(6, hitstun);
    attacker.meter = Math.min(100, attacker.meter + 14);
    defender.meter = Math.min(100, defender.meter + 18);
    const word = HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
    const size = Math.min(64, 26 + damage * 1.8);
    this.spawnWord(word, defender.x, defender.y - 140, "#fff200", size);
    this.spawnSpark(defender.x, defender.y - 70, color, 10 + Math.floor(damage / 2));
    this.shake = Math.max(this.shake, 4 + damage * 0.5);
    if (defender.hp <= 0) {
      defender.state = "ko";
      this.shake = 20;
    }
  }

  // ----------------------------------------------------------------- physics

  private applyPhysics(f: Fighter): void {
    f.x += f.vx;
    f.y += f.vy;
    if (f.y < GROUND_Y) {
      f.vy += GRAVITY;
      if (f.state !== "ko" && f.state !== "attack") f.state = "jump";
    } else {
      f.y = GROUND_Y;
      f.vy = 0;
      if (f.state === "ko") f.vx *= 0.9;
    }
    if (f.state !== "walk") f.vx *= f.y >= GROUND_Y ? 0.8 : 0.98;
    f.x = Math.max(WALL_PAD, Math.min(ARENA_W - WALL_PAD, f.x));
  }

  private separate(a: Fighter, b: Fighter): void {
    const minDist = 52;
    const dx = b.x - a.x;
    const dist = Math.abs(dx);
    if (dist < minDist && Math.abs(a.y - b.y) < 100 && a.state !== "ko" && b.state !== "ko") {
      const push = (minDist - dist) / 2;
      const sign = dx >= 0 ? 1 : -1;
      a.x -= sign * push;
      b.x += sign * push;
      a.x = Math.max(WALL_PAD, Math.min(ARENA_W - WALL_PAD, a.x));
      b.x = Math.max(WALL_PAD, Math.min(ARENA_W - WALL_PAD, b.x));
    }
  }

  // ------------------------------------------------------------- projectiles

  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.grow;
      p.life--;
      if (p.kind === "projectile" && this.tick % 4 === 0) {
        this.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 14, maxLife: 14, color: p.color, size: 4 });
      }
      if (p.kind === "shockwave" && this.tick % 3 === 0) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * p.r * 2, y: GROUND_Y - Math.random() * 10, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 3, life: 16, maxLife: 16, color: p.color, size: 5 });
      }

      const target = this.fighters[p.owner === 0 ? 1 : 0];
      const owner = this.fighters[p.owner];
      if (!p.hasHit && target.state !== "ko") {
        const dx = Math.abs(target.x - p.x);
        const dy = Math.abs(target.y - 60 - p.y);
        const inRange =
          p.kind === "shockwave"
            ? dx < p.r && target.y >= GROUND_Y - 60
            : dx < p.r + 24 && dy < 80;
        if (inRange) {
          p.hasHit = true;
          const dir: 1 | -1 = target.x >= owner.x ? 1 : -1;
          const facingSave = owner.facing;
          owner.facing = dir;
          this.applyHit(owner, target, p.damage, p.kind === "shockwave" ? 8 : 5, p.kind === "shockwave" ? -11 : -3, 20, p.color);
          owner.facing = facingSave;
          p.life = Math.min(p.life, 6);
        }
      }

      if (p.life <= 0 || p.x < -60 || p.x > ARENA_W + 60 || (p.kind === "shockwave" && p.r > 240)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ----------------------------------------------------------------- effects

  private updateEffects(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.12;
      pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
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

  private spawnWord(text: string, x: number, y: number, color: string, size: number): void {
    this.words.push({
      text,
      x: Math.max(60, Math.min(ARENA_W - 60, x)),
      y: Math.max(50, y),
      vy: -1.4,
      life: 42,
      maxLife: 42,
      rot: (Math.random() - 0.5) * 0.5,
      size,
      color,
    });
  }

  private spawnSpark(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 1,
        life: 18 + Math.floor(Math.random() * 10),
        maxLife: 28,
        color: Math.random() < 0.5 ? color : "#fff200",
        size: 3 + Math.random() * 4,
      });
    }
  }

  // ---------------------------------------------------------------------- AI

  private aiInputs(index: 0 | 1): Inputs {
    const input = emptyInputs();
    const me = this.fighters[index];
    const opp = this.fighters[index === 0 ? 1 : 0];
    const dist = Math.abs(opp.x - me.x);

    if (this.phase !== "fight" || me.state === "ko") return input;

    me.aiTimer--;
    if (me.aiTimer <= 0) {
      const roll = Math.random();
      if (me.meter >= 100 && dist < 250 && roll < 0.75) me.aiAction = "special";
      else if (dist > 220) me.aiAction = roll < 0.15 ? "jump" : "approach";
      else if (dist < 120) me.aiAction = roll < 0.4 ? "attack" : roll < 0.6 ? "block" : roll < 0.75 ? "retreat" : "approach";
      else me.aiAction = roll < 0.6 ? "approach" : roll < 0.8 ? "attack" : "block";
      me.aiPress = me.aiAction === "attack" ? (Math.random() < 0.5 ? "punch" : "kick") : null;
      me.aiTimer = 14 + Math.floor(Math.random() * 26);
    }

    const toward = opp.x >= me.x ? 1 : -1;
    if (me.aiAction === "approach" || me.aiAction === "attack" || me.aiAction === "special") {
      if (toward < 0) input.left = true;
      else input.right = true;
    } else if (me.aiAction === "retreat") {
      if (toward < 0) input.right = true;
      else input.left = true;
    } else if (me.aiAction === "block") {
      input.down = true;
    }
    if (me.aiAction === "jump" && me.y >= GROUND_Y) input.up = true;
    if (me.aiAction === "special" && me.meter >= 100 && dist < 250) input.special = true;
    if (me.aiPress && me.aiTimer > 10) {
      if (me.aiPress === "punch") input.punch = true;
      else input.kick = true;
    }
    return input;
  }
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
    meter: 0,
    state: "idle",
    stateFrame: 0,
    attackKind: null,
    hasHit: false,
    hitstun: 14,
    cooldown: 0,
    confused: 0,
    buff: 0,
    walkPhase: 0,
    aiTimer: 0,
    aiAction: "approach",
    aiPress: null,
  };
}


