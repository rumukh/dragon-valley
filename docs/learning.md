# Problem generation

How Dragon Valley turns a skill and an item into a problem, and a problem into answer options.
The code is `src/rules/learning/generate.ts` (the entry point), `src/rules/learning/generators/`
(one module per generator family) and `src/rules/learning/distractors.ts`; the tests are
`test/unit/learning/`. The types are in [contract.md](contract.md) §5-§7, and the bounds come from
[curriculum.md](curriculum.md) §4.

## 1. Entry points

```ts
problemFor(skill, item, { problems, words, data }): Problem
choicesFor(problem, count, distractors): AnswerValue[]
keypadPossible(problem): boolean
```

- `problemFor` draws a problem that practises `item` (one of `skillItems(skill)`) through `skill`.
  Numbers, positions and shapes come from the `problems` stream, and the names and objects of word
  problems come from the `words` stream. `data` is the content pack's data, of which word problems
  read `wordTemplates` and `wordLists`. Nothing else is random: the same streams and content always
  give the same problem. It throws `Generator <id> cannot practise <item>.` for an item the skill
  can never produce (a caller bug or invalid content).
- `choicesFor` gives `count` options with the correct one among them, shuffled by the
  `distractors` stream (§4). Relations always offer `<`, `>`, `=`, and operations always offer
  `+`, `−`, `·`, `:`.
- `keypadPossible` is true for numeric and remainder answers. A keypad cannot enter a relation
  (Compare Stones) or a term, so `auto` input must resolve to choice for those problems.
- Every problem `problemFor` emits passes `expectedAnswer` with exactly one answer. The rounds call
  `choicesFor` only for choice input, and only for the answer step: the operation step of a word
  problem always offers the four operations.

## 2. Items

| Generator       | Items                                  | One item is                                                    |
| --------------- | -------------------------------------- | -------------------------------------------------------------- |
| `mul.fact`      | `mul:AxB`                              | the fact `A · B` as written                                    |
| `div.fact`      | `div:P:D`                              | the fact `P : D`                                               |
| `mul.missing`   | `div:P:D`                              | `? · D = P` or `D · ? = P` (the division fact)                 |
| `div.remainder` | `rem:d2` … `rem:d10`                   | division with remainder by that divisor                        |
| `mul.power10`   | `pow10:x10`, `pow10:x100`              | a number times 10 or 100                                       |
| `mul.tens`      | `tens:d2` … `tens:d9`                  | a multiple of ten times that digit                             |
| `mul.2d1d`      | `mul2d1d:carry`, `mul2d1d:nocarry`     | a two-digit times a one-digit number, the ones carrying or not |
| `div.2d1d`      | `div2d1d:regroup`, `div2d1d:noregroup` | a two-digit number over a one-digit divisor, regrouping or not |
| `order.ops`     | `order:brackets`, `order:no-brackets`  | an expression of 2-3 operations with or without brackets       |
| `compare`       | `compare:<sides>`                      | a comparison of the skill's kind                               |
| `word`          | `word:<family>`                        | a story of that family                                         |
| `terms`         | `terms:<term>`                         | naming that term in a sentence                                 |

## 3. Generators

Each generator draws uniformly from what the parameters allow. Where an item covers several
groups (divisors, one-digit factors), the group is drawn first, so every divisor is practised
equally often whatever its number of quotients.

- **`mul.fact`, `div.fact`, `mul.missing`** (walking skeleton, unchanged): the item is the fact.
  Only the missing factor's position is drawn (`position: 'both'`). The known factor is never 0,
  so the blank is unique.
- **`div.remainder`** (`23 : 5 = ? r ?`): a quotient and a remainder are drawn from every pair the
  parameters allow: quotient in `quotients`, remainder smaller than the divisor and present,
  possible or absent as `remainder` asks, and dividend at most `dividendMax` (99 in the core). The
  all-zero `0 : d = 0 r 0` is left out unless nothing else fits.
- **`mul.power10`** (`34 · 10`, `7 · 100`, either order): the factor comes from `factors`, with the
  product at most `resultMax` (1000, so at most a single digit times 100, or 10 · 100).
- **`mul.tens`** (`30 · 3`, either order): the tens come from `tens` and the digit from the item.
- **`mul.2d1d`** (`23 · 3` no carry, `14 · 3` carry, two-digit factor first): the one-digit factor
  is drawn, then a two-digit factor with the item's carry (the ones' product reaches ten). Round
  tens (`30 · 3`) belong to `mul.tens` and are used only when nothing else fits.
