# The domain contract

`src/rules/contract/` is the shared language of Dragon Valley: the content pack, problems and
answers, item IDs, per-profile state, actions, views, events and identifiers. The rules (S2a, S2b)
implement it, the shell (S3) renders it, art (S4) and audio (S5) are keyed by its IDs, and QA (S6)
asserts on it. Everything is built on public `@aegis/runtime` schemas and `@aegis/narrative` types,
and everything is plain JSON.

This document explains every part, the invariants each part guarantees, the rules that implement
it, and who owns what. The design it serves is
[design.md](design.md); the curriculum is [curriculum.md](curriculum.md).

## 1. Map

| File             | What it defines                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ids.ts`         | Canonical region, dragon, boss IDs; closed vocabularies: stages, expressions, slots, avatars, mastery levels                                                 |
| `kinds.ts`       | Activity kinds, minigame kinds, input modes, operators, relations, response buckets, generators, random streams, event phases, strands, word families, terms |
| `schema.ts`      | Schema helpers on the runtime `schema` API (`contentId`, `catalogKey`, `artId`, `oneOf`, `nullable`, `objectWithOptional`, …)                                |
| `problems.ts`    | Expressions, problems, answers, reference answers (`expectedAnswer`), item IDs                                                                               |
| `notation.ts`    | Reference text rendering in Czech and international notation                                                                                                 |
| `skills.ts`      | Skills, generator parameter schemas, item universes (`skillItems`)                                                                                           |
| `minigames.ts`   | Typed minigame boards (`BoardView`), card faces (`CardFace`) and the moves of every minigame activity                                                        |
| `content.ts`     | The content pack schema, `contentRegistration`, cross-reference validation, catalog/art/curriculum helpers                                                   |
| `state.ts`       | `ProfileState` and its schema, `STATE_VERSION`, day numbers, the initial state                                                                               |
| `actions.ts`     | `GameAction`, `ACTION_TURNS`, `gameActionSchema`                                                                                                             |
| `views.ts`       | `GameView` and every screen's view type                                                                                                                      |
| `events.ts`      | `EVENTS` and payload types                                                                                                                                   |
| `persistence.ts` | Adapter, database, game and profile IDs; profile seeds                                                                                                       |
| `index.ts`       | Barrel: `import { … } from '../rules/contract'`                                                                                                              |

The runtime adapter is `src/rules/adapter.ts` (`dragonValleyAdapter`, `createGameHost`).

## 2. Ownership and changing the contract

| Area                                                                                                                                                                                                                             | Owner                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Problem generation: `src/rules/learning/generate.ts` and the generator and distractor modules under `src/rules/learning/`; the content `wordTemplates` section and the `word.*` catalog keys; learner simulation (`test/sim/**`) | S2a Problem generators & learner sim |
| The rest of `src/rules/**` (adapter, rounds and item selection, minigames, economy, progression, story, view) and the rest of `content/**` (pack, history, `en.content.json`)                                                    | S2b Game rules & content             |
| `src/app/**` except `src/app/art/**`; `content/catalogs/en.ui.json`                                                                                                                                                              | S3 App shell & screens               |
| `assets/art/**`, `assets/backgrounds/**`, `src/app/art/**`, `scripts/art/**`, `docs/art.md`                                                                                                                                      | S4 Art                               |
| `assets/audio/**`, `scripts/audio/**`, `docs/audio.md`                                                                                                                                                                           | S5 Audio                             |
| `test/e2e/**`, CI hardening (`.github/**` changes beyond fixes)                                                                                                                                                                  | S6 QA & release                      |
| Toolchain (`package.json`, tsconfigs, ESLint, Prettier, `scripts/*.mjs`, `vendor/**`)                                                                                                                                            | Coordinator review; S1 set up        |

**Contract changes** (anything under `src/rules/contract/`) go through a PR reviewed by the
coordinator, even when S2a or S2b makes them, because every session builds on it. A contract PR states
what changed, why, and what each consumer must do. Prefer additive changes: a new optional view
field, a new event, a new union variant. Renaming or removing something is a breaking change and
needs the coordinator's agreement first.

## 3. Determinism

- The rules are pure functions of state, content, action and the named random streams. Same
  actions, content and seed give the same state hash on every OS and in every browser (CI runs the
  golden trace on Windows and Ubuntu).
- **Time enters only as data**: the child's local date in `startSession.day` (`YYYY-MM-DD`) and
  the measured response time in `answer.elapsedMs`. The shell computes both; rules never read a
  clock.
- **Randomness** comes only from `context.random(stream)` with the streams `problems`,
  `distractors`, `rewards` and `words` (§10). Streams are forked once by the runtime, so a reward
  draw never shifts the next problem.
- Integer arithmetic only: no fractions in content or state (percentages are integers 0-100,
  durations are milliseconds), no `Math.sin`/`pow`/`random`, no `**`, no locale-dependent string
  functions. ESLint enforces this for `src/rules/**` and every non-e2e test.
- Rules never format text; views carry catalog keys and structured problems.

## 4. Identifiers

- **Content IDs** match `CONTENT_ID_PATTERN` (`/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/`, at most 64
  characters): `sunny-meadow`, `sunny-meadow.3`, `mul:7x8`, `beat.prologue`.
- **Canonical v1 IDs** (`ids.ts`): regions `sunny-meadow` … `dragon-castle`; table dragons by table
  (`TABLE_DRAGON_IDS[7] === 'rainbow'`); special `pearl`, `boulder`, `clockwork`; finale
  `seven-headed`; guide `glimmer`; bosses `bridge-troll` … `seven-headed`. Dragon and boss IDs are
  separate namespaces (`seven-headed` is both).
- **Closed vocabularies** implemented in code: stages `egg`, `hatchling`, `youngling`, `adult`,
  `crowned`; expressions `idle`, `happy`, `curious`, `eating`, `sleepy`, `proud`; cosmetic slots
  `head`, `neck`, `eyes`, `wings`, `nest`; avatars `keeper-1` … `keeper-8`; mastery `dim`, `bronze`,
  `silver`, `gold`.
- **Stable forever.** Once shipped, an ID is never renamed or reused. Saves, the art catalog and the
  audio manifest refer to it. Retiring one needs a migration (§7.6).
- **Catalog keys** (`catalogKey`, e.g. `level.sunny-meadow.3`) name strings in
  `content/catalogs/en.content.json`. **Art IDs** (`artId`) name entries of the art catalog.

## 5. Problems and answers (`problems.ts`)

Problems are structured and notation-agnostic; the shell renders them and the verbalizer speaks
them.

### 5.1 Expressions

```ts
type Expr =
  | { kind: 'num'; value: number } // 0 … 100 000
  | { kind: 'blank' } // the unknown the child supplies
  | { kind: 'op'; op: 'add' | 'sub' | 'mul' | 'div'; left: Expr; right: Expr }
  | { kind: 'group'; inner: Expr }; // explicit brackets
```

Precedence is the tree. Brackets are rendered only for `group` nodes and where `needsGroup` says
the tree needs them (a looser child, or a right child of `-` or `:` with equal precedence). Values
are non-negative integers; division inside an expression is exact; trees are at most 8 deep and 31
nodes.

### 5.2 Problem kinds

| Kind       | Shape                                                             | Example (Czech)                              | Answer                               |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| `equation` | `{ left: Expr; right: Expr }`, exactly one blank                  | `7 · 8 = ?`, `? · 6 = 42`, `(2 + 3) · 4 = ?` | `number`                             |
| `divrem`   | `{ dividend; divisor }`                                           | `23 : 5 = ? r ?`                             | `remainder`                          |
| `compare`  | `{ left: Expr; right: Expr }`, no blanks                          | `7 · 8 ○ 50`                                 | `relation`                           |
| `word`     | `{ template; vars; model; operation }`                            | catalog story                                | `operation`, then the model's answer |
| `term`     | `{ sentence: { op, left, right, result, remainder }; highlight }` | which is 42 in `6 · 7 = 42`?                 | `term`                               |

`word.template` is a catalog key; `vars` holds numbers shown in the story and catalog keys of words
(names, objects) drawn from the `words` stream; `model` is an `equation` or `divrem` problem with
the arithmetic the story asks for; with `operation` set the child first picks it (Riddle Scrolls).

### 5.3 Answers

```ts
type AnswerValue =
  | { kind: 'number'; value }
  | { kind: 'remainder'; quotient; remainder }
  | { kind: 'relation'; relation: 'lt' | 'gt' | 'eq' }
  | { kind: 'operation'; operation: 'add' | 'sub' | 'mul' | 'div' }
  | {
      kind: 'term';
      term: 'factor' | 'product' | 'dividend' | 'divisor' | 'quotient' | 'remainder';
    };
```

The `answer` action carries one `AnswerValue`; choice buttons carry the value they show.

**Invariant:** `expectedAnswer(problem, step)` returns the single correct answer or fails. A problem
is valid only if it succeeds: exactly one blank with a unique non-negative integer value (so
`? · 0 = 0` is invalid), evaluable sides, remainders smaller than divisors, true term sentences.
Generators must only emit valid problems; their exhaustive tests use this function.

### 5.4 Item IDs

Items are the unit of spaced retrieval and mastery: what is retrieved, independent of how it is
shown.

| Pattern             | Meaning                                                  | Count     |
| ------------------- | -------------------------------------------------------- | --------- |
| `mul:AxB`           | the fact `A · B` as presented, A and B in 0-10           | 121       |
| `div:P:D`           | the fact `P : D = Q`, D in 1-10, Q in 0-10               | 110       |
| `<family>:<bucket>` | an open-ended skill bucket (family never `mul` or `div`) | per skill |

Buckets used by the generators: `rem:d2` … `rem:d10`, `pow10:x10`, `pow10:x100`, `tens:d2` …
`tens:d9`, `mul2d1d:carry`, `mul2d1d:nocarry`, `div2d1d:regroup`, `div2d1d:noregroup`,
`order:brackets`, `order:no-brackets`, `compare:fact-number`, `compare:fact-fact`,
`compare:expression`, `word:<family>`, `terms:<term>`.

Presentation is not part of the item: `? · 6 = 42` practises `div:42:6`; a word problem practises
`word:<family>`; choice versus keypad is a property of the problem on screen. `mul:7x8` and `mul:8x7`
are distinct items that share partial credit (`commutedId`).

## 6. Skills and generators (`skills.ts`)

A skill is `{ id, titleKey, generator, params }`. The generator decides the problem family; its
parameters are validated by `SKILL_PARAM_SCHEMAS[generator]`. `skillItems(skill)` enumerates the
skill's item universe; content validation rejects skills whose universe is empty.

| Generator       | Parameters                                                                             | Items                           |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| `mul.fact`      | `tables`, `factors: [lo, hi]`, `order: 'table-first'                                   | 'table-second'                  | 'both'`                   | `mul:AxB` |
| `div.fact`      | `divisors`, `quotients`                                                                | `div:P:D`                       |
| `mul.missing`   | `tables` (1-10), `factors`, `position: 'first'                                         | 'second'                        | 'both'`                   | `div:P:D` |
| `div.remainder` | `divisors` (2-10), `quotients`, `dividendMax`, `remainder: required/allowed/forbidden` | `rem:dD`                        |
| `mul.power10`   | `powers: (10                                                                           | 100)[]`, `factors`, `resultMax` | `pow10:x10`, `pow10:x100` |
| `mul.tens`      | `tens: [lo, hi]` (tens digits), `digits`, `resultMax`                                  | `tens:dD`                       |
| `mul.2d1d`      | `twoDigit`, `oneDigit`, `carry: required/allowed/forbidden`, `resultMax`               | `mul2d1d:carry/nocarry`         |
| `div.2d1d`      | `divisors`, `quotients`, `dividendMax`, `regroup`, `remainder`                         | `div2d1d:regroup/noregroup`     |
| `order.ops`     | `operators`, `brackets`, `operations: [lo, hi]`, `operands`, `resultMax`               | `order:brackets/no-brackets`    |
| `compare`       | `sides: fact-number/fact-fact/expression`, `tables`, `equalShare`                      | `compare:<sides>`               |
| `word`          | `templates` (word template IDs)                                                        | `word:<family>`                 |
| `terms`         | `terms`, `tables`                                                                      | `terms:<term>`                  |

The core 3rd-grade bounds for each are in [curriculum.md §4](curriculum.md#4-generator-bounds).
A new generator is code plus a contract change; a new skill using an existing generator is data.

## 7. The content pack (`content.ts`)

One versioned JSON file, `content/dragon-valley.content.json`:
`{ "id": "dragon-valley", "revision": "1.0.0", "schemaVersion": 1, "data": ContentData }`, validated
by `contentRegistration` (`parseContentJson(text, contentRegistration, file)`).

### 7.1 Records

| Collection      | Record fields                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objectives`    | `id`, `strand`, `titleKey` (docs/curriculum.md)                                                                                                                                                                                                                                                                                                                                     |
| `regions`       | `id`, `order` (map order), `titleKey`, `unlock: { after: levelId[] }`, `boss`, `background` (art ID)                                                                                                                                                                                                                                                                                |
| `levels`        | `id`, `region`, `order`, `titleKey`, `kind: lesson/boss`, `unlock`, `activities`, `stars` (null = balance), `rewards: { coins: [1★, 2★, 3★], eggs, cosmetics }`, `boss`, `storyBeat`, `objectives`                                                                                                                                                                                  |
| `activities`    | `kind`, `skills`, `count` (problems or boards), `input: auto/choice/keypad`, `options` (per kind, `ACTIVITY_OPTION_SCHEMAS`: Feeding Time `draw` (`mix`, or `weakest`: due and weakest facts first), Riddle Scrolls `pickOperation`, Memory Match `pairs` and `match` (`value`, `family`: × ↔ ÷ sentences, `term`: term ↔ example), Number Trail `length`/`gaps`, Egg Grid `split`) |
| `skills`        | §6                                                                                                                                                                                                                                                                                                                                                                                  |
| `dragons`       | `id`, `kind: table/special/finale`, `table`, `nameKey`, `region`, `rig` (art ID), `skills` (mastery set), `divisionSkills`, `boss`                                                                                                                                                                                                                                                  |
| `bosses`        | `id`, `region`, `nameKey`, `mood: sleepy/laughing/happy`, `meter` (correct answers), `reviewShare`; optional `heads` (default 1: a boss with several heads shares its meter evenly and serves its boss activity's skills one per head, in order) and `finale` (winning over this boss completes the game)                                                                           |
| `cosmetics`     | `id`, `slot`, `assetId` (art ID), `nameKey`, `price`, `unlock` (level or null); `{id, slot, assetId}` is the narrative `CosmeticItem`                                                                                                                                                                                                                                               |
| `stickers`      | `id`, `nameKey`, `page` (region), `criteria`, `icon` (art ID), `color` (`#rrggbb`), `frame` (art ID)                                                                                                                                                                                                                                                                                |
| `quests`        | `id`, `titleKey`, `goal`, `target`, `coins`, `weight`, `unlock`                                                                                                                                                                                                                                                                                                                     |
| `wordLists`     | `id`, `kind: name/thing`, `entries` (catalog keys; things have `.one` / `.other` plural forms)                                                                                                                                                                                                                                                                                      |
| `wordTemplates` | `id`, `family`, `textKey` (with `{placeholders}`), `vars` (`int` / `word` / `calc` / `form`), `model` (`value` or `divrem` over template expressions), `operation`                                                                                                                                                                                                                  |
| `placement`     | `steps: { skill, problems, passAccuracy, levels }[]`, `minProblems`, `maxProblems`, `stopAfterMisses`                                                                                                                                                                                                                                                                               |
| `story`         | `beats: { id, trigger, skippable, graph }[]` (each graph a `@aegis/narrative` `NarrativeGraph`, validated by `validateNarrative`) and `rewards: { reward, grant }[]`                                                                                                                                                                                                                |
| `balance`       | every tunable number (§7.3)                                                                                                                                                                                                                                                                                                                                                         |

**Sticker criteria** (`kind`): `level-complete {level, stars}`, `boss-defeated {boss}`,
`dragon-stage {dragon | null, stage}`, `dragons-stage {dragonKind | null, stage, count | null}`
(that many dragons of a kind at a stage or later; `count: null` means every such dragon in the
content), `facts-mastered {family: mul/div, level, count}`,
`skill-mastered {skill, level: seen/bronze/silver/gold, share}` (a percentage of the skill's
items), `streak {count}`, `days-practiced`, `week-days`, `coins-earned`, `cosmetics-owned`,
`dragons-dressed {count}` (dragons wearing at least one cosmetic: what the child did, so placement
and level rewards never earn it), `arena-best`, `quests-claimed`, `placement-done`, `finale`.

**Beat triggers**: `first-session`, `after-beat {beat}`, `level-start {level}`,
`level-complete {level}`, `boss-defeated {boss}`, `finale`. **Grants**: `egg {dragon}`,
`coins {amount}`, `cosmetic {item}`.

**Word-template variables**: `int {min, max}` (a whole number drawn from `problems`),
`word {list}` (an entry drawn from `words`: a name's catalog key, or a thing's plural form
`<key>.other`), `calc {expr}` (computed from numeric variables) and `form {word, count}` (the thing
drawn for `word` in the form that agrees with the number in `count`: `<key>.one` exactly when it
is 1, else `<key>.other`). A generated `WordProblem.vars` therefore holds numbers and catalog keys
only; the shell shows numbers as digits and looks every string up in the catalog.

### 7.2 Validation (`validateContentData`)

Beyond the strict schemas (unknown fields are rejected), a pack is valid only if:

- every ID is unique in its collection and every reference resolves (diagnostics name the record
  and field: `duplicate-id`, `missing-reference`);
- every skill can produce at least one item (`empty-skill`); word templates use only defined,
  numeric variables in expressions, `form` variables name a thing-list `word` variable and a
  numeric count, `calc` variables do not depend on each other in a cycle, and only `leftover`
  templates use a remainder model;
- activity options belong to their kind; minigames use `input: 'auto'`; Compare Stones is never
  keypad; a boss level ends with its boss activity and lessons have none;
- map order is unique per region and per level; the region boss has a boss level;
- a boss with several `heads` has a meter that shares evenly between them and a boss activity
  with at least one skill per head; at most one boss is the `finale`;
- the unlock graph is acyclic and every level is reachable from a start level (`unreachable`);
- growth rules list hatchling, youngling, adult, crowned in order; Leitner intervals never decrease;
  goal, gift, mix and response ranges are consistent;
- beat graphs are valid narrative graphs with distinct IDs, and every story reward is claimed by a
  beat.

`scripts/validate-content.mjs` (part of `npm run verify`) adds the cross-file checks: every catalog
key the pack uses exists in `en.content.json`; word-template placeholders are template variables;
story lines keep to 10 words per sentence (`CHILD_PROFILE`); shipped history packs stay valid; art
IDs exist in `assets/art/catalog.json` (`--strict-art`); every objective has a lesson and a boss
level (`--strict-coverage`). The v1 pack passes both strict checks and `npm run verify` runs them.

### 7.3 Balance defaults

| Key                 | Default                                                                                                        | Meaning                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `leitner.intervals` | `[0, 0, 1, 2, 4, 8]`                                                                                           | days until due, by box 0-5        |
| `response.choice`   | fast ≤ 2500 ms, ok ≤ 6000 ms                                                                                   | response buckets for choice input |
| `response.keypad`   | fast ≤ 3500, ok ≤ 8000, +700 ms per extra digit                                                                | response buckets for keypad input |
| `input`             | keypad from box 2, 4 choices                                                                                   | `auto` input and option count     |
| `mix`               | success 82 %, known 70 %, learning 10-50 %, window 20, no repeat within 2                                      | round composition                 |
| `reask`             | delay 3 turns, at most 2 per round                                                                             | re-asking missed items            |
| `coins`             | 1 per correct, +2 every 5 in a row, boss 30, placement 10                                                      | coin sources                      |
| `stars`             | 2★ at 80 %, 3★ at 95 % with 60 % fast                                                                          | level stars                       |
| `mastery`           | gold = box 5 and 2 fast of the last 3                                                                          | gold rule                         |
| `growth`            | hatchling 30 % seen; youngling 60 % bronze + division; adult 90 % silver + division + boss; crowned 100 % gold | dragon stages                     |
| `daily`             | goal 30 (10-100), 3 quests, 60 days of history                                                                 | daily goal and history            |
| `gift`              | 10-25 coins or a cosmetic, weights 1 : 3                                                                       | the daily gift chest              |
| `arena`             | unlocked after `sunny-meadow.boss`, ≤ 60 problems                                                              | Lightning Arena                   |
| `hungry`            | 1 due item                                                                                                     | when a dragon is hungry           |

### 7.4 Catalogs

- `content/catalogs/en.content.json`: every string the content refers to (S2b; the `word.*` keys S2a).
- `content/catalogs/en.ui.json`: the shell's own strings (S3).

Both are flat `{ key: string }` maps with `{placeholder}` parameters, the format
`createMessages` from `@aegis/browser/ui` consumes. A translation later adds `cs.*.json` with the
same keys. `thing` word entries have plural forms `<key>.one` and `<key>.other`.

### 7.5 Art references

Content refers to art by art-catalog ID: `region.background`, `dragon.rig` (the dragon's recipe ID,
equal to the dragon ID), `cosmetic.assetId`, `sticker.icon`, `sticker.frame`, and the scenes of
story beats (a scene ID is a background ID: `castle-hall`, `valley-map` or a region ID; bosses are
drawn by the shell from the boss ID, not the scene). `collectArtIds(data)` lists them;
`checkArtCatalog(data, ids)` reports the missing ones. The validator gathers catalog IDs from every
`id` field and every string under `icons` in `assets/art/catalog.json`; the v1 pack resolves all of
them, and S4's `test/unit/art/content-art.test.ts` also checks each reference in its role (region
scenes, rigs of the right table, boss moods matching the won pose, cosmetic slots, stickers that
compose). Sound IDs are not in content: the shell maps events to sounds from S5's
`assets/audio/manifest.json`.

### 7.6 Revisions, history and save migration

- A save pins the exact pack it was played with: pack ID, revision and content hash (the runtime
  refuses to restore a save against any other pack).
- **Every content change merged to `main` bumps `revision`** (MAJOR.MINOR.PATCH: patch for balance
  or text, minor for new levels or regions) with `npm run content:bump -- <revision>`
  ([content.md §1](content.md#1-files-and-revisions)): `main` deploys, so its pack is what saves
  pin. The Region 1 slice went live as `1.0.0` (main `373a5d2`); v1 is `1.1.0`.
- **Every deployed revision is archived** byte-for-byte as `content/history/<revision>.json` and
  shipped with the site. A revision string is never reused for different content: every
  revision's content hash is pinned (`REVISIONS` in `test/unit/contract/content.test.ts`), so
  changed content under a pinned revision, or a changed archive, fails the tests, and the validator
  refuses a current revision archived with other content. Every catalog key an archived pack uses
  stays in the catalog (the validator checks).
- **The schema only grows compatibly.** Every archived pack must stay valid under the current
  `contentRegistration`, so `CONTENT_SCHEMA_VERSION` stays 1 and changes are limited to new union
  variants (new activity kinds, generators, criteria) and new optional fields
  (`objectWithOptional`). Anything else needs a coordinator decision and a history plan.
- **Content IDs are append-only.** New content adds regions, levels, skills, dragons, cosmetics and
  stickers; it does not rename or delete them.
- **Upgrade path** (plan §3.4), as the shell does it (`src/app/persistence/game-session.ts`):
  create the host with the save's pack (the archived one for an old save), stage the current pack,
  `restore` the save, then at the hub (`canActivateContent`: no round, no pending beat, no pending
  jobs) `activateContent(current, 'boundary')`. The adapter's `activateContent` carries progress
  forward; with append-only IDs no transformation is needed, and a revision that retires an ID
  must migrate the state there. `test/migration/slice-save.test.ts` proves it with a real save made
  by the deployed Region 1 slice's rules on its pack (fixture `slice-save.json`): refused by the
  current pack alone, restored exactly as saved with `content/history/1.0.0.json`, and moved to
  `1.1.0` at the hub with all progress unchanged (the v1 content under `1.0.0` is refused as
  `content-revision-reused`). `test/migration/next-revision.test.ts` does the same for the next
  release (a fixture island under the next minor revision, `test/migration/fixtures/island.json`):
  refused mid-round, activated at the hub with all progress carried forward, an old save still
  restoring against its own revision.
- **State compatibility.** New state fields are optional (`objectWithOptional`) with a default
  that old saves get by omission, so every save keeps restoring under newer rules without bumping
  `STATE_VERSION` (the day counters `daily.levels` and `daily.minigames` were the first such fields; `round.current.teach` followed).

## 8. Per-profile state (`state.ts`)

`ProfileState` is everything authoritative about one child's game. It lives in the runtime snapshot
and is saved after every commit. `STATE_VERSION` (the adapter's `stateVersion`, now 1) must be
bumped, with an explicit save migration, whenever a change means an old snapshot cannot continue
unchanged.

| Field                                  | Meaning                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `day`, `firstDay`                      | current and first session day (day numbers: days since 1970-01-01, local)                                                      |
| `sessions`, `daysPracticed`            | counters                                                                                                                       |
| `onboarding`                           | `firstEgg`, `placement: pending/done/skipped`                                                                                  |
| `items`                                | per item: `box` 0-5, `due` day, `seen`, `correct`, `recent` (last 3 buckets), `lastDay`                                        |
| `levels`                               | per level: best `stars`, `bestAccuracy`, `plays`, `placed`, `paidStars`                                                        |
| `bosses`                               | defeated bosses and the day                                                                                                    |
| `dragons`                              | owned dragons: `stage`, `obtainedDay`, `stageDay`, `outfit` (one item or null per slot)                                        |
| `coins`, `coinsEarned`                 | wallet and lifetime earnings                                                                                                   |
| `cosmetics`                            | `@aegis/narrative` `CosmeticState` (owned + idempotent grant claims; `equipped` stays empty)                                   |
| `stickers`                             | earned stickers and the day                                                                                                    |
| `daily`                                | today's answers, goal, quests, gift (`locked/ready/opened`), levels and minigames finished today (optional; absent reads as 0) |
| `history`                              | the last 60 days' records (answers, correct, fast)                                                                             |
| `arena`, `questsClaimed`, `bestStreak` | records for stickers and the parent view                                                                                       |
| `story`                                | the beat in progress (`NarrativeState`), `pending`, `queue`, `done` (finished beats keep only their ID)                        |
| `run`                                  | the level being played: `level`, `next` activity, `results`                                                                    |
| `round`                                | the active or finished round (problem round or minigame round)                                                                 |
| `roundCounter`                         | for round IDs `r1`, `r2`, …                                                                                                    |
| `settings`                             | rule settings: `dailyGoal`, `arena`, `unlockAhead`                                                                             |
| `finale`                               | the day the finale was completed                                                                                               |

A **problem round** keeps the activity, source, skills, input, target or boss meter, counters
(asked, answered, correct, fast, streak), the re-ask queue, recent items, the `current` problem
(with resolved input, choices, step, re-ask and hint flags) and the last `feedback` (correct,
bucket, given and expected answers, coins). A **minigame round** keeps the generated
`MinigameDefinition` and its `MinigameState` (persisted, never regenerated).

**Invariants**

- Bounded: no list grows per answer without a cap (history ≤ 366 entries, recent ≤ 20, queue ≤ 20,
  claims bounded by content). Do not add per-answer logs.
- Dragons never shrink; coins are never negative; a day number never decreases (a device clock that
  goes back is clamped to the last session day).
- Every record refers to existing content (checked by `adapter.validate` on every commit and
  restore), outfits use owned items of the right slot, story states restore against their beat
  graphs.
- Presentation preferences (notation, volumes, text size, reduced motion, read-aloud voice,
  time limit) are **not** state: the shell stores them per profile in its preferences record, so
  changing them never touches a game hash or a durable checkpoint.

## 9. Actions (`actions.ts`)

Every action is validated by `gameActionSchema` and then by the rules' legality check (`resolve`).
A rejected action changes nothing, costs nothing and draws no randomness. Only answers cost a
logical turn (`ACTION_TURNS`); re-ask jobs count turns.

| Action                                                 | Turns | Legal when                                                                                                     | Effect                                                                                                                                                                                     |
| ------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `startSession { day: 'YYYY-MM-DD' }`                   | 0     | always (first action of a profile)                                                                             | new day: daily record, history; first session: prologue                                                                                                                                    |
| `startLevel { level, activity? }`                      | 0     | level open, no active round, no blocking beat; with `activity`: the level completed and that activity playable | start a run and its first playable activity, with the level-start beat; with `activity`, replay just that activity (the level is not completed again; the Daily Adventure's minigame step) |
| `startActivity { activity }`                           | 0     | `level` (index ≤ next), `arena` (open and on), `snack` (a hungry dragon, or due basket facts), `placement`     | start a round                                                                                                                                                                              |
| `answer { value, elapsedMs }`                          | 1     | a problem is on screen (not in the placement check)                                                            | grade, Leitner move, coins, re-ask job, next problem                                                                                                                                       |
| `placementAnswer { value, elapsedMs }`                 | 1     | a placement-check problem is on screen                                                                         | grade, climb the ladder (no re-asks); at the end place levels                                                                                                                              |
| `minigameMove { revision, move }`                      | 0     | a minigame board is active, `revision` is its revision, the move is legal (minigames.ts)                       | reduce the board; credit facts and coins; next board or the end of the round                                                                                                               |
| `hint`                                                 | 0     | a problem is on screen, not yet hinted                                                                         | mark hinted (shell shows the model)                                                                                                                                                        |
| `endRound { reason: done/quit/time-up/time-limit }`    | 0     | `done`: round finished; `quit`, `time-limit`: round active; `time-up`: the Arena only                          | close or end the round; cancel pending re-asks; only a finished round completes its activity                                                                                               |
| `buy { item }`                                         | 0     | item available, not owned, affordable                                                                          | pay, grant (`buy:<item>`)                                                                                                                                                                  |
| `equip { dragon, slot, item \| null }`                 | 0     | dragon owned; item owned and fits the slot                                                                     | dress the dragon                                                                                                                                                                           |
| `claimQuest { quest }`                                 | 0     | quest done and unclaimed                                                                                       | pay the quest coins                                                                                                                                                                        |
| `openGift`                                             | 0     | daily gift ready                                                                                               | weighted grant from `rewards`                                                                                                                                                              |
| `storyChoice { beat, node, revision, choice \| null }` | 0     | the pending beat, current node and revision                                                                    | advance (or skip a skippable beat); grant rewards                                                                                                                                          |
| `setSetting { setting }`                               | 0     | values in range                                                                                                | `dailyGoal`, `arena`, `unlockAhead`                                                                                                                                                        |

- **Rejections** are `RuntimeError`s with stable `code`s: `no-session`, `invalid-day`,
  `story-pending`, `round-active`, `unknown-level`, `locked-level`, `no-level`, `locked-activity`,
  `no-problem`, `wrong-action`, `already-hinted`, `no-round`, `round-finished`, `not-timed`, `unknown-item`,
  `owned`, `insufficient-coins`, `unknown-dragon`, `not-owned`, `wrong-slot`, `gift-not-ready`,
  `story-choice`, `invalid-setting`, `not-implemented`, and (rules work) `no-board` (no minigame
  board to play), `stale-move` (the board changed since the move was made), `invalid-move` (the
  board's rules do not allow that move), `not-hungry` (snack time with nothing due to eat),
  `arena-locked` (the Arena is not open yet or switched off), `unknown-quest`, `quest-not-done`,
  `quest-claimed`. The shell localizes by `code` (`error.<code>` in `en.ui.json`) and never
  shows diagnostic text to a child.
- **Stale UI**: the shell dispatches with `{ expectedRevision }` captured when the control was
  rendered (the labs' command-controller pattern), so an old button cannot act on a newer view.
- **elapsedMs** excludes paused time and is capped at 600 000 ms; anything slower is just "slow".

## 10. Runtime integration (`adapter.ts`)

| Registration         | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | `dragon-valley` (`ADAPTER_ID`)                                                                  |
| `stateVersion`       | `STATE_VERSION` (1)                                                                             |
| `state` / `action`   | `profileStateSchema` / `gameActionSchema`                                                       |
| `content`            | `contentRegistration` (schema version 1)                                                        |
| `randomStreams`      | `problems`, `distractors`, `rewards`, `words`                                                   |
| `eventPhases`        | `reask`                                                                                         |
| `commands`           | one rule per action type (`ruleIds` in traces are action types)                                 |
| `jobs`               | `reask` with payload `{ round, item }`                                                          |
| runtime phases       | `round` (entered when a round starts), `hub` (entered when it ends, cancelling pending re-asks) |
| claims               | idempotent one-time effects (`story:<beat>:<reward>`); cosmetic grants use their own claim IDs  |
| `canActivateContent` | no round and no pending beat (the hub)                                                          |

The `answer` command grades in `start` (item update, coins, re-ask scheduling), the logical turn
runs any due re-ask jobs, and `finish` serves the next problem, so a re-ask that falls due is served
on time. A miss on turn _t_ schedules its re-ask for turn _t_ + 3: the item comes back as the third
problem after the miss.

**Note on long-lived saves.** The runtime keeps a ledger of consumed job tickets and claims in every
snapshot, and its snapshot schema caps each list at 10 000 entries. Re-ask jobs are therefore capped
per round and claims are used only for once-ever effects (never per day or per answer). At a heavy
20 re-asks a day the ledger lasts well over a year of daily play (typical play: several years); an
SDK change (a compactable ledger) has been requested upstream. Do not add other per-answer jobs or
per-day claims.

## 11. Views (`views.ts`)

`GameView` is recomputed on every commit; screens render only from it (plus commit events for
one-shots). It contains:

- `screen`: `story` (a beat is pending), `round` (a round is active), `results` (a round finished),
  `hub` (otherwise). The shell may navigate elsewhere (market, album, parent) without an action.
- `story`: the pending beat's projection (`node`, `text` key, `choices`, `skippable`, `finished`).
- `hub`: regions with backgrounds, boss status (`heads`: 1, or 7 for the Seven-Headed Dragon; the
  head being won over is `floor(meter.value × heads / meter.target)`) and level cards
  (`locked/open/completed`, stars, placed, `glowing`); `next` (the Daily Adventure step); `hungry`
  dragons; arena availability.
- `run`: the level's activities and done flags, and the level result once finished.
- `round`: for problem rounds the progress (answered, target, correct, streak, boss meter), the
  current `problem` (structured problem, resolved input, choices, step, re-ask and hint flags, and
  `teach: true` when the item's last two answers were misses (not in the Arena or the placement
  check), so the shell shows the picture model before asking, as for a re-ask; the field is absent
  otherwise:
  at a story's `operation` step the choices are the four operations, + − · : in that order; at the
  `answer` step answer options in seeded order for choice input, else `null`), the last `feedback` (with the expected answer for "Let's look"), coins, the dragon
  being fed with its expression, and for the placement check its ladder (`placement`: step,
  steps, levels placed so far); for minigame rounds the board count, the raw `projectMinigame`
  view (`minigame`, whose `revision` every `minigameMove` must carry) and the typed board
  `current` (§11.1).
- `dragons`: owned dragons with stage, expression, mastery shares (percent, rounded down),
  hunger, outfit and the next stage with its exact counts (`next.have` facts at the stage's mastery
  level, `next.need` to reach it: the shell's "4 of 7 facts"). `mastery.items` is the size of the
  mastery set; from bronze up the shares and counts leave out the rule facts of a dragon not of the
  0 or 1 table, as growth does (docs/design.md §6.5).
- `window`: the **11 × 11** Magic Window (`cells`: 121 multiplication facts, row = first factor,
  column = second factor) and the division panel (110 cells, row = divisor, column = quotient), each
  cell with `level` (`dim/bronze/silver/gold`) and `needsPolish`.
- `market`, `album`, `daily` (goal, quests, gift, the week's practised days, sleepy), `parent`
  (per-table and per-skill accuracy, hardest facts, 60-day trend).

Expressions are hints for the art rig, derived from state: `curious` after a miss, `eating` after a
correct answer, `proud` on a streak milestone, `sleepy` after the daily goal, `happy` otherwise
(eggs `idle`).

A dragon is **hungry** when at least `balance.hungry.minDue` of its facts (multiplication and
division) are due. A fact is due when it was answered right before, its review day has come and
it was not already practised today, so a dragon is never hungry on the day it hatched. `hub.next`
is, in order: a pending beat (`story`); the placement check while `onboarding.placement` is
`pending`; `snack` time when a dragon is hungry or the valley's basket has due facts, and nothing
was answered yet today; the next
glowing `level` until a level was finished today; then, once a day that had no minigame yet,
`minigame { level, activity }` (a minigame of the furthest finished level, replayed with
`startLevel { level, activity }`); the `gift` once the goal is reached; `snack` time again while a
known fact is starving (the review guarantee) and no level is under way; the next `level` while
today's success is at least 70 % (`LOW_SUCCESS`; a level already under way always continues);
below it a review: `snack` time as above, else `minigame { level, activity }` naming an activity
of the last three finished levels (problem activities, or minigames too while there are fewer than
two; never the boss), rotating with `roundCounter` so successive reviews differ (the step
replays any one activity of a finished level); `free-play`. Pacing only chooses `next`: level availability never
depends on it.

While recent success (the last `mix.window` answers, across days) is below `LOW_SUCCESS`, the rules
protect the child's success: likely successes first in the mix and in snacks, a due item missed
last time treated as a learning item, snacks of 4-6 problems instead of 6-10, and reviews (due
items, snacks) and re-asks resolved to choice input outside the Arena and the placement check
(docs/design.md §6.3).

Snack time for every dragon (`startActivity { snack, dragon: null }`) also serves the valley's
basket: due facts no hatched dragon eats (docs/design.md §5.12). The round's `dragon` is then the
first owned dragon, as for any fact no owned dragon eats. Wherever reviews are served, a known fact
(box 2+) four or more days past its review day (`STARVING_DAYS`) comes first: the review guarantee
(§6.3).

Word problems with an operation (Riddle Scrolls, and stories in boss and mixed rounds) are asked
in two steps: the operation, then the number. A right operation moves the problem to its answer
step with no credit yet; a wrong one is the problem's miss (shown with the right operation, the
item goes back a box and is re-asked later) and the round moves on. Riddle Scrolls with
`pickOperation: false` serve the story without the operation step.

### 11.1 Minigame boards (`minigames.ts`)

Every minigame round carries its board twice: the narrative projection (`round.minigame.view`)
and the same board typed (`round.current`, a union keyed by the activity kind, which adds only
`kind` to the custom boards' projections). Moves go in `minigameMove.move` with
`revision = round.minigame.revision`.

Card and stone faces are notation-agnostic labels in the narrative projection (`labelKey`):
`fact:<item ID>` (`fact:mul:7x8` is `7 · 8`, `fact:div:56:7` is `56 : 7`), `expr:<op>:<a>:<b>`
(any other single operation, such as the remainder division `expr:div:23:5`), `num:<n>`,
`term:<term>` (term ↔ example pairs), `rem:<quotient>:<remainder>`,
`example:<op>:<left>:<right>:<result>:<remainder or ->:<highlight or none>`; every card back is
`card:back`. `parseCardLabel(label)` turns a label into a structured `CardFace` (`expr`,
`answer` or `sentence`), `cardLabel(face)` back, and `formatFace(face, notation)` renders it; the
typed boards carry the parsed face directly (`null` while face down).

Memory Match pairs by its `match` option: `value` (a fact and its product or quotient,
`7 · 8` ↔ `56`, or a division with leftovers and its answer, `23 : 5` ↔ `4 r 3`), `family`
(`6 · 7 = 42` ↔ `42 : 7 = 6`, both sentences without a highlight) or `term` (`product` ↔
`6 · 7 = 42` with 42 highlighted). Every pair on one board is different, so a match is never
ambiguous.

| Board           | View (besides `kind`)                                                                                                         | Moves                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `memory-match`  | `cards[{ id, face, faceUp, matched }]`, `clearAvailable`, `pairs`, `matched`, `attempts`                                      | `{ type: 'select', card }`, `{ type: 'clear' }`                                                    |
| `number-trail`  | `step`, `path[{ value, gap }]` (a fixed number or a gap index), `stones[{ id, value }]` in gap order, `submitted`, `attempts` | `{ type: 'place', item, index }`, `{ type: 'submit' }`                                             |
| `egg-grid`      | `product`, `maxSide`, `split`, `find`, `rows`, `columns`, `found[{ rows, columns }]`, `last` (`found`, `again`, `wrong`)      | `{ type: 'set', rows, columns }` (1..`maxSide`), `{ type: 'submit' }`                              |
| `fact-family`   | `numbers` (the nest), `equations[{ op, slots, correct }]` (two ·, two :), `submitted`, `attempts`                             | `{ type: 'fill', equation, slot, value }`, `{ type: 'submit' }`                                    |
| `sharing-feast` | `total`, `baskets`, `remainder` (leftovers expected), `inBaskets[]`, `bowl`, `last` (`uneven`, `more`, `count`), `attempts`   | `{ type: 'put' \| 'take', basket, count? }`, `{ type: 'deal' }`, `{ type: 'submit', each, left }`  |
| `golem-orders`  | `expr` (as it stands), `start`, `picked` (a path or null), `last` (`right`, `not-first`, `wrong-value`), `steps`, `mistakes`  | `{ type: 'pick', path }` (`left`/`right`/`inner` steps from the root), `{ type: 'answer', value }` |

The Egg Grid's config is `{ product, maxSide, split, find }` and the board is complete when
`found` has `find` rectangles; the rules set `find` to every rectangle up to 10 × 10 (both
orders of each factor pair, at most four). A Sharing Feast is complete when the baskets are
equal, the bowl cannot go round once more and `submit` says how many each basket has and how many
are left; Golem Orders when one number is left. A Golem expression is always worked out the way
it reads (brackets only where they are written, · and : before + and −, each rank from left to
right: `60 + 6 + 45 : 5` is the tree `(60 + 6) + 45 : 5`); the adapter refuses any other tree, and
the rules redraw a generated expression whose tree reads differently. The operation that may go
first follows the textbook: inside brackets first (the innermost pair that still holds an
operation; separate pairs in either order), then · and :, then + and −, from left to right;
independent operations of the same rank (`2 · 3 + 4 · 5`) in either order.

A finished step earns `balance.coins.correct` (a matched pair, a new rectangle, an equation, a
trail stone, a basket, a Golem step) and credits facts to the Leitner boxes: a matched pair its
fact (a family pair both its facts, a remainder pair `rem:d<divisor>`, a term pair
`terms:<term>`; fast if no pair was mismatched on the board before, else ok); a new rectangle
`rows × columns` its fact `mul:RxC` when that fact belongs to the activity's skills (each order is
its own fact, so 3 × 4 and 4 × 3 each count when found); a finished family its four facts, a
finished trail its `k · n` facts (a trail of tens `tens:d<k>`), a finished feast its division
fact, `rem:d<baskets>` or `div2d1d:<regroup|noregroup>`, and a finished Golem board
`order:<brackets|no-brackets>` (ok when the first check was right or no mistake was made, slow
otherwise). Only items of the activity's own skills are credited. A finished board is replaced by
the next one (`minigame.completed`); the last one finishes the round. Minigame credits do not count
as daily answers.

## 12. Events (`events.ts`)

Rules emit transient events with each commit. The shell turns them into one-shot sounds, animations
and announcements; tests assert on them. Events are never replayed: after a restore the shell
rebuilds the screen from the view.

| Event                 | Payload                                   | When                                         |
| --------------------- | ----------------------------------------- | -------------------------------------------- |
| `session.started`     | `day`, `newDay`                           | every `startSession`                         |
| `round.started`       | `round`, `activity`                       | a round starts                               |
| `answer.correct`      | `item`, `bucket` (fast/ok/slow), `streak` | a correct answer                             |
| `answer.incorrect`    | `item`                                    | a miss                                       |
| `item.promoted`       | `item`, `box`                             | a correct answer moved the item up a box     |
| `reask.scheduled`     | `item`, `dueTurn`                         | a miss scheduled a re-ask                    |
| `hint.shown`          | `item`                                    | `hint`                                       |
| `round.completed`     | `round`, `answered`, `correct`, `fast`    | a round ends                                 |
| `level.completed`     | `level`, `stars`, `firstTime`             | a level run ends                             |
| `region.unlocked`     | `region`                                  | a region opens                               |
| `boss.defeated`       | `boss`                                    | first boss win                               |
| `placement.completed` | `placed`                                  | the placement check ends                     |
| `egg.received`        | `dragon`                                  | an egg is granted                            |
| `dragon.hatched`      | `dragon`                                  | egg → hatchling                              |
| `dragon.grew`         | `dragon`, `stage`                         | a later stage                                |
| `dragon.crowned`      | `dragon`                                  | crowned                                      |
| `dragon.dressed`      | `dragon`, `slot`, `item`                  | `equip`                                      |
| `pane.lit`            | `item`, `level`                           | a window fact reached a higher mastery level |
| `coins.earned`        | `amount`, `reason`                        | any coin income                              |
| `item.purchased`      | `item`, `price`                           | `buy` (a cosmetic)                           |
| `sticker.earned`      | `sticker`                                 | a sticker's criteria are met                 |
| `quest.completed`     | `quest`                                   | a daily quest reaches its target             |
| `quest.claimed`       | `quest`, `coins`                          | `claimQuest`                                 |
| `daily.goal-reached`  | `day`                                     | the daily goal is reached                    |
| `gift.opened`         | `grant`                                   | `openGift`                                   |
| `story.advanced`      | `beat`, `node`, `finished`                | a story choice or skip                       |
| `finale.completed`    | `{}`                                      | the Seven-Headed Dragon is cured             |
| `minigame.completed`  | `round`, `board`                          | a minigame board is solved                   |
| `arena.finished`      | `score`, `best`, `record`                 | an Arena race ran to its end (time or cap)   |

## 13. Persistence identifiers (`persistence.ts`)

- IndexedDB database `dragon-valley`; `SaveService` game IDs `dragon-valley` (per-profile game
  saves through the strict checkpoint bridge), `dragon-valley-family` (the family record: profiles,
  names, avatars; profile ID `family`) and `dragon-valley-preferences` (per-profile presentation
  preferences).
- Profiles are fixed slots `profile-1` … `profile-4`; names are at most 16 characters and live in
  the family record, never in game state.
- The runtime seed of a profile is `profileSeed(profile)` (`dragon-valley:profile-1`, …).

## 14. The rules today

`src/rules/adapter.ts` with `learning/`, `progression/`, `minigames/`, `economy/`, `story/` and
`view.ts` implements the contract deterministically. Implemented: sessions and days (daily goal,
three daily quests with claims and a next-day payout, the gift chest, the week's habit dots, the
Daily Adventure steps), story beats with the first-egg choice and every region's welcome, boss
and finale beats, level runs of problem rounds and all six minigame boards (Memory Match in its
value, family and term modes, Number Trail, Egg Grid, Fact Family Nest, Sharing Feast, Golem
Orders), replaying one activity of a finished level, the adaptive mix (due reviews, known and
learning items, the learning share following recent success, the focus egg, no repeats, and below
the success band likely successes first, smaller snacks, choice input for reviews and re-asks and
the Daily Adventure's pacing with rotating reviews; the review guarantee and the valley's basket; every skill of an activity is served when several produce the same
item), partial credit for commuted facts, re-ask jobs and teaching a fact missed twice in a row, the boss meter with its kindness cap, spaced review and many heads, the
finale, the placement check, snack time, the Lightning Arena, grading (with the Riddle Scrolls
operation step), Leitner moves, coins and streak bonuses, stars, eggs, growth (rule facts counted
from bronze up only for Puff and Mirror), stickers, the
market, outfits, settings (with unlock-ahead), state validation and the complete view. Every
generator of §6 is implemented with its distractors ([learning.md](learning.md)); comparisons and
terms are answered by choice whatever the input mode (`keypadPossible`).

The command traces in `test/traces/` (`first-session`, `region-one`, `struggling-child`) pin the
rules with named checks, literal golden hashes and trajectories, and mutation checks. When the
rules change on purpose, re-pin the golden values and say why in the commit message
([testing.md](testing.md)).
