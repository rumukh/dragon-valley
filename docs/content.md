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

| File                                 | What                                                  | Owner          |
| ------------------------------------ | ----------------------------------------------------- | -------------- |
| `content/dragon-valley.content.json` | the pack: `{ id, revision, schemaVersion, data }`     | S2b            |
| `content/catalogs/en.content.json`   | every string the pack refers to                       | S2b            |
| `wordTemplates` and `word.*` keys    | word problems and their words                         | S2a            |
| `content/history/<revision>.json`    | every revision deployed, byte for byte (never edited) | `content:bump` |

**Every content change merged to `main` gets a new revision** (MAJOR.MINOR.PATCH: patch for
balance or text, minor for new levels or regions). `main` deploys to the live site, and a save pins
the exact pack it was played with (ID, revision and content hash): the runtime restores it only
with that pack. The shell loads `content/history/<revision>.json` for a save that pins an older
revision, restores it with that pack and moves it to the current pack at the hub. The Region 1
slice went live as `1.0.0` (main `373a5d2`); v1 is `1.1.0`.

To change content:

1. Run `npm run content:bump -- <revision>`, before or after editing. It reads the deployed pack
   from `origin/main` (`--from <git-ref>` for another ref; fetch first), archives it byte for byte
   as `content/history/<its revision>.json` and sets the pack's `revision`, nothing else. It
   refuses a revision that is not newer and a branch whose pack is behind the deployed one.
2. Pin the new revision and its content hash in `REVISIONS` in
   `test/unit/contract/content.test.ts` (the failing test prints the hash). That test fails
   whenever the pack changes under a pinned revision, so a forgotten bump cannot reach `main`.
3. Re-pin the golden traces (the content hash is part of every snapshot) with the reason and the
   old and new values in the commit message ([testing.md](testing.md)), then `npm run verify`.

Archived packs never change (their hashes are pinned too) and stay valid under the current schema.
Every catalog key an archived pack uses stays in the catalog (the validator checks): a restored old
save shows those strings until it reaches the hub. IDs are append-only: never rename or delete a
level, skill, dragon, cosmetic or sticker that has shipped; saves refer to them.

Catalog keys name the record they belong to: `level.<id>`, `boss.<id>`, `dragon.<id>`,
`skill.<id>`, `cosmetic.<id>`, `sticker.<id>`, `quest.<id>`, `objective.<…>`, story lines
`story.<beat>.<n>` (S2a's word problems `word.*`), and region names `region.<id>.name`, the keys the
art's valley map also labels its regions with (`assets/backgrounds/map-hotspots.json`; the archived
`1.0.0` pack still names Sunny Meadow `region.sunny-meadow`, so that key stays too).

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

| Kind             | Plays                                                          | `count`          | `input`              | Options (default)                                      |
| ---------------- | -------------------------------------------------------------- | ---------------- | -------------------- | ------------------------------------------------------ |
| `feeding`        | problems from the skills, the mix and re-asks                  | 8-15 problems    | `auto/choice/keypad` | `draw` (`mix`; `weakest`: due and weakest facts first) |
| `boss`           | the boss meter; the last activity of a boss level only         | the kindness cap | usually `auto`       |                                                        |
| `compare-stones` | `compare` problems                                             | problems         | never `keypad`       |                                                        |
| `riddle-scrolls` | `word` problems, pick the operation first                      | problems         | `auto`               | `pickOperation` (true)                                 |
| `memory-match`   | pairs: a fact and its value, a × ↔ ÷ family, or a term         | boards           | `auto`               | `pairs` 3-8 (6), `match` (`value`, `family`, `term`)   |
| `number-trail`   | a trail of multiples of a table of the skills, stones to order | boards           | `auto`               | `length` 5-12 (10), `gaps` 1-6 (3)                     |
| `egg-grid`       | every rectangle for a product of the skills' facts             | boards           | `auto`               | `split` (`none`)                                       |
| `fact-family`    | a family a, b, a · b (different factors of at least 2)         | boards           | `auto`               |                                                        |
| `sharing-feast`  | share fruit fairly between baskets; leftovers stay in the bowl | boards           | `auto`               |                                                        |
| `golem-orders`   | an expression worked out one operation at a time, in order     | boards           | `auto`               |                                                        |

