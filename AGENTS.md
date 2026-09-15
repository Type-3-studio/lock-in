# Lock-In — Project Instructions

Weekly-planning PWA (Ionic web components, web-first, Android/iOS later) built around one idea:
once you commit to a goal, its deadline is locked. Everything else supports shipping against that
commitment.

## Non-negotiables (locked decisions)

- **Stack:** `@ionic/core` web components + Vite + TypeScript + pnpm + vitest + `vite-plugin-pwa`.
  No React/Vue/Angular runtime. Mirror the `breath-badger` toolchain (same package manager, test
  runner, PWA plugin).
- **Storage:** Dexie.js on IndexedDB. No backend for v1 — everything is local and offline-first.
- **Immutability is a UI concern, not storage.** A power user can always nuke IndexedDB; that's fine.
- **Dates are `YYYY-MM-DD` strings, never timestamps,** for all domain logic. One `date-util` module
  (`weekKey`, `addDays`, `isoWeek`, `generateOccurrences`). Never use `new Date()` in domain code.
- **Recurring tasks = template + generated occurrences.** `Task` is a template only. Occurrences are
  computed deterministically from `(recurrence rule, date range)` at render time; per-occurrence
  `done`/`missed` state is keyed by `taskId + date`. Clipping at `goal.deadline` is a pure function.
- **Locked goal terminal status is permanent.** No undo. Mistakes become a new goal.
- **Import is replace-only** and always auto-backups current state first.
- **Week cells hold Tasks only** (no free-text scribbles). Quick capture is a Task with just a title.
- **Notes are flat lists** (no nested sub-items) for v1.

## Tooling

- Package manager: `pnpm`
- Dev: `pnpm dev`
- Build (also typechecks): `pnpm build`
- Test: `pnpm test` (vitest)
- Icons: `pnpm icons` (regenerates PWA PNG icons into `public/icons/`)
- Run `pnpm test` and `pnpm build` before considering any task done.

## Icon setup (offline)

Ionicons are registered locally via `src/icons.ts` (`addIcons`), never fetched from a CDN — the
app must work fully offline. When you use a new `ion-icon name="..."`, add its import + entry to
`registerAppIcons` in `src/icons.ts`.

## Conventions

- TypeScript strict; no `any`.
- Domain logic lives in pure, framework-agnostic modules and MUST have vitest coverage:
  recurrence generation, week/date math, lock transitions, export/import DTO mapping.
- Export/import uses a versioned DTO (`schemaVersion`); never dump raw Dexie tables.
- Keep `plan.md` current: mark an item complete only after it's built and verified.

## Key invariants

- Recurring occurrence generation is clipped at `goal.deadline` when `goalId` is set.
- Promoting a ListItem flips its status to `promoted` + stores a pointer; it is not deleted.
- Locking / deadline-set always require an explicit confirm step (the one irreversible action).
- History is append-only; never editable/deletable via UI. Each entry stores a frozen `snapshot`.
- `missed` rollover: on app open, pending occurrences in past days flip to `missed` (logged).

## Progress

See `plan.md` for milestones and current state. Resume from there.
