# Celeb Fighter (formerly "World Battle") — Project Plan

Hackathon project: a Street-Fighter-style browser fighting game with exaggerated
comic-parody graphics of famous people. 100% frontend, fully static export —
no API calls, CDN-cacheable (Vercel + Cloudflare friendly).

## Tech stack
- Next.js **16.3.3** (App Router, TS, strict), React 19.2.8, Tailwind 4
- pnpm (use `pnpm.cmd` in this shell — PowerShell blocks .ps1 shims)
- Canvas 2D game with fixed-timestep 60 Hz engine; no game libraries
- `output: "export"` in next.config.ts → pure static build

## Architecture
```
app/
  layout.tsx        fonts (Bangers/Comic Neue) + metadata "Celeb Fighter"
  page.tsx          main menu + character select (P1/P2, CPU toggle)
  play/page.tsx     the fight (Suspense wrapper, reads ?p1=&p2=&cpu=)
  create/page.tsx   custom character creator + live preview + share code
  share/page.tsx    verify & import shared codes (?c=... or paste)
lib/
  types.ts          CharacterDef model (stats, look, special) + enums
  characters.ts     roster data — add a character = add one object
  share.ts          WBC1 share codes: base64url(json) + CRC32, strict validation
  storage.ts        localStorage custom roster (re-validated on every read)
  game/engine.ts    fixed-timestep fight sim: states, hitboxes, meter, AI
  game/render.ts    comic canvas renderer: caricatures, HUD, FX
components/
  Game.tsx          canvas + rAF loop + keyboard mapping
  CharacterCard.tsx portrait card (canvas preview)
```

## Game design
- Controls P1: WASD move/jump, S block, F punch, G kick, H special.
  P2: arrows + J/K/L (or CPU AI).
- Meter builds by dealing/taking damage; special costs full meter.
- Shared special-move system (only names/animation/colors differ):
  projectile | dash | buff | shockwave | confuse
- HP bars, meter bars, timer, KO screen, speech bubbles, "POW!" FX, screenshake.
- Roster: Trump (boss-tier, ~2x baseline), Biden, Harris, Obama,
  Tang Jie (god-tier: hp 999 / power 5.0 / special 3.0 — overwhelmingly
  stronger than Trump), + user customs.

## Custom character share codes (security)
- Format `WBC1.<base64url(utf8(json))>.<crc32-hex>`; ≤4000 chars.
- Strict whitelist schema: unknown fields dropped, wrong types rejected,
  enums whitelisted, colors must be `#rrggbb`, stat point-buy budget enforced
  (10 pts: hp +4/pt from 80, speed +0.06/pt from 1.0, power +0.04/pt from 1.0,
  bounds hp 80–120, speed 0.8–1.6, power 0.8–1.4 — floors low enough to cover
  the starters if re-encoded). Output built as fresh literal (no prototype
  pollution).
- No eval/Function/innerHTML; text rendered via React/canvas only.
- localStorage customs stored as share-code strings, re-validated on read.

## Status
- [x] Scaffold Next 16.3.3 + Tailwind 4 (pnpm)
- [x] next.config.ts static export
- [x] lib/types.ts, lib/characters.ts (incl. Trump 2x + Tang Jie)
- [x] lib/share.ts (encode/decode + strict validation; stat floors 0.8 so
      starters remain re-encodable; budget tolerance note above)
- [x] lib/storage.ts (customs stored as share-code strings)
- [x] lib/game/engine.ts (fixed-timestep sim: states, meter, 5 special
      archetypes, blocks, K.O./time-over, CPU AI)
- [x] lib/game/render.ts (procedural comic renderer, HUD, portraits,
      speech bubbles, POW words, halftone stage)
- [x] components/Game.tsx (rAF loop, fixed-step accumulator, key maps),
      components/CharacterCard.tsx
- [x] pages: home/select, play (Suspense), create, share; layout fonts
      (Bangers/Comic Neue via next/font), globals.css comic theme
- [x] Validation: tsc clean, eslint clean, pnpm build → static out/ (5 routes)
- [x] tests/smoke.ts — 23 headless checks (engine flow + share-code security),
      all passing. Run: `node tests/smoke.ts`
      (tests/smoke.ts is a copy of lib/ with "@/lib/..." aliases rewritten to
      relative "./x.ts" so Node can strip types and run it directly — refresh
      the copy if lib changes materially.)

## Notes
- Run: `pnpm.cmd dev` (shell blocks .ps1, always use pnpm.cmd)
- Build: `pnpm.cmd build` → static site in `out/`
- Vercel: auto-detects Next; static export = zero server functions.
