# Test coverage: the plan and its evidence

Where each promise of the plan is held by a test, at commit `8d3236a` (main after #29). Plan §4 is the verification
strategy; §2.8-2.12 are the promises a child and a grown-up would notice. "Covered" means a test
fails if the promise breaks; "partly" names what is missing; a gap says when it will be covered.
The browser specs are in `test/e2e/` ([testing.md](../testing.md) §5), the rest in `test/`
([testing.md](../testing.md) §3-4).

## Plan §4: verification strategy

| §4  | Promise                                                                                                                                                       | Evidence                                                                                                                                                                                                                   | Status                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Exhaustive generator tests: every fact and range answered, remainders below the divisor                                                                       | `test/unit/learning/` (generators, distractors, words): every small-table fact and every parameter range yields a valid problem; distractors unique, non-negative, never the answer                                        | Covered (S2a)                                     |
| 2   | Command traces with literal goldens and trajectory digests, every test mutation-checked                                                                       | `test/traces/` (first session, Region 1, Riddle Scrolls, rules paths, the struggling child, the valley); automated mutation checks on the golden trace; ESLint bans self-referential goldens                               | Covered                                           |
| 3   | Learner bots: 70-90 % success, mastery within N days, the struggling bot progresses, no unreviewed due fact, no dead ends, every boss beatable, reward pacing | `test/sim/` in the gate (bot models, checks against synthetic reports, a short first session); 12-week runs with `node scripts/simulate.mjs --days 84 --check`, results in [balance-report.md](../balance-report.md)       | Covered (S2a); the long runs are outside the gate |
| 4   | Save, restore and migration: mid-round restore, failed-checkpoint retry, content upgrade                                                                      | `test/migration/` (the deployed slice's save moved to the current pack; the next revision activated at a safe boundary); `test/unit/app/` (records, backup, family, save status); e2e `persistence`, `recovery`, `upgrade` | Covered                                           |
| 5   | Browser end-to-end                                                                                                                                            | (below)                                                                                                                                                                                                                    | Covered                                           |
| 6   | Human checkpoints: dragon designs and backgrounds approved, audio auditioned, copy reviewed, playtest with the child                                          | Copy: [copy-review.md](copy-review.md) (needs decisions); screens for review: [screens.md](screens.md); the rest is for the coordinator and the family                                                                     | Not automatable; see [release.md](release.md)     |

### §4.5 in detail

| Browser promise                                  | Evidence                                                                                                                         | Status                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| First-run onboarding                             | `first-run.spec.ts`, `profiles.spec.ts`                                                                                          | Covered                 |
| One round by keyboard and one by touch emulation | `input.spec.ts` (a whole check by tapping), `persistence.spec.ts` and `regions.spec.ts` (keyboard), `boards.spec.ts` (both ways) | Covered                 |
| Save, reload and resume                          | `persistence.spec.ts`, `recovery.spec.ts`                                                                                        | Covered                 |
| Parent gate and notation switch                  | `gate.spec.ts`, `settings.spec.ts`, `profiles.spec.ts`                                                                           | Covered                 |
| Read-aloud with a mocked local voice             | `read-aloud.spec.ts`; the verbalizer checked by an independent words oracle in `settings.spec.ts`                                | Covered                 |
| Offline install and offline reload               | `offline.spec.ts`: the test's own server shut down after install; emulated offline too (not in WebKit)                           | Covered                 |
| Zero outbound requests and zero console errors   | The guard on every test (`support/fixtures.ts`, `support/guard.ts`), proved by `harness.spec.ts`                                 | Covered                 |
| 200 % text and reduced motion                    | `reflow.spec.ts`, `motion.spec.ts`                                                                                               | Covered (DV-QA-13 open) |
| Screenshots at tablet, desktop and phone sizes   | `screens.spec.ts`, indexed in [screens.md](screens.md)                                                                           | Covered                 |

## Plan §2.8: the first session

| Step                                          | Evidence                                                                                                                                            | Status                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Title, a new keeper, the story, the first egg | `first-run.spec.ts` (skippable story, the egg cannot be skipped)                                                                                    | Covered                     |
| Placement check                               | `profiles.spec.ts`, `persistence.spec.ts`, `input.spec.ts`, `settings.spec.ts`                                                                      | Covered                     |
| First Feeding Time and the first hatch        | The screen walks; `profiles.spec.ts` (the hatch celebrated before the results); `test/sim/` (the first session hatches the first egg for every bot) | Covered                     |
| First sticker and coins                       | `live.spec.ts` (coins announced), `persistence.spec.ts` (coins kept); stickers in the finale's results                                              | Partly: stickers in general |
| Buy a hat                                     | The market is photographed and checked by axe; no purchase is made                                                                                  | **Gap**: next e2e tranche   |
| The map shows the next level                  | The map and road are visited and checked (`screens.spec.ts`, `reflow.spec.ts`)                                                                      | Covered, visually           |

## Plan §2.9: session flow and wellbeing

| Promise                                                                          | Evidence                                                                                                    | Status                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Daily Adventure: reviews, the next level, a mini-game, the gift                  | `test/unit/progression/daily-adventure.test.ts`; the bots follow it daily; e2e starts it only               | **Partly**: the path end to end is next |
| Sleepy dragons after the daily goal; play can go on; goal and limit by grown-ups | The goal is set in `profiles.spec.ts`; the limit in `test/unit/app/preferences.test.ts`                     | **Partly**: goal, gift and snack next   |
| Goodbye with the Dragon Diary: what the day brought                              | `goodbye.spec.ts`, `test/unit/app/diary.test.ts`                                                            | Covered                                 |
| Days practised this week, not a streak                                           | `test/unit/app/game-view.test.ts` (the hub's week of practised days)                                        | Covered headless; not in a browser      |
| Timed play only in the optional Arena                                            | `test/unit/progression/arena.test.ts`; the switch in `grown-ups.spec.ts`, its clock in `visibility.spec.ts` | Covered                                 |

## Plan §2.10: presentation

| Promise                                                   | Evidence                                                                                  | Status                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Painted backgrounds, the dragon rig, cosmetics on anchors | `test/unit/art/`; every screen photographed for review                                    | Covered; approval is a human checkpoint |
| Animation, with reduced motion respected                  | `motion.spec.ts`                                                                          | Covered                                 |
| Feedback never by colour alone                            | `live.spec.ts` and the round specs read the words; the screens show the symbol            | Covered for words; symbols by review    |
| Audio from deterministic recipes, on the SDK's buses      | `test/unit/audio/` (determinism, the 8 MB pack), `test/unit/app/` (sound map, game audio) | Covered; audition is a human checkpoint |
| Read-aloud with local voices only                         | `read-aloud.spec.ts`, `test/unit/app/verbalizer.test.ts`, `test/unit/app/voices.test.ts`  | Covered                                 |
| The reading font, bundled for offline use                 | `test/unit/app/fonts.test.ts`; the fonts are in the offline pack (`perf.spec.ts`)         | Covered                                 |

## Plan §2.11: UX, input and accessibility

See [accessibility.md](accessibility.md). Targets of 48 px, 200 % text with reflow, the keyboard
promises, live feedback, focus with dialogs and reduced motion are covered. The pause when the page is hidden is held by `visibility.spec.ts`.

## Plan §2.12: family profiles and the grown-ups' area

| Promise                                                                                         | Evidence                                                                                                                                                                                             | Status                          |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Up to four keepers, each with their own dragons, progress and settings                          | `keepers.spec.ts`, `persistence.spec.ts`, `settings.spec.ts`                                                                                                                                         | Covered                         |
| The grown-ups' gate: hold, then a two-digit × two-digit question                                | `gate.spec.ts`                                                                                                                                                                                       | Covered                         |
| Progress view: the window, accuracy and speed, the hardest facts, the trend, time played        | `progress.spec.ts` (the Magic Window grids with their counts, the times tables, the hardest facts, the practice days); `test/unit/app/progress-print.test.ts`                                        | Covered                         |
| Settings: notation, goal, voice and auto-read, volumes, text size, reduced motion, unlock ahead | `settings.spec.ts`, `profiles.spec.ts`, `read-aloud.spec.ts`, `reflow.spec.ts`, `motion.spec.ts`; unlock ahead drives the valley specs                                                               | Covered                         |
| Settings: daily limit, Arena on or off, re-run placement                                        | The Arena switch and the placement check again in `grown-ups.spec.ts`; the limit in `test/unit/app/preferences.test.ts` (it counts per page load until the persisted limit, [app.md](../app.md) §16) | Covered; the limit headless     |
| Data: backup export and import, install for offline use                                         | `test/unit/app/backup.test.ts`; exact-bytes export in `recovery.spec.ts`; import in `upgrade.spec.ts`; `offline.spec.ts`                                                                             | Covered                         |
| Data: confirmed reset of a keeper's progress                                                    | `grown-ups.spec.ts`: Cancel keeps everything; confirmed, the dragons and progress go and the settings stay                                                                                           | Covered                         |
| Data: storage status                                                                            | `grown-ups.spec.ts`: the status, and the request made only on a grown-up's tap, granted or declined                                                                                                  | Covered                         |
| Printables: flashcards of the hardest facts, certificates                                       | `progress.spec.ts` (flashcards on A4 for the preview, the printer and a saved file); certificates in `test/unit/app/progress-print.test.ts`                                                          | Covered (certificates headless) |

## Gaps, in the order they will be covered

1. Buying a hat and dressing a dragon; the sticker album's pages; the Magic Window's states.
2. The Daily Adventure end to end with the daily goal, the gift and snack time.
3. Memory Match's variants, Number Trail, Fact Family, and the Egg Grid by touch.
4. The grown-ups' daily limit, once it is kept across page loads (app.md §16).
5. With S3's teach rendering (#27): a low-success day's pacing and the picture model shown before a
   twice-missed item is asked again.
6. Still to be built (app.md §16): the persisted daily limit and the credits after the finale.