- `auto` input is multiple choice while a fact is new (box 0-1) and the keypad from box 2.
- Minigame boards draw from the activity's skills: Memory Match needs at least two pairs with
  different values (`value`: facts of mul/div skills or remainders of a `div.remainder` skill;
  `family`: multiplication facts, and list the division skill too so both facts are credited;
  `term`: a `terms` skill), Egg Grid a fact with both factors at least 2 (its boards go from small
  products to big ones over the round), Fact Family a fact with two different factors of at least
  2, Number Trail a skill with a table (or divisor) of at least 2, or a `mul.tens` skill (a trail of
  whole tens), Sharing Feast a division fact, a `div.remainder` skill (leftovers) or a `div.2d1d`
  skill (big numbers), and Golem Orders an `order.ops` skill. An activity that cannot make a board
  is skipped.
- When several skills of an activity produce the same item (a division fact is also a missing
  factor item), each problem picks one of them at random, so every skill is served.
- An activity whose generator is not implemented yet is skipped in a level run (the level still
  completes).

### 2.2 Bosses

A boss is `{ id, region, nameKey, mood, meter, reviewShare }`, optionally with `heads` and
`finale`. The boss activity's `count` is the **kindness cap**: after that many problems the meter
fills with a flourish, so a boss can never be lost. Make `count` at least `meter + 5`.
`reviewShare` is the percentage of problems drawn as spaced review of facts the child knows from
outside the boss's own skills. `mood` must be the mood of the boss's won pose in the art
(`BOSS_MOOD`; S4's content-art test checks it).

A boss with `heads` (the Seven-Headed Dragon has 7) shares its meter evenly between them (the
meter must divide by the heads) and is won over one head at a time: head _k_ serves the boss
activity's _k_-th skill (list at least one skill per head, in order). The `finale` boss's first
defeat completes the game: the finale beat plays and the `finale` dragon, whose egg is that boss
level's reward, hatches at once. At most one boss is the finale.

## 3. Skills

A skill is a generator with parameters (`{ id, titleKey, generator, params }`); its items are
what the mix serves and what dragons grow on. Keep parameters inside the core bounds of
[curriculum.md §4](curriculum.md#4-generator-bounds). Prefer reusing a skill to defining a near
copy: the parent view lists accuracy per skill.

Word skills (`word-<region>`) list the word templates their stories come from. S2a writes the
templates with numbers for a region's tables ([learning.md §5.4](learning.md) says which region
each template is written for); pick the ones written for the level's region, and put each
"times as many" family next to its additive twin where a level contrasts them.

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

Later regions follow one pattern: the welcome beat at the start of level 1 grants the region's
first new egg (a story reward claimed in the beat's first node, so skipping the beat still gives
it), level 1 practises that table and hatches it, level 1's completion gives the second egg, and
level 2 hatches that one. Sunny Meadow 3's story gives Mirror's and Puff's eggs as it starts, so
its ×0 and ×1 practice warms them (given only at the end, they often stayed eggs past the troll).
Eggs a story gives are also rewards of their level, and a region's eggs rewards of its boss level
(an egg already owned is not given again), so a child placed out of a level or who skipped it
with unlock-ahead still gets every dragon. Special dragons (Pearl, Boulder, Clockwork) grow on
their region's skills; the finale dragon's mastery set is every strand of the Seven-Headed Dragon.

## 5. The placement check

`placement.steps` is a ladder of `{ skill, problems, passAccuracy, levels }`. The check asks
`problems` keypad problems of each step; reaching `passAccuracy` places the step's `levels`
(completed with one star, replayable, first-time eggs and cosmetics granted) and climbs; failing
a step, `stopAfterMisses` misses in a row or `maxProblems` answers end it. Rules for authors:

- never place the intro level of the game (Sunny Meadow 1): every child plays it and hatches the
  first egg there;
- never place a region's level 1 (its welcome story gives the region's egg) or a boss level:
  bosses are fun and gate the next region;
- keep the whole ladder within 12-24 problems.

Levels of a later region can be placed before the region opens; they wait, completed, until the
previous boss is won over.

## 6. Market, stickers and quests

- **Cosmetics** `{ id, slot, assetId, nameKey, price, unlock }`: `assetId` must be an ID in
  `assets/art/catalog.json` (S4); `unlock` is the level that puts it in Glimmer's Market (`null`
  for from the start). Prices by tier: 15-25 starter, 30-45 regions 2-4, 50-80 later and boss
  rewards. A cosmetic that a level grants still appears in the market (as owned).
