# Curriculum: the Czech 3rd-grade multiplicative strand

Dragon Valley covers the whole multiplicative program of the 3rd grade of Czech primary school
(_3. ročník ZŠ_), in English. This document lists every learning objective with a **stable objective
ID**, the levels and boss that teach it, the bounds the generators must respect, the notation
conventions, and an English-Czech glossary for parents. §7 extends it down to the 1st and 2nd grade.

The objective IDs are data: `content/dragon-valley.content.json` declares them under `objectives`,
levels list the objectives they teach, and `scripts/validate-content.mjs --strict-coverage` (part of
`npm run verify`) fails on any objective without a lesson or without a boss level. A test keeps this
document's ID table and the content pack's objectives in step.

## 1. Sources and scope

- **RVP ZV** (Rámcový vzdělávací program pro základní vzdělávání), _Matematika a její aplikace_,
  1st period (grades 1-3), expected outcomes:
  - **M-3-1-02** reads, writes and compares natural numbers up to 1000; uses relations of equality
    and inequality;
  - **M-3-1-04** performs simple calculations with natural numbers mentally;
  - **M-3-1-05** solves and creates problems applying the operations learned;
  - **M-3-2-03** completes tables, schemes and number sequences.
- **Typical 3rd-grade school programs** (Hejný, Fraus, Prodos and similar textbooks): the 6-9 tables
  are new in 3rd grade; 2, 3, 4, 5 and 10 are 2nd-grade review; division with remainder and
  multiplication beyond the small tables are introduced; order of operations and brackets are used.
- **Out of scope** (4th grade): written multiplication algorithms, division with a 2-digit quotient
  _and_ a remainder (`75 : 4 = 18 r 3`, at most an optional bonus level, never core), numbers beyond
  1000, fractions.

## 2. Objectives

