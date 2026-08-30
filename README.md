# Celeb Fighter

A Street-Fighter-style parody brawler for the browser. Famous-ish people with
exaggerated comic-book looks beat each other up with signature special moves:
Trump's MAGA RUSH, Biden's MEMORY LOSS, Harris's COCONUT DROP, Obama's
YES WE CAN, and Tang Jie's TANG QUAKE (god-tier: hp 999 / power 5.0 —
overwhelmingly stronger than everyone). Trump is the boss-tier fighter at
roughly 2x the baseline of the rest of the roster.

100% frontend. The Next.js build is a fully static export (out/) — no API
routes, no server runtime — so it deploys to Vercel as-is and is CDN-cacheable
(Cloudflare-friendly).

## Play

````bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static site in out/
````

(Windows shells that block .ps1 scripts: use pnpm.cmd instead of pnpm.)

## Controls

| Action | P1 | P2 |
| ------ | -- | -- |
| Move / Jump / Block | A / D - W - S | Left/Right - Up - Down |
| Punch / Kick | F / G | J / K |
| Special (full meter) | H | L |
| Rematch after K.O. | R | R |

Down blocks; specials cost a full meter, which fills as you deal and take
damage. Add &cpu=1 on /play to hand P2 to a simple AI.

## Custom fighters

/create builds a fighter from colors, hair/accessory/build presets, a
10-point stat budget, and one of five special-move archetypes (projectile,
dash, buff, shockwave, confuse). Share codes (WBC1.<base64url>.<crc32>) are
verified with a strict whitelist schema — bounds-checked stats, hex-only
colors, checksum integrity, no eval, no prototype pollution — at
/share?c=<code>. Customs live in localStorage and are re-validated on every
read.

## Adding a character

Add one CharacterDef object to lib/characters.ts — engine, renderer, select
screen and creator all read from the same data model.

## Tests

````bash
node tests/smoke.ts   # headless engine + share-code security checks
````

See plan.md for architecture and status.
