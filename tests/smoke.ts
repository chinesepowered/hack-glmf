// Headless smoke tests for Celeb Fighter engine + share codes.
// Run: node tmp/smoke/smoke.ts   (Node 24 strips TS types natively)
import { encodeCharacterCode, decodeCharacterCode } from "./share.ts";
import { STARTER_CHARACTERS } from "./characters.ts";
import { WorldBattle, emptyInputs, ROUND_SECONDS, GROUND_Y } from "./engine.ts";
import { SPECIAL_TYPES, type SpecialType } from "./types.ts";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

const trump = STARTER_CHARACTERS[0];
const harris = STARTER_CHARACTERS[2];

// --- share codes ------------------------------------------------------------
// Starters (e.g. boss-tier Trump at 240hp/2.3 power) are internal-only and
// intentionally not custom-code encodable; roundtrip uses a legal custom build.
const customDef: typeof harris = {
  ...harris,
  id: "whatever",
  custom: true,
  name: "Test Fighter",
  stats: { hp: 80, speed: 1.6, power: 1.0 },
};
const code = encodeCharacterCode(customDef);
check("code format WBC1.x.y", /^WBC1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/.test(code));
const decoded = decodeCharacterCode(code);
check("roundtrip decodes ok", decoded.ok && decoded.character.name === "Test Fighter");
check("roundtrip keeps stats", decoded.ok && decoded.character.stats.hp === 80 && decoded.character.stats.speed === 1.6);
check("custom id regenerated", decoded.ok && decoded.character.id !== "whatever");

// tamper: flip one char in payload
const parts = code.split(".");
const payload = parts[1];
const flipped = (payload[0] === "A" ? "B" : "A") + payload.slice(1);
const tampered = decodeCharacterCode(`WBC1.${flipped}.${parts[2]}`);
check("tampered payload rejected (checksum)", !tampered.ok);

// invalid stat bounds
const bad = encodeCharacterCode({
  ...harris,
  stats: { hp: 200, speed: 1.0, power: 1.0 },
});
check("out-of-bounds stats rejected", !decodeCharacterCode(bad).ok);

// budget breach: all-max stats = 30 points > 10
const greedy = encodeCharacterCode({
  ...harris,
  stats: { hp: 120, speed: 1.6, power: 1.4 },
});
check("stat budget breach rejected", !decodeCharacterCode(greedy).ok);

// legal max build (Tang Jie style) is accepted
const maxed = encodeCharacterCode({
  ...harris,
  name: "Tang Jie",
  stats: { hp: 80, speed: 1.6, power: 1.0 },
});
check("legal point-buy accepted", decodeCharacterCode(maxed).ok);

// prototype pollution attempt
const evil = `WBC1.${btoa(
  unescape(encodeURIComponent(JSON.stringify({ v: 1, c: { __proto__: { evil: 1 }, name: "Evil", stats: { hp: 100, speed: 1, power: 1 }, special: { type: "buff", name: "X", power: 1 } } })))
).replace(/\+/g, "-").replace(/\//g, "_")}.${"00000000"}`;
const evilResult = decodeCharacterCode(evil);
check("pollution attempt fails checksum at minimum", !evilResult.ok || !("evil" in evilResult.character));

// garbage inputs
check("empty string rejected", !decodeCharacterCode("").ok);
check("wrong prefix rejected", !decodeCharacterCode("XXXX.aaa.bbbbbbbb").ok);
check("garbage rejected", !decodeCharacterCode("WBC1.!!!!.12345678").ok);
check("oversize rejected", !decodeCharacterCode("WBC1." + "A".repeat(5000) + ".12345678").ok);

// --- engine -----------------------------------------------------------------
const battle = new WorldBattle([trump, harris], false);
for (let i = 0; i < 130; i++) battle.step(); // intro (110 frames)
check("intro -> fight", battle.phase === "fight");

const in1 = emptyInputs();
const in2 = emptyInputs();
in1.right = true; // walk toward until adjacent (separation stops them ~52px apart)
battle.setInputs(in1, in2);
for (let i = 0; i < 220; i++) battle.step();
check("P1 walked toward P2", battle.fighters[0].x > 307);

// punch until it lands
const hpBefore = battle.fighters[1].hp;
in1.right = false;
in1.punch = true;
battle.setInputs(in1, in2);
for (let i = 0; i < 120; i++) battle.step();
check("punches land (P2 hp reduced)", battle.fighters[1].hp < hpBefore);

// signature moves are UNLIMITED — no meter, no cooldown: fire immediately
battle.fighters[1].hp = 500; // keep the target alive through both windows
in1.punch = false;
in1.special = true;
battle.setInputs(in1, in2);
const hpBeforeSig = battle.fighters[1].hp;
for (let i = 0; i < 40; i++) battle.step();
check("MAGA eagle projectile fires immediately (no meter)", battle.projectiles.length > 0 || battle.fighters[1].hp < hpBeforeSig);

