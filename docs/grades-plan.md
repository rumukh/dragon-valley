# Dragon Valley for grades 1-3: plan

Status: **draft for approval**. Nothing here is implemented yet. Once approved, this plan is
executed like v1 ([plan.md §5](plan.md#5-delivery-plan-todos-are-tracked-in-sql)): this session
coordinates, child sessions implement one workstream and one PR each.

## 0. Decisions (from Q&A)

| Topic          | Decision                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grades         | **1, 2 and 3** now. 4th grade later, as new regions after Dragon Castle.                                                                                                                                   |
| World          | **One continuous valley.** New 1st- and 2nd-grade regions come **before** Sunny Meadow. A grade per child sets where the child starts.                                                                     |
| Existing kids  | Unchanged. Every existing save is a 3rd grader starting at Sunny Meadow, with all progress kept.                                                                                                           |
| 1st grade      | The whole Czech 1st-grade program: counting, reading and comparing numbers **0-20**; **addition and subtraction within 10, then within 20** (first without, then with crossing ten); simple word problems. |
| 2nd grade      | New regions for **numbers to 100** and **+/− within 100**. 2nd-grade multiplication (×2-5, ×10) is taught by the existing Sunny Meadow and Whispering Woods, so a 2nd grader flows straight into them.     |
| Way of working | Plan first (this document), then a coordinator and child sessions, one PR each, as in v1.                                                                                                                  |

## 1. How grades work

### 1.1 The grade setting

- A new **rules setting `grade`** (1, 2 or 3) in `ProfileState.settings`, changed with
  `setSetting { key: 'grade' }`. It is authoritative game state (it changes unlocks and suggestions),
  so it lives in the save, not in the app's preferences. Saves without it read as **grade 3**
  (state migration, `STATE_VERSION` 2).
- Content declares where each grade starts:
  `grades: [{ grade: 1, start: '<g1 first region>' }, { grade: 2, start: '<g2 first region>' },
{ grade: 3, start: 'sunny-meadow' }]`, and every region gets a `grade` field.
- **Unlocking** (`progression/levels.ts`): a region is open if it is the child's start region, or
  its `unlock.after` is complete (as today), or a parent unlocked it ahead (as today), or **it
  belongs to an earlier grade** than the child's (free practice, never required).
- **Suggestions**: the Daily Adventure's "next glowing level" (`nextLevel`) starts at the child's
  start region; earlier-grade regions are open on the map but never pushed.
- **Sunny Meadow** gets `unlock.after: [<last 2nd-grade boss>]`. Because a 3rd grader's start
  region is always open, nothing locks for existing children, and a 1st grader walks the whole
  valley from the first region to the castle.
- **Changing grade** (parent area, behind the gate): only moves the start and the suggestions.
  Progress, dragons and coins stay. Moving up later is the normal path ("now in 2nd grade").

### 1.2 Choosing the grade

- The new-keeper editor gets a third step after name and avatar: _"Which class is Ema in?"_ with
  three big read-aloud buttons (1st, 2nd, 3rd class). A wrong pick costs nothing and the parent can
  change it later.
- The shell dispatches the grade before the child's first `startSession`, so the first-session
  story already knows it.
- The parent area's settings show the grade per child (with a short note on what it changes) and
  the progress page groups by grade.

### 1.3 First session per grade

- The prologue is shared. The **first egg** beat is per grade: beat triggers gain an optional
  `grades` filter (`first-session`, `after-beat`, …), so a 1st grader chooses among 1st-grade eggs,
  a 2nd grader among 2nd-grade eggs, and a 3rd grader among Bubbles, Sunny and Goldie exactly as now.
- A child who reaches Sunny Meadow without having chosen a meadow egg receives Bubbles's egg with
  Sunny Meadow 1's welcome (so its "the first egg's table" rule still holds).
- **Placement** steps gain a `grade` field and the check runs only the child's grade's ladder:
  none for grade 1 (they start at the beginning), a short ladder for grade 2 (numbers to 100,
  +/− without crossing), today's ladder for grade 3.
- Finishing each grade's last boss earns a **"1st grade done!" / "2nd grade done!"** certificate
  and celebration; the valley simply continues. The Seven-Headed Dragon stays the finale.

## 2. Curriculum (the new `docs/curriculum.md` sections)

Sources: RVP ZV, _Matematika a její aplikace_, 1st period (M-3-1-01 counting, M-3-1-02 reading,
writing and comparing numbers, M-3-1-03 number line, M-3-1-04 mental calculation, M-3-1-05 word
problems), mapped to typical 1st- and 2nd-grade textbooks (Hejný, Fraus, Prodos).

### 2.1 New objectives (stable IDs, append-only)

| ID                       | Grade | Objective                                                               |
| ------------------------ | ----- | ----------------------------------------------------------------------- |
| `obj.num.count-10`       | 1     | Count objects to 10; read and write numbers 0-10                        |
| `obj.num.compare-10`     | 1     | Compare and order numbers 0-10 (`<`, `>`, `=`), number line             |
| `obj.add.within-10`      | 1     | Addition within 10                                                      |
| `obj.sub.within-10`      | 1     | Subtraction within 10                                                   |
| `obj.add.bonds-10`       | 1     | Number bonds of 10 and missing addends (`7 + ? = 10`)                   |
| `obj.num.to-20`          | 1     | Numbers 11-20: tens and ones, compare, number line                      |
| `obj.addsub.20-no-cross` | 1     | +/− within 20 without crossing ten (`13 + 4`, `17 − 3`)                 |
| `obj.addsub.20-cross`    | 1     | +/− within 20 crossing ten (`8 + 5`, `13 − 6`)                          |
| `obj.word.add-sub`       | 1, 2  | Word problems: adding to, taking away, "N more / N fewer"               |
| `obj.num.to-100`         | 2     | Numbers to 100: tens and ones, place value, compare, order, number line |
| `obj.addsub.tens`        | 2     | Whole tens ± whole tens (`40 + 30`, `90 − 50`)                          |
| `obj.addsub.2d1d`        | 2     | 2-digit ± 1-digit, without and with crossing ten (`34 + 5`, `34 + 8`)   |
| `obj.addsub.2d2d`        | 2     | 2-digit ± 2-digit, without and with crossing ten (`34 + 25`, `52 − 27`) |
| `obj.word.two-step-add`  | 2     | Simple two-step additive word problems                                  |

Multiplication meaning and ×2-5, ×10 for 2nd grade stay on their existing objectives in Sunny
Meadow and Whispering Woods; curriculum.md notes that those regions serve both grades.

### 2.2 New generators (bounds)

| Generator     | Items                                                                                            | Bounds                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `num.count`   | buckets `count:<range>`                                                                          | count dots/objects 0-20 (ten-frame layout), read a number                            |
| `num.compare` | buckets `ncompare:<range>`                                                                       | two numbers 0-20 or 0-100; extends Compare Stones with `number-number` sides         |
| `num.place`   | buckets `place:tens`, `place:ones`, `place:compose`                                              | tens and ones of 11-99; `4 tens 7 ones = ?`                                          |
| `add.fact`    | **`add:A+B`**, A, B in 0-10 (121 items, like `mul:AxB`)                                          | the whole addition table to 10 + 10; `range` limits sums (≤ 10 first, then ≤ 20)     |
| `sub.fact`    | **`sub:M-S`**, S 0-10, difference 0-10 (121 items)                                               | the mirror of `add.fact`; minuend ≤ 20                                               |
| `add.missing` | the matching `sub:` item (as `mul.missing` uses `div:`)                                          | `7 + ? = 10`, `? + 4 = 9`; never ambiguous                                           |
| `addsub.2d`   | buckets `add2d:<shape>-<carry>`, `sub2d:<shape>-<borrow>`                                        | shapes `tens`, `2d1d`, `2d2d`; `crossing: required/allowed/forbidden`; results 0-100 |
| `word`        | existing; new templates in families `add-to`, `take-from`, `more-than`, `fewer-than`, `two-step` | numbers inside the region's skills; additive models only for grades 1-2              |

Each `add:` fact has partial credit with its commuted twin (`add:3+5` ↔ `add:5+3`), exactly as
multiplication does. Distractors get additive error patterns: ±1 (counting slip), the other
operation, forgotten carry or borrow (`34 + 8 = 32`), digit-wise subtraction (`52 − 27 = 35`),
reversed digits.

## 3. The new regions

Five regions, about 28 lessons and 5 bosses. Names and bosses are proposals for your review;
bosses are Czech folk-tale characters in the public domain, friendly as in v1.

| #   | Region (proposal)                       | Grade | Focus                                                    | Boss (won over by…)                                                                   | New dragons (proposal)          |
| --- | --------------------------------------- | ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | **Pebble Brook** (`pebble-brook`)       | 1     | Counting and numbers to 10, compare, + within 10         | The Will-o'-the-Wisps (_bludičky_): count their lights until they dance               | **Dot** (counting), **Hop** (+) |
| 2   | **Mushroom Hollow** (`mushroom-hollow`) | 1     | − within 10, bonds of 10, missing addend, first stories  | The House Goblin (_skřítek_): give back what he hid, one less each time               | **Nibble** (−)                  |
| 3   | **Rainbow Ford** (`rainbow-ford`)       | 1     | Numbers to 20, +/− to 20 without, then with crossing ten | Kašpárek the jester: answers make him laugh (end of 1st grade)                        | **Tenzi** (crossing ten)        |
| 4   | **Hundred Hills** (`hundred-hills`)     | 2     | Numbers to 100, place value, tens ± tens, 2d ± 1d        | Long, Broad and Sharp-Eyes (_Dlouhý, Široký a Bystrozraký_)                           | **Bead** (place value)          |
| 5   | **Market Square** (`market-square`)     | 2     | 2d ± 1d and 2d ± 2d with crossing, two-step stories      | Otesánek, always hungry: feed him exact sums until he sleeps (end of 2nd grade's +/−) | **Tumble** (carry and borrow)   |

Then **Sunny Meadow** and **Whispering Woods** (2nd-grade ×), then the existing 3rd-grade valley.

- New dragons are `special` dragons (no times table) growing on their region's skills, the way
  Pearl, Boulder and Clockwork do. A 1st grader's first egg is Dot, Hop or Nibble (open question
  2), and Pebble Brook 1 serves counting and + and − within 5, so whichever egg is chosen hatches
  in the first session (the learner simulation confirms it). A 2nd grader chooses among Bead,
  Tumble and a third 2nd-grade egg.
- Each region keeps the v1 pattern: welcome beat with an egg, concept → choice → keypad →
  minigame → mixed review → stories → boss; stickers (one album page per region), a few
  cosmetics, quests.

### 3.1 Activities for the young ones

| Activity                                  | Reuse / change                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Feeding Time                              | as is, with `add`/`sub`/`num` problems                                                  |
| Compare Stones                            | as is, with `num.compare` (numbers 0-20, 0-100) and `add`/`sub` sides                   |
| Riddle Scrolls                            | as is, with additive templates; "pick the operation" offers only + and − for grades 1-2 |
| Memory Match                              | as is: sums ↔ values, `add` ↔ `sub` families                                            |
| Number Trail                              | add counting trails (by 1 from any start, by 2, by 10, backwards) from `num.*` skills   |
| Fact Family Nest                          | add an additive family: `a + b = c`, `b + a = c`, `c − a = b`, `c − b = a`              |
| **Ten Frame** (new, `dv.ten-frame`)       | fill two ten-frames to show a number, make ten, then cross it (`8 + 5 = 8 + 2 + 3`)     |
| **Bundle Sticks** (new, `dv.place-value`) | bundle sticks into tens to build 2-digit numbers and to regroup for + and −             |
| Boss                                      | as is                                                                                   |

## 4. Making it work for 6- and 7-year-olds

- **Reading.** For grade 1 the defaults are `autoRead: true` and every story line, instruction and
  problem is read aloud; buttons keep icons next to words. Story lines for grades 1-2 stay at
  **at most 6 words** (a stricter child profile in the content gate for those regions).
- **Pictures first.** New visual models for problems: dots and ten-frames (to 20), a number line,
  tens sticks and ones cubes (to 100). Shown on choice problems and as the hint for misses.
- **Input.** Three choices instead of four while a fact is new; a keypad limited to 2 digits for
  grade 1. Big numerals.
- **Time.** Per-grade response thresholds (`balance.grades[g].response`), so a 1st grader's
  "fast" is slower than a 3rd grader's; shorter rounds (6-8 problems) for grade 1.
- **The Magic Window for + and −.** A second face of the window, the **Sun Window**: an 11 × 11
  addition mosaic (`add:A+B`) and a subtraction panel (`sub:M-S`), the exact mirror of × and ÷.
  The hub shows the window of the child's current grade; both are always reachable. 2nd-grade
  2-digit work shows per skill in Progress, as 3rd-grade "beyond the tables" work does now.
- **The map.** The current map has no room for five more regions. It becomes **two connected
  sheets**: the new **Lower Valley** (regions 1-5, a river and hills leading up) and today's
  valley; the road crosses from one sheet to the next, and the map opens on the sheet of the
  child's glowing level.
- **Parents.** Progress groups skills by grade; printables add addition and subtraction flashcards
  and a certificate per finished grade.

## 5. Compatibility and safety nets

- IDs stay append-only: no shipped level, skill, dragon or sticker changes ID. Only Sunny Meadow's
  region `unlock.after` changes, and the grade-3 start rule keeps it open.
- Content **1.4.0** (minor: new regions). Old saves restore with their archived pack and move to
  1.4.0 at the hub, then default to grade 3. New migration tests: a 1.3.0 save mid-Sunny Meadow
  upgrades with nothing locked; a grade-1 save reaches Sunny Meadow through the Lower Valley.
- `STATE_VERSION` 2 with a migration adding `settings.grade = 3`; the family record and
  preferences keep their versions (the grade lives in the save).
- Golden traces are re-pinned once, with the reason, as content.md §1 requires.

## 6. Verification

- Exhaustive generator tests for every new generator (every `add`/`sub` fact, every 2-digit
  bucket, crossing rules, unique answers, valid distractors).
- Learner simulations with **grade-1 and grade-2 learners** (slower answers): success stays in the
  70-90 % band, every new dragon hatches, every boss is winnable, a 1st grader reaches Sunny Meadow
  in a plausible number of days; the 3rd-grade report must not change.
- Content validation: every new objective has a lesson and a boss; the 6-word limit for grades
  1-2 story lines.
- E2E: new keeper with each grade, first session per grade, grade change in the parent area, the
  two-sheet map, read-aloud on by default for grade 1, an existing (1.3.0) save upgraded.
- **Human gates**: approve region names, bosses and dragon designs; the slice playtest with a 1st
  grader; copy review for 6-year-olds.

## 7. Delivery

Like v1, contract first, then parallel workstreams, then a **vertical slice**: grade selection and
**Pebble Brook complete** (rules, content, app, art) for a playtest with a 1st grader before the
other four regions are built.

| Session                | Scope                                                                                                                                                                                                                                                                                       | Starts after                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **G1 Contract & docs** | this plan's decisions into `contract.md`, `curriculum.md` (grades 1-2), `design.md` (regions, activities, young-player UX), `content.md`; the contract code: kinds, IDs, skills schema, `grade` setting, `grades`/`region.grade` fields, beat/placement `grades` filters, `STATE_VERSION` 2 | plan approved                   |
| **G2 Rules**           | grade unlock and suggestion rules, state migration, new generators and item IDs, additive distractors, Sun Window view, Number Trail / Fact Family extensions, Ten Frame and Bundle Sticks minigames, per-grade balance, simulation learners                                                | G1 merged                       |
| **G3 Content**         | Pebble Brook (slice), then the other four regions: levels, skills, word templates, stories, dragons, bosses, stickers, quests, cosmetics, placement; content 1.4.0; balance report                                                                                                          | G1 merged (plays once G2 lands) |
| **G4 App**             | grade step in the keeper editor, grade in the parent area, first-session per grade, young-player UX (auto-read, 3 choices, 2-digit keypad), visual models (dots, ten-frame, number line, sticks), Sun Window, the two-sheet map, Progress and printables                                    | G1 merged                       |
| **G5 Art**             | Lower Valley map sheet and hotspots, 5 region scenes, 5 bosses, about 6 dragon recipes, emblems, stickers, palette, goldens                                                                                                                                                                 | G1 merged                       |
| **G6 QA & release**    | E2E, accessibility, copy review for grade 1-2 reading, screenshots, migration checks, release                                                                                                                                                                                               | slice integrated                |

Phases: **0** plan approval → **1** G1 → **2** G2-G5 in parallel on Pebble Brook → **3** slice
playtest with a 1st grader → **4** the remaining four regions → **5** G6 and release.

## 8. Open questions for you

1. Region names, bosses and dragon names in §3: keep, or do you have favourites?
2. Grade-1 first egg: a choice of three different 1st-grade dragons (like today), or one dragon in
   three colours?
3. Should a 2nd or 3rd grader be allowed to earn the earlier-grade dragons by playing those
   regions for fun (proposed: yes), or should those regions be hidden for them?
4. Is anyone available for the slice playtest with a real 1st grader?