- **`div.2d1d`** (`69 : 3` no regrouping, `48 : 3` regrouping): the divisor is drawn, then a
  quotient with the item's regrouping (the tens are not a multiple of the divisor). The dividend
  has two digits up to `dividendMax`. With `remainder: 'forbidden'` (the core) the problem is
  `48 : 3 = ?`. A bonus skill that allows remainders asks `75 : 4 = ? r ?`.
- **`order.ops`** (`2 + 3 · 4`, `(2 + 3) · 4`, `24 : (8 − 2)`, `20 − 12 : 4`):
  - The number of operations and the expression's shape are drawn first. Every tree is exactly how
    its written text is read at school: brackets first, then `·` and `:`, then `+` and `−`, each
    from left to right. So a chain of the same strength is built from the left: `60 + 6 + 45 : 5`
    is the tree `(60 + 6) + (45 : 5)`, never `60 + (6 + 45 : 5)`, which prints the same text
    (the contract brackets a right operand of the same strength only under `−` and `:`) but would
    make Golem Orders ask for `6 + 9` before `60 + 6`.
  - A no-brackets problem mixes `·` or `:` with `+` or `−` when the operators allow it, so
    precedence matters.
  - A brackets problem has at least one bracket pair. Each pair holds one operation of two numbers,
    is never inside another, and holds `+` or `−` when the operators allow it. Brackets are
    explicit `group` nodes.
  - The numbers come from a small dynamic program over the shape. It works out every value each
    part can take, draws the answer, and splits it top-down, so the draw never fails.
  - Every intermediate value is a whole number at most `resultMax` (and 1000). Leaves come from
    `operands`. `·` and `:` stay in the small tables (factors, divisors and quotients 2-10),
    because the skill is the order, not big products. Only parameters that leave no room for that
    get 0, 1 or larger factors.
  - For brackets, a few redraws find numbers whose value changes without the brackets. The tests
    see this in every problem.
- **`compare`** (Compare Stones): one factor of every product comes from `tables` and the other is
  1-10 (0 only when the skill practises the 0 table). About `equalShare` % of comparisons are
  equal.
  - `fact-number`: `7 · 8 ○ 54`, with the number within a fifth of the product (2 to 10 away).
  - `fact-fact`: two products, among the 8 nearest, or equal (`3 · 8 ○ 4 · 6`).
  - `expression`:
    - precedence against brackets: `2 + 3 · 4 ○ (2 + 3) · 4`;
    - bracketing the wrong part: `6 · 4 + 2 ○ 6 · (4 + 2)`;
    - a product against its split: `7 · 8 ○ 7 · 5 + 7 · 3`, equal, or a near miss.
- **`terms`** (`6 · 7 = 42`, which is 42?):
  - `factor` and `product` use a product sentence. `dividend`, `divisor` and `quotient` use a
    division sentence. `remainder` uses a remainder sentence such as `23 : 5 = 4 r 3`, with a
    dividend of at most 99.
  - Factors, divisors and quotients are 2-10, so no sentence is trivial. A skill with only the 0
    and 1 tables uses the tables 2-10.
  - The highlighted number appears nowhere else in the sentence.
- **`word`**: §5.

## 4. Distractors

Choice options are the mistakes a child plausibly makes on the problem shown.

- **Signature mistake.** Each problem shape has one: the misconception its skill is about. It is
  offered whenever it is a valid option.
- **Ranked mistakes.** The other options are drawn from the first few valid mistakes in a ranked
  list (3 more than needed), so rounds vary. The answer's position comes from the `distractors`
  stream.
- **Small-table facts** keep the walking skeleton's options exactly: neighbouring products,
  `a + b`, the digits reversed and slips.
- **Validity.** A numeric distractor is a whole number, never the answer, at most 1000 (the 3rd-grade
  range, unless the answer is bigger), and at most one digit longer or shorter than the answer. A
  remainder distractor is a `{ quotient, remainder }` pair with the remainder below twice the
  divisor. Options never repeat. If too few mistakes are valid (answers such as 0), the nearest
  numbers fill in.