// ...and can fire again right away — unlimited use
let firedAgain = false;
battle.setInputs(in1, in2);
for (let i = 0; i < 90; i++) {
  battle.step();
  if (battle.projectiles.length > 0) firedAgain = true;
}
check("signature is unlimited (fires again)", firedAgain);

// SLEEPY JOE: Biden naps, heals, and on waking the opponent forgets
const napBattle = new WorldBattle([STARTER_CHARACTERS[1], trump], false);
const napIn = emptyInputs();
const blank2 = emptyInputs();
for (let i = 0; i < 130; i++) { napBattle.setInputs(blank2, blank2); napBattle.step(); }
napBattle.fighters[0].hp = 40;
napIn.special = true;
napBattle.setInputs(napIn, blank2);
for (let i = 0; i < 100; i++) napBattle.step();
check("SLEEPY JOE heals Biden while napping", napBattle.fighters[0].hp > 40);
check("waking from the nap confuses the opponent", napBattle.fighters[1].confused > 0);

// KO flow: drain P2 directly
battle.fighters[1].hp = 1;
battle.fighters[0].state = "idle";
battle.setInputs(in1, in2);
for (let i = 0; i < 400 && battle.phase !== "ko"; i++) battle.step();
check("KO ends the round", battle.phase === "ko");
check("winner recorded", battle.winner === 0);

// timer path: no inputs for a full round on a fresh battle
const b2 = new WorldBattle([trump, harris], true);
const blank = emptyInputs();
b2.setInputs(blank, blank);
const steps = (ROUND_SECONDS + 5) * 60;
for (let i = 0; i < steps && b2.phase !== "ko"; i++) b2.step();
check("time-over resolves round", b2.phase === "ko");

// CPU produces inputs without crashing
check("cpu battle runs", b2.fighters.every((f) => Number.isFinite(f.x) && Number.isFinite(f.hp)));

// Trump is ~2x baseline
check(
  "Trump is boss-tier (hp 240, power 2.3)",
  trump.stats.hp === 240 && trump.stats.power === 2.3
);

// Tang Jie is god-tier: overwhelmingly stronger than even boss-Trump
const tangjie = STARTER_CHARACTERS.find((c) => c.id === "tangjie");
check(
  "Tang Jie is god-tier vs Trump (hp > 2x, power > 2x, special > cap)",
  !!tangjie &&
    tangjie.stats.hp > trump.stats.hp * 2 &&
    tangjie.stats.power > trump.stats.power * 2 &&
    tangjie.special.power > 1.5
);

// --- signature move system --------------------------------------------------
const idle = emptyInputs();
const holdSpecial = emptyInputs();
holdSpecial.special = true;

function dummy(type: SpecialType, id: string): typeof harris {
  return {
    ...harris,
    id,
    custom: true,
    special: { type, name: "TEST MOVE", taunt: "Test!", power: 1.0 },
  };
}

function arena(type: SpecialType, seed: number) {
  const b = new WorldBattle([dummy(type, "a"), dummy("buff", "b")], false, seed);
  for (let i = 0; i < 130; i++) {
    b.setInputs(idle, idle);
    b.step();
  }
  return b;
}

// Every signature must reach a terminal state. "dash" used to fall through the
// switch with no exit condition, freezing the fighter in "attack" forever.
for (const { type } of SPECIAL_TYPES) {
  const b = arena(type, 7);
  b.setInputs(holdSpecial, idle);
  b.step();
  b.setInputs(idle, idle);
  let recovered = false;
  for (let i = 0; i < 400 && !recovered; i++) {
    b.step();
    if (b.fighters[0].state !== "attack") recovered = true;
  }
  check(`signature "${type}" finishes (no soft-lock)`, recovered);
}

// COUNTER: parry the incoming punch, take no damage, riposte hard.
const cb = arena("counter", 3);
cb.fighters[0].x = 420;
cb.fighters[1].x = 480;
cb.setInputs(holdSpecial, idle);
cb.step();
const counterHpMe = cb.fighters[0].hp;
const counterHpThem = cb.fighters[1].hp;
const jab = emptyInputs();
jab.punch = true;
for (let i = 0; i < 30; i++) {
  cb.setInputs(idle, jab);
  cb.step();
}
check("COUNTER takes no damage from the parried hit", cb.fighters[0].hp === counterHpMe);
check("COUNTER ripostes for heavy damage", cb.fighters[1].hp < counterHpThem - 10);

// UPPERCUT launches the opponent into a juggle state.
const ub = arena("uppercut", 5);
ub.fighters[0].x = 420;
ub.fighters[1].x = 472;
ub.setInputs(holdSpecial, idle);
ub.step();
let launched = false;
for (let i = 0; i < 60; i++) {
  ub.setInputs(idle, idle);
  ub.step();
  if (ub.fighters[1].state === "launched") launched = true;
}
check("UPPERCUT launches the opponent", launched);

