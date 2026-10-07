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
- every bot earns coins every session and, except the perfect one, sees progress every week;
- no known fact (bronze and up: Leitner box 2+) waits more than a week past its review day; facts
  in box 0-1 are still being learned and are served as learning items;
- no dead ends: every level is completed and every boss won over;
- reward pacing stays inside targets (coins per session, a gift every day the goal is met, the
  market not emptied in the first three weeks, every egg hatched within five sessions);
- the first session hatches the first egg for every bot; the slow bot earns silver but never gold.

A simulated day costs about a hundred commits, so the long runs live outside the gate:
`node scripts/simulate.mjs --days 84 --check` runs the four bots for 12 weeks in parallel
processes, writes `out/simulation/report.md` and fails when a check fails (`--balance file.json`
simulates a changed balance block; `--answers` also writes every answer with its item, its tier
and Leitner box before the answer and the bot's recall, for analyses like balance-report.md §5).
The gate runs only the bots' model tests, the checks against synthetic reports and a short first
session (`test/sim/*.test.ts`). The measured results, the model's assumptions and the balance
decisions are in [balance-report.md](balance-report.md).

## 5. Browser end-to-end (Playwright): the QA suite (S6)

`test/e2e/` runs the built site at the Pages base `/dragon-valley/` in a real browser. Locally it
drives the system Microsoft Edge (`DV_BROWSER_CHANNEL=chrome` for Chrome) and never downloads
browsers; `$env:DV_E2E_ALL_ENGINES = '1'` runs Chromium, WebKit and Firefox where Playwright's own
builds are installed. CI runs each engine in parallel jobs with `DV_E2E_AUDIT=1`, one or more parts
of the suite each (`DV_E2E_PART`, comma-separated; `support/parts.ts`): `walks` (`screens`,
`reflow`), `rounds` (`input`, `persistence`, `recovery`, `settings`), `regions` (`regions`),
`valley` (`boards`, `bosses`, `upgrade`, `finale`, `map`) and `rest` (every other spec, including
any new one). Chromium and Firefox run two jobs each with two workers, `walks+rest` and
`rounds+regions+valley`; WebKit, about twice as slow per test on a hosted runner, runs one job per
part with three workers (its tests mostly wait on the engine, so the third worker shortens a job
on the four-processor runner). The split follows measured run times, so each job takes about seven
minutes, installation included; `harness.spec.ts` checks that the matrix runs every part once per
engine. Setup is under a minute: `setup-node`
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

| Spec                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`       | Boot at the Pages base with a validated pack and the same-origin CSP (S1/S3's original smoke, kept)                                                                                                                                                                                                                                                                                                                                                                    |
| `profiles.spec.ts`    | S3's flows on the real rules: prologue and first egg kept after a reload, the placement check by keyboard, the gate, notation, a rule setting, a rename, Escape pauses                                                                                                                                                                                                                                                                                                 |
| `first-run.spec.ts`   | Title → Play → editor (kind name and picture checks, Czech names, tidy spaces) → the prologue line by line, Skip, the first egg (cannot be skipped) → hub with the egg in the nest and the placement check offered; the prologue is told once; Back keeps nothing                                                                                                                                                                                                      |
| `keepers.spec.ts`     | Four keepers in fixed slots, no fifth; rename and new picture survive a reload; removal only behind the gate and a confirmation, and it erases the keeper's game and settings; a freed slot starts empty                                                                                                                                                                                                                                                               |
| `persistence.spec.ts` | A reload mid-round reopens the round on the same problem with the same coins; a finished check keeps its coins and is not asked again; keepers never share progress; a new keeper starts fresh                                                                                                                                                                                                                                                                         |
| `recovery.spec.ts`    | A failed save shows "Not saved" + Retry and holds the answer, Retry stores it exactly once (a reload resumes right after it); "Not saved" is the truth after a reload; a second window gets "Open in another window" + Reopen with the newer save; damaged family, game and settings records ask a grown-up (exact bytes export, previous copy, confirmed erase); unopenable storage offers only "Try opening again"                                                   |
| `gate.spec.ts`        | Two-digit × two-digit questions (no multiples of ten, no repeated digits, never the same twice); a wrong answer asks again with no lockout; hold by Space; early release; Escape and Back return focus                                                                                                                                                                                                                                                                 |
| `settings.spec.ts`    | The notation switch on every problem of the placement check (`6 · 2 = ?`, `14 : 2 = ?`, `5 · ? = 20` and their praise vs `×`, `÷`), per keeper, read aloud identically (an independent words oracle); settings persist per keeper; text size and reduced motion apply only while that keeper plays                                                                                                                                                                     |
| `read-aloud.spec.ts`  | A stand-in speech engine: only local English voices are used or listed (never the remote default, never Czech); the words match the written problem; auto-read; pause cancels speech; no local voice hides the button and the grown-ups' area says why; late voices appear                                                                                                                                                                                             |
| `input.spec.ts`       | Keypad and keyboard parity step by step (leading zero, six digits, delete); Enter sends the answer after keys were tapped, when a round reopens, and after Read aloud; choice tiles by typing, arrows (wrapping), Enter and Space; a whole check by touch; the pause dialog                                                                                                                                                                                            |
| `offline.spec.ts`     | Install for offline play (progress, Installed, newest version), then with the test's own server shut down the worker serves the game, a keeper plays the check and saves, and a cold start keeps the coins; emulated offline mode too (not WebKit, which fails navigations before the worker); no service worker says so                                                                                                                                               |
| `reflow.spec.ts`      | A keeper at 200 % text through the hub, the placement check and the valley (map, road, level card, choice tiles, Egg Grid, collections) at tablet, desktop and phone sizes; every screen at 200 % browser zoom                                                                                                                                                                                                                                                         |
| `motion.spec.ts`      | Flying coins and moving art without a preference (the control); none of it with the device's reduced motion or a keeper's own Reduce motion                                                                                                                                                                                                                                                                                                                            |
| `keyboard.spec.ts`    | Tab order forward and back on each screen (editor, prologue, eggs, hub, keypad, keepers, grown-ups), a visible focus ring on every stop, focus on each new screen's heading or answer area; dialogs keep focus inside and give it back; the keeper editor by keyboard alone (the name on arrival and after each problem, the pictures as one named radio group: arrows and Space choose, the choice reads as checked and is kept), focus rings checked by their pixels |
| `live.spec.ts`        | Live regions announce a miss and its fact, typed digits, praise, coins, results and toasts politely, a failed save assertively, and each region exists before it speaks                                                                                                                                                                                                                                                                                                |
| `screens.spec.ts`     | Every screen and state at three sizes: screenshots for review ([qa/screens.md](qa/screens.md)), axe (no serious or critical WCAG 2.2 A/AA violation) and the layout checks                                                                                                                                                                                                                                                                                             |
| `harness.spec.ts`     | The checks themselves see planted faults (including a focus ring removed by a rule or covered by art, which only the pixel check sees); the answer oracle solves hand-written problems in both notations                                                                                                                                                                                                                                                               |
| `regions.spec.ts`     | Each region of the valley (opened early by the grown-ups): a whole activity of its own kind, answered by the oracle to its results: stories (sign, then number), remainders, ×10 and ×100, two-digit × one-digit, comparisons with brackets, terms                                                                                                                                                                                                                     |
| `boards.spec.ts`      | Sharing Feast and Golem Orders by touch and by keyboard, played from what they show (deal the fruit, answer the division; pick the gear the order of operations does next, brackets first), a kind line for a wrong step; a feast of two-digit totals, then its two-digit divisions                                                                                                                                                                                    |
| `bosses.spec.ts`      | A boss's mood meter fills by one per right answer and holds on a miss until the boss is won over; the Seven-Headed Dragon is won over head by head, each head asking its own skill in order (tables, division, remainders, two-digit × one-digit, order of operations, comparisons, stories)                                                                                                                                                                           |
| `upgrade.spec.ts`     | (S3) A save from before a content update opens on its archived pack and moves to the newest at the hub; while that pack is out of reach the save waits on the recovery screen                                                                                                                                                                                                                                                                                          |
| `perf.spec.ts`        | Performance budgets ([qa/performance.md](qa/performance.md)): the script, style sheet and offline pack sizes; a first visit until the title is ready on fast and slow 4G with a processor four times slower (Chromium), timed in the page, with what it downloaded                                                                                                                                                                                                     |
| `visibility.spec.ts`  | A hidden page pauses the game: hidden time does not make answers slow (three stars where the same waits in view give two), the Lightning Arena's clock stands still, read-aloud stops                                                                                                                                                                                                                                                                                  |
| `grown-ups.spec.ts`   | Starting a keeper over (a confirmation, the dragons and progress erased, the settings kept), asking the browser to keep progress (only on a grown-up's tap; granted or declined), running the placement check again, the Lightning Arena switch (a keeper past the Bridge Troll, from a backup the rules played to: `support/saves.ts`)                                                                                                                                |

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
  more: `test.slow()` triples the budget, and the walks, regions, boards, bosses and offline specs
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
and axe advice by rule. With `DV_E2E_AUDIT=1`
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
