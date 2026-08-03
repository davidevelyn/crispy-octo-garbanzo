# Life OS

A household operating system for two people, built as a local-first PWA.
Layer 1 is fitness: a full workout logger with two researched 12-week
programs tuned for a home gym and golf. The architecture is the point —
every life domain is a **module**, and everything the app knows exports as
one clean JSON document that any agent can read.

## What's in it

- **Fitness** — the flagship. 96-exercise library tagged for the exact
  equipment on hand; Hevy-style logging (previous-session ghost values, rest
  timer, supersets, RPE, plate calculator); two 12-week programs with a real
  progression engine:
  - *Golf Athlete 5/3/1* (intermediate, 4 days) — Leader/Leader/Anchor,
    RPE-capped PR sets, jump/throw primers, a golf-power day, and a
    "round tomorrow" flag that swaps heavy legs out.
  - *Foundations* (beginner, 3 days) — two technique weeks, then GZCLP with
    its stall-proof stage system.
  - PR detection, e1RM charts, volume by muscle group, streaks, measurements.
- **Grocery** — one shared list, quick add, check-off.
- **Tasks** — small asks between the two of you, with an assignee.
- **Two profiles** (David / Margs), one tap to switch. No accounts, no cloud
  service of our own — data lives in IndexedDB on each device and
  exports/imports as JSON.
- **Device sync** — both phones share one pool (lists, tasks, each other's
  training) through a **secret GitHub gist**. Deletions use tombstones so they
  stick across the merge; syncs run on app open, after workouts, or on demand.

### Setting up sync on your two phones

1. On github.com (one account for the household): Settings → Developer
   settings → Fine-grained tokens → new token with **only the Gists
   permission** (read and write).
2. Phone 1: Life OS → Settings → *Sync between your devices* → paste the
   token → **Connect sync**. This creates the private sync gist.
3. Phone 2: same steps with the same account's token — it finds the existing
   pool and joins it.
4. Done. The token never leaves the device it was typed on, and never appears
   in exports or the gist.

Program rationale and sources: [docs/research.md](docs/research.md) ·
[Golf Athlete 5/3/1](docs/programs/golf-athlete-531.md) ·
[Foundations](docs/programs/foundations.md) ·
[Jacked & Tan 2.0 (future)](docs/programs/jacked-and-tan-2.md)

## For agents

The whole state exports from **Settings → Export everything (JSON)**. The
format is documented and stable: [docs/data-schema.md](docs/data-schema.md).
Import merges by `updatedAt`, so an agent can read an export, act on it, and
hand back changes. Program and exercise content are code, not data —
`src/modules/fitness/content/` — typed against the engine and validated by
tests.

## Development

```bash
npm ci
npm run dev        # local dev server
npm test           # engine + platform unit tests (vitest)
npm run build      # typecheck + production build
npm run e2e        # Playwright smoke (CHROMIUM_PATH=... to reuse a system browser)
```

Deploys to GitHub Pages automatically on push to `main`
(`.github/workflows/deploy.yml` — enables Pages on first run). Install it on
a phone from the browser's "Add to Home Screen" and it works offline.

## Architecture in one breath

`src/platform/` is the OS: a ~100-line typed IndexedDB wrapper, profile
management, a module registry, and export/import. `src/modules/*` are the
apps: each declares routes, a home card, the stores it owns, and its export
section. `src/modules/fitness/engine/` is pure functions — scheme resolution,
TM bumps, GZCLP stages, double progression, PR detection — all unit-tested,
no DOM, no DB. Adding a life domain (events, meal planning, …) is one new
`ModuleDefinition`.