// BARRAGE chains multiple hits into a combo.
const bb = arena("barrage", 11);
bb.fighters[0].x = 420;
bb.fighters[1].x = 472;
bb.fighters[1].maxHp = 5000;
bb.fighters[1].hp = 5000;
bb.setInputs(holdSpecial, idle);
bb.step();
let bestCombo = 0;
for (let i = 0; i < 120; i++) {
  bb.setInputs(idle, idle);
  bb.step();
  bestCombo = Math.max(bestCombo, bb.fighters[0].comboHits);
}
check("BARRAGE racks up a multi-hit combo", bestCombo >= 3);

// DASH closes distance and connects instead of hanging.
const db = arena("dash", 23);
db.fighters[0].x = 340;
db.fighters[1].x = 520;
const dashHpBefore = db.fighters[1].hp;
db.setInputs(holdSpecial, idle);
db.step();
for (let i = 0; i < 80; i++) {
  db.setInputs(idle, idle);
  db.step();
}
check("DASH rushes in and connects", db.fighters[1].hp < dashHpBefore);

// VANISH teleports past the opponent.
const vb = arena("vanish", 29);
vb.fighters[0].x = 380;
vb.fighters[1].x = 520;
vb.setInputs(holdSpecial, idle);
vb.step();
for (let i = 0; i < 20; i++) {
  vb.setInputs(idle, idle);
  vb.step();
}
check("VANISH ends up behind the opponent", vb.fighters[0].x > vb.fighters[1].x);

// --- fundamentals -----------------------------------------------------------
const gb = arena("buff", 31);
gb.fighters[0].x = 420;
gb.fighters[1].x = 476;
const guardHp = gb.fighters[1].hp;
const guard = emptyInputs();
guard.down = true;
const swing = emptyInputs();
swing.kick = true;
for (let i = 0; i < 40; i++) {
  gb.setInputs(swing, guard);
  gb.step();
}
const blockedLoss = guardHp - gb.fighters[1].hp;
check("blocking reduces a kick to chip damage", blockedLoss > 0 && blockedLoss < 6);

const jb = arena("buff", 37);
const up = emptyInputs();
up.up = true;
jb.setInputs(up, idle);
jb.step();
jb.setInputs(idle, idle);
jb.step();
jb.setInputs(up, idle);
jb.step();
check("double jump works", jb.fighters[0].jumps === 2 && jb.fighters[0].y < GROUND_Y);
for (let i = 0; i < 200; i++) {
  jb.setInputs(up, idle);
  jb.step();
}
check("holding jump never exceeds two jumps", jb.fighters[0].jumps <= 2);

const ab = arena("buff", 41);
ab.setInputs(up, idle);
ab.step();
const airPunch = emptyInputs();
airPunch.punch = true;
ab.setInputs(airPunch, idle);
ab.step();
check("air attacks are allowed", ab.fighters[0].airborneAttack && ab.fighters[0].state === "attack");

// --- determinism ------------------------------------------------------------
function fingerprint(seed: number): string {
  const b = new WorldBattle([trump, harris], true, seed);
  for (let i = 0; i < 900; i++) {
    b.setInputs(idle, idle);
    b.step();
  }
  return [b.fighters[0].hp, b.fighters[1].hp, b.fighters[0].x, b.fighters[1].x]
    .map((n) => n.toFixed(4))
    .join("|");
}
check("same seed replays identically", fingerprint(42) === fingerprint(42));
check("different seeds diverge", fingerprint(42) !== fingerprint(43));

// --- renderer ---------------------------------------------------------------
const { drawScene, drawPortrait } = await import("./render.ts");

function stubCtx() {
  const gradient = { addColorStop() {} };
  const target: Record<string, unknown> = {
    measureText: (s: string) => ({ width: String(s).length * 9 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key as string];
      return () => undefined;
    },
    set(obj, key, value) {
      obj[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const ctx = stubCtx();
let renderCrash: string | null = null;
try {
  for (const { type } of SPECIAL_TYPES) {
    const b = new WorldBattle([dummy(type, "r1"), dummy(type, "r2")], true, 97);
    for (let i = 0; i < 260; i++) {
      b.setInputs(i % 40 < 6 ? holdSpecial : i % 17 < 3 ? jab : idle, idle);
      b.step();
      drawScene(ctx, b);
    }
    b.fighters[1].hp = 0;
    for (let i = 0; i < 120; i++) {
      b.setInputs(idle, idle);
      b.step();
      drawScene(ctx, b);
    }
  }
  for (const c of STARTER_CHARACTERS) drawPortrait(ctx, c, 110, 120);
} catch (err) {
  renderCrash = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
}
check("renderer draws every state without throwing", renderCrash === null);
if (renderCrash) console.log(renderCrash);

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

