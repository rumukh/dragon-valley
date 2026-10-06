# The domain contract

`src/rules/contract/` is the shared language of Dragon Valley: the content pack, problems and
answers, item IDs, per-profile state, actions, views, events and identifiers. The rules (S2)
implement it, the shell (S3) renders it, art (S4) and audio (S5) are keyed by its IDs, and QA (S6)
asserts on it. Everything is built on public `@aegis/runtime` schemas and `@aegis/narrative` types,
and everything is plain JSON.

This document explains every part, the invariants each part guarantees, the walking-skeleton
adapter that ships with the contract, and who owns what. The design it serves is
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
| `content.ts`     | The content pack schema, `contentRegistration`, cross-reference validation, catalog/art/curriculum helpers                                                   |
| `state.ts`       | `ProfileState` and its schema, `STATE_VERSION`, day numbers, the initial state                                                                               |
| `actions.ts`     | `GameAction`, `ACTION_TURNS`, `gameActionSchema`                                                                                                             |
| `views.ts`       | `GameView` and every screen's view type                                                                                                                      |
| `events.ts`      | `EVENTS` and payload types                                                                                                                                   |
| `persistence.ts` | Adapter, database, game and profile IDs; profile seeds                                                                                                       |
| `index.ts`       | Barrel: `import { … } from '../rules/contract'`                                                                                                              |

The runtime adapter is `src/rules/adapter.ts` (`dragonValleyAdapter`, `createGameHost`).

## 2. Ownership and changing the contract

