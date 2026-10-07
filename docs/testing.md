# Testing and verification

Everything authoritative is headless and deterministic, so almost all evidence is produced without
pixels (plan §4). This document is the verification strategy and the discipline every test follows.
It adopts the Aegis engine's test rules (AGENTS.md §6): **a test's job is to name the broken thing;
a golden is a pinned literal, never self-referential; every test is mutation-checked.**

## 1. The gate

`npm run verify` (CI on Ubuntu and Windows) runs, in order, and records each step in
`.verify-report.json`:

1. **build**: the static site, with its digest-checked offline resource graph;
2. **typecheck**: `src/rules` (ES2022 only), `src/app` (DOM), the worker (WebWorker), tests and the
   `@ts-check` scripts;
3. **lint**: determinism rules, dependency boundaries, the golden-hash ban;
4. **format**: Prettier (LF everywhere);
5. **content**: `scripts/validate-content.mjs` (schema, references, reachability, catalogs, child
   sentence length, history, art, curriculum coverage);
6. **test**: Vitest (unit, trace, tooling, later simulation and migration). The run is audited:
   every `*.test.ts` file on disk must have run, nothing may be skipped, at least one test must pass;
7. **lockfile**: canonical registry URLs.

CI then audits the record again outside npm (`node scripts/verify.mjs --audit`), so a lost exit code
cannot turn a failed gate green. The e2e jobs run the QA suite (§5) on Chromium, WebKit and Firefox:
each engine in parallel jobs (Chromium and Firefox in two, WebKit in five).

## 2. Rules for every test

