# Lock-In — Plan & Progress

State tracking for this project. Keep this current across sessions — mark an item done only when
verified (built + tested).

## Decisions (locked)

- Ionic web components + Vite/TS/pnpm/vitest/vite-plugin-pwa (mirrors `breath-badger`).
- Recurring tasks: template + deterministic occurrence generation.
- Locked goal terminal status is permanent.
- Import: replace-only + auto-backup.

## Milestones

### M0 — Scaffold
- [x] Vite + TypeScript project (pnpm), `@ionic/core` installed
- [x] `vite-plugin-pwa` configured (manifest + service worker, offline-first)
- [x] Dexie.js wired up with typed schema
- [x] vitest configured + a smoke test passing
- [x] 4-tab shell (Goals / Weeks / Lists / History) rendering

### M1 — Data layer
- [x] Model types: Goal, Task, Note, ListItem, HistoryEntry
- [x] `date-util` (`weekKey`, `addDays`, `isoWeek`) + tests
- [x] `generateOccurrences(task, range)` + goal-deadline clipping + tests
      (`src/lib/recurrence.ts`; `custom` recurrence uses `Task.recurrenceDays` — ISO weekdays)
- [x] Dexie store (CRUD + reactive queries) on top of IndexedDB
      (`src/db/store.ts`; `liveQuery` observables + CRUD per table, tested with `fake-indexeddb`)
- [x] History append-only logger with snapshots
      (`src/lib/history.ts`; `snapshot()` deep-freezes a clone; typed `log*` helpers per event)

### M2 — Goals tab (first vertical slice)
- [x] Goal list + create/edit (draft fully editable)
      (`src/views/goals-view.ts`; list + detail + inline form, backed by live Dexie queries)
- [x] Lock flow with confirm dialog (draft → locked, sets `lockedAt`)
      (`lockGoal` in `src/lib/goal.ts`; confirm via `src/lib/confirm.ts`)
- [x] Locked view: read-only + terminal status transitions (completed/failed/abandoned)
      (`setTerminalStatus`; terminal is permanent — later transitions throw)
- [x] Status transitions logged to History (irreversible)
      (view calls `logGoalLocked` / `logGoalTerminal`; verified persisted snapshots)

### M3 — Weeks tab
- [x] `WeekGrid` component with density prop (full/compact)
      (`src/components/week-grid.ts`; 7-column grid, chips+add in full, status dots in compact)
- [x] Week view (full + compact), Month view, arbitrary range
      (`src/views/weeks-view.ts`; prev/next/Today, week + month, `buildSchedule` handles any range)
- [x] Task create/edit + drop into day cell, optional goal link
      (add button on a cell → task form; recurrence none/daily/weekly/custom; goal select)
- [x] done/missed toggling + `missed` rollover on open
      (grid check + status buttons; `planMissedRollover` run from `lock-in-app` on open)

### M4 — Lists tab
- [x] Note + list item CRUD
      (`src/views/lists-view.ts`; live notes list + note detail, editable title/body/items)
- [x] Promote item → Task (pre-filled) and → Goal (pre-filled); sets `promoted` + pointer
      (creates a task anchored today / a draft goal from the item text; `promoteNoteItem`)

### M5 — History / Settings
- [x] Read-only audit log UI
      (`src/views/history-view.ts`; stats cards + typed badges + frozen snapshot summaries)
- [x] Export (versioned JSON DTO) + Import (replace-only + auto-backup)
      (`src/lib/dto.ts` + `src/db/store.ts`; imports snapshot current state into a `backups` table)

### M6 — PWA polish + wrap
- [x] Installable manifest, icons, offline verification
      (`vite.config.ts` + `public/icons`; icons now precached. Verified: SW controls the app and a
      reload while offline renders the shell from cache)
- [x] Full favicon set + apple-touch-icon + OG/Twitter share image
      (`pnpm icons` now also emits `favicon.ico`, `favicon-16/32/48.png`, `apple-touch-icon.png`;
      `public/og-image.png` 1200x630)
- [x] PWA install screenshots + shortcuts (deep link via `?tab=`)
      (`public/screenshots/*`; manifest `screenshots` + `shortcuts`, wired in `src/lock-in-app.ts`)
- [x] SEO/AEO assets: `llms.txt`, `robots.txt`, `sitemap.xml`, `humans.txt`, `privacy.html`, `terms.html`
- [x] Deploy source pushed to `github.com/Type-3-studio/lock-in`
- [ ] Cloudflare Pages project + custom domain `lockin.t3apps.com` (dashboard wiring)
- [ ] Capacitor wrap for iOS/Android — later

## Steals from v1 (backlog)

Ideas recovered from the old `old-notes/` mockups worth folding in. Tagged with the milestone they
best fit; not scheduled until that milestone's base work is done.

High value:
- [x] `timeLeft(goal, today)` pure helper + live countdown on the locked goal (M2)
      (`timeLeft` in `src/lib/goal.ts`; shown as date-granularity days left/overdue by design)
- [x] Per-goal progress rollup (done/total occurrences) (M2/M3)
      (`goalProgress` in `src/lib/progress.ts`; shown on goal detail, ignores future days)
- [x] Per-note checked count (M4)
      (`noteStats` in `src/lib/list.ts`; shown on the list row and note header)
- [x] Completion capture: self-rating + reflection stored in the History `snapshot` (M2)
      (`GoalOutcome` in `src/lib/history.ts`; close screen feeds `logGoalTerminal`)
- [x] `order` field on `Task` + a single "current/active task" focus pointer per goal (M3)
      (`Task.order` scoped per goal; `Goal.activeTaskId`; focus task sorts first + shows ★ in the
      grid, set from the Weeks task form, shown on goal detail; deleting a task clears the pointer)
- [x] History-derived stats: time-to-complete per goal + aggregate totals (M5)
      (`historyStats` in `src/lib/stats.ts`; career stats cards on the History tab)

Nice to have:
- [x] `order` field on `ListItem` + reorder (M4)
      (`ListItem.order` + `moveListItem`; up/down buttons — not drag, for accessibility)
- [x] ListItem checked state (beyond `idle`/`promoted`) (M4)
      (`ListItem.checked`; checkbox per item, independent of promotion status)
- [x] Guided goal wizard prompts (why / reasons / time estimate / subtask breakdown) (M2)
      (3-step create wizard + `Goal.reasons`; quick deadline picks; subtasks via goal-linked
      tasks created on the Weeks tab, not in the wizard)
- [x] "Restart as new goal" — prefill a fresh draft from a terminal goal (M2/M5)
- [x] Motivational quote + theme/CRT personality (per-goal or global) (M6)
      (`src/lib/quotes.ts` + `src/lib/theme.ts`; quote on empty/locked goal, accent presets + CRT
      mode in History → Settings, persisted in `localStorage`)

Deliberately NOT copying (violates our invariants):
- Archive/delete or "edit" of terminal goals — terminal is permanent.
- Stored countdown durations/timestamps as domain state — derive from `deadline`.
- Nested sub-goal ownership — keep any grouping as a link, not ownership.

## Current status

- **In progress:** none — milestones M0–M6 complete
- **Next:** backlog empty (only the deliberately-deferred Capacitor wrap remains)

## How to resume

1. Read this file + `AGENTS.md`.
2. Pick the next unchecked item.
3. Implement, run `pnpm test` and `pnpm build`, then check the box.