| Area                                                                                        | Owner                         |
| ------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/rules/**` (contract, adapter, rules), `content/**` except UI strings                   | S2 Rules & content            |
| `src/app/**` except `src/app/art/**`; `content/catalogs/en.ui.json`                         | S3 App shell & screens        |
| `assets/art/**`, `assets/backgrounds/**`, `src/app/art/**`, `scripts/art/**`, `docs/art.md` | S4 Art                        |
| `assets/audio/**`, `scripts/audio/**`, `docs/audio.md`                                      | S5 Audio                      |
| `test/e2e/**`, CI hardening (`.github/**` changes beyond fixes)                             | S6 QA & release               |
| Toolchain (`package.json`, tsconfigs, ESLint, Prettier, `scripts/*.mjs`, `vendor/**`)       | Coordinator review; S1 set up |

**Contract changes** (anything under `src/rules/contract/`) go through a PR reviewed by the
coordinator, even when S2 makes them, because every session builds on it. A contract PR states
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

| Collection      | Record fields                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objectives`    | `id`, `strand`, `titleKey` (docs/curriculum.md)                                                                                                                                                    |
| `regions`       | `id`, `order` (map order), `titleKey`, `unlock: { after: levelId[] }`, `boss`, `background` (art ID)                                                                                               |
| `levels`        | `id`, `region`, `order`, `titleKey`, `kind: lesson/boss`, `unlock`, `activities`, `stars` (null = balance), `rewards: { coins: [1★, 2★, 3★], eggs, cosmetics }`, `boss`, `storyBeat`, `objectives` |
| `activities`    | `kind`, `skills`, `count` (problems or boards), `input: auto/choice/keypad`, `options` (per kind, `ACTIVITY_OPTION_SCHEMAS`)                                                                       |
| `skills`        | §6                                                                                                                                                                                                 |
| `dragons`       | `id`, `kind: table/special/finale`, `table`, `nameKey`, `region`, `rig` (art ID), `skills` (mastery set), `divisionSkills`, `boss`                                                                 |
| `bosses`        | `id`, `region`, `nameKey`, `mood: sleepy/laughing/happy`, `meter` (correct answers), `reviewShare`                                                                                                 |
| `cosmetics`     | `id`, `slot`, `assetId` (art ID), `nameKey`, `price`, `unlock` (level or null); `{id, slot, assetId}` is the narrative `CosmeticItem`                                                              |
| `stickers`      | `id`, `nameKey`, `page` (region), `criteria`, `icon` (art ID), `color` (`#rrggbb`), `frame` (art ID)                                                                                               |
| `quests`        | `id`, `titleKey`, `goal`, `target`, `coins`, `weight`, `unlock`                                                                                                                                    |
| `wordLists`     | `id`, `kind: name/thing`, `entries` (catalog keys; things have `.one` / `.other` plural forms)                                                                                                     |
| `wordTemplates` | `id`, `family`, `textKey` (with `{placeholders}`), `vars` (`int` / `word` / `calc`), `model` (`value` or `divrem` over template expressions), `operation`                                          |
| `placement`     | `steps: { skill, problems, passAccuracy, levels }[]`, `minProblems`, `maxProblems`, `stopAfterMisses`                                                                                              |
| `story`         | `beats: { id, trigger, skippable, graph }[]` (each graph a `@aegis/narrative` `NarrativeGraph`, validated by `validateNarrative`) and `rewards: { reward, grant }[]`                               |
| `balance`       | every tunable number (§7.3)                                                                                                                                                                        |

**Sticker criteria** (`kind`): `level-complete {level, stars}`, `boss-defeated {boss}`,
`dragon-stage {dragon | null, stage}`, `facts-mastered {family: mul/div, level, count}`,
`streak {count}`, `days-practiced`, `week-days`, `coins-earned`, `cosmetics-owned`, `arena-best`,
`quests-claimed`, `placement-done`, `finale`.

**Beat triggers**: `first-session`, `after-beat {beat}`, `level-start {level}`,
`level-complete {level}`, `boss-defeated {boss}`, `finale`. **Grants**: `egg {dragon}`,
`coins {amount}`, `cosmetic {item}`.

### 7.2 Validation (`validateContentData`)

Beyond the strict schemas (unknown fields are rejected), a pack is valid only if:

- every ID is unique in its collection and every reference resolves (diagnostics name the record
  and field: `duplicate-id`, `missing-reference`);
- every skill can produce at least one item (`empty-skill`); word templates use only defined
  variables, and only `leftover` templates use a remainder model;
- activity options belong to their kind; minigames use `input: 'auto'`; Compare Stones is never
  keypad; a boss level ends with its boss activity and lessons have none;
- map order is unique per region and per level; the region boss has a boss level;
- the unlock graph is acyclic and every level is reachable from a start level (`unreachable`);
- growth rules list hatchling, youngling, adult, crowned in order; Leitner intervals never decrease;
  goal, gift, mix and response ranges are consistent;
- beat graphs are valid narrative graphs with distinct IDs, and every story reward is claimed by a
  beat.

`scripts/validate-content.mjs` (part of `npm run verify`) adds the cross-file checks: every catalog
key the pack uses exists in `en.content.json`; word-template placeholders are template variables;
story lines keep to 10 words per sentence (`CHILD_PROFILE`); shipped history packs stay valid; art
IDs exist in `assets/art/catalog.json` (reported now, `--strict-art` later); curriculum coverage
(reported now, `--strict-coverage` once v1 content is complete).

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

- `content/catalogs/en.content.json`: every string the content refers to (S2).
- `content/catalogs/en.ui.json`: the shell's own strings (S3).

Both are flat `{ key: string }` maps with `{placeholder}` parameters, the format
`createMessages` from `@aegis/browser/ui` consumes. A translation later adds `cs.*.json` with the
same keys. `thing` word entries have plural forms `<key>.one` and `<key>.other`.

### 7.5 Art references

Content refers to art by art-catalog ID: `region.background`, `dragon.rig` (the dragon's recipe ID,
equal to the dragon ID), `cosmetic.assetId`, `sticker.icon`, `sticker.frame`. `collectArtIds(data)`
lists them; `checkArtCatalog(data, ids)` reports the missing ones. The validator gathers catalog IDs
from every `id` field and every string under `icons` in `assets/art/catalog.json`. With the art
branch's draft catalog the Region 1 pack resolves everything except the three sticker frames
(`frame-round`, `frame-star`, `frame-shield`), which arrive with the art pipeline's sticker work.
Sound IDs are not in content: the shell maps events to sounds from S5's
`assets/audio/manifest.json`.

### 7.6 Revisions, history and save migration

- A save pins the exact pack it was played with: pack ID, revision and content hash (the runtime
  refuses to restore a save against any other pack).
- **Every content change merged after a release bumps `revision`** (semver-like: patch for balance or
  text, minor for new levels or regions). Before the first release the pack stays `1.0.0`.
- **Every shipped revision is archived** byte-for-byte as `content/history/<revision>.json` and
  shipped with the site. A revision string is never reused for different content (tests and the
  validator enforce it).
- **The schema only grows compatibly.** Every archived pack must stay valid under the current
  `contentRegistration`, so `CONTENT_SCHEMA_VERSION` stays 1 and changes are limited to new union
  variants (new activity kinds, generators, criteria) and new optional fields
  (`objectWithOptional`). Anything else needs a coordinator decision and a history plan.
- **Content IDs are append-only.** New content adds regions, levels, skills, dragons, cosmetics and
  stickers; it does not rename or delete them.
- **Upgrade path** (plan §3.4): create the host with the save's archived pack, `restore` the save,
  `stageContent(current)`, then at the hub (`canActivateContent`: no round, no pending beat, no
  pending jobs) `activateContent(current, 'boundary')`. The adapter's `activateContent` carries
  progress forward; with append-only IDs v1 needs no transformation, and a revision that retires an
  ID must migrate the state there. The save-migration work proves this with a fixture save upgraded to
  a v1.1 pack that adds an island.

## 8. Per-profile state (`state.ts`)

`ProfileState` is everything authoritative about one child's game. It lives in the runtime snapshot
and is saved after every commit. `STATE_VERSION` (the adapter's `stateVersion`, now 1) must be
bumped, with an explicit save migration, whenever a change means an old snapshot cannot continue
unchanged.

| Field                                  | Meaning                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `day`, `firstDay`                      | current and first session day (day numbers: days since 1970-01-01, local)                    |
| `sessions`, `daysPracticed`            | counters                                                                                     |
| `onboarding`                           | `firstEgg`, `placement: pending/done/skipped`                                                |
| `items`                                | per item: `box` 0-5, `due` day, `seen`, `correct`, `recent` (last 3 buckets), `lastDay`      |
| `levels`                               | per level: best `stars`, `bestAccuracy`, `plays`, `placed`, `paidStars`                      |
| `bosses`                               | defeated bosses and the day                                                                  |
| `dragons`                              | owned dragons: `stage`, `obtainedDay`, `stageDay`, `outfit` (one item or null per slot)      |
| `coins`, `coinsEarned`                 | wallet and lifetime earnings                                                                 |
| `cosmetics`                            | `@aegis/narrative` `CosmeticState` (owned + idempotent grant claims; `equipped` stays empty) |
| `stickers`                             | earned stickers and the day                                                                  |
| `daily`                                | today's answers, goal, quests, gift (`locked/ready/opened`)                                  |
| `history`                              | the last 60 days' records (answers, correct, fast)                                           |
| `arena`, `questsClaimed`, `bestStreak` | records for stickers and the parent view                                                     |
| `story`                                | beat states (`NarrativeState` per started beat), `pending`, `queue`, `done`                  |
| `run`                                  | the level being played: `level`, `next` activity, `results`                                  |
| `round`                                | the active or finished round (problem round or minigame round)                               |
| `roundCounter`                         | for round IDs `r1`, `r2`, …                                                                  |
| `settings`                             | rule settings: `dailyGoal`, `arena`, `unlockAhead`                                           |
| `finale`                               | the day the finale was completed                                                             |

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

| Action                                              | Turns   | Legal when                                                                            | Effect                                                                                       |
| --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `startSession { day: 'YYYY-MM-DD' }`                | 0       | always (first action of a profile)                                                    | new day: daily record, history; first session: prologue                                      |
| `startLevel { level }`                              | 0       | level open, no active round, no blocking beat                                         | start a run and its first playable activity; level-start beat                                |
| `startActivity { activity }`                        | 0       | `level` (index ≤ next), `arena`, `snack`, `placement`                                 | start a round                                                                                |
| `answer { value, elapsedMs }`                       | 1       | a problem is on screen                                                                | grade, Leitner move, coins, re-ask job, next problem                                         |
| `placementAnswer { value, elapsedMs }`              | 1       | in the placement round                                                                | grade, place levels                                                                          |
| `minigameMove { revision, move }`                   | 0       | a minigame board is active                                                            | reduce the board; completion credits and pays                                                |
| `hint`                                              | 0       | a problem is on screen, not yet hinted                                                | mark hinted (shell shows the model)                                                          |
| `endRound { reason: done/quit/time-up/time-limit }` | 0       | `done`: round finished; `quit`, `time-limit`: round active; `time-up`: the Arena only | close or end the round; cancel pending re-asks; only a finished round completes its activity |
| `buy { item }`                                      | 0       | item available, not owned, affordable                                                 | pay, grant (`buy:<item>`)                                                                    |
| `equip { dragon, slot, item                         | null }` | 0                                                                                     | dragon owned; item owned and fits the slot                                                   | dress the dragon                                  |
| `claimQuest { quest }`                              | 0       | quest done and unclaimed                                                              | pay the quest coins                                                                          |
| `openGift`                                          | 0       | daily gift ready                                                                      | weighted grant from `rewards`                                                                |
| `storyChoice { beat, node, revision, choice         | null }` | 0                                                                                     | the pending beat, current node and revision                                                  | advance (or skip a skippable beat); grant rewards |
| `setSetting { setting }`                            | 0       | values in range                                                                       | `dailyGoal`, `arena`, `unlockAhead`                                                          |

- **Rejections** are `RuntimeError`s with stable `code`s: `no-session`, `invalid-day`,
  `story-pending`, `round-active`, `unknown-level`, `locked-level`, `no-level`, `locked-activity`,
  `no-problem`, `wrong-action`, `already-hinted`, `no-round`, `round-finished`, `not-timed`, `unknown-item`,
  `owned`, `insufficient-coins`, `unknown-dragon`, `not-owned`, `wrong-slot`, `gift-not-ready`,
  `story-choice`, `invalid-setting`, `not-implemented`. The shell localizes by `code`
  (`error.<code>` in `en.ui.json`) and never shows diagnostic text to a child.
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
- `hub`: regions with backgrounds, boss status and level cards (`locked/open/completed`, stars,
  placed, `glowing`); `next` (the Daily Adventure step); `hungry` dragons; arena availability.
- `run`: the level's activities and done flags, and the level result once finished.
- `round`: for problem rounds the progress (answered, target, correct, streak, boss meter), the
  current `problem` (structured problem, resolved input, choices in seeded order, step, re-ask and
  hint flags), the last `feedback` (with the expected answer for "Let's look"), coins and the dragon
  being fed with its expression; for minigame rounds the `projectMinigame` view.
- `dragons`: owned dragons with stage, expression, mastery shares, hunger, outfit and next stage.
- `window`: the **11 × 11** Magic Window (`cells`: 121 multiplication facts, row = first factor,
  column = second factor) and the division panel (110 cells, row = divisor, column = quotient), each
  cell with `level` (`dim/bronze/silver/gold`) and `needsPolish`.
- `market`, `album`, `daily` (goal, quests, gift, the week's practised days, sleepy), `parent`
  (per-table and per-skill accuracy, hardest facts, 60-day trend).

Expressions are hints for the art rig, derived from state: `curious` after a miss, `eating` after a
correct answer, `proud` on a streak milestone, `sleepy` after the daily goal, `happy` otherwise
(eggs `idle`).

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

## 13. Persistence identifiers (`persistence.ts`)

- IndexedDB database `dragon-valley`; `SaveService` game IDs `dragon-valley` (per-profile game
  saves through the strict checkpoint bridge), `dragon-valley-family` (the family record: profiles,
  names, avatars; profile ID `family`) and `dragon-valley-preferences` (per-profile presentation
  preferences).
- Profiles are fixed slots `profile-1` … `profile-4`; names are at most 16 characters and live in
  the family record, never in game state.
- The runtime seed of a profile is `profileSeed(profile)` (`dragon-valley:profile-1`, …).

## 14. The walking skeleton

`src/rules/adapter.ts` with `learning/`, `progression/`, `economy/`, `story/` and `view.ts` is a
working, deterministic implementation of the contract, so the shell, art, audio and QA can build
against real rules from day one. It implements sessions, story beats with the first-egg choice,
level runs with problem rounds for the `mul.fact`, `div.fact` and `mul.missing` generators, grading,
Leitner moves, re-ask jobs, coins and streak bonuses, stars, eggs, growth, stickers, the market,
outfits, the daily goal and gift, settings, state validation and the complete view.

Not yet implemented (rejected with `not-implemented`, or skipped in a level run): placement, arena,
snack time, minigame moves (level runs skip minigame activities), quest drawing and claims, the
other generators, the adaptive mix (rounds draw new facts first, then uniformly, avoiding recent
items), partial credit for commuted facts, and the finale. These are S2's rules work; the module
layout follows plan §3.2 so each piece can be replaced in place.

`test/traces/first-session.test.ts` pins the skeleton's first session with named checks, a literal
golden hash and trajectory, and mutation checks. When the rules change on purpose, re-pin the
golden values and say why in the commit message ([testing.md](testing.md)).