| ID                             | Objective (English)                                                    | Czech program wording                                                 | RVP ZV             |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------ |
| `obj.num.count-10`             | Count objects to 10; read and write numbers 0-10 (grade 1)             | počítání předmětů do 10, čtení a psaní čísel                          | M-3-1-01, M-3-1-02 |
| `obj.num.compare-10`           | Compare and order numbers 0-10 (`<`, `>`, `=`), number line (grade 1)  | porovnávání čísel do 10, číselná osa                                  | M-3-1-02, M-3-1-03 |
| `obj.add.within-10`            | Addition within 10 (grade 1)                                           | sčítání v oboru do 10                                                 | M-3-1-04           |
| `obj.sub.within-10`            | Subtraction within 10 (grade 1)                                        | odčítání v oboru do 10                                                | M-3-1-04           |
| `obj.word.add-sub`             | Word problems: adding to, taking away, "N more / N fewer" (grade 1, 2) | slovní úlohy na sčítání a odčítání, o N více / o N méně               | M-3-1-05           |
| `obj.mul.meaning`              | Multiplication as equal groups, repeated addition and arrays           | násobení jako opakované sčítání, skupiny, pole                        | M-3-1-04, M-3-1-05 |
| `obj.mul.commutative`          | Swapping the factors gives the same product (`3 · 4 = 4 · 3`)          | záměna činitelů                                                       | M-3-1-04           |
| `obj.mul.rules-0-1`            | Multiplying by 1 and by 0                                              | násobení jedničkou a nulou                                            | M-3-1-04           |
| `obj.mul.table-2-5-10`         | Times tables of 2, 5 and 10 (review)                                   | malá násobilka 2, 5, 10                                               | M-3-1-04           |
| `obj.mul.table-3-4`            | Times tables of 3 and 4                                                | malá násobilka 3, 4                                                   | M-3-1-04           |
| `obj.mul.table-6-7`            | Times tables of 6 and 7                                                | malá násobilka 6, 7                                                   | M-3-1-04           |
| `obj.mul.table-8-9`            | Times tables of 8 and 9                                                | malá násobilka 8, 9                                                   | M-3-1-04           |
| `obj.mul.fluency`              | Quick recall of every small-table product                              | automatizace spojů malé násobilky                                     | M-3-1-04           |
| `obj.div.meaning`              | Division as sharing and as grouping                                    | dělení na stejné části a po částech                                   | M-3-1-04, M-3-1-05 |
| `obj.div.tables`               | Division within the small tables                                       | dělení v oboru malé násobilky                                         | M-3-1-04           |
| `obj.div.fact-families`        | Multiplication and division as one fact family                         | vztah mezi násobením a dělením                                        | M-3-1-04, M-3-2-03 |
| `obj.div.missing-factor`       | Finding a missing factor (`? · 6 = 42`)                                | neznámý činitel                                                       | M-3-1-04           |
| `obj.rem.divide`               | Division with remainder (`23 : 5 = 4 r 3`, remainder < divisor)        | dělení se zbytkem                                                     | M-3-1-04           |
| `obj.rem.word`                 | Word problems with leftovers                                           | slovní úlohy na dělení se zbytkem                                     | M-3-1-05           |
| `obj.big.mul-10-100`           | Multiplying by 10 and 100 (`34 · 10`, `7 · 100`)                       | násobení 10 a 100                                                     | M-3-1-04           |
| `obj.big.tens`                 | Tens times a one-digit number (`30 · 3`, `40 · 6`)                     | násobení desítek jednociferným číslem                                 | M-3-1-04           |
| `obj.big.mul-2d1d`             | 2-digit × 1-digit by decomposition (`14 · 3 = 10 · 3 + 4 · 3`)         | násobení dvojciferného čísla jednociferným (mimo obor malé násobilky) | M-3-1-04           |
| `obj.big.div-2d1d`             | 2-digit : 1-digit without remainder (`48 : 4`, `69 : 3`, `96 : 8`)     | dělení dvojciferného čísla jednociferným (mimo obor malé násobilky)   | M-3-1-04           |
| `obj.order.precedence`         | Multiplication and division before addition and subtraction            | přednost násobení a dělení                                            | M-3-1-04           |
| `obj.order.brackets`           | Brackets first                                                         | počítání se závorkami                                                 | M-3-1-04           |
| `obj.compare.expressions`      | Comparing products and expressions with `<`, `>`, `=`                  | porovnávání čísel a výrazů                                            | M-3-1-02           |
| `obj.word.equal-groups`        | Word problems with equal groups and fair sharing                       | slovní úlohy na násobení a dělení                                     | M-3-1-05           |
| `obj.word.times-more-fewer`    | "N times as many", asked in both directions                            | x-krát více, x-krát méně                                              | M-3-1-05           |
| `obj.word.more-fewer-contrast` | Telling "N more / N fewer" apart from "N times as many"                | o N více/méně versus N-krát více/méně                                 | M-3-1-05           |
| `obj.word.two-step`            | Simple two-step word problems                                          | složené slovní úlohy                                                  | M-3-1-05           |
| `obj.terms.mul`                | Terms: factor, product                                                 | činitel, součin                                                       | M-3-1-04           |
| `obj.terms.div`                | Terms: dividend, divisor, quotient, remainder                          | dělenec, dělitel, podíl, zbytek                                       | M-3-1-04           |

## 3. Objectives by level and boss