- **Stickers** `{ id, nameKey, page, criteria, icon, color, frame }`: one album page per region;
  `icon` is an art icon ID (items, fruits, map nodes, glyphs, region emblems) or a cosmetic ID,
  `frame` one of S4's sticker frames, `color` a `#rrggbb` colour (S4's composer renders the three;
  its content-art test composes every sticker). Criteria kinds are listed in contract §7.1. A sticker named
  for something the child does must use a criterion only that action meets: Dressed Up is
  `dragons-dressed`, not `cosmetics-owned`, because placed levels and level rewards also give
  cosmetics.
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
each is granted once. Put a claim that must not be missed (a region's egg) in the first node's
`entryEffects`: starting the beat applies it, so skipping the beat still grants it.

Every region has a welcome beat (`level-start` of its level 1, the region's scene), a boss intro
(`level-start` of the boss level) and an outro (`boss-defeated`); the Seven-Headed Dragon's outro
is the `finale` beat in the castle hall.

## 8. The valley as shipped (v1)

Nine regions, 50 lessons and 9 boss levels, 65 skills, 15 dragons, 42 cosmetics (the whole art
catalog), 53 stickers, 12 quest templates and 30 story beats. Level objectives are in
curriculum.md §3. Rewards besides stars: eggs and cosmetics; a boss level also gives 30 boss coins
the first time.

### Sunny Meadow (`sunny-meadow`)

| Level               | Activities                                                                                        | Rewards                                 |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `sunny-meadow.1`    | Egg Grid (×2, ×5, ×10; 3 boards), Feeding Time (same; 8; choice)                                  | stars                                   |
| `sunny-meadow.2`    | Feeding Time (×2, ×5; 10; choice), Memory Match (×2, ×5; 6 pairs)                                 | eggs Bubbles, Sunny, Goldie             |
| `sunny-meadow.3`    | Feeding Time (×0, ×1, ×10; 10; auto), Number Trail (×10)                                          | eggs Mirror, Puff (story, at the start) |
| `sunny-meadow.4`    | Egg Grid (×2, ×5; 2), Fact Family Nest (÷2, ÷5, ÷10; 3), Feeding Time (÷ and missing factors; 10) | striped scarf                           |
| `sunny-meadow.5`    | Feeding Time (all meadow ×, ÷; 12; keypad), Memory Match (÷; 6 pairs)                             |                                         |
| `sunny-meadow.6`    | Riddle Scrolls (6)                                                                                |                                         |
| `sunny-meadow.boss` | The Bridge Troll: meter 15, cap 20, laughing                                                      | party hat, 30 boss coins                |

Placement ladder: ×2/×5 (4 problems, 75 %) places level 2, ×0/×1/×10 (3, 100 %) level 3,
÷2/÷5/÷10 (3, 67 %) level 4, missing factors (3, 67 %) level 5; then ×3/×4 (4, 75 %) places
Whispering Woods 2 and 3 and ÷3/÷4 (3, 67 %) Whispering Woods 4 (20 problems at most).

### Whispering Woods (`whispering-woods`)

| Level                                     | Activities                                                                                             | Rewards                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `whispering-woods.1` Clover Counts        | Egg Grid (`mul-3`; 3), Number Trail (`mul-3`; 1; length 10; gaps 3), Feeding Time (`mul-3`; 8; choice) | egg Clover (story, at the start); egg Petal                     |
| `whispering-woods.2` Petal Doubles        | Egg Grid (`mul-4`; 2; split double), Feeding Time (`mul-4`; 10; choice)                                |                                                                 |
| `whispering-woods.3` Woodland Recall      | Feeding Time (`mul-3-4`; 12; keypad), Memory Match (`mul-3-4`; 1; pairs 6)                             |                                                                 |
| `whispering-woods.4` Sharing in the Woods | Fact Family Nest (`div-3-4`; 3), Sharing Feast (`div-3-4`; 3), Feeding Time (`div-3-4`; 10)            | Square Glasses                                                  |
| `whispering-woods.5` Woods and Meadow Mix | Feeding Time (`mul-2-3-4-5-10`; 12), Compare Stones (`compare-woods`; 6; choice)                       |                                                                 |
| `whispering-woods.6` Woodland Stories     | Riddle Scrolls (`word-woods`; 6)                                                                       |                                                                 |
| `whispering-woods.boss` The Forest Witch  | Boss (`mul-3-4`, `div-3-4`; 20)                                                                        | meter 15, happy; the region's eggs if still missing; Wizard Hat |

### Fire Mountain (`fire-mountain`)

| Level                                              | Activities                                                                         | Rewards                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `fire-mountain.1` Ember's Spikes                   | Egg Grid (`mul-6`; 3; split five-plus), Feeding Time (`mul-6`; 8; choice)          | egg Ember (story, at the start); egg Rainbow                       |
| `fire-mountain.2` Rainbow Stripes                  | Egg Grid (`mul-7`; 3; split five-plus), Feeding Time (`mul-7`; 10; choice)         |                                                                    |
| `fire-mountain.3` Hot Recall                       | Feeding Time (`mul-6-7`; 12; keypad), Number Trail (`mul-7`; 1; length 10; gaps 3) |                                                                    |
| `fire-mountain.4` Sharing the Fire                 | Fact Family Nest (`div-6-7`; 3), Feeding Time (`div-6-7`, `missing-6-7`; 10)       | Glowing Lantern                                                    |
| `fire-mountain.5` Mountain Mix                     | Feeding Time (`mul-2-to-7`; 12), Memory Match (`mul-6-7`; 1; pairs 6)              |                                                                    |
| `fire-mountain.6` Mountain Stories                 | Riddle Scrolls (`word-mountain`; 6)                                                |                                                                    |
| `fire-mountain.boss` Krakonoš, the Mountain Spirit | Boss (`mul-6-7`, `div-6-7`, `missing-6-7`; 23)                                     | meter 18, laughing; the region's eggs if still missing; Sports Cap |

### Crystal Caves (`crystal-caves`)

| Level                               | Activities                                                                                  | Rewards                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `crystal-caves.1` Crystal Doubles   | Egg Grid (`mul-8`; 3; split double), Feeding Time (`mul-8`; 8; choice)                      | egg Crystal (story, at the start); egg Starry                      |
| `crystal-caves.2` Starry Nines      | Egg Grid (`mul-9`; 3; split ten-minus), Feeding Time (`mul-9`; 10; choice)                  |                                                                    |
| `crystal-caves.3` Cave Recall       | Feeding Time (`mul-8-9`; 12; keypad), Number Trail (`mul-9`; 1; length 10; gaps 3)          |                                                                    |
| `crystal-caves.4` Gem Sharing       | Fact Family Nest (`div-8-9`; 3), Sharing Feast (`div-8-9`; 3), Feeding Time (`div-8-9`; 10) | Treasure Pile                                                      |
| `crystal-caves.5` Deep Cave Mix     | Feeding Time (`mul-all`; 14), Compare Stones (`compare-caves`; 6; choice)                   |                                                                    |
| `crystal-caves.6` Cave Stories      | Riddle Scrolls (`word-caves`; 6)                                                            |                                                                    |
| `crystal-caves.boss` The Gnome King | Boss (`mul-8-9`, `div-8-9`; 23)                                                             | meter 18, happy; the region's eggs if still missing; Propeller Hat |

### Sharing Lake (`sharing-lake`)

| Level                                | Activities                                                                                     | Rewards                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `sharing-lake.1` Fair Shares         | Sharing Feast (`div-all`; 5), Feeding Time (`div-all`; 10; choice)                             |                              |
| `sharing-lake.2` Missing Pieces      | Feeding Time (`missing-all`; 12)                                                               |                              |
| `sharing-lake.3` Fact Family Island  | Fact Family Nest (`div-all`; 4), Memory Match (`mul-all`, `div-all`; 1; pairs 6; match family) |                              |
| `sharing-lake.4` Times as Many       | Riddle Scrolls (`word-times`; 6)                                                               | Patchwork Quilt              |
| `sharing-lake.5` More or Times?      | Riddle Scrolls (`word-contrast`; 6), Compare Stones (`compare-lake`; 6; choice)                |                              |
| `sharing-lake.6` Lake Mix            | Feeding Time (`div-all`; 14; keypad)                                                           |                              |
| `sharing-lake.boss` The Water Goblin | Boss (`div-all`, `missing-all`, `word-contrast`; 25)                                           | meter 20, happy; Captain Hat |

### Leftover Lagoon (`leftover-lagoon`)

| Level                                        | Activities                                                                 | Rewards                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `leftover-lagoon.1` Pearls Left Over         | Sharing Feast (`rem-small`; 4), Feeding Time (`rem-small`; 8; choice)      | egg Pearl (story, at the start)                                        |
| `leftover-lagoon.2` Smaller Than the Divisor | Feeding Time (`rem-all`; 10)                                               |                                                                        |
| `leftover-lagoon.3` Lagoon Recall            | Feeding Time (`rem-all`; 12; keypad), Memory Match (`rem-all`; 1; pairs 6) |                                                                        |
| `leftover-lagoon.4` Leftover Stories         | Riddle Scrolls (`word-leftover`; 6)                                        | Heart Wings                                                            |
| `leftover-lagoon.5` Lagoon Mix               | Feeding Time (`rem-mixed`, `div-all`; 14)                                  |                                                                        |
| `leftover-lagoon.boss` The Lake Nymphs       | Boss (`rem-mixed`, `word-leftover`; 23)                                    | meter 18, laughing; the region's eggs if still missing; Pearl Necklace |

### Giant's Peaks (`giants-peaks`)

| Level                                  | Activities                                                                   | Rewards                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `giants-peaks.1` Giant Steps           | Feeding Time (`pow10`; 10), Number Trail (`mul-10`; 1; length 10; gaps 3)    | egg Boulder (story, at the start)                             |
| `giants-peaks.2` Tens Times            | Number Trail (`tens-1d`; 1; length 9; gaps 3), Feeding Time (`tens-1d`; 10)  |                                                               |
| `giants-peaks.3` Break It Apart        | Feeding Time (`mul2d1d-nocarry`; 10; choice)                                 |                                                               |
| `giants-peaks.4` Carry the Boulder     | Feeding Time (`mul2d1d-carry`; 10; keypad)                                   | Number Blocks                                                 |
| `giants-peaks.5` Split the Load        | Sharing Feast (`div2d1d`; 3), Feeding Time (`div2d1d`; 10)                   |                                                               |
| `giants-peaks.6` Peak Stories          | Riddle Scrolls (`word-peaks`; 6)                                             |                                                               |
| `giants-peaks.boss` The Friendly Giant | Boss (`pow10`, `tens-1d`, `mul2d1d-nocarry`, `mul2d1d-carry`, `div2d1d`; 23) | meter 18, sleepy; the region's eggs if still missing; Top Hat |

### Riddle Ruins (`riddle-ruins`)

| Level                               | Activities                                                                                                                                                               | Rewards                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `riddle-ruins.1` Gears in Order     | Golem Orders (`order-precedence`; 4), Feeding Time (`order-precedence`; 8)                                                                                               | egg Clockwork (story, at the start)                           |
| `riddle-ruins.2` Brackets First     | Golem Orders (`order-brackets`; 4), Feeding Time (`order-brackets`; 8)                                                                                                   |                                                               |
| `riddle-ruins.3` Compare Stones     | Compare Stones (`compare-expression`; 10; choice)                                                                                                                        |                                                               |
| `riddle-ruins.4` Words of the Ruins | Feeding Time (`terms-all`; 10; choice), Memory Match (`terms-all`; 1; pairs 6; match term)                                                                               | Book Stack                                                    |
| `riddle-ruins.5` Two-Step Riddles   | Riddle Scrolls (`word-two-step`; 6)                                                                                                                                      |                                                               |
| `riddle-ruins.6` Ruins Mix          | Feeding Time (`div-all`, `missing-all`, `rem-mixed`, `pow10`, `tens-1d`, `mul2d1d-carry`, `div2d1d`, `order-mixed`, `compare-expression`, `terms-all`, `word-times`; 14) |                                                               |
| `riddle-ruins.boss` The Golem       | Boss (`order-precedence`, `order-brackets`, `compare-expression`, `terms-all`, `word-two-step`; 25)                                                                      | meter 20, happy; the region's eggs if still missing; Chef Hat |

### Dragon Castle (`dragon-castle`)

| Level                                        | Activities                                                                                                                                                   | Rewards                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `dragon-castle.1` The Great Hall             | Feeding Time (`mul-all`, `div-all`; 15; keypad)                                                                                                              |                                                                                      |
| `dragon-castle.2` Polishing the Window       | Feeding Time (`mul-all`, `div-all`; 12; draw weakest), Memory Match (`mul-all`; 1; pairs 6)                                                                  |                                                                                      |
| `dragon-castle.3` Seven Sneezes Practice     | Feeding Time (`mul-all`, `div-all`, `rem-mixed`, `mul2d1d-carry`, `order-mixed`, `compare-expression`, `word-castle`; 14), Riddle Scrolls (`word-castle`; 4) |                                                                                      |
| `dragon-castle.boss` The Seven-Headed Dragon | Boss (`mul-all`, `div-all`, `rem-mixed`, `mul2d1d-carry`, `order-mixed`, `compare-expression`, `word-castle`; 28)                                            | meter 21 (7 heads), happy; egg The Seven-Headed Dragon (hatches at once); Gold Medal |

Market: 42 cosmetics, 13 from the start or Sunny Meadow (15-60 coins), then two to five per
region (30-45 coins in regions 2-4, 50-80 later), each boss level giving one (hats, a pearl
necklace from the nymphs, the gold medal at the finale). Quests: six from the start, six more with
bigger targets unlocking in regions 2-4.
