# Screens for human review

Every screen and state the game can show today is photographed by the end-to-end suite in all
three engines (Chromium, WebKit, Firefox) at three sizes, so a person can review the look without
running anything. The pictures are evidence for people, not pixel gates: fonts and anti-aliasing
differ by operating system, so no test compares them.

| Size             | CSS pixels | Why                                    |
| ---------------- | ---------- | -------------------------------------- |
| tablet landscape | 1180 × 820 | the main device (touch-first, plan §0) |
| desktop          | 1440 × 900 | the family PC or laptop                |
| phone portrait   | 390 × 844  | the smallest supported screen (§2.11)  |

## Where to find them

- **CI**: each run of the `CI` workflow uploads one artifact per engine from the job that runs
  the walks: `qa-screens-chromium-walks+rest`, `qa-screens-firefox-walks+rest` and
  `qa-screens-webkit-walks` (kept 30 days). Open `first-run-and-placement.html`,
  `the-valley.html`, `keepers-and-grown-ups.html`, `when-things-go-wrong.html` or `text-200.html`
  in the artifact for a contact sheet: one row per stop, one column per size.
- **Locally**: `npm run test:e2e -- screens.spec.ts reflow.spec.ts` writes the same files to
  `out/qa-screens/<project>/` (`chromium-msedge` with the default local browser).

Files: `out/qa-screens/<project>/<size>/<stop>.png` and, for the large-text walk,
`out/qa-screens/<project>/text-200/<size>/<stop>.png`. Pages are photographed in full (long phone
pages included) with animations settled and reduced motion on, so confetti and transitions never
blur a picture. The voice list in the grown-ups' area shows the same stand-in voices in every
engine (`test/e2e/support/speech.ts`).

Every stop is also checked automatically at each size (`test/e2e/screens.spec.ts`): no serious or
critical axe violations (tablet and phone), no sideways scrolling, nothing cut off, every control
at least 48 px, no word broken in the middle. Tolerated known defects are listed in
[defects.md](defects.md).

## The first run and the placement check (`first-run-and-placement`)

A new family makes its first keeper, hears the prologue, chooses an egg and takes the placement
check ("Show the dragons what you know!") to its results (`test/e2e/support/tour.ts`:
`welcomeWalk`, `roundWalk`).

| Stop                | What it shows                                                    |
| ------------------- | ---------------------------------------------------------------- |
| `01-title`          | Title: Old Glimmer, three eggs and Play                          |
| `02-editor-new`     | A new keeper: name field and eight pictures                      |
| `03-editor-problem` | The editor asking kindly for a name                              |
| `04-story`          | The prologue, line by line, with Next and Skip                   |
| `05-story-eggs`     | Choosing the first egg                                           |
| `06-hub`            | Ada's hub: the egg, the week, goal, quests, places               |
| `07-round-keypad`   | The placement check: a keypad problem                            |
| `08-round-typing`   | The keypad with a digit typed                                    |
| `09-round-paused`   | The pause dialog over the round                                  |
| `10-round-miss`     | A miss: orange "Almost!", the right fact and its picture, Got it |
| `11-round-results`  | Placement results: score, coins, new eggs and stickers           |
| `12-hub-after`      | The hub after the check: eggs in the nest                        |

## The valley (`the-valley`)

A keeper who has finished the placement check visits the map, a region road, a level card, a
Feeding Time round with choice tiles, an Egg Grid board and the four collections (`placesWalk`).

| Stop              | What it shows                              |
| ----------------- | ------------------------------------------ |
| `13-map`          | The valley map with Sunny Meadow awake     |
| `14-region`       | The Sunny Meadow road: levels and the boss |
| `15-level`        | A level card: its activities and Play      |
| `16-round-choice` | Feeding Time with choice tiles             |
| `17-egg-grid`     | Egg Grid: build rows and columns of eggs   |
| `18-market`       | Glimmer's Market                           |
| `19-den`          | The Dragon Den                             |
| `20-album`        | The Sticker Album                          |
| `21-window`       | The Magic Window                           |

## Keepers and the grown-ups' area (`keepers-and-grown-ups`)

| Stop                 | What it shows                                         |
| -------------------- | ----------------------------------------------------- |
| `22-keepers`         | Who is playing? One keeper and New keeper             |
| `23-gate-hold`       | The grown-ups' gate: press and hold                   |
| `24-gate-question`   | The gate question and its keypad                      |
| `25-parent-keepers`  | Grown-ups' area: keepers                              |
| `26-parent-settings` | Grown-ups' area: one keeper's settings and game rules |
| `27-parent-data`     | Grown-ups' area: backups and storage                  |
| `28-parent-offline`  | Grown-ups' area: offline play                         |
| `29-parent-about`    | Grown-ups' area: about and privacy                    |
| `30-confirm-remove`  | Confirming the removal of a keeper                    |
| `31-editor-change`   | Changing a keeper, with Remove                        |
| `32-keepers-full`    | Four keepers: the valley is full                      |

## When things go wrong (`when-things-go-wrong`)

Failed saves, damaged records, storage that will not open, an invalid content pack and a broken
page shell, staged with the fault injection in `test/e2e/support/storage.ts` (`troubleWalk`).

| Stop                      | What it shows                         |
| ------------------------- | ------------------------------------- |
| `41-save-failed`          | Not saved: the save status with Retry |
| `42-recovery-game`        | Recovery: Ema's saved game            |
| `43-recovery-confirm`     | Recovery: confirm erasing a record    |
| `44-settings-saved`       | A setting saved, with its toast       |
| `45-recovery-settings`    | Recovery: Ema's settings              |
| `46-recovery-family`      | Recovery: the list of keepers         |
| `47-recovery-unavailable` | Storage that will not open            |
| `48-error`                | The error screen: a dragon sneezed    |
| `49-startup-failure`      | The page shell could not start        |

## Large text (`text-200`)

A keeper whose grown-up chose Text size 200 % (`test/e2e/reflow.spec.ts`): the hub (`06-hub`),
the placement check (stops `07` to `12`) and the valley (stops `13` to `21`), at all three sizes.
The same walk checks reflow; every screen is also checked at 200 % browser zoom (no pictures).

Not yet walked (they need whole levels played first; PR B covers them with the gameplay): Memory
Match, Number Trail, Fact Family Nest, the Bridge Troll, hatching and growing, a gift, snack time,
the Arena, and the market purchase and dressing a dragon.

## Reviewing

Look for: anything cut off or overlapping, text that is hard to read on its background, a
control that looks disabled when it is not, inconsistent wording, the Czech signs (`·`, `:`,
`r`) on every problem, and whether the screen still feels like a toy shelf rather than a
dashboard (docs/app.md §7). Report findings to the coordinator with the stop name, size and
engine.
