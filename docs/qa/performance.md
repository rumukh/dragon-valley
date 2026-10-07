# Performance budgets

What a child's tablet has to download, and how soon the first screen is ready on a slow connection
and a slow processor. `test/e2e/perf.spec.ts` checks every budget on each CI run and writes the
measurements to the job summary ("Performance"), so a budget is revisited with numbers in hand.

## Budgets

| What                                                    | Budget       | Now          | Notes                                           |
| ------------------------------------------------------- | ------------ | ------------ | ----------------------------------------------- |
| `app.js` as built / gzipped                             | 750 / 250 KB | 629 / 202 KB | the whole game: rules, SDK, screens, inline art |
| `app.css` as built / gzipped                            | 100 / 20 KB  | 64 / 12 KB   |                                                 |
| Offline pack without its audio                          | 2.5 MB       | 1.79 MB      | 44 files: data, images, script, style, fonts    |
| Whole offline pack (`resource-graph.json`)              | 10.5 MB      | 8.75 MB      | 77 files; the audio is 6.96 MB of it            |
| First visit: downloaded before the title (uncompressed) | 1.3 MB       | 1.09 MB      | 325 KB gzipped, as GitHub Pages sends it        |
| First visit, fast 4G, processor ×4: title ready         | 4 s          | 1.7 s        | first paint 0.36 s (budget 1.5 s)               |
| First visit, slow 4G, processor ×4: title ready         | 10 s         | 6.6 s        | first paint 1.13 s (budget 3 s)                 |

"Now" is commit `f850d39` on the development machine (Edge); CI's numbers are in each job summary.
Sizes are in decimal units (1 KB = 1 000 bytes). The audio has its own budget, 8 MB, held by S5's
tests ([audio.md](../audio.md): uncompressed WAV by design, for deterministic bytes without an
encoder); the rest of the offline pack is budgeted here.

## What the first screen costs

A first visit downloads eight files before the title is ready:

| File                                   | As built | Gzipped |
| -------------------------------------- | -------: | ------: |
| `app.js`                               |   629 KB |  202 KB |
| `content/dragon-valley.content.json`   |   256 KB |   17 KB |
| `app.css`                              |    64 KB |   12 KB |
| Reading font, regular and bold (WOFF2) |    77 KB |   77 KB |
| `content/catalogs/en.content.json`     |    30 KB |    8 KB |
| `assets/audio/manifest.json`           |    30 KB |    7 KB |
| `index.html`                           |     1 KB |    1 KB |
| **Total**                              | 1 088 KB |  325 KB |

Nothing else loads until the child does something: sounds load when they first play, and the
offline pack only when a grown-up installs it (8.75 MB, in the background, with progress shown).

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
- **Chromium only** for the timings: the throttling is the Chrome DevTools Protocol's. WebKit and
  Firefox run the size checks and skip the timings with that reason.
- **Upper bounds.** The test server does not compress, so a visit downloads 1.09 MB where GitHub
  Pages sends about 325 KB; on slow 4G that alone is about 4 s of the 6.6 s. A real first visit on
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