Level IDs follow [design.md §3](design.md#3-world-and-levels). Every objective has at least one
lesson and at least one boss level; the Seven-Headed Dragon (`dragon-castle.boss`) reviews all of
the 3rd-grade objectives, and the Will-o'-the-Wisps (`pebble-brook.boss`) the 1st-grade ones of
Pebble Brook.

| Objective                      | Lessons                                                                                                          | Boss levels                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `obj.num.count-10`             | `pebble-brook.1`, `pebble-brook.2`, `pebble-brook.3`                                                             | `pebble-brook.boss`                      |
| `obj.num.compare-10`           | `pebble-brook.3`, `pebble-brook.5`                                                                               | `pebble-brook.boss`                      |
| `obj.add.within-10`            | `pebble-brook.1`, `pebble-brook.4`, `pebble-brook.5`                                                             | `pebble-brook.boss`                      |
| `obj.sub.within-10`            | `pebble-brook.1`, `pebble-brook.5`                                                                               | `pebble-brook.boss`                      |
| `obj.word.add-sub`             | `pebble-brook.6`                                                                                                 | `pebble-brook.boss`                      |
| `obj.mul.meaning`              | `sunny-meadow.1`, `whispering-woods.1`                                                                           | `sunny-meadow.boss`                      |
| `obj.mul.commutative`          | `sunny-meadow.2`, `sunny-meadow.4`, `whispering-woods.2`                                                         | `sunny-meadow.boss`                      |
| `obj.mul.rules-0-1`            | `sunny-meadow.3`, `sunny-meadow.5`                                                                               | `sunny-meadow.boss`                      |
| `obj.mul.table-2-5-10`         | `sunny-meadow.1`, `sunny-meadow.2`, `sunny-meadow.3`, `sunny-meadow.5`                                           | `sunny-meadow.boss`                      |
| `obj.mul.table-3-4`            | `whispering-woods.1`, `whispering-woods.2`, `whispering-woods.3`, `whispering-woods.5`                           | `whispering-woods.boss`                  |
| `obj.mul.table-6-7`            | `fire-mountain.1`, `fire-mountain.2`, `fire-mountain.3`, `fire-mountain.5`                                       | `fire-mountain.boss`                     |
| `obj.mul.table-8-9`            | `crystal-caves.1`, `crystal-caves.2`, `crystal-caves.3`, `crystal-caves.5`                                       | `crystal-caves.boss`                     |
| `obj.mul.fluency`              | `crystal-caves.5`, `dragon-castle.1`, `dragon-castle.2`                                                          | `dragon-castle.boss`                     |
| `obj.div.meaning`              | `sunny-meadow.4`, `sharing-lake.1`                                                                               | `sunny-meadow.boss`, `sharing-lake.boss` |
| `obj.div.tables`               | `sunny-meadow.5`, `whispering-woods.4`, `fire-mountain.4`, `crystal-caves.4`, `sharing-lake.1`, `sharing-lake.6` | `sharing-lake.boss`                      |
| `obj.div.fact-families`        | `sunny-meadow.4`, `whispering-woods.4`, `fire-mountain.4`, `sharing-lake.3`                                      | `sunny-meadow.boss`, `sharing-lake.boss` |
| `obj.div.missing-factor`       | `fire-mountain.4`, `sharing-lake.2`                                                                              | `sharing-lake.boss`                      |
| `obj.rem.divide`               | `leftover-lagoon.1`, `leftover-lagoon.2`, `leftover-lagoon.3`, `leftover-lagoon.5`                               | `leftover-lagoon.boss`                   |
| `obj.rem.word`                 | `leftover-lagoon.4`                                                                                              | `leftover-lagoon.boss`                   |
| `obj.big.mul-10-100`           | `giants-peaks.1`                                                                                                 | `giants-peaks.boss`                      |
| `obj.big.tens`                 | `giants-peaks.2`                                                                                                 | `giants-peaks.boss`                      |
| `obj.big.mul-2d1d`             | `giants-peaks.3`, `giants-peaks.4`                                                                               | `giants-peaks.boss`                      |
| `obj.big.div-2d1d`             | `giants-peaks.5`                                                                                                 | `giants-peaks.boss`                      |
| `obj.order.precedence`         | `riddle-ruins.1`                                                                                                 | `riddle-ruins.boss`                      |
| `obj.order.brackets`           | `riddle-ruins.2`                                                                                                 | `riddle-ruins.boss`                      |
| `obj.compare.expressions`      | `whispering-woods.5`, `crystal-caves.5`, `sharing-lake.5`, `riddle-ruins.3`                                      | `riddle-ruins.boss`                      |
| `obj.word.equal-groups`        | `sunny-meadow.6`, `whispering-woods.6`, `crystal-caves.6`                                                        | `sunny-meadow.boss`                      |
| `obj.word.times-more-fewer`    | `fire-mountain.6`, `sharing-lake.4`                                                                              | `sharing-lake.boss`                      |
| `obj.word.more-fewer-contrast` | `sunny-meadow.6`, `sharing-lake.5`                                                                               | `sharing-lake.boss`                      |
| `obj.word.two-step`            | `giants-peaks.6`, `riddle-ruins.5`                                                                               | `riddle-ruins.boss`                      |
| `obj.terms.mul`                | `riddle-ruins.4`                                                                                                 | `riddle-ruins.boss`                      |
| `obj.terms.div`                | `riddle-ruins.4`                                                                                                 | `riddle-ruins.boss`                      |

## 4. Generator bounds

Skill parameters (see `src/rules/contract/skills.ts`) must keep generated problems inside these
bounds for core levels. Bonus levels outside them must be marked as such in their title.

| Skill family               | Generator       | Core bounds                                                                                                                                                     |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small-table multiplication | `mul.fact`      | factors 0-10; both orders (`order: 'both'`) once the table is introduced                                                                                        |
| Small-table division       | `div.fact`      | divisor 1-10, quotient 0-10 (dividend = divisor × quotient)                                                                                                     |
| Missing factor             | `mul.missing`   | known factor 1-10 (never 0, so the answer is unique), missing factor 0-10                                                                                       |
| Division with remainder    | `div.remainder` | divisor 2-10, dividend ≤ 99, quotient 0-9 (occasionally 10), `remainder: 'required'` or `'allowed'`; remainder < divisor always                                 |
| × 10, × 100                | `mul.power10`   | `powers: [10]` or `[10, 100]`, result ≤ 1000                                                                                                                    |
| Tens × 1-digit             | `mul.tens`      | tens 10-90, digit 2-9, result ≤ 1000                                                                                                                            |
| 2-digit × 1-digit          | `mul.2d1d`      | 10-99 × 2-9, result ≤ 1000; `carry: 'forbidden'` first (`23 · 3`), then `'required'` (`14 · 3`, `25 · 4`)                                                       |
| 2-digit : 1-digit          | `div.2d1d`      | divisor 2-9, dividend 10-99, quotient ≥ 10, `remainder: 'forbidden'`; `regroup: 'forbidden'` first (`48 : 4`, `69 : 3`), then `'required'` (`48 : 3`, `96 : 8`) |
| Order of operations        | `order.ops`     | 2-3 operations, operands 0-100, every intermediate and final result a non-negative integer ≤ 1000, exact division only                                          |
| Comparison                 | `compare`       | sides from the small tables, `equalShare` about 20 %                                                                                                            |
| Word problems              | `word`          | templates by family; numbers inside the region's skills; additive and multiplicative contrast templates side by side                                            |
| Terms                      | `terms`         | sentences from the small tables (and remainder sentences for `remainder`)                                                                                       |

The contract's reference answer (`expectedAnswer`) rejects any problem whose answer is not a unique
non-negative integer (for example `? · 0 = 0`), and generators must only emit problems it accepts.

## 5. Notation conventions

Problems are structured data; the shell renders them in the notation the parent chose
(`src/rules/contract/notation.ts` is the reference rendering).

| Meaning                 | Czech school notation (default) | International notation |
| ----------------------- | ------------------------------- | ---------------------- |
| multiplication          | `3 · 4 = 12`                    | `3 × 4 = 12`           |
| division                | `12 : 3 = 4`                    | `12 ÷ 3 = 4`           |
| division with remainder | `23 : 5 = 4 r 3`                | `23 ÷ 5 = 4 R 3`       |
| subtraction             | `8 − 3`                         | `8 − 3`                |
| brackets                | `(2 + 3) · 4`                   | `(2 + 3) × 4`          |
| comparison              | `<` `>` `=`                     | `<` `>` `=`            |
| the unknown             | an empty box (text: `?`)        | an empty box (`?`)     |

- The multiplication dot is the middle dot `·` (U+00B7) with a space on each side; the division sign
  is a colon with spaces. The minus sign is U+2212.
- Brackets appear only where the expression tree needs them for the conventional reading, or where
  the author grouped on purpose (for example `(2 · 3) + 4` while teaching brackets).
- Read-aloud always speaks English: "three times four", "twelve divided by three", "twenty-three
  divided by five is four remainder three", "is less than", "is greater than", "equals".

## 6. Glossary (English - Czech)

Shown in the parent area and used in the terminology levels. The UI uses the English terms.

| English                  | Czech                   | Example                                                |
| ------------------------ | ----------------------- | ------------------------------------------------------ |
| multiplication, times    | násobení, krát          | `3 · 4` "three times four"                             |
| factor                   | činitel                 | 3 and 4 in `3 · 4 = 12`                                |
| product                  | součin                  | 12 in `3 · 4 = 12`                                     |
| division, divided by     | dělení, děleno          | `12 : 3` "twelve divided by three"                     |
| dividend                 | dělenec                 | 12 in `12 : 3 = 4`                                     |
| divisor                  | dělitel                 | 3 in `12 : 3 = 4`                                      |
| quotient                 | podíl                   | 4 in `12 : 3 = 4`                                      |
| remainder                | zbytek                  | 3 in `23 : 5 = 4 r 3`                                  |
| times table              | násobilka               | the 7 times table                                      |
| fact family              | (rodina příkladů)       | `6 · 7 = 42`, `7 · 6 = 42`, `42 : 6 = 7`, `42 : 7 = 6` |
| equal groups             | stejné skupiny          | 4 nests with 3 eggs each                               |
| sharing (equal parts)    | dělení na stejné části  | 12 berries into 3 baskets                              |
| grouping (equal amounts) | dělení po částech       | 12 berries, 3 in each basket                           |
| N times as many          | N-krát více             | Eva has 4. Tom has 3 times as many: 12                 |
| N times as many as       | N-krát méně             | Tom has 12. Tom has 3 times as many as Eva: 4          |
| N more / N fewer         | o N více / o N méně     | Eva has 4, Tom has 3 more: 7                           |
| brackets                 | závorky                 | `(2 + 3) · 4`                                          |
| order of operations      | pořadí početních výkonů | `2 + 3 · 4 = 14`                                       |
| greater than / less than | větší než / menší než   | `7 · 8 > 50`                                           |
| word problem             | slovní úloha            |                                                        |

**Editorial ruling.** Child-facing English never says "N times fewer": it is how Czech _N-krát méně_
is often translated for children, but it is awkward English. Both directions use "times as many":
"Eva has 4 apples. Tom has 3 times as many. How many does Tom have?" (_N-krát více_) and "Tom has 12
apples. Tom has 3 times as many as Eva. How many apples does Eva have?" (_N-krát méně_), side by side
with the additive "3 more" and "3 fewer" (_o N více / o N méně_). This glossary maps the English to
the Czech terms for parents. The word families keep their IDs (`times-as-many`, `times-fewer`); see
[learning.md](learning.md) for the templates.

## 7. Grades 1 and 2

Dragon Valley is being extended down to the 1st and 2nd grade (docs/grades-plan.md): new regions
before Sunny Meadow for counting, numbers to 20 and to 100, and addition and subtraction. This
section is the curriculum for that work. An objective moves into the tables of §2 and §3, which a
test keeps in step with the pack, once a region of the content teaches it. Content 1.4.0 adds
**Pebble Brook** (grade 1) and with it `obj.num.count-10`, `obj.num.compare-10`,
`obj.add.within-10`, `obj.sub.within-10` and `obj.word.add-sub`; the rest are listed here until
their regions exist.

### 7.1 Sources

**RVP ZV**, _Matematika a její aplikace_, 1st period: **M-3-1-01** uses natural numbers to model
real situations, counts objects in a given set and forms sets of a given number of elements;
**M-3-1-02** reads, writes and compares natural numbers; **M-3-1-03** uses the number line;
**M-3-1-04** performs simple calculations mentally; **M-3-1-05** solves and creates word problems.
Mapped to typical 1st- and 2nd-grade textbooks (Hejný, Fraus, Prodos):

- **1st grade** (_1. ročník_): counting and numbers 0-20, comparing, addition and subtraction within
  10, then within 20 (first without, then with crossing ten), simple word problems.
- **2nd grade** (_2. ročník_): numbers to 100, place value, addition and subtraction within 100,
  simple two-step word problems, and the meaning of multiplication with the tables of 2-5 and 10.
  The multiplication part is already taught by **Sunny Meadow** and **Whispering Woods** on their
  existing objectives (`obj.mul.meaning`, `obj.mul.commutative`, `obj.mul.rules-0-1`,
  `obj.mul.table-2-5-10`, `obj.mul.table-3-4`): those regions serve the 2nd and the 3rd grade, so a
  2nd grader flows from the new regions straight into them.

### 7.2 Objectives

| ID                       | Grade | Objective (English)                                                     | Czech program wording                                  | RVP ZV             |
| ------------------------ | ----- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| `obj.add.bonds-10`       | 1     | Number bonds of 10 and missing addends (`7 + ? = 10`)                   | rozklad čísla 10, doplňování do 10                     | M-3-1-04           |
| `obj.num.to-20`          | 1     | Numbers 11-20: tens and ones, compare, number line                      | čísla do 20, desítky a jednotky, číselná osa           | M-3-1-02, M-3-1-03 |
| `obj.addsub.20-no-cross` | 1     | +/− within 20 without crossing ten (`13 + 4`, `17 − 3`)                 | sčítání a odčítání do 20 bez přechodu přes desítku     | M-3-1-04           |
| `obj.addsub.20-cross`    | 1     | +/− within 20 crossing ten (`8 + 5`, `13 − 6`)                          | sčítání a odčítání do 20 s přechodem přes desítku      | M-3-1-04           |
| `obj.num.to-100`         | 2     | Numbers to 100: tens and ones, place value, compare, order, number line | čísla do 100, desítky a jednotky, porovnávání          | M-3-1-02, M-3-1-03 |
| `obj.addsub.tens`        | 2     | Whole tens ± whole tens (`40 + 30`, `90 − 50`)                          | sčítání a odčítání celých desítek                      | M-3-1-04           |
| `obj.addsub.2d1d`        | 2     | 2-digit ± 1-digit, without and with crossing ten (`34 + 5`, `34 + 8`)   | dvojciferné ± jednociferné, bez přechodu i s přechodem | M-3-1-04           |
| `obj.addsub.2d2d`        | 2     | 2-digit ± 2-digit, without and with crossing ten (`34 + 25`, `52 − 27`) | dvojciferné ± dvojciferné, bez přechodu i s přechodem  | M-3-1-04           |
| `obj.word.two-step-add`  | 2     | Simple two-step additive word problems                                  | jednoduché složené slovní úlohy (sčítání, odčítání)    | M-3-1-05           |

Strands: `numbers` (`obj.num.*`), `addition-subtraction` (`obj.add.*`, `obj.sub.*`,
`obj.addsub.*`) and `word` (`obj.word.*`). The planned regions teach them in this order (the exact
level mapping joins §3 with the content): **Pebble Brook** (grade 1) counting, comparing, addition
within 10, subtraction within 5 and the first adding-to and taking-from stories (in the pack, §3); **Mushroom Hollow** (1) subtraction within 10, bonds of 10, missing addends and
the first stories; **Rainbow Ford** (1) numbers to 20 and +/− within 20 without, then with crossing
ten; **Hundred Hills** (2) numbers to 100, place value, tens ± tens and 2-digit ± 1-digit; **Market
Square** (2) 2-digit ± 1-digit and ± 2-digit with crossing and two-step stories.

### 7.3 Generator bounds

| Skill family           | Generator     | Core bounds                                                                                                                                                                                                                                        |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counting               | `num.count`   | 0-20 objects (dots in two ten-frames), read the number; buckets `count:0-5`, `count:6-10`, `count:11-20`                                                                                                                                           |
| Comparing numbers      | `num.compare` | two numbers 0-20 (grade 1) or 0-100 (grade 2), `equalShare` about 20 %; buckets `ncompare:0-10`, `ncompare:0-20`, `ncompare:0-100`; Compare Stones' `number-number` sides                                                                          |
| Place value            | `num.place`   | 2-digit numbers 10-99: the tens digit, the ones digit, or the number (`4 tens 7 ones = ?`); buckets `place:tens`, `place:ones`, `place:compose`                                                                                                    |
| Addition facts         | `add.fact`    | addends 0-10 (`add:A+B`, the 121-fact table to 10 + 10); `sumMax` 10 for "within 10", then 20; `crossing: 'forbidden'` first (`7 + 3`, `4 + 5`), then `'required'` (`8 + 5`); `13 + 4` and `17 − 3` are `addsub.2d` work with `twoDigit: [10, 19]` |
| Subtraction facts      | `sub.fact`    | subtrahend 0-10 and difference 0-10 (`sub:M-S`, 121 facts), minuend ≤ 20; `crossing: 'forbidden'` first, then `'required'` (`13 − 6`)                                                                                                              |
| Missing addend         | `add.missing` | known addend 0-10, missing addend 0-10, sum ≤ 20 (`7 + ? = 10`, `? + 4 = 9`); never ambiguous; practises the matching `sub:` fact                                                                                                                  |
| 2-digit + and −        | `addsub.2d`   | shapes `tens` (`40 + 30`), `2d1d` (`34 + 5`), `2d2d` (`34 + 25`); every number 0-100, differences never negative; `crossing: 'forbidden'` first, then `'required'`; buckets `add2d:<shape>-carry/nocarry`, `sub2d:<shape>-borrow/noborrow`         |
| Additive word problems | `word`        | families `add-to`, `take-from`, `more-than`, `fewer-than`, `two-step`; numbers inside the region's skills; additive models only for grades 1-2, so Riddle Scrolls offers only + and −                                                              |

Crossing ten means the ones carry or borrow: `8 + 5` and `13 − 6` cross, `13 + 4` and `17 − 3` do
not. Within 20 a sum crosses when both addends are below 10 and the sum is above 10. Each `add:`
fact shares partial credit with its commuted twin (`add:3+5` ↔ `add:5+3`). Distractors use additive
error patterns: off by one (a counting slip), the other operation, a forgotten carry or borrow
(`34 + 8 = 32`), digit-wise subtraction (`52 − 27 = 35`) and reversed digits.

### 7.4 Notation and glossary

The notation of §5 applies: `+` and the minus sign `−` (U+2212) with a space on each side, the
unknown as an empty box. Read-aloud says "plus", "minus" ("eight plus five is thirteen"), and reads
place value as "four tens and seven ones".

| English                         | Czech                      | Example                       |
| ------------------------------- | -------------------------- | ----------------------------- |
| addition, plus                  | sčítání, plus              | `8 + 5` "eight plus five"     |
| addend                          | sčítanec                   | 8 and 5 in `8 + 5 = 13`       |
| sum                             | součet                     | 13 in `8 + 5 = 13`            |
| subtraction, minus              | odčítání, mínus            | `13 − 6` "thirteen minus six" |
| minuend, subtrahend, difference | menšenec, menšitel, rozdíl | 13, 6 and 7 in `13 − 6 = 7`   |
| crossing ten                    | přechod přes desítku       | `8 + 5`, `13 − 6`             |
| tens, ones                      | desítky, jednotky          | 4 tens 7 ones = 47            |
| number line                     | číselná osa                |                               |
| number bonds of 10              | rozklad čísla 10           | `7 + 3 = 10`                  |