1. **Name the capability.** Assertion labels read as bug reports ("the missed item came back three
   problems later as a re-ask"). Prefer event assertions (`answer.correct`, `dragon.hatched`) where
   the capability emits an event.
2. **Independent provenance.** An equality is an oracle only if the two sides do not share an
   ancestor. Expected values are written by hand from the design or curriculum, or computed by an
   independent oracle (the golden trace multiplies the problem's numbers itself; it never calls the
   contract's `expectedAnswer`). Never compare a run with itself.
3. **Goldens are literals.** `GOLDEN_HASH` and `GOLDEN_TRAJECTORY` (a digest of every commit hash)
   are captured once from a green run and pinned with a comment on their provenance. ESLint rejects
   `toBe(run.hash)`, `toBe(host.hash())` and `expectedHash: host.hash()`.
4. **Mutation-check.** Break the capability, watch the named assertion go red, put it back. The
   golden trace carries automated mutation checks (answers that cost no turns, grading every answer
   as wrong, another seed); other tests were mutation-checked by hand when written, and the PR that
   adds a test lists its mutations.
5. **Determinism in tests too.** Tests under `test/**` (except `test/e2e/**`) follow the rules'
   determinism lint: no clocks, no `Math.random`.

### When a golden moves

A golden changes only for a deliberate change to rules, content or the SDK. Before re-pinning:
check that every named check still passes (they describe behaviour; the golden only detects
change), understand why the hash moved, then pin the new literals and write the reason and the old
and new values in the commit message. Content changes move the golden because the pack's hash is part
of every snapshot.

## 3. Evidence by area

| Area                      | Evidence                                                                                                                                                                                                                                                                                      | Where                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Contract                  | Schemas accept the sample and reject each class of mistake with a named diagnostic; answers for every problem kind are hand-checked; 231 fact IDs; calendar for 2000-2100; notation strings                                                                                                   | `test/unit/contract/`                                   |
| Curriculum                | `docs/curriculum.md` and the content pack agree on objectives and level mapping                                                                                                                                                                                                               | `test/unit/contract/curriculum-doc.test.ts`             |
| Generators (S2a)          | **Exhaustive**: every small-table fact and every parameter range yields a valid problem (`expectedAnswer` succeeds), remainders < divisors, distractors unique, non-negative, never the answer                                                                                                | `test/unit/learning/`                                   |
| Command traces            | `runCommandTrace` scenarios with named checks, literal goldens and trajectory digests                                                                                                                                                                                                         | `test/traces/`                                          |
| Learner simulation (S2a)  | Deterministic synthetic learners (below)                                                                                                                                                                                                                                                      | `test/sim/`                                             |
| Saves and migration (S2b) | Mid-round restore, failed checkpoint retry without double charge, a real save of the deployed slice (1.0.0) restored with its archived pack and moved to the current pack at the hub, the next revision (a fixture island) activated at a safe boundary, every revision's content hash pinned | `test/migration/`, `test/unit/contract/content.test.ts` |
| Build and SDK             | Site graph verified and reproducible; forbidden modules rejected; vendored tarballs match the pin; lockfile canonical                                                                                                                                                                         | `test/tooling/`                                         |
| Browser (S6)              | Playwright (below)                                                                                                                                                                                                                                                                            | `test/e2e/`                                             |

## 4. Learner-simulation bots

Deterministic synthetic learners play the real rules for simulated weeks, producing measurable
proxies for "fun" and "learning". Each bot is a seeded model of answering: per-fact strength rising
with practice and fading with days without it (more slowly after spaced successes and for facts
known from 2nd grade), the chance of a right answer rising with it, and response times by how well
the fact comes to mind (`test/sim/learners.ts`). The driver (`test/sim/driver.ts`) plays the real
adapter through `createRuntimeHost` one day after another, following the Daily Adventure, and
records what a parent would see.

| Bot        | Model                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| perfect    | always right and quick, plays every day                                                |
| average    | knows the 2nd-grade tables, learns a fact in a few exposures, forgets slowly           |
| struggling | shaky on the 2nd-grade tables, needs many exposures, forgets quickly, slow and clumsy  |
| slow       | learns like the average child but is never quick (tests fluency rules and keypad time) |

The named checks (`test/sim/report.ts`, each label carries what it measured):

- success per session stays in the 70-90 % band for the average bot; the struggling bot's session
  median is at least 60 %, with the band as its stretch goal (it progresses more slowly but keeps
  succeeding: never wrong more often than right);
- the average bot grows every times-table dragon to adult within 12 weeks;
- the struggling bot sees its dragons grow (content 1.3.0's effort path): its first times-table
  youngling by the end of the first term (day 118 of a run from 5 October, or the run's end), and
  in a run of 365 days or more at least 3 times-table adults;
- every bot earns coins every session and, except the perfect one, sees progress every week;
- no known fact (Leitner box 2+) waits more than a week past its review day; facts
  in box 0-1 are still being learned and are served as learning items;
- no dead ends: the perfect, average and slow bots complete every level and win over every boss in
  12 weeks; the struggling bot keeps a steady path instead (its success matters more than its
  speed, and the rules' protection slows it by design): while levels remain, every week with play
  completes a new level, the boss of every region whose lessons it finished is won over, and at
  least ¾ of the levels (45 of 59) are done in 12 weeks;
- reward pacing stays inside targets (coins per session for the average bot, a gift every day the
  goal is met, every egg hatched within five sessions). Coins come from right answers, so the slow
  and struggling bots earn less than a typical session's 50-80 (design §7.1): their coins are
  reported as measured, and their market waits below are their binding targets;
- Glimmer's Market keeps something new coming (the 1.2.0 economy): the average bot still has
  something on sale it cannot afford yet after 110 sessions (a 365-day run) and gets something new
  with a median wait of at most 6 sessions and never more than 10; the slow bot waits at most 8
  sessions (median), the struggling bot at most 12; every bot buys its first cosmetic in its first
  week;
- the first session hatches the first egg for every bot; the slow bot earns silver but never gold.

A simulated day costs about a hundred commits, so the long runs live outside the gate:
`node scripts/simulate.mjs --days 84 --check` runs the four bots for 12 weeks in parallel
processes, writes `out/simulation/report.md` and fails when a check fails (`--balance file.json`
simulates a changed balance block; `--answers` also writes every answer with its item, its tier
and Leitner box before the answer, the bot's recall and the bucket the rules gave it, for analyses
like balance-report.md §5). Since 1.2.0 the bots take time to read a story's English text (600 ms
a word for the average bot, 900 for the slow and struggling bots, 300 for the perfect one: the
whole story before its first step, a quarter of it again before the answer that follows an
operation step); `--no-reading` reproduces the earlier runs without it.
Each report also records the day each fact was first met (an answer or a board's credit), the
measure of coverage; and `--growth test/sim/growth-study.json` follows other growth rules
alongside the shipped ones (`test/sim/growth.ts`). Growth past hatching never feeds back into
play, so the stage days a variant records are those it would give on the same run; the shipped
rules as a variant reproduce the game's own stage days (balance-report.md §8).
The gate runs only the bots' model tests, the checks against synthetic reports and a short first
session (`test/sim/*.test.ts`). The measured results, the model's assumptions and the balance
decisions are in [balance-report.md](balance-report.md).

## 5. Browser end-to-end (Playwright): the QA suite (S6)

`test/e2e/` runs the built site at the Pages base `/dragon-valley/` in a real browser. Locally it
drives the system Microsoft Edge (`DV_BROWSER_CHANNEL=chrome` for Chrome) and never downloads
browsers; `$env:DV_E2E_ALL_ENGINES = '1'` runs Chromium, WebKit and Firefox where Playwright's own
builds are installed. CI runs each engine in parallel jobs with `DV_E2E_AUDIT=1`, one or more parts
of the suite each (`DV_E2E_PART`, comma-separated; `support/parts.ts`): `walks` (`screens`,
`reflow`), `rounds` (`input`, `persistence`, `recovery`, `settings`, `teach`), `regions` (`regions`),
`valley` (`boards`, `bosses`, `upgrade`, `finale`, `map`), `activities` (`activities`), `days`
(`daily`, `collections`), `controls` (`grown-ups`, `visibility`), `playtest` (`playtest`), `journey` (`journey`, `placement`) and
`rest` (every other spec, including any new one). Chromium and Firefox run four jobs each with two
workers, `walks+rest`, `rounds+controls`, `regions+valley+activities+days` and `journey+playtest`;
WebKit, about twice as slow per test on a hosted runner, runs eight jobs of one or two parts with
three workers (`regions+controls` and `activities+playtest` share one each; its tests mostly wait
on the engine, so the third worker shortens a job on the four-processor runner). The split follows
measured run
times, so each job takes about seven minutes, installation included; `harness.spec.ts` checks that
the matrix runs every part once per engine. Setup is under a minute: `setup-node`
restores npm's cache, and Playwright's browsers are downloaded, not cached, because the download
is 4–9 s of the install step and the rest is the system packages (apt: about 15 s for Chromium
and Firefox, 45 s for WebKit), which a browser cache would not skip. A slow Ubuntu mirror once
stretched WebKit's packages from one minute to ten; the 20-minute job limit leaves room for that.

```
npm run test:e2e                                   # everything, system Edge
npm run test:e2e -- input.spec.ts --headed         # one spec, watching
$env:DV_E2E_ALL_ENGINES = '1'; npm run test:e2e -- --project=webkit
$env:DV_E2E_PART = 'regions,valley'; npm run test:e2e   # parts, as a CI job runs them
$env:DV_E2E_PORT = '4401'; npm run test:e2e       # a second run beside another one
```

**WebKit on Windows is not CI's WebKit.** Playwright's Windows build behaves differently from the
Linux one CI runs, in two ways that show in this suite:

- It draws a page at rest only a few times a second. Taps wait for stable frames, so touch tests
  run slower (the Sunny Meadow journey by touch takes 6.5 to 12 min there, by how busy the machine
  is, against 3.5 min on CI), long specs such as the day's (`daily.spec.ts`, three to four times
  slower than on CI) can run out of their time budgets, and the blank-screen watch's runs are
  coarse.
- Once a Tab pass has left the page, the document loses focus. `toBeFocused` then reports the
  focused element as "inactive", although it is the active element. `keyboard.spec.ts` › "the
  keepers screen and the grown-ups area are in reading order" fails there for that reason only;
  CI's WebKit passes it.

Judge WebKit by CI, or by WebKit on Linux or macOS. At main `5d98ee3`, this is the only local WebKit
failure in `input.spec.ts` and `keyboard.spec.ts`. Two `input.spec.ts` tests that failed there the
same way before #19 pass now.

### Guards on every test

Every spec imports `test` and `expect` from `test/e2e/support/fixtures.ts`. Its automatic `guard`
fixture watches the whole browser context and fails the test on any **console message** (of any
level: the game writes none), **uncaught error**, **failed or 4xx/5xx request**, **request to
another origin**, **outbound link or URL** in the page (a MutationObserver from the first parsed
node: links, forms, media, embeds, `mailto:`/`tel:`), **`window.open`**, **beacon, socket or peer
connection**, **CSP violation** or **navigation away**. A request the browser cancels (its page
moved on, or the audio service dropped a sound it no longer needs) is only noted. A test that
provokes a finding on purpose says so with `guard.allow(kind, pattern, reason)`; every finding and
allowance is attached to the report as `qa-guard.json`. `harness.spec.ts` plants each kind of fault
and proves the guard, the axe audit, the layout checks and the answer oracle all see it.

### What the suite covers

| Spec                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`       | Boot at the Pages base with a validated pack and the same-origin CSP (S1/S3's original smoke, kept)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `profiles.spec.ts`    | S3's flows on the real rules: prologue and first egg kept after a reload, the placement check by keyboard, the gate, notation, a rule setting, a rename, Escape pauses                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `first-run.spec.ts`   | Title → Play → editor (kind name and picture checks, Czech names, tidy spaces) → the prologue line by line, Skip, the first egg (cannot be skipped) → hub with the egg in the nest and the placement check offered; the prologue is told once; Back keeps nothing                                                                                                                                                                                                                                                                                                                                                                                                 |
| `keepers.spec.ts`     | Four keepers in fixed slots, no fifth; rename and new picture survive a reload; removal only behind the gate and a confirmation, and it erases the keeper's game and settings; a freed slot starts empty                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `persistence.spec.ts` | A reload mid-round reopens the round on the same problem with the same coins; a finished check keeps its coins and is not asked again; keepers never share progress; a new keeper starts fresh                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `recovery.spec.ts`    | A failed save shows "Not saved" + Retry and holds the answer, Retry stores it exactly once (a reload resumes right after it); "Not saved" is the truth after a reload; a second window gets "Open in another window" + Reopen with the newer save; damaged family, game and settings records ask a grown-up (exact bytes export, previous copy, confirmed erase); unopenable storage offers only "Try opening again"                                                                                                                                                                                                                                              |
| `gate.spec.ts`        | Two-digit × two-digit questions (no multiples of ten, no repeated digits, never the same twice); a wrong answer asks again with no lockout; hold by Space; early release; Escape and Back return focus                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `settings.spec.ts`    | The notation switch on every problem of the placement check (`6 · 2 = ?`, `14 : 2 = ?`, `5 · ? = 20` and their praise vs `×`, `÷`), per keeper, read aloud identically (an independent words oracle); settings persist per keeper; text size and reduced motion apply only while that keeper plays                                                                                                                                                                                                                                                                                                                                                                |
| `read-aloud.spec.ts`  | A stand-in speech engine: only local English voices are used or listed (never the remote default, never Czech); the words match the written problem; auto-read; pause cancels speech; no local voice hides the button and the grown-ups' area says why; late voices appear                                                                                                                                                                                                                                                                                                                                                                                        |
| `input.spec.ts`       | Keypad and keyboard parity step by step (leading zero, six digits, delete); Enter sends the answer after keys were tapped, when a round reopens, and after Read aloud; choice tiles by typing, arrows (wrapping), Enter and Space; a whole check by touch; the pause dialog                                                                                                                                                                                                                                                                                                                                                                                       |
| `offline.spec.ts`     | Install for offline play (progress, Installed, newest version), then with the test's own server shut down the worker serves the game, a keeper plays the check and saves, and a cold start keeps the coins; emulated offline mode too (not WebKit, which fails navigations before the worker); no service worker says so                                                                                                                                                                                                                                                                                                                                          |
| `reflow.spec.ts`      | A keeper at 200 % text through the hub, the placement check and the valley (map, road, level card, choice tiles, Egg Grid, collections) at tablet, desktop and phone sizes; every screen at 200 % browser zoom                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `motion.spec.ts`      | Flying coins and moving art without a preference (the control); none of it with the device's reduced motion or a keeper's own Reduce motion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `keyboard.spec.ts`    | Tab order forward and back on each screen (editor, prologue, eggs, hub, keypad, keepers, grown-ups), a visible focus ring on every stop, focus on each new screen's heading or answer area; dialogs keep focus inside and give it back; the keeper editor by keyboard alone (the name on arrival and after each problem, the pictures as one named radio group: arrows and Space choose, the choice reads as checked and is kept), focus rings checked by their pixels                                                                                                                                                                                            |
| `live.spec.ts`        | Live regions announce a miss and its fact, typed digits, praise, coins, results and toasts politely, a failed save assertively, and each region exists before it speaks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `screens.spec.ts`     | Every screen and state at three sizes: screenshots for review ([qa/screens.md](qa/screens.md)), axe (no serious or critical WCAG 2.2 A/AA violation) and the layout checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `harness.spec.ts`     | The checks themselves see planted faults (including a focus ring removed by a rule or covered by art, which only the pixel check sees, and a faded, wordless or missing screen for the blank-screen watch); the answer oracle solves hand-written problems in both notations                                                                                                                                                                                                                                                                                                                                                                                      |
| `regions.spec.ts`     | Each region of the valley (opened early by the grown-ups): a whole activity of its own kind, answered by the oracle to its results: stories (sign, then number), remainders, ×10 and ×100, two-digit × one-digit, comparisons with brackets, terms                                                                                                                                                                                                                                                                                                                                                                                                                |
| `boards.spec.ts`      | Sharing Feast and Golem Orders by touch and by keyboard, played from what they show (deal the fruit, answer the division; pick the gear the order of operations does next, brackets first), a kind line for a wrong step; a feast of two-digit totals, then its two-digit divisions                                                                                                                                                                                                                                                                                                                                                                               |
| `bosses.spec.ts`      | A boss's mood meter fills by one per right answer and holds on a miss until the boss is won over; the Seven-Headed Dragon is won over head by head, each head asking its own skill in order (tables, division, remainders, two-digit × one-digit, order of operations, comparisons, stories)                                                                                                                                                                                                                                                                                                                                                                      |
| `upgrade.spec.ts`     | (S3) A save from before a content update opens on its archived pack and moves to the newest at the hub; while that pack is out of reach the save waits on the recovery screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `perf.spec.ts`        | Performance budgets ([qa/performance.md](qa/performance.md)): the script, style sheet and offline pack sizes; a first visit until the title is ready on fast and slow 4G with a processor four times slower (Chromium), timed in the page, with what it downloaded                                                                                                                                                                                                                                                                                                                                                                                                |
| `visibility.spec.ts`  | A hidden page pauses the game: hidden time does not make answers slow (three stars where the same waits in view give two), the Lightning Arena's clock stands still, read-aloud stops                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `activities.spec.ts`  | Memory Match by touch and by keyboard (a mismatch turned back first; the family, term and remainder cards), Number Trail by touch and by keyboard (a trail of tens too), the Fact Family nest, and an Egg Grid built by touch from a split goal, each played from what the board shows                                                                                                                                                                                                                                                                                                                                                                            |
| `collections.spec.ts` | Glimmer's Market (an item too dear says so and takes nothing; bought for its price), the Dragon Den (dressed, kept after a reload, taken off; the first dressing earns "Dressed Up", told by a toast and kept in the album), the Sticker Album (earned and unearned stickers on their region's page; pages by Next and by the arrow keys), the Magic Window (dark at first, then the practised × and : facts lit)                                                                                                                                                                                                                                                 |
| `daily.spec.ts`       | The Daily Adventure with a lowered goal: the goal reached, the dragons sleepy, the gift once; the next day (the page's clock moved): both days practised, snack time first, the gift again. Pacing: after today's level and the day's mini-game, a day under 70 % suggests snack time or a review, never a new level; a good day the next level                                                                                                                                                                                                                                                                                                                   |
| `grown-ups.spec.ts`   | Starting a keeper over (a confirmation, the dragons and progress erased, the settings kept), asking the browser to keep progress (only on a grown-up's tap; granted or declined), running the placement check again, the Lightning Arena switch (a keeper past the Bridge Troll, from a backup the rules played to: `support/saves.ts`)                                                                                                                                                                                                                                                                                                                           |
| `playtest.spec.ts`    | The coordinator's Region 1 playtest findings (fixed by #14 and #17) as regression checks: Sunny Meadow 6's stories ask their sign on sign tiles and both right answers are praised; at 1180 × 820 and 1024 × 768 the hub, the Egg Grid, a round, each hatch and the results need no page scrolling; the hatched dragon is at least 200 px each way with no word on it; no change of screen is blank for more than 300 ms (`support/blank.ts`; Chromium at a 4× slower processor)                                                                                                                                                                                  |
| `teach.spec.ts`       | Teach, then ask: a fact missed in the browser comes back a few problems later with its picture first ("Let's try this one again. Look first!", no Show me); a fact missed twice in a row, in a game the rules played to the moment (`missedFactBackup`), is taught with its picture first, drawn unsolved, and "Look at the picture first. Then answer!"; a × 0 fact, which has no picture, must not be sent to look at one (DV-QA-18)                                                                                                                                                                                                                            |
| `journey.spec.ts`     | Sunny Meadow whole, from a new keeper to the Bridge Troll, once by keyboard alone (Enter on each control; the Egg Grid's nests built with its steppers) and once by touch alone on a tablet (every control tapped; nests by tapping a spot): every level at least two stars, shown on its road marker, each opening the next; the purse growing; every hatch celebrated (Bubbles in the first level); every finished quest claimed for its coins and still claimed after a reload; the troll's meter one fuller per number answered (a story's sign step leaves it); the Lightning Arena open, Whispering Woods awake, the daily goal reached and the gift opened |
| `placement.spec.ts`   | The placement check's three paths, and the road after each: a child who passes every step has Sunny Meadow 2 to 5 placed with one star, their eggs and level 6 open, with level 1 still next; three misses in a row stop it with nothing placed; leaving part-way keeps what was placed and the check is not offered again                                                                                                                                                                                                                                                                                                                                        |

### How the tests drive the game

- **Through the screen only.** Helpers in `support/app.ts` act as a child or grown-up would
  (test IDs are handles, never private state). Answers come from `support/problem.ts`, an
  independent oracle that parses the rendered problem (either notation, brackets, an answer box
  anywhere, remainders, a comparison's sign, a marked term) and works it out with its own
  arithmetic; a story's sign step is matched against the pack's word-problem templates, whose
  words the story shows. The grown-ups' "Open regions early" opens every level of a region
  (`openRegionsEarly`), so any activity, boss or the finale is one map trip away.
- **One run per port.** Each `DV_E2E_PORT` builds into its own `out/e2e-site-<port>` and writes
  to its own output folder (`out/e2e-results-<port>`; `test-results/` on the default port), so
  two local runs never clear each other's files. Every run starts its own web server and never
  reuses one already listening: a busy port (another run, another checkout serving its own build)
  stops the run at once with Playwright's "already used" message.
- **Faults from outside.** `support/storage.ts` damages stored records the way a failing disk
  would (the intact copy kept as "previous") and installs IndexedDB faults before the game starts
  (writes that fail like a full disk, storage that will not open like some private windows).
  `support/speech.ts` replaces the speech engine with recorded voices.
- **Named waits only.** Feedback is observed in the page (`feedbackAfter`), so a half-second
  "Yes!" is never missed; there are no fixed sleeps except where a duration is the subject (the
  gate's two-second hold).
- **Time budgets.** A test has 120 s, an `expect` 10 s. Whole rounds and other long flows declare
  more: `test.slow()` triples the budget, and the walks, regions, boards, bosses, journeys and offline specs
  set theirs (`test.setTimeout`). A budget is at least twice the test's slowest time on CI, and the
  job summary lists every test that used more than half of its budget, so a budget is raised
  before a slower runner turns it into a failure.
- **Layout checks** (`support/layout.ts`): no sideways scrolling (naming the element that sticks
  out), no control outside the viewport or cut off by a clipping parent, every control at least
  48 × 48 px (a radio or switch measured by its label), no word broken in the middle.
- **Accessibility** (`support/a11y.ts`): axe-core with the WCAG 2.2 A/AA and best-practice rules;
  serious and critical violations fail, moderate and minor ones are attached as advice and listed
  in the job summary.
- **Focus you can see** (`focusPixels`, `support/a11y.ts`): where a ring matters most (the keeper
  editor), the pixels around the focused control are compared before and after focus leaves it by
  a key press, so a ring that art covers, a later rule takes away or an engine never draws is
  caught; computed styles alone would pass all three.
- **Never a blank screen** (`support/blank.ts`): on every animation frame the page checks that the
  stage shows a screen, not faded out (below 0.3 opacity), with at least one visible word in the
  viewport; a run of blank frames lasts until the next frame that is not. The harness plants each
  kind (faded, words hidden, no screen). With the screens fading in from nothing and no wait for
  their pictures (the playtest finding, planted), Chromium at a 4× slower processor showed
  130–570 ms of blank screen per change and under 90 ms without the slowdown, so the check runs
  slowed down there; the fixed game shows no blank frame at either speed. Headless WebKit on
  Windows draws a page at rest only a few times a second, so its runs are coarse.

### Known defects and the job summary

A defect found by the suite is written up in [qa/defects.md](qa/defects.md) and registered in
`support/known-issues.ts` (`DEFECTS`, plus `KNOWN_LAYOUT` for layout findings; axe findings in
`KNOWN_AXE`, `support/a11y.ts`). The test states the
behaviour the game should have and wraps that one assertion in `unlessKnown(...)`: while the defect
reproduces the test records it and carries on; when the fix lands the assertion passes and the
summary lists the marker as "fixed?" so it can be removed. A defect seen on one engine only lists
it (`engines`), and stays a failure everywhere else. One that shows only under some timings is
marked `intermittent` (everywhere, or on the engines it names): a passing run there is noted ("not
seen this time"), not taken for a fix. Nothing unlisted is tolerated.

`support/qa-reporter.ts` writes `qa-summary.md` into the run's output folder (`test-results/` on
the default port) and the GitHub job summary: totals, known defects still reproducing (with the
evidence a test recorded for them), markers that no longer reproduce, registered defects that no
test met (in a full run: a layout or axe allowance whose problem is gone says nothing by itself),
tests that used more than half their time budget, performance measurements against their budgets,
blank screens between screens (frames watched, the longest frame, every blank run) and axe advice
by rule. With `DV_E2E_AUDIT=1`
it also fails the run if a spec file (of the job's part) did not run in a project or a test was
skipped without a reason.

### Artifacts

Each CI job uploads `qa-screens-<job>` (screenshots and contact sheets, 30 days:
`chromium-walks+rest`, `firefox-walks+rest` and `webkit-walks`, the jobs that run the walks) and
`playwright-report-<job>` (the HTML report with every axe result and guard report attached,
`qa-summary.md`, `results.json`), plus `playwright-traces-<job>` when something failed.

### Adding a test

Import from `./support/fixtures`, drive through `support/app.ts`, compute answers with
`support/problem.ts`, give every assertion a label that reads as a bug report, and plant the
fault once (by hand, or in `harness.spec.ts` for a new kind of check) to watch it go red. New
screens join a walk in `support/tour.ts`, so they get screenshots, axe and the layout checks for
free; add their stops to [qa/screens.md](qa/screens.md).

## 6. Human checkpoints

Approve dragon designs and backgrounds; audition the audio; review copy (simple English, sentence
length, Czech notation correctness, "times fewer" wording); **playtest with the child**, then iterate.
These are tracked as review gates by the coordinator, not claimed by automated tests.
