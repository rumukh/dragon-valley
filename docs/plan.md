# Dragon Valley — A Times-Table Adventure

A colorful, English-language math game for Czech 3rd graders (8–9 years). It covers the
**whole 3rd-grade multiplicative program** in v1, built as a **standalone consumer of the Aegis
action-driven SDK** in a new public repository, `rumukh/dragon-valley`.

---

## 0. Status, decisions and assumptions

**Latest main.** Plan mode blocked `git pull` in the user's checkout, which is clean but sits at `cb73183`,
140 commits behind. All analysis used a fresh clone of `origin/main` at **`5949a7f`** (2026-09-26) in the
session folder. Todo #1 fast-forwards the real checkout.

What latest main offers this game, all public SDK exports:

| Package            | Used for                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@aegis/core`      | Seeded PRNG, hashing, validation envelopes                                                                                                                                                                                      |
| `@aegis/runtime`   | Deterministic command host: atomic actions, logical turns, scheduled jobs (used for re-asking missed facts), named random streams, versioned content packs with **boundary migration** (`activateContent`), `runCommandTrace` |
| `@aegis/narrative` | Story graph, `matching` / `ordering` minigames plus custom `MinigameAdapter`s, idempotent cosmetic grants, child-profile text limits, A4 duplex **print** layout                                                              |
| `@aegis/browser`   | IndexedDB `SaveService` with a strict checkpoint bridge, Web Audio (music bus, `playEffect` SFX, gesture unlock), accessible DOM controls, tap and drag placement, map hotspots, child-safe CSS preset, offline packs and service worker |

### Decisions (from Q&A)

| Topic              | Decision                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kind of game       | 2D adventure on the action SDK: DOM and animated SVG, touch-first with full keyboard support, saves progress, works offline                                    |
| Location           | **New public repo `rumukh/dragon-valley`** consuming packed SDK tarballs (the documented standalone route), deployed to GitHub Pages as an installable offline app |
| Theme              | **Dragon Valley**: hatch and raise a dragon per times table. Finale: the **Seven-Headed Dragon** (from Czech folklore, *sedmihlavý drak*)                       |
| Scope              | **Everything through the end of Czech 3rd grade in v1**, with complexity rising level by level. New levels will be added later, so content must be data-driven and saves must migrate |
| Language           | **English UI**, content matched to the Czech math program                                                                                                       |
| Notation           | Czech school notation by default: `3 · 4 = 12`, `12 : 3 = 4`, `23 : 5 = 4 r 3`. A parent setting switches to `×` / `÷` / `R`                                    |
| Sound              | Music and SFX, plus a **read-aloud button** that uses the device's built-in English speech. **Local voices only, no external service**                          |
| Art                | **SVG dragons and UI**, plus **AI-generated painted backgrounds** (valley map, region scenes, castle) with committed prompts and provenance                       |
| Players            | Family device: **up to 4 child profiles** and a parent area (progress, settings, backup, printables)                                                           |
| Devices            | A Windows PC or laptop (keyboard and mouse) plus a tablet of unknown OS. **Touch-first, full keyboard**, and the test matrix includes WebKit for a possible iPad   |

### Assumptions (edit if wrong)

- The repo license is **MIT**, matching Aegis. Fonts are OFL. AI art keeps its recorded provenance.
- No accounts, analytics, ads, purchases, outbound links or network calls beyond same-origin static files.
- The engine is not modified for this game. Any SDK gap or defect is reported as an issue in
  `rumukh/aegis-engine`, never patched inside the vendored tarballs.
- Painted backgrounds use the same **Azure OpenAI gpt-image** route as Coyote Gap's canyon. That skill
  is **not available in this session**, so you must enable it for the art workstream. Until then,
  SVG fallback backgrounds keep the game fully playable.
- Per your latest instruction, **every child session uses Claude Opus 5.5, long context, max
  reasoning** (`claude-opus-5.5`, `long_context`, `max`). This replaces the earlier GPT-5.6 Sol
  preference.

---

## 1. Problem and approach

Children need **thousands of quick, well-spaced retrievals** to become fluent, plus enough
understanding (arrays, strategies, fact families) for facts to stick. Plain drills get boring fast.

The approach: an **adaptive spaced-retrieval engine** wrapped in a **pet-raising adventure**. Dragons
grow with *real* mastery, and a "Magic Window" mosaic lights up fact by fact. Short, varied
mini-games, juicy feedback, collections and friendly folklore bosses keep it fun. Everything
authoritative is deterministic and headless-testable, the Aegis way. The browser is only a
presentation adapter.

---

## 2. Game design (GDD summary; the full GDD ships as `docs/design.md`)

### 2.1 Pillars

1. **Learn for real.** Adaptive spaced retrieval, visual models, named strategies, fact families,
   and alignment with the Czech 3rd-grade program.
2. **Joy every few seconds.** Characters react to every answer with sound, motion and sparkle, and
   activities vary.
3. **Visible growth.** Eggs hatch, dragons grow and get crowned, map regions open, and the Magic
   Window lights up.
4. **Kind and safe.** No punishment, no "wrong" red X, no FOMO, no streak shaming, no ads or
   in-app purchases, works offline, short sessions, parent controls.

### 2.2 Story and characters

- **Premise.** The Seven-Headed Dragon caught a cold and *sneezed*. The castle's **Magic Window**
  shattered into sparkly panes, and the valley's dragon eggs went cold. The player is the new **Dragon
  Keeper**. Practice warms the eggs and relights the panes. Old **Glimmer**, the castle dragon, is the
  guide. Lines are short, at most about 10 words per sentence, enforced with the narrative
  child-profile validator.
- **Table dragons** use designs that double as mnemonics. Each has 5 growth stages: egg, hatchling,
  youngling, adult, crowned.

  | ×  | Dragon  | Mnemonic design                                     |
  | -- | ------- | --------------------------------------------------- |
  | 0  | Puff    | Cloud-wisp dragon: everything × 0 goes *poof*       |
  | 1  | Mirror  | Silver dragon with a reflection: × 1 stays the same |
  | 2  | Bubbles | Two-tailed water dragon: doubles                    |
  | 3  | Clover  | Three-leaf forest dragon, 3 horns                   |
  | 4  | Petal   | Four-winged flower dragon: double the double        |
  | 5  | Sunny   | Five-ray sun crest, clock-hand tail (5-minute steps) |
  | 6  | Ember   | 6 fire spikes: "5 groups and 1 more"                |
  | 7  | Rainbow | 7 stripes, like the 7 colors of the rainbow         |
  | 8  | Crystal | 8-point snowflake crest: double, double, double     |
  | 9  | Starry  | Night dragon with 9 stars: the "10 groups − 1" trick |
  | 10 | Goldie  | Crown with 10 points: "add a zero"                  |

- **Special dragons** come from the later regions: **Pearl** (remainders as leftover pearls),
  **Boulder** (big numbers) and **Clockwork** (order of operations: gears turn in order).
- **Friendly folklore bosses.** You make them laugh, sleep or agree; nobody gets hurt. They are the
  Bridge Troll, the Forest Witch (*Ježibaba*), Krakonoš the Mountain Spirit, the Gnome King
  (*permoníci*), the Water Goblin (*vodník*, who keeps lost fruit in teacups), the Lake Nymphs, the
  Friendly Giant, the **Golem** (who must be given instructions in the right order) and the
  **Seven-Headed Dragon** (finale: cure the sneezes of all 7 heads).

### 2.3 World map and curriculum (Czech 3rd grade, multiplicative strand)

| #  | Region          | Curriculum covered                                                                                                                                                                           | New dragons                   | Levels    | Boss                 |
| -- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------- | -------------------- |
| 1  | Sunny Meadow    | Review from 2nd grade: meaning of × (equal groups, repeated addition, arrays), ×2 ×5 ×10, rules for ×1 and ×0, commutativity                                                                 | Bubbles, Sunny, Goldie, Mirror, Puff | 6         | Bridge Troll         |
| 2  | Whispering Woods | ×3, ×4; division by 3 and 4; "double the double"                                                                                                                                            | Clover, Petal                 | 6         | Forest Witch         |
| 3  | Fire Mountain   | **×6, ×7**; division; strategies (5 groups + 1 group, 5 groups + 2 groups)                                                                                                                   | Ember, Rainbow                | 6         | Krakonoš             |
| 4  | Crystal Caves   | **×8, ×9**; division; strategies (double ×4, 10 groups − 1 group, finger trick)                                                                                                              | Crystal, Starry               | 6         | Gnome King           |
| 5  | Sharing Lake    | Division across all tables, missing factor (`? · 6 = 42`), fact families, "N times as many / N times fewer"                                                                                 | (dragons reach Youngling)     | 6         | Water Goblin         |
| 6  | Leftover Lagoon | **Division with remainder** (`23 : 5 = 4 r 3`, remainder < divisor), leftover word problems                                                                                                  | Pearl                         | 5         | Lake Nymphs          |
| 7  | Giant's Peaks   | **Beyond the small tables**: ×10 and ×100, tens × 1 digit (`30 · 3`), **2-digit × 1-digit** (`14 · 3`, `23 · 4`), **2-digit : 1-digit** (`48 : 3`), within 1000                             | Boulder                       | 6         | Friendly Giant       |
| 8  | Riddle Ruins    | **Order of operations and brackets**, comparing expressions (`<` `>` `=`), multi-step **word problems**, the terms factor/product/dividend/divisor/quotient/remainder                          | Clockwork                     | 6         | Golem                |
| 9  | Dragon Castle   | Grand mixed review, Magic Window restored                                                                                                                                                    | Seven-Headed Dragon           | 3         | Seven-Headed Dragon  |

This adds up to about 50 levels and 9 bosses. The **Lightning Arena** (optional, timed, personal
bests) opens after Region 1. The **Endless Daily Adventure** keeps spaced review going after the
finale. Future content (new islands, 4th grade) arrives as new content-pack revisions.

### 2.4 Level structure: complexity rises with levels

- **Inside a table region**, levels follow a fixed sequence:
  1. Concept: arrays, groups and the strategy picture.
  2. Guided recall with multiple choice.
  3. Free recall on the keypad.
  4. The matching division and fact family.
  5. Mixed review with earlier tables.
  6. Word problems.
  7. The boss.
- **Across regions**, the order follows the curriculum. Each region's boss mixes its skills with
  spaced review of earlier ones.
- **Stars.** 1 star means completed. 2 stars need at least 80% accuracy. 3 stars need at least
  95% accuracy and fluency (fast answers). A low score never fails a level: it reads "Let's practice
  a bit more" and keeps partial progress.
- **Placement.** "Show the dragons what you know!" is a gentle adaptive check of 12–24 items that
  stops early if the child struggles. It can *skip ahead* through levels the child already knows,
  and those levels stay replayable.
- Parents can **unlock ahead** if the school is further along.

### 2.5 Activities (data-driven activity kinds)

| Activity                                   | Skill focus                         | Interaction                                                                                                  | Engine piece                                                       |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Feeding Time** (core)                    | Any problem kind                    | 8–12 problems. Multiple choice moves to keypad as the fact strengthens. Fruit flies into the dragon's mouth | Runtime commands; re-ask jobs                                      |
| **Memory Match** (pairs game)              | Fact ↔ product, fact ↔ quotient     | Flip pairs. Mismatches stay visible until cleared, with no timer                                             | `narrative` `matching`                                             |
| **Number Trail**                           | Counting in steps of a table        | Put multiples in order or fill gaps on a path                                                                | `narrative` `ordering` + custom                                     |
| **Egg Grid**                               | Meaning of ×, commutativity         | Build rows × columns of eggs for a product; finds every rectangle                                            | Custom `MinigameAdapter` + `createPlacement`                        |
| **Fact Family Nest**                       | × ↔ :                               | From 3 numbers, complete 4 equations                                                                         | Custom adapter                                                     |
| **Sharing Feast**                          | Division, remainder                 | Tap or drag fruit into baskets; leftovers stay in the bowl                                                   | Custom adapter + `createPlacement`                                  |
| **Compare Stones**                         | `<` `>` `=` with expressions        | Pick the sign                                                                                                | Custom adapter                                                     |
| **Riddle Scrolls**                         | Word problems                       | Read (🔊), pick the operation, then answer                                                                    | Runtime + templated generators                                     |
| **Golem Orders**                           | Order of operations, brackets       | Tap which operation goes first, then solve step by step                                                      | Custom adapter                                                     |
| **Lightning Arena** (optional)             | Fluency                             | 60-second race against your own best; no penalties                                                           | Runtime; the shell ends the round with an explicit command          |
| **Boss Challenge**                         | Region mix                          | Fill the boss's "sleepy, laughing or happy" meter; retry any time; you cannot lose                           | Runtime                                                            |

### 2.6 Adaptive learning engine (deterministic)

- **Items.** Every small-table fact is its own item: 121 multiplication facts (0–10 × 0–10) and about
  110 division facts. Open-ended skills are grouped into buckets, for example `mul2d1d:carry` or
  `remainder:d7`. Commuted facts share partial credit.
- **Leitner boxes 0–5.** Intervals (days) are `[0, 0, 1, 2, 4, 8]` and tunable. Moves:
  - Correct and fast or OK: up one box.
  - Correct but slow: stays in the box.
  - Wrong: back to box 1, invisibly.
- **Re-asking.** A miss schedules a **runtime job** to re-ask that item about 3 problems later, at
  most twice per round, and shows the visual model first.
- **Mix control.** Each round aims for about 80–85% success. About 70% of items are likely successes
  (due reviews and known facts) and about 30% are learning items. The mix shifts with rolling
  accuracy. There are no immediate repeats, tables are interleaved, and draws use named PRNG streams.
- **Time enters only as data.** The shell measures response time and sends it as `elapsedMs` in the
  answer payload, sorted into fast, OK or slow buckets. The local date arrives in the
  `startSession{ day }` payload. Rules never read a clock, so replays stay byte-identical.
- **Mastery levels.** Box 0–1 is dim, box 2 is bronze, boxes 3–4 are silver. Gold means box 5 plus
  2 fast answers out of the last 3. These levels drive both the **Magic Window** panes and dragon
  growth.
- **Kindness rules.** Dragons **never shrink**. A forgotten fact only makes its window pane
  "need polishing", and a dragon with due facts is *hungry for snacks*. Feeding hungry dragons is
  the spaced review, which ties memory upkeep to pet care.
- **Distractors** are plausible error patterns: neighbouring products a·(b±1), a + b, reversed
  digits, quotient ± 1, a swapped remainder. They are unique, non-negative and never the answer, and
  the options appear in seeded order.

### 2.7 Rewards and economy (all tunable balance JSON)

- **Coins**: 1 per correct answer, a streak bonus, level coins by stars, boss coins and daily quests.
  Coins are spent at **Glimmer's Market** on about 40 cosmetics: hats, scarves, glasses, wing paints
  and nest decorations. Ownership uses the narrative cosmetic grants; outfits are stored per dragon.
- **Sticker album**: about 48 achievements, one page per region.
- **Dragon growth stages** are the main reward:
  - Hatch: 30% mastery of the table's × facts.
  - Youngling: 60%, including division.
  - Adult: 90% and the region boss beaten.
  - Crowned: 100% gold.
- **Magic Window**: a 10×10 stained-glass mosaic, plus a division panel.
- **Daily**: 3 small quests and a **gift chest** after the daily goal. The chest uses a seeded
  `rewards` stream, prefers items not yet owned and guarantees a reward.
- **Printable certificates** for each crowned dragon, each region and the finale.
- **Dragon Diary**: an end-of-session summary such as "Today you learned 7 · 8 = 56!".

### 2.8 First session: the hook within 5 minutes

Title (tap also unlocks audio) → add a profile (name and keeper avatar) → 30-second story,
skippable and readable aloud → **choose your first egg** (×2, ×5 or ×10) → placement check →
first Feeding Time → **first hatch in the very first session** → first sticker and coins → buy a hat
→ the map shows the next glowing level.

### 2.9 Session flow and wellbeing

- **Daily Adventure** is one button, about 10–15 minutes: hungry dragons (due reviews), then the
  next level, then a mini-game, then the gift.
- After the daily goal, the dragons get sleepy. Play can continue; the parent sets the goal and an
  optional limit.
- Habit tracking shows **days practiced this week**, not a fragile streak.
- Timed play exists only in the optional Arena.

### 2.10 Presentation

- **Art direction.** Bright storybook style with a vivid, harmonious palette and an accent color per
  region:
  - **Painted backgrounds** (AI): the valley map, 9 region scenes and the castle hall with the Magic
    Window frame. The landscape takes Czech inspiration (rolling hills, a castle on a hill, pine
    forests, Krkonoše-like peaks, a millpond). No text appears in the images, negative space is left
    for UI, and prompts plus provenance are committed.
  - **SVG**: one **parametric dragon rig** built from a JSON recipe (palette, spikes, horns, wing
    pattern, stage proportions), all UI, icons and cosmetics. Cosmetics sit on rig anchors.
- **Animation.** CSS and Web Animations: breathing, blinking, wing flaps, chewing, hatching, fruit
  arcs, coin flights, confetti and a gentle "curious" tilt after a miss. **Reduced motion** is
  respected.
- **Feedback** never relies on color alone. A correct answer shows green, a check mark, a happy
  dragon and a chime. A miss shows orange, a "?", a curious dragon, a soft boop and "Almost! Let's
  look…".
- **Audio.** About 24 SFX (chimes with rising streak pitch, chomp, coin, egg crack, hatch fanfare,
  level up) and 4 music loops (valley, focused practice, boss, victory). Both come from
  **deterministic synthesis recipes** in the repo, with WAV or OGG outputs and digests committed.
  They play through the SDK's music and effects buses.
- **Read-aloud** uses the Web Speech API, **restricted to `localService` voices** (no network). A
  verbalizer turns Czech notation into English speech: "fifty-six divided by seven", "four
  remainder three". If the device has no local voice, the button is hidden and the parent area
  explains why.
- **Font**: Andika (SIL OFL), a literacy font with unambiguous digits. It is bundled for offline use.

### 2.11 UX, input and accessibility

- **Touch-first** on a landscape tablet, plus desktop and phone portrait. Targets are at least 48 px
  (`CHILD_SAFE_PRESET`), and text scales to 200% with reflow.
- **Keyboard**: digits type the answer (and select the matching choice), Enter submits, Backspace
  deletes, arrows and Space move through choices, Esc pauses. A big on-screen keypad is always
  available.
- Feedback is announced in an `aria-live` region, focus is managed with `openDialog` and
  `replaceProjection`, and the game pauses on visibility change.

### 2.12 Family profiles and parent area

- **Profiles.** Up to 4 children, each with a name, avatar, own dragons, progress and preferences.
  A small family record lists them.
- **Parent gate**: press and hold, then a 2-digit × 2-digit question.
- **Progress view**: Magic Window, accuracy and speed per table and skill, the 10 hardest facts,
  last-60-days trend, time played.
- **Settings**: notation, daily goal and limit, Arena on or off, read-aloud voice and auto-read,
  volumes, text size, reduced motion, re-run placement, unlock ahead.
- **Data**: backup export and import per child, confirmed reset, install for offline use, storage
  status.
- **Printables**: **flashcards of the hardest facts** (A4, double-sided, via `layoutPrint` /
  `renderPrintHtml`) and certificates.

---

## 3. Technical architecture

### 3.1 Repository and SDK consumption

- In aegis-engine, after the fast-forward:
  1. `npm ci`, then `npm run build`.
  2. `npm run pack:sdk -- --revision <HEAD> --out out\sdk-<short>`.
  3. `npm run test:consumer -- --artifacts out\sdk-<short>`.
- Copy all 4 tarballs and `artifacts.json` into `dragon-valley/vendor/aegis/<version>/`, then
  `npm install --save-exact` **all four in one invocation**. `docs/sdk-update.md` records the update
  procedure. A test verifies the vendored tarball digests against `artifacts.json`.
- Toolchain: Node 24, npm 11, TypeScript ^5 (pinned), esbuild 0.27.x, Vitest ^3, Playwright
  (system Chrome or Edge channel locally; Chromium, WebKit and Firefox on CI), ESLint and Prettier.
- The corporate `.npmrc` proxy is copied from aegis. Aegis's **lockfile canonicalisation** script and
  its test are ported, so `package-lock.json` keeps registry.npmjs.org URLs and CI can install.
- **Determinism lint**, mirroring Aegis: `src/rules/**` may not use `Date`, `performance`,
  `Math.random` or `Math.sin` and friends. Browser code in `src/app/**` is exempt.

### 3.2 Layout

```
dragon-valley/
  vendor/aegis/<version>/            # 4 SDK tarballs + artifacts.json (pinned, digest-checked)
  content/
    dragon-valley.content.json       # regions, levels, skills, activities, balance, items, stickers, quests (revisioned)
    history/                         # every shipped content revision (for save migration)
    story.graph.json                 # narrative graph (child-profile validated)
    catalogs/en.json                 # all UI strings (catalog-based, so a later translation is possible)
  src/rules/                         # deterministic, DOM-free; no clocks or Math.random
    adapter.ts                       # RuntimeAdapter: state/action/view schemas, commands, jobs, activateContent
    learning/ (items, generators, distractors, scheduler, mastery)
    economy/ (coins, shop, cosmetics, stickers, quests, gifts)
    progression/ (levels, regions, stars, unlocks, placement, dragons, window)
    minigames/ (egg-grid, fact-family, sharing, compare, golem-orders adapters)
    story/ (narrative graph integration)
    events.ts                        # event vocabulary
  src/app/                           # browser shell (DOM + SVG), uses @aegis/browser only
    boot, profiles, persistence, controller, screens/, components/, art/dragon-rig, audio/, speech/, print/, parent/
    sw.ts                            # offline worker entry (public @aegis/browser/offline/worker)
  assets/ backgrounds/ (webp + *.prompt.txt + provenance.json), audio/ (outputs + recipes + provenance), fonts/, icons/
  scripts/ build.mjs, serve.mjs, validate-content.mjs, synth-audio.mjs, simulate.mjs, canonicalise-lockfile.mjs
  test/ unit/, traces/, sim/, migration/, e2e/
  docs/ design.md, curriculum.md, architecture.md, testing.md, assets.md, sdk-update.md
  .github/workflows/ ci.yml, pages.yml
```

### 3.3 Rules: the runtime adapter

- **State** (per profile): items (box, stats, due day, last buckets); level and region progress;
  dragons (stage, warmth, outfit); window projection inputs; coins; cosmetics (narrative state);
  stickers; quests; daily aggregates (bounded to 60 days); active round and its progress; story
  state; rule-affecting settings (daily goal, unlock ahead, Arena on or off). Presentation settings
  such as notation, volumes and text size live in preferences, outside the game state.
- **Actions** (validated schemas):
  - `startSession{day}`, `startLevel{id}`, `startActivity{kind}`
  - `answer{value, elapsedMs}`, `minigameMove{…}`, `hint`, `endRound{reason}`
  - `placementAnswer`, `buy{item}`, `equip{dragon, item}`, `claimQuest`, `openGift`
  - `storyChoice`, `setSetting`
  - Each `answer` costs **1 logical turn**, which drives the re-ask jobs; navigation costs 0.
  - Stale UI is rejected with `expectedRevision`, using the labs' command-controller pattern.
- **Events** (for UI one-shots and test assertions):
  - Session and answers: `session.started`, `answer.correct`, `answer.incorrect`, `item.promoted`,
    `reask.scheduled`
  - Progression: `round.completed`, `level.completed`, `region.unlocked`, `boss.defeated`
  - Dragons and window: `dragon.hatched`, `dragon.grew`, `dragon.crowned`, `pane.lit`
  - Economy and story: `coins.earned`, `item.purchased`, `sticker.earned`, `quest.completed`,
    `gift.opened`, `finale.completed`
- **Random streams**: `problems`, `distractors`, `rewards` and `words`. They are independent, so a
  reward draw never changes the problem sequence.

### 3.4 Content model, extensibility and save migration

- Levels and skills are **pure data**. Example:
  `{ id, region, unlock, activities:[{kind, skills, count, input}], stars, rewards, intro }`, with
  skills such as `{ id:"mul.fact:7", generator:"mul.fact", params:{ tables:[7], factors:[0,10] } }`.
  Adding levels later means new JSON plus a content-revision bump. Only a new *generator or activity
  kind* needs code.
- `scripts/validate-content.mjs` checks:
  - schema, cross-references, unlock-graph reachability and non-empty skill pools;
  - **curriculum coverage**: every Czech 3rd-grade objective maps to at least one level and boss.
- **Migration**:
  1. A save pins its content revision.
  2. On upgrade, the app restores the save with the matching pack from `content/history/`.
  3. It then calls `activateContent(newPack, 'boundary')` while the child is at the hub.
     `adapter.activateContent` carries progress forward and inserts the new levels.
  4. A v1 test proves this path by upgrading a fixture save to a v1.1 pack that adds an island.

### 3.5 Persistence, profiles and offline

- **Saves.** A family record (`SaveService`, gameId `dragon-valley-family`), plus one game save per
  profile (`profileId` per child) through `createSaveCheckpoint`. That gives a strict durable
  checkpoint per answer, a visible "not saved, retry" state and recovery screens, following the labs.
- **Preferences** are stored per profile, separately from game state.
- **Offline.** The build emits a digest-checked resource graph and a worker bundled from the public
  export. The parent area offers "Install for offline play". There is no forced reload, and content
  updates activate only at a safe boundary.

### 3.6 Build, CI and Pages

- `npm run verify` runs build, typecheck (rules without DOM, app with DOM), lint (including the
  determinism and dependency checks), content validation, unit, trace, simulation and migration
  tests, and the lockfile check.
- **CI** runs verify on ubuntu and windows. E2E runs on ubuntu with Chromium (required), WebKit and
  Firefox (required smoke). Both use `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` like aegis.
- **Pages** builds with base `/dragon-valley/`, checks the artifact and deploys. The site serves over
  HTTPS, as offline install requires.

---

## 4. Verification strategy (agent-verifiable without pixels, per AGENTS.md)

1. **Exhaustive generator tests.** Every small-table fact and every parameter range has a correct
   answer and valid distractors. Remainders are always smaller than the divisor.
2. **Command traces.** Named events plus **literal** golden hashes and trajectory digests, never
   self-referential. Every test is **mutation-checked**: break the scheduler, the distractors or
   the unlocks, and watch the test go red.
3. **Learner-simulation bots** (deterministic synthetic learners: perfect, average, struggling,
   slow) provide measurable proxies for fun and learning:
   - success rate stays in the 70–90% band;
   - the average bot masters every table within N simulated days;
   - the struggling bot still progresses and earns rewards every session;
   - no due fact goes unreviewed; no dead-end unlocks;
   - every boss is beatable;
   - reward pacing stays inside targets.
4. **Save, restore and migration tests**: mid-round restore, a failed-checkpoint retry, and the
   content-revision upgrade.
5. **Browser E2E** (Playwright):
   - first-run onboarding;
   - one round by keyboard and one by touch emulation;
   - save, reload and resume;
   - parent gate and notation switch;
   - read-aloud with a mocked local voice;
   - offline install and offline reload;
   - zero outbound requests and zero console errors;
   - 200% text and reduced motion;
   - screenshots at tablet, desktop and phone sizes for human review.
6. **Human checkpoints**: approve dragon designs and backgrounds, audition the audio, review copy
   (simple English, Czech notation correctness), and **playtest with the child**, then iterate.

---

## 5. Delivery plan (todos are tracked in SQL)

### Execution model: everything is implemented in child sessions

Every child session runs on **`claude-opus-5.5` with `long_context` and `max` reasoning**. This
session is the **coordinator (PM)**. It writes no game code: it creates sessions, hands each one its
brief, reviews and merges PRs, keeps the contract in sync, answers questions and runs the human
review gates.

**Coordinator bootstrap** (the minimum needed to host child sessions):

1. `git pull --ff-only` the aegis-engine checkout. This is your original "fetch latest main".
2. `gh repo create rumukh/dragon-valley --public` with an MIT license and README, cloned to
   `C:\Users\rmukhamedov\dev\dragon-valley`.
3. `create_project` on that path.

**Child sessions** are worktrees in the `dragon-valley` project, one branch and PR each; the
coordinator merges:

| Session                      | Todos                                                                                                                                                       | Starts after                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **S1 Foundations & contract** | pack-sdk (reads the aegis checkout, writes only `out/`), scaffold-toolchain, ci-pages, design-docs, domain-contract                                          | bootstrap                        |
| **S2 Rules & content**       | problem-generators, adaptive-scheduler, progression-lifecycle, economy-rewards, dragons-window, story-graph, custom-minigames, content-v1, learner-sim, save-migration | S1 merged                        |
| **S3 App shell & screens**   | app-shell, design-system, read-aloud, printables, offline-install, then screens-activities                                                                  | S1 merged                        |
| **S4 Art**                   | dragon-rig, painted-backgrounds (needs the image skill enabled)                                                                                              | S1 merged (design-system tokens) |
| **S5 Audio**                 | audio-synthesis                                                                                                                                             | S1 merged                        |
| **S6 QA & release**          | e2e-suite, a11y-copy-review, then release-v1                                                                                                                | S3 shell is usable               |

The coordinator integrates the **Region 1 vertical slice** from S2–S5, then runs the playtest gate
with you. Scaling to all regions resumes only after that feedback.

| Phase                    | Todos                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Foundations**       | update-aegis-main → pack-sdk → create-repo → scaffold-toolchain → ci-pages                                                                                                                                                                                      |
| **1. Design and contract** | design-docs, domain-contract                                                                                                                                                                                                                                  |
| **2. Rules (headless)**  | problem-generators, adaptive-scheduler, progression-lifecycle, economy-rewards, dragons-window, story-graph, custom-minigames, content-v1, learner-sim, save-migration                                                                                           |
| **3. Presentation**      | app-shell, design-system, dragon-rig, screens-activities, painted-backgrounds, audio-synthesis, read-aloud, printables, offline-install                                                                                                                         |
| **4. Release**           | vertical-slice-playtest, e2e-suite, a11y-copy-review, human-review-playtest, release-v1                                                                                                                                                                         |

**Internal milestone: a vertical slice for an early playtest.** It contains Region 1 complete, with
Feeding Time, Memory Match, Egg Grid, the Bridge Troll boss, profiles, saving, SFX and one painted
background. Scaling to all 9 regions comes after the slice.

---

## 6. Risks and open items

- **Image generation access**: needed for painted backgrounds (see the assumptions in §0). SVG
  fallbacks prevent blocking.
- **Untested browsers**: the SDK is accepted on Chromium only, so WebKit (iPad) and Firefox are
  unclaimed. Our CI runs both, and defects go upstream as aegis issues.
- **Storage eviction**: browser storage can be evicted. Mitigations: backup export,
  `navigator.storage.persist()` on install, and visible save status.
- **Speech voices vary**: local English voices differ by device. Remote "natural" voices are
  excluded by design.
- **Wording of "times fewer"**: Czech "*x-krát méně*" has awkward English. Proposal: "N times as
  many" and "N times fewer", with a parent glossary. Needs editorial sign-off.
- **v1 size**: about 50 levels and 11 activity kinds. The vertical-slice playtest happens first so
  the fun is validated before scaling.
- **SDK upgrades**: each upgrade means a new complete tarball set. Saves keep working through
  content-history migration; runtime-format changes need explicit migrations.

## 7. Out of scope for v1

Czech UI translation (the catalogs make it possible later), recorded voice-over, accounts and cloud
sync, multiplayer or online leaderboards, teacher and classroom dashboards, 4th-grade content (new
islands later), and a native app wrapper.
