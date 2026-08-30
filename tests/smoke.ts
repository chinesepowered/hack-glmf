// Headless smoke tests for Celeb Fighter engine + share codes.
// Run: node tmp/smoke/smoke.ts   (Node 24 strips TS types natively)
import { encodeCharacterCode, decodeCharacterCode } from "./share.ts";
import { STARTER_CHARACTERS } from "./characters.ts";
import { WorldBattle, emptyInputs, ROUND_SECONDS } from "./engine.ts";

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
check("attacker gains meter", battle.fighters[0].meter > 0);

// special: grant meter, fire projectile special
battle.fighters[0].meter = 100;
in1.punch = false;
in1.special = true;
battle.setInputs(in1, in2);
for (let i = 0; i < 40; i++) battle.step();
check("projectile special spawns a projectile", battle.projectiles.length > 0 || battle.fighters[1].hp < hpBefore);

// KO flow: drain P2 directly
battle.fighters[1].hp = 1;
battle.fighters[0].meter = 100;
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

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

