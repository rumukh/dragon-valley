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
cannot turn a failed gate green. The e2e job runs Playwright on Chromium, WebKit and Firefox.

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

| Area                      | Evidence                                                                                                                                                                                       | Where                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Contract                  | Schemas accept the sample and reject each class of mistake with a named diagnostic; answers for every problem kind are hand-checked; 231 fact IDs; calendar for 2000-2100; notation strings    | `test/unit/contract/`                       |
| Curriculum                | `docs/curriculum.md` and the content pack agree on objectives and level mapping                                                                                                                | `test/unit/contract/curriculum-doc.test.ts` |
| Generators (S2a)          | **Exhaustive**: every small-table fact and every parameter range yields a valid problem (`expectedAnswer` succeeds), remainders < divisors, distractors unique, non-negative, never the answer | `test/unit/learning/`                       |
| Command traces            | `runCommandTrace` scenarios with named checks, literal goldens and trajectory digests                                                                                                          | `test/traces/`                              |
| Learner simulation (S2a)  | Deterministic synthetic learners (below)                                                                                                                                                       | `test/sim/`                                 |
| Saves and migration (S2b) | Mid-round restore, failed checkpoint retry without double charge, content-revision upgrade of a fixture save to a v1.1 pack that adds an island                                                | `test/migration/`                           |
| Build and SDK             | Site graph verified and reproducible; forbidden modules rejected; vendored tarballs match the pin; lockfile canonical                                                                          | `test/tooling/`                             |
| Browser (S6)              | Playwright (below)                                                                                                                                                                             | `test/e2e/`                                 |

## 4. Learner-simulation bots

Deterministic synthetic learners play the real rules for simulated weeks, producing measurable
proxies for "fun" and "learning". Each bot is a seeded model of answering: per-item probability of a
correct answer rising with practice and spacing, response times by bucket.

| Bot        | Model                                                         |
| ---------- | ------------------------------------------------------------- |
| perfect    | always correct and fast                                       |
| average    | learns facts in a few exposures; forgets slowly; ok speed     |
| struggling | needs many exposures; forgets quickly; slow; often misses 6-9 |
| slow       | accurate but slow (tests fluency rules and keypad timing)     |

Assertions (thresholds in the test file):

- success rate per round stays in the 70-90 % band for average and struggling bots;
- the average bot crowns every table dragon within N simulated days;
- the struggling bot still completes a level, earns coins and a sticker every session, and its
  dragons never shrink;
- no due fact goes unreviewed for more than its interval plus a grace period;
- no dead ends: every level becomes reachable; every boss is beatable;
- reward pacing stays inside targets (coins per session, stickers per week, a gift every day the
  goal is met);
- the first session hatches the first egg for every bot.

## 5. Browser end-to-end (Playwright)

Locally Playwright drives the system Microsoft Edge (`DV_BROWSER_CHANNEL=chrome` for Chrome) and
never downloads browsers; CI installs Chromium, WebKit and Firefox. The web server builds the site at
the Pages base `/dragon-valley/`.

Today: the smoke test (boot with zero console errors, zero failed or cross-origin requests, the rules
reach the prologue in every engine, the CSP is declared). The S6 suite adds:

- first-run onboarding to the first hatch;
- one round by keyboard and one by touch emulation;
- save, reload and resume, including a failed checkpoint and retry;
- the parent gate and the notation switch;
- read-aloud with a mocked local voice;
- offline install and an offline reload with the origin denied;
- zero outbound requests and zero console errors throughout;
- 200 % text and reduced motion;
- screenshots at tablet, desktop and phone sizes for human review.

## 6. Human checkpoints

Approve dragon designs and backgrounds; audition the audio; review copy (simple English, sentence
length, Czech notation correctness, "times fewer" wording); **playtest with the child**, then iterate.
These are tracked as review gates by the coordinator, not claimed by automated tests.