| Problem                    | Signature mistake                                                                                        | Further mistakes                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `7 · 8`                    | none                                                                                                     | `7 · 9`, `7 · 7`, `8 · 8`, `6 · 8`, `7 + 8`, 65, ± 1, ± 2, ± 10                                                    |
| `34 · 10`, `7 · 100`       | one zero too few (34, 70)                                                                                | one zero too many, `34 + 10`, `35 · 10`, `33 · 10`                                                                 |
| `30 · 3`                   | the zero dropped (9)                                                                                     | the zero doubled (900), `30 + 3`, neighbouring products                                                            |
| `14 · 3`, `23 · 3`         | the carry forgotten (32); without a carry, only the tens (63)                                            | only the ones multiplied (22), neighbouring products, ± 10, `14 + 3`                                               |
| `42 : 6`                   | none                                                                                                     | the quotient ± 1, ± 2, the divisor, ± 10                                                                           |
| `48 : 4`, `48 : 3`         | the tens divided and the ones copied (18); tens and ones apart                                           | only the tens (10), the zero dropped, ± 1, ± 10, `48 − 3`                                                          |
| `? · 6 = 42`               | none                                                                                                     | the answer ± 1, ± 2, the known factor, ± 10                                                                        |
| `(2 + 3) · 4`, `2 + 3 · 4` | brackets ignored (14); precedence ignored, left to right (20)                                            | brackets first then left to right, a step left out (12), slips                                                     |
| word problems              | the additive/multiplicative contrast (`4 · 3` → 7, `12 : 3` → 9, `4 + 3` → 12, `12 − 3` → 4)             | the other direction (`12 : 3` → 36, `4 + 3` → 1), a step of a two-step story, the arithmetic mistakes above, slips |
| `23 : 5 = 4 r 3`           | remainder not smaller than the divisor (3 r 8); for a quotient of 0, the next multiple (`3 : 5` → 1 r 2) | the next multiple's difference (5 r 2), swapped (3 r 4), remainder or quotient ± 1, remainder forgotten (4 r 0)    |
| terms                      | the closest term (`product` for `factor`, `divisor` for `dividend`)                                      | other terms of the same and of the other operation                                                                 |

## 5. Word problems

A word problem is a story from a content template (`content.wordTemplates`; catalog texts
`word.<family>.<story>` in `content/catalogs/en.content.json`). The item is the family. The
template is drawn from the skill's templates of that family.

### 5.1 Templates

```json
{
  "id": "word.times-as-many.fruit",
  "family": "times-as-many",
  "textKey": "word.times-as-many.fruit",
  "vars": {
    "name": { "kind": "word", "list": "names" },
    "friend": { "kind": "word", "list": "names" },
    "small": { "kind": "int", "min": 1, "max": 10 },
    "times": { "kind": "int", "min": 2, "max": 4 },
    "things": { "kind": "word", "list": "fruit" },
    "thing": { "kind": "form", "word": "things", "count": "small" }
  },
  "model": {
    "kind": "value",
    "expr": {
      "kind": "op",
      "op": "mul",
      "left": { "kind": "var", "name": "small" },
      "right": { "kind": "var", "name": "times" }
    }
  },
  "operation": "mul"
}
```

Text: `{name} has {small} {thing}. {friend} has {times} times as many. How many does {friend} have?`

- **`int`** variables have small ranges. All their combinations are enumerated, and only those whose
  `calc` values, every step of the model and the answer are whole numbers from 0 to 1000 are kept.
  A leftover story must also leave something over. One combination is drawn uniformly, so a
  template never fails while any combination fits, and the story's numbers always match its model.
  A template may have at most 20 000 combinations.
- **`word`** variables draw from `words`. Name lists give a name's catalog key; thing lists give the
  plural `<key>.other`. Two variables on the same list get different words.
- **`calc`** variables are worked out from numeric variables (`total = baskets · each`).
- **`form`** variables give the thing of a `word` variable in the form that agrees with a count:
  `<key>.one` exactly when the count is 1. So "Tom eats 1 cherry" and "Tom eats 3 cherries" are both
  right.
- **Region numbers** are written into each template's ranges. A story for the ×6 and ×7 tables has
  `times` 6-7 or a fixed `legs` 6, and big-number stories keep the curriculum's beyond-table
  bounds. The catalogue below says which region each template is written for.

### 5.2 Writing rules

These are checked by `scripts/validate-content.mjs` and `test/unit/learning/words.test.ts`.

- Short sentences: at most 10 words each (the child profile), counted with the longest name and
  thing a placeholder can take.
- A plain thing variable (plural) never follows a number that can be 1. A number that can be 1
  uses a `form` variable instead.
- "she" and "he" appear only with names from the `girls` and `boys` lists, or with a fixed
  character such as Grandma, Grandpa or the Gnome King.
