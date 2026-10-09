# Performance budgets

What a child's tablet has to download, how soon the first screen is ready on a slow connection and
a slow processor, and how fast an answer gets its feedback. `test/e2e/perf.spec.ts` checks every
budget on each CI run and writes the measurements to the job summary ("Performance"), so a budget
is revisited with numbers in hand.

## Budgets

| What                                                    | Budget       | Now (CI)     | Notes                                                                                    |
| ------------------------------------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------- |
| `app.js` as built / gzipped                             | 800 / 260 KB | 765 / 245 KB | the whole game: rules, SDK, screens, inline art; raised from 750 / 250 KB for grades 1-3 |
| `app.css` as built / gzipped                            | 100 / 20 KB  | 74 / 14 KB   |                                                                                          |
| Offline pack without its audio                          | 3 MB         | 2.64 MB      | 52 files: data, images, script, style, fonts; raised from 2.5 MB for grades 1-3          |
| Whole offline pack (`resource-graph.json`)              | 10.5 MB      | 9.60 MB      | 85 files; the audio is 6.96 MB of it                                                     |
| First visit: downloaded before the title (uncompressed) | 1.3 MB       | 1.14 MB      | 341 KB gzipped, as GitHub Pages sends it                                                 |
| First visit, fast 4G, processor ×4: title ready         | 4 s          | 1.47 s       | first paint 0.29 s (budget 1.5 s)                                                        |
| First visit, slow 4G, processor ×4: title ready         | 10 s         | 6.66 s       | first paint 1.16 s (budget 3 s)                                                          |
| Feedback after an answer, processor ×4 (median of 7)    | 500 ms       | 107 ms       | slowest of the seven 154 ms                                                              |

"Now" is main `8d3236a` (after #29) as measured on CI's Chromium (run 37571226099); Edge on the
development machine measures 1.8 s, 6.9 s and 206 ms. Sizes are in decimal units (1 KB = 1 000
bytes). The audio has its own budget, 8 MB, held by S5's tests ([audio.md](../audio.md):
uncompressed WAV by design, for deterministic bytes without an encoder); the rest of the offline pack
is budgeted here.

## What the first screen costs

A first visit downloads eight files before the title is ready:

| File                                   | As built | Gzipped |
| -------------------------------------- | -------: | ------: |
| `app.js`                               |   672 KB |  216 KB |
| `content/dragon-valley.content.json`   |   256 KB |   17 KB |
| `app.css`                              |    74 KB |   14 KB |
| Reading font, regular and bold (WOFF2) |    78 KB |   78 KB |
| `content/catalogs/en.content.json`     |    30 KB |    8 KB |
| `assets/audio/manifest.json`           |    30 KB |    7 KB |
| `index.html`                           |     1 KB |    1 KB |
| **Total**                              | 1 141 KB |  341 KB |

Nothing else loads until the child does something: sounds load when they first play, and the
offline pack only when a grown-up installs it (9.60 MB, in the background, with progress shown).

## Feedback after an answer

Praise or kind help must follow an answer at once, also on a slow tablet. The game shows the
feedback when the answer is saved, or 250 ms after it is taken if saving is slower
([app.md](../app.md) §5), so on a slow processor the save is most of the wait. Timed in the page
from the answer's Enter to the feedback, over seven answers of the placement check:

| Where                     | Processor         | Feedback   | Saved      |
| ------------------------- | ----------------- | ---------- | ---------- |
| Edge, development machine | as is             | 23-31 ms   | 18-24 ms   |
| Edge, development machine | four times slower | 153-185 ms | 128-159 ms |
| CI, Chromium              | four times slower | 89-154 ms  |            |

## How it is measured

- **Sizes** come from the site the test run builds: `app.js` and `app.css` as built and gzipped
  (level 9), the offline pack from `resource-graph.json` (every file the offline install copies,
  with its exact bytes).
- **The first screen** is timed inside the page: from the navigation to the moment the title is
  mounted and painted (`boot-status` turns `ready`, [app.md](../app.md) §2), with the browser cache
  off, so every visit is a first visit. Each profile is visited three times and the best visit is
  held to the budget (noise only ever slows a visit down); all three are recorded. The profiles are
  Lighthouse's mobile ones: fast 4G (9 Mbit/s, 40 ms) and slow 4G (1.6 Mbit/s down, 750 kbit/s
  up, 150 ms), each with the processor slowed four times.
- **Feedback** is timed inside the page from the answer's Enter key to the feedback being shown,
  for seven answers with the processor slowed four times; the median is held to the budget.
- **Chromium only** for the timings: the throttling is the Chrome DevTools Protocol's. WebKit and
  Firefox run the size checks and skip the timings with that reason.
- **Judged only on a quiet machine.** A timing means something only when the browser has the
  machine nearly to itself, as in CI (two workers per job). A run with more workers, such as a full
  local run, records the timings marked "not judged" and holds only the sizes and bytes to their
  budgets; `npm run test:e2e -- perf.spec.ts --workers=2` judges them locally.
- **Upper bounds.** The test server does not compress, so a visit downloads 1.14 MB where GitHub
  Pages sends about 341 KB; on slow 4G that alone is about 4 s of the 6.7 s. A real first visit on
  that profile should be ready in about 3 s.

## Not measured

Real devices (an older iPad or a low-end Android tablet), Safari's own timings, a returning visit
(the HTTP cache, or the offline worker once a grown-up installs it), and the time a round, a board
or the map takes to open after the first screen. These are checks for the playtest and for a later
budget if one of them proves slow.

## Changing a budget

A budget moves only on purpose: when a change needs the room, raise the limit in
`test/e2e/perf.spec.ts` and the table above in the same commit, and say why in the commit message.
A budget that fails without such a change is a regression to look into first.
