# Authoring content

Everything a child plays is data in `content/dragon-valley.content.json` plus English strings in
`content/catalogs/en.content.json`. This guide is for whoever adds levels, regions, dragons,
cosmetics, stickers, quests or story beats. The schema and its invariants are in
[contract.md §7](contract.md#7-the-content-pack-contentts); the curriculum mapping is in
[curriculum.md](curriculum.md); the game design is [design.md](design.md).

Run `npm run validate:content` after every edit (it is part of `npm run verify`). It checks the
schema, every cross-reference, reachability, skill pools, activity options, catalog keys, story
sentence length, history packs, art IDs and curriculum coverage.

## 1. Files and revisions

| File                                 | What                                                 | Owner   |
| ------------------------------------ | ---------------------------------------------------- | ------- |
| `content/dragon-valley.content.json` | the pack: `{ id, revision, schemaVersion, data }`    | S2b     |
| `content/catalogs/en.content.json`   | every string the pack refers to                      | S2b     |
| `wordTemplates` and `word.*` keys    | word problems and their words                        | S2a     |
| `content/history/<revision>.json`    | every shipped revision, byte for byte (never edited) | release |

Before the first release the pack stays `1.0.0`. After it, every change bumps `revision` (patch for
balance or text, minor for new levels or regions) and the shipped pack is archived in
`content/history/`. IDs are append-only: never rename or delete a level, skill, dragon,
cosmetic or sticker that has shipped; saves refer to them.

## 2. Levels

A level is `{ id, region, order, titleKey, kind, unlock, activities, stars, rewards, boss,
storyBeat, objectives }`.

- **IDs** are `<region>.<n>` for lessons and `<region>.boss` for the boss level; `order` is the
  position on the region's path (the boss last).
- **Unlock**: a lesson lists the previous lesson in `unlock.after`; a region's first lesson has
  none (the region's own `unlock.after` names the previous region's boss level).
- **Objectives** must match the level's row in [curriculum.md §3](curriculum.md) exactly; a test
  compares the two. Change both together.
- **Stars**: `null` uses `balance.stars` (1 star = completed, 2 at 80 %, 3 at 95 % with 60 % fast
  answers). Minigames do not count towards accuracy; a level of minigames only earns 3 stars.
- **Rewards**: `coins` for first reaching 1, 2 and 3 stars (never decreasing), `eggs` and
  `cosmetics` granted once, the first time the level is completed (or placed).
- **storyBeat** names the beat that introduces the level (also listed as a `level-start` trigger
  on the beat itself).

### 2.1 Activities

Each activity is `{ kind, skills, count, input, options }`. `count` is problems for problem
activities and boards for minigames.

| Kind             | Plays                                                          | `count`          | `input`              | Options (default)                  |
| ---------------- | -------------------------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `feeding`        | problems from the skills, the mix and re-asks                  | 8-15 problems    | `auto/choice/keypad` |                                    |
| `boss`           | the boss meter; the last activity of a boss level only         | the kindness cap | usually `auto`       |                                    |
| `compare-stones` | `compare` problems                                             | problems         | never `keypad`       |                                    |
| `riddle-scrolls` | `word` problems, pick the operation first                      | problems         | `auto`               | `pickOperation` (true)             |
| `memory-match`   | pairs of a fact and its value from mul/div skills              | boards           | `auto`               | `pairs` 3-8 (6)                    |
| `number-trail`   | a trail of multiples of a table of the skills, stones to order | boards           | `auto`               | `length` 5-12 (10), `gaps` 1-6 (3) |
| `egg-grid`       | every rectangle for a product of the skills' facts             | boards           | `auto`               | `split` (`none`)                   |
| `fact-family`    | a family a, b, a · b (different factors of at least 2)         | boards           | `auto`               |                                    |

- `auto` input is multiple choice while a fact is new (box 0-1) and the keypad from box 2.
- Minigame boards draw their facts from the activity's skills: Memory Match needs at least two
  facts with different values, Egg Grid a fact with both factors at least 2 (its boards go from
  small products to big ones over the round), Fact Family a fact
  with two different factors of at least 2, Number Trail a skill with a table (or divisor) of at
  least 2. An activity that cannot make a board is skipped.
- An activity whose generator is not implemented yet is skipped in a level run (the level still
  completes). Today that is Riddle Scrolls until S2a ships the `word` generator.

### 2.2 Bosses

A boss is `{ id, region, nameKey, mood, meter, reviewShare }`. The boss activity's `count` is the
**kindness cap**: after that many problems the meter fills with a flourish, so a boss can never
be lost. Make `count` at least `meter + 5`. `reviewShare` is the percentage of problems drawn as
spaced review of facts the child knows from outside the boss's own skills.

## 3. Skills

A skill is a generator with parameters (`{ id, titleKey, generator, params }`); its items are
what the mix serves and what dragons grow on. Keep parameters inside the core bounds of
[curriculum.md §4](curriculum.md#4-generator-bounds). Prefer reusing a skill to defining a near
copy: the parent view lists accuracy per skill.

## 4. Dragons and the first hatch

A dragon is `{ id, kind, table, nameKey, region, rig, skills, divisionSkills, boss }`: `skills`
is its mastery set, `divisionSkills` the division facts youngling and later stages also need, and
`boss` the boss whose defeat adult and crowned need. Its egg comes from a level's
`rewards.eggs` or a story reward.

Learning draws prefer the **focus egg**: the chosen first egg while it is still an egg, else the
oldest egg owned, among facts of the round never answered right. Practice warms the egg, so a
level whose skills include an egg's table hatches it quickly. Sunny Meadow 1 therefore lists
×2, ×5 and ×10 (`mul-2-5-10`): whichever first egg the child chose, its table is what the level
serves, and the egg hatches in the first session (design §4.1). Only an egg whose table the round
practises is warmed: Puff's `2 · 0` is a stray fact in a round of twos. Sunny Meadow 3's story
gives Mirror's and Puff's eggs as the level starts, so its ×0 and ×1 practice warms them (the eggs
stay its completion reward too, for a child placed out of the level; an owned egg is never given
twice).

## 5. The placement check

`placement.steps` is a ladder of `{ skill, problems, passAccuracy, levels }`. The check asks
`problems` keypad problems of each step; reaching `passAccuracy` places the step's `levels`
(completed with one star, replayable, first-time eggs and cosmetics granted) and climbs; failing
a step, `stopAfterMisses` misses in a row or `maxProblems` answers end it. Rules for authors:

- never place the intro level of the game (Sunny Meadow 1): every child plays it and hatches the
  first egg there;
- never place a boss level: bosses are fun and gate the next region;
- keep the whole ladder within 12-24 problems.

## 6. Market, stickers and quests

- **Cosmetics** `{ id, slot, assetId, nameKey, price, unlock }`: `assetId` must be an ID in
  `assets/art/catalog.json` (S4); `unlock` is the level that puts it in Glimmer's Market (`null`
  for from the start). Prices by tier: 15-25 starter, 30-45 regions 2-4, 50-80 later and boss
  rewards. A cosmetic that a level grants still appears in the market (as owned).
- **Stickers** `{ id, nameKey, page, criteria, icon, color, frame }`: one album page per region;
  `icon` and `frame` are art IDs (frames arrive with S4's sticker work), `color` is `#rrggbb`.
  Criteria kinds are listed in contract §7.1. A sticker named for something the child does must
  use a criterion only that action meets: Dressed Up is `dragons-dressed`, not `cosmetics-owned`,
  because placed levels and level rewards also give cosmetics.
- **Quests** `{ id, titleKey, goal, target, coins, weight, unlock }`: three are drawn a day,
  weighted, never two with the same goal, only from templates whose `unlock` level is complete.
  A goal the child cannot reach on a given day (for example `feed-hungry` before any dragon can be
  hungry) needs an `unlock`. Finished quests the child forgot to claim are paid the next day.

## 7. Story beats

A beat is `{ id, trigger, skippable, graph }`; the graph is an `@aegis/narrative` graph whose
`text` catalog lists catalog keys and whose `scene` catalog lists art background IDs
(`castle-hall`, `valley-map`, or the region's ID; checked against the art catalog like every
other art reference). Lines keep to the child profile: at most 10 words per
sentence (the validator counts). Every line is read aloud, so write for the ear. Triggers:
`first-session`, `after-beat`, `level-start`, `level-complete`, `boss-defeated`, `finale`.
Story rewards (`story.rewards`) map a graph's reward claims to grants (eggs, coins, cosmetics);
each is granted once.

## 8. Sunny Meadow as shipped

| Level               | Activities                                                                                        | Rewards                                 |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `sunny-meadow.1`    | Egg Grid (×2, ×5, ×10; 3 boards), Feeding Time (same; 8; choice)                                  | stars                                   |
| `sunny-meadow.2`    | Feeding Time (×2, ×5; 10; choice), Memory Match (×2, ×5; 6 pairs)                                 | eggs Bubbles, Sunny, Goldie             |
| `sunny-meadow.3`    | Feeding Time (×0, ×1, ×10; 10; auto), Number Trail (×10)                                          | eggs Mirror, Puff (story, at the start) |
| `sunny-meadow.4`    | Egg Grid (×2, ×5; 2), Fact Family Nest (÷2, ÷5, ÷10; 3), Feeding Time (÷ and missing factors; 10) | striped scarf                           |
| `sunny-meadow.5`    | Feeding Time (all meadow ×, ÷; 12; keypad), Memory Match (÷; 6 pairs)                             |                                         |
| `sunny-meadow.6`    | Riddle Scrolls (6) (skipped until the `word` generator ships)                                     |                                         |
| `sunny-meadow.boss` | The Bridge Troll: meter 15, cap 20, laughing                                                      | party hat, 30 boss coins                |

Placement ladder: ×2/×5 (4 problems, 75 %) places level 2, ×0/×1/×10 (3, 100 %) level 3,
÷2/÷5/÷10 (3, 67 %) level 4, missing factors (3, 67 %) level 5. Market: 13 cosmetics from 15 to
60 coins, unlocking level by level.