- **Editorial ruling.** The text never says "N times fewer". The `times-fewer` family is written
  with "times as many" in the other direction: "Tom has 12 apples. That is 3 times as many as Eva
  has. How many does Eva have?" Each comparison family has an additive twin, worded the same except
  for the comparison ("3 times as many" and "3 more"; "that is 3 times as many as" and "that is 3
  more than"). The contrast levels (Sunny Meadow 6, Sharing Lake 5, the bosses) can serve them side
  by side.
- Czech life: orchards and markets, Grandma's eggs, plum dumplings, crowns (Kč), school, the
  valley's dragons (Ember, Rainbow), the Gnome King and the Lake Nymphs. Names are Czech and easy
  for English read-aloud: Anna, Ela, Eva, Klara, Maya, Nela, Adam, Filip, Kuba, Leo, Ondra, Tom.
- Two-step stories have no operation step (`operation: null`). Every other family names its
  operation for the Riddle Scrolls step.

### 5.3 Word lists

| List       | Kind  | Entries                                        |
| ---------- | ----- | ---------------------------------------------- |
| `names`    | name  | all twelve names                               |
| `girls`    | name  | Anna, Ela, Maya, Eva, Nela, Klara              |
| `boys`     | name  | Tom, Kuba, Leo, Adam, Filip, Ondra             |
| `fruit`    | thing | apple, pear, plum, cherry, apricot, strawberry |
| `treats`   | thing | bun, cookie, pancake, dumpling, muffin         |
| `school`   | thing | pencil, crayon, sticker, marble, card          |
| `treasure` | thing | gem, crystal, coin, pearl                      |
| `pond`     | thing | fish, frog, duck, snail                        |

### 5.4 Template catalogue

`word.` is left out of the IDs. Fixed numbers are ranges of one value (`legs 8`). The last column
says which region each template is written for. Word skills choose their templates (S2b's
content).

| Template                 | Step | Model                   | Numbers                             | Lists           | Written for                                                |
| ------------------------ | ---- | ----------------------- | ----------------------------------- | --------------- | ---------------------------------------------------------- |
| `equal-groups.nests`     | ·    | nests · eggs            | nests 2-10, eggs 2-5                | names           | Sunny Meadow (×2-×5)                                       |
| `equal-groups.bikes`     | ·    | bikes · wheels          | bikes 2-10, wheels 2                | -               | Sunny Meadow (×2)                                          |
| `equal-groups.stars`     | ·    | stars · points          | stars 2-10, points 5                | names           | Sunny Meadow (×5)                                          |
| `equal-groups.crayons`   | ·    | packs · each            | packs 2-10, each 10                 | names           | Sunny Meadow (×10)                                         |
| `equal-groups.baskets`   | ·    | baskets · each          | baskets 2-5, each 2-10              | names, fruit    | Sunny Meadow, Whispering Woods                             |
| `equal-groups.clovers`   | ·    | clovers · leaves        | clovers 2-10, leaves 3              | names           | Whispering Woods (×3)                                      |
| `equal-groups.dragons`   | ·    | count · legs            | count 2-10, legs 4                  | -               | Whispering Woods (×4)                                      |
| `equal-groups.eggs`      | ·    | boxes · each            | boxes 2-10, each 6                  | -               | Fire Mountain (×6)                                         |
| `equal-groups.weeks`     | ·    | weeks · days            | days 7, weeks 2-10                  | -               | Fire Mountain (×7)                                         |
| `equal-groups.beetles`   | ·    | beetles · legs          | beetles 2-10, legs 6                | names           | Fire Mountain (×6)                                         |
| `equal-groups.rainbows`  | ·    | count · colours         | count 2-10, colours 7               | names           | Fire Mountain (×7)                                         |
| `equal-groups.spiders`   | ·    | count · legs            | count 2-10, legs 8                  | -               | Crystal Caves (×8)                                         |
| `equal-groups.gems`      | ·    | rows · each             | rows 2-10, each 9                   | -               | Crystal Caves (×9)                                         |
| `equal-groups.market`    | ·    | bags · each             | bags 2-10, each 2-10                | names, fruit    | Sharing Lake, Dragon Castle (all tables)                   |
| `equal-groups.tickets`   | ·    | price · count           | tens 2-9, count 2-9                 | -               | Giant's Peaks (tens × 1-digit)                             |
| `equal-groups.pencils`   | ·    | packs · each            | each 10, packs 11-60                | -               | Giant's Peaks (× 10)                                       |
| `equal-groups.books`     | ·    | count · pages           | pages 100, count 2-9                | -               | Giant's Peaks (× 100)                                      |
| `equal-groups.trucks`    | ·    | each · trucks           | each 12-48, trucks 2-9              | -               | Giant's Peaks (2-digit × 1-digit)                          |
| `sharing.berries`        | :    | total : baskets         | baskets 2-5, each 1-10              | names           | Sunny Meadow (÷2-÷5)                                       |
| `sharing.friends`        | :    | total : 2               | half 1-10                           | names, fruit    | Sunny Meadow (÷2)                                          |
| `sharing.pancakes`       | :    | total : plates          | plates 3-4, each 1-10               | -               | Whispering Woods (÷3, ÷4)                                  |
| `sharing.plums`          | :    | total : dragons         | dragons 6-7, each 1-10              | -               | Fire Mountain (÷6, ÷7)                                     |
| `sharing.gnomes`         | :    | total : gnomes          | gnomes 8-9, each 1-10               | -               | Crystal Caves (÷8, ÷9)                                     |
| `sharing.class`          | :    | total : children        | children 2-10, each 1-10            | school          | Sharing Lake (all tables)                                  |
| `sharing.books`          | :    | total : classes         | classes 2-4, each 11-24             | -               | Giant's Peaks (2-digit : 1-digit)                          |
| `sharing.giant`          | :    | total : friends         | friends 5-6, each 10-16             | -               | Giant's Peaks (2-digit : 1-digit)                          |
| `grouping.bags`          | :    | total : each            | bags 1-10, each 2-5                 | girls, fruit    | Sunny Meadow, Whispering Woods                             |
| `grouping.teams`         | :    | total : size            | size 3-4, teams 2-10                | -               | Whispering Woods (÷3, ÷4)                                  |
| `grouping.eggs`          | :    | total : each            | each 6, boxes 1-10                  | -               | Fire Mountain (÷6)                                         |
| `grouping.holiday`       | :    | days : week             | week 7, weeks 1-10                  | names           | Fire Mountain (÷7)                                         |
| `grouping.spiders`       | :    | legs : each             | each 8, spiders 1-10                | names           | Crystal Caves (÷8)                                         |
| `grouping.chests`        | :    | total : each            | each 9, chests 1-10                 | -               | Crystal Caves (÷9)                                         |
| `grouping.market`        | :    | total : each            | each 2-10, bags 1-10                | boys, treats    | Sharing Lake (all tables)                                  |
| `grouping.giant`         | :    | total : size            | size 3-6, groups 10-16              | -               | Giant's Peaks (2-digit : 1-digit)                          |
| `times-as-many.fruit`    | ·    | small · times           | small 1-10, times 2-4               | names, fruit    | Whispering Woods, Sharing Lake 4-5                         |
| `times-as-many.sparks`   | ·    | small · times           | small 2-10, times 6-7               | -               | Fire Mountain                                              |
| `times-as-many.treasure` | ·    | small · times           | small 1-10, times 8-9               | names, treasure | Crystal Caves                                              |
| `times-as-many.pond`     | ·    | small · times           | small 1-10, times 2-10              | names, pond     | Sharing Lake                                               |
| `times-as-many.savings`  | ·    | small · times           | small 11-30, times 2-5              | names           | Giant's Peaks                                              |
| `times-fewer.fruit`      | :    | total : times           | small 1-10, times 2-5               | names, fruit    | Fire Mountain, Sharing Lake 4-5                            |
| `times-fewer.scales`     | :    | total : times           | small 1-10, times 6-7               | -               | Fire Mountain                                              |
| `times-fewer.treasure`   | :    | total : times           | small 1-10, times 8-9               | names, treasure | Crystal Caves                                              |
| `times-fewer.pond`       | :    | total : times           | small 1-10, times 2-10              | names           | Sharing Lake                                               |
| `more-than.flowers`      | +    | picked + more           | picked 2-20, more 2-10              | names           | Sunny Meadow                                               |
| `more-than.fruit`        | +    | small + more            | small 1-10, more 2-10               | names, fruit    | Sunny Meadow, Sharing Lake 5 (twin of times-as-many.fruit) |
| `more-than.inverse`      | −    | total − more            | small 1-10, more 2-10               | names, fruit    | Sharing Lake 5 (twin of times-fewer.fruit)                 |
| `more-than.plums`        | +    | eaten + more            | eaten 6-20, more 2-9                | -               | Fire Mountain, Sharing Lake                                |
| `fewer-than.fruit`       | −    | total − fewer           | total 6-20, fewer 2-5               | names, fruit    | Sharing Lake 5                                             |
| `fewer-than.inverse`     | +    | small + fewer           | small 1-10, fewer 2-10              | names, fruit    | Sharing Lake 5                                             |
| `fewer-than.class`       | −    | count − fewer           | count 10-16, fewer 2-5              | -               | Sharing Lake 5                                             |
| `leftover.bags`          | :    | total : size (r)        | size 3-5, full 1-9, left 1-2        | girls, fruit    | Leftover Lagoon (÷3-÷5)                                    |
| `leftover.boats`         | :    | total : size (r)        | size 5-9, full 1-9, left 1-4        | -               | Leftover Lagoon (÷5-÷9)                                    |
| `leftover.necklaces`     | :    | total : size (r)        | size 6-9, full 1-9, left 1-5        | -               | Leftover Lagoon (÷6-÷9)                                    |
| `leftover.plates`        | :    | total : size (r)        | size 2-4, full 2-9, left 1          | boys, treats    | Leftover Lagoon (÷2-÷4)                                    |
| `leftover.album`         | :    | total : size (r)        | size 6-10, full 1-9, left 1-5       | names           | Leftover Lagoon (÷6-÷10)                                   |
| `two-step.bags`          | -    | bags · each − eaten     | bags 2-5, each 3-10, eaten 1-5      | names, fruit    | Giant's Peaks, Riddle Ruins                                |
| `two-step.tickets`       | -    | paid − price · count    | price 5-20, count 2-5, paid 100     | names           | Riddle Ruins                                               |
| `two-step.chairs`        | -    | rows · each − kids      | rows 3-9, each 5-10, kids 10-40     | -               | Riddle Ruins                                               |
| `two-step.bowls`         | -    | (plums + pears) : bowls | plums 5-20, pears 5-20, bowls 2-5   | girls           | Riddle Ruins                                               |
| `two-step.pocket`        | -    | start − count · price   | start 30-100, count 2-5, price 3-10 | names, school   | Riddle Ruins                                               |
| `two-step.stickers`      | -    | packs · each − given    | packs 2-6, each 5-10, given 2-9     | names           | Giant's Peaks, Riddle Ruins                                |
| `two-step.garden`        | -    | rows · each + more      | rows 2-9, each 3-10, more 2-9       | names           | Giant's Peaks, Riddle Ruins                                |

## 6. Tests

`test/unit/learning/` holds the generator, distractor and word-content tests:

- **`generators.test.ts`** has six kinds of test:
  - Exhaustive surveys of the small-table facts.
  - Coverage checks that the draws reach every remainder pair, every ×10/×100 factor, every
    tens × digit pair, every 2-digit × 1-digit pair and every 2-digit : 1-digit division of the core
    parameters.
  - Property surveys over 60 random parameter sets per generator inside the curriculum bounds,
    every content skill and every word template.
  - Reading checks for order of operations: every tree equals the school reading of its own text
    in Czech and international notation (chains built from the left), with direct cases of the
    reading rule (the tree `60 + (6 + 45 : 5)` prints as `60 + 6 + 45 : 5`, which is not read so).
  - Determinism, and literal golden digests of 30 problems with their choices per generator.
  - Mutation checks: each rule of the oracle, fed a broken problem, names the rule it breaks.
- **`distractors.test.ts`**:
  - Option rules for 2, 3, 4 and 6 options across every generator.
  - The signature mistakes, case by case.
  - Seeded order: the answer lands in every position.
  - Mutation checks of the option rules.
- **`words.test.ts`**:
  - Plurals agree with their numbers, pronouns with their names, and sentences keep to the length.
  - The editorial ruling and the additive twins.
  - The validator's word count.

`oracle.ts` holds the independent oracles: plain arithmetic, a separate reader of the rendered
text in both notations (`2 + 3 · 4` is read back with precedence, `60 + 6 + 9` from the left, into
a tree that must equal the generated one, not just its value), and `violations()`, which restates
each generator's rules from the curriculum and names every rule a problem breaks. The tests never
use `expectedAnswer` as the oracle for the answer's value.

To add a template, add it to `wordTemplates` with its `word.*` text and run `npm run verify`. The
word tests check every template in the pack, and the generator golden for `word` moves (re-pin it
and say why). A new generator is a contract change (contract.md §6).
