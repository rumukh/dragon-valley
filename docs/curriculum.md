# Curriculum: the Czech 3rd-grade multiplicative strand

Dragon Valley covers the whole multiplicative program of the 3rd grade of Czech primary school
(_3. ročník ZŠ_), in English. This document lists every learning objective with a **stable objective
ID**, the levels and boss that teach it, the bounds the generators must respect, the notation
conventions, and an English-Czech glossary for parents.

The objective IDs are data: `content/dragon-valley.content.json` declares them under `objectives`,
levels list the objectives they teach, and `scripts/validate-content.mjs` reports any objective
without a lesson or without a boss level (a gate once the v1 content is complete). A test keeps this
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

| ID                             | Objective (English)                                                | Czech program wording                                                 | RVP ZV             |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------ |
| `obj.mul.meaning`              | Multiplication as equal groups, repeated addition and arrays       | násobení jako opakované sčítání, skupiny, pole                        | M-3-1-04, M-3-1-05 |
| `obj.mul.commutative`          | Swapping the factors gives the same product (`3 · 4 = 4 · 3`)      | záměna činitelů                                                       | M-3-1-04           |
| `obj.mul.rules-0-1`            | Multiplying by 1 and by 0                                          | násobení jedničkou a nulou                                            | M-3-1-04           |
| `obj.mul.table-2-5-10`         | Times tables of 2, 5 and 10 (review)                               | malá násobilka 2, 5, 10                                               | M-3-1-04           |
| `obj.mul.table-3-4`            | Times tables of 3 and 4                                            | malá násobilka 3, 4                                                   | M-3-1-04           |
| `obj.mul.table-6-7`            | Times tables of 6 and 7                                            | malá násobilka 6, 7                                                   | M-3-1-04           |
| `obj.mul.table-8-9`            | Times tables of 8 and 9                                            | malá násobilka 8, 9                                                   | M-3-1-04           |
| `obj.mul.fluency`              | Quick recall of every small-table product                          | automatizace spojů malé násobilky                                     | M-3-1-04           |
| `obj.div.meaning`              | Division as sharing and as grouping                                | dělení na stejné části a po částech                                   | M-3-1-04, M-3-1-05 |
| `obj.div.tables`               | Division within the small tables                                   | dělení v oboru malé násobilky                                         | M-3-1-04           |
| `obj.div.fact-families`        | Multiplication and division as one fact family                     | vztah mezi násobením a dělením                                        | M-3-1-04, M-3-2-03 |
| `obj.div.missing-factor`       | Finding a missing factor (`? · 6 = 42`)                            | neznámý činitel                                                       | M-3-1-04           |
| `obj.rem.divide`               | Division with remainder (`23 : 5 = 4 r 3`, remainder < divisor)    | dělení se zbytkem                                                     | M-3-1-04           |
| `obj.rem.word`                 | Word problems with leftovers                                       | slovní úlohy na dělení se zbytkem                                     | M-3-1-05           |
| `obj.big.mul-10-100`           | Multiplying by 10 and 100 (`34 · 10`, `7 · 100`)                   | násobení 10 a 100                                                     | M-3-1-04           |
| `obj.big.tens`                 | Tens times a one-digit number (`30 · 3`, `40 · 6`)                 | násobení desítek jednociferným číslem                                 | M-3-1-04           |
| `obj.big.mul-2d1d`             | 2-digit × 1-digit by decomposition (`14 · 3 = 10 · 3 + 4 · 3`)     | násobení dvojciferného čísla jednociferným (mimo obor malé násobilky) | M-3-1-04           |
| `obj.big.div-2d1d`             | 2-digit : 1-digit without remainder (`48 : 4`, `69 : 3`, `96 : 8`) | dělení dvojciferného čísla jednociferným (mimo obor malé násobilky)   | M-3-1-04           |
| `obj.order.precedence`         | Multiplication and division before addition and subtraction        | přednost násobení a dělení                                            | M-3-1-04           |
| `obj.order.brackets`           | Brackets first                                                     | počítání se závorkami                                                 | M-3-1-04           |
| `obj.compare.expressions`      | Comparing products and expressions with `<`, `>`, `=`              | porovnávání čísel a výrazů                                            | M-3-1-02           |
| `obj.word.equal-groups`        | Word problems with equal groups and fair sharing                   | slovní úlohy na násobení a dělení                                     | M-3-1-05           |
| `obj.word.times-more-fewer`    | "N times as many" and "N times fewer"                              | x-krát více, x-krát méně                                              | M-3-1-05           |
| `obj.word.more-fewer-contrast` | Telling "N more / N fewer" apart from "N times as many / fewer"    | o N více/méně versus N-krát více/méně                                 | M-3-1-05           |
| `obj.word.two-step`            | Simple two-step word problems                                      | složené slovní úlohy                                                  | M-3-1-05           |
| `obj.terms.mul`                | Terms: factor, product                                             | činitel, součin                                                       | M-3-1-04           |
| `obj.terms.div`                | Terms: dividend, divisor, quotient, remainder                      | dělenec, dělitel, podíl, zbytek                                       | M-3-1-04           |

## 3. Objectives by level and boss

Level IDs follow [design.md §3](design.md#3-world-and-levels). Every objective has at least one
lesson and at least one boss level; the Seven-Headed Dragon (`dragon-castle.boss`) reviews all of
them.

| Objective                      | Lessons                                                                                                          | Boss levels                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
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
| N times as many          | N-krát více             | Anna has 4, Tom has 3 times as many: 12                |
| N times fewer            | N-krát méně             | Tom has 12, Anna has 3 times fewer: 4                  |
| N more / N fewer         | o N více / o N méně     | Anna has 4, Tom has 3 more: 7                          |
| brackets                 | závorky                 | `(2 + 3) · 4`                                          |
| order of operations      | pořadí početních výkonů | `2 + 3 · 4 = 14`                                       |
| greater than / less than | větší než / menší než   | `7 · 8 > 50`                                           |
| word problem             | slovní úloha            |                                                        |

**Editorial note.** "N times fewer" is how Czech _N-krát méně_ is usually translated for children,
but it is awkward English ("one third as many" is the formal form). The game uses "N times as many"
and "N times fewer" with this glossary for parents; final wording needs editorial sign-off (plan §6).
