# Dragon Valley: Game Design Document

This is the full design of v1, expanding §2 of the approved [plan](plan.md). The plan's decisions
are binding; where this document adds detail it says so. Numbers marked _(balance)_ live in the
content pack's `balance` block (see [contract.md](contract.md)) and are tuned without code changes.
The curriculum mapping is in [curriculum.md](curriculum.md).

Audience: an 8-9-year-old Czech 3rd grader playing in English on a family tablet or PC, plus the
parent who sets it up.

---

## 1. Pillars

1. **Learn for real.** Adaptive spaced retrieval of every small-table fact, visual models (arrays,
   groups, sharing), named strategies, fact families, and the whole Czech 3rd-grade multiplicative
   program.
2. **Joy every few seconds.** Every answer gets a reaction: sound, motion, sparkle. Activities change
   every few minutes.
3. **Visible growth.** Eggs hatch, dragons grow and get crowned, map regions open and the Magic
   Window lights up pane by pane.
4. **Kind and safe.** No punishment, no red X, no lives, no losing, no streak shaming, no FOMO, no
   ads or purchases, no accounts, no network beyond the game's own files, short sessions, parent
   controls.

## 2. Story

**Premise.** The Seven-Headed Dragon (_sedmihlavý drak_) caught a cold and sneezed seven times. The
castle's **Magic Window** shattered into sparkly panes and the valley's dragon eggs went cold. The
player is the new **Dragon Keeper**. Practice warms the eggs and relights the panes. Old **Glimmer**,
the castle dragon, guides the way.

**Tone.** Warm, funny, never scary. Bosses are folk-tale characters you win over, not enemies.
Every line is short: at most 10 words per sentence (the `@aegis/narrative` child profile; the content
gate enforces it). Every line can be read aloud.

### 2.1 Beats

Story is delivered as short **beats** (2-4 lines, skippable unless a choice is required), each a
small narrative graph in the content pack, started by a trigger.

| Beat                | Trigger                              | Content                                                                  |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Prologue            | first session                        | The sneeze, the shattered window, the cold eggs, "you are the Keeper"    |
| First egg           | after the prologue (no skip)         | Choose the bubbly blue (×2), sunny yellow (×5) or shiny golden (×10) egg |
| Region welcome (×9) | first start of each region's level 1 | Glimmer introduces the region and its dragons                            |
| Boss intro (×9)     | first start of each boss level       | The boss's problem and how to win them over                              |
| Boss outro (×9)     | boss defeated                        | The boss laughs, sleeps or agrees; the way onward opens                  |
| Window moments      | 25 %, 50 %, 75 % of panes lit        | Glimmer reacts to the window coming back (later content)                 |
| Finale              | Seven-Headed Dragon cured            | All seven heads smile; the Magic Window is whole; credits                |

**Dragon Diary.** At the end of a session (the shell's "Goodbye" screen) a diary card summarizes the
day from the view: facts that reached bronze or better ("Today you learned 7 · 8 = 56!"), dragons
that grew, stickers earned. It is generated from data, not authored text.

### 2.2 Characters

| ID             | Character               | Role and personality                                                                   |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `glimmer`      | Old Glimmer             | The castle dragon. Kind, a bit forgetful, loves puns. Gives hints and tells the story. |
| (avatar)       | The Keeper              | The child. Chooses one of eight keeper avatars (`keeper-1`…`keeper-8`) and a name.     |
| `puff`         | Puff (×0)               | Cloud-wisp dragon: everything × 0 goes _poof_.                                         |
| `mirror`       | Mirror (×1)             | Silver dragon with a reflection: × 1 stays the same.                                   |
| `bubbles`      | Bubbles (×2)            | Two-tailed water dragon: doubles.                                                      |
| `clover`       | Clover (×3)             | Three-leaf forest dragon with three horns.                                             |
| `petal`        | Petal (×4)              | Four-winged flower dragon: double the double.                                          |
| `sunny`        | Sunny (×5)              | Five-ray sun crest and a clock-hand tail (5-minute steps).                             |
| `ember`        | Ember (×6)              | Six fire spikes: "5 groups and 1 more group".                                          |
| `rainbow`      | Rainbow (×7)            | Seven stripes like the seven colours of the rainbow: "5 groups and 2 more".            |
| `crystal`      | Crystal (×8)            | Eight-point snowflake crest: double, double, double.                                   |
| `starry`       | Starry (×9)             | Night dragon with nine stars: "10 groups minus 1 group".                               |
| `goldie`       | Goldie (×10)            | Crown with ten points: "add a zero".                                                   |
| `pearl`        | Pearl                   | Lagoon dragon who keeps leftover pearls: remainders.                                   |
| `boulder`      | Boulder                 | Mountain dragon who carries big numbers.                                               |
| `clockwork`    | Clockwork               | Brass dragon whose gears turn in order: order of operations.                           |
| `seven-headed` | The Seven-Headed Dragon | The finale. Seven heads, seven sneezes, one per curriculum strand.                     |

Bosses (folk-tale, friendly; nobody gets hurt). The mood is the boss's won pose in the art
(`BOSS_MOOD` in `src/app/art`), which the content's `bosses[].mood` matches:

| ID               | Boss                          | Region           | Mood to fill | How you win them over                                                 |
| ---------------- | ----------------------------- | ---------------- | ------------ | --------------------------------------------------------------------- |
| `bridge-troll`   | The Bridge Troll              | Sunny Meadow     | laughing     | Answers tickle him until he rolls over laughing                       |
| `forest-witch`   | The Forest Witch (_Ježibaba_) | Whispering Woods | happy        | Solve her puzzles in threes and fours; she agrees, shares gingerbread |
| `krakonos`       | Krakonoš, the Mountain Spirit | Fire Mountain    | laughing     | Warm the mountain with sixes and sevens until he laughs               |
| `gnome-king`     | The Gnome King (_permoníci_)  | Crystal Caves    | happy        | Sort his gems in eights and nines; he agrees and dances               |
| `water-goblin`   | The Water Goblin (_vodník_)   | Sharing Lake     | happy        | Fair sharing frees the fruit he keeps in teacups                      |
| `lake-nymphs`    | The Lake Nymphs               | Leftover Lagoon  | laughing     | Count their leftover pearls; they laugh and dance                     |
| `friendly-giant` | The Friendly Giant            | Giant's Peaks    | sleepy       | Big-number answers calm him until he falls asleep, smiling            |
| `golem`          | The Golem                     | Riddle Ruins     | happy        | Give him instructions in the right order                              |
| `seven-headed`   | The Seven-Headed Dragon       | Dragon Castle    | happy        | Cure each head's sneeze with a different kind of problem              |

## 3. World and levels

Nine regions, **50 lessons and 9 boss levels**, in curriculum order. Inside a table region, lessons
follow the plan's sequence: concept → guided recall (choice) → free recall (keypad) → matching
division and fact family → mixed review → word problems → boss. Each region's boss mixes its skills
with spaced review of earlier ones (`reviewShare`).

Level IDs are `<region>.<n>` and `<region>.boss`. Unlock: each lesson needs the previous one
completed; each region's level 1 needs the previous region's boss. Parents can unlock regions
ahead; the placement check can place out of levels the child already knows (they stay replayable).

New eggs (detail added in the implementation): a region's first new dragon's egg comes with the
region's welcome story at the start of level 1, and the second with level 1's completion, so each
egg is warmed by its own table and hatches in "its" level (Clover in Whispering Woods 1, Petal in 2;
Ember and Rainbow; Crystal and Starry; Pearl, Boulder and Clockwork in their regions' level 1).
Sunny Meadow 3's story likewise brings Mirror's and Puff's eggs as the level starts. A region's
eggs are also rewards of its boss level (eggs already owned stay as they are), for a child who
skipped a level.

Activity notation below: _kind (skills, count, input)_. "Auto" input means multiple choice while a
fact is new and the keypad once it has strengthened (§6.3).

### 3.1 Sunny Meadow (`sunny-meadow`): review of 2nd grade

New dragons: Bubbles, Sunny, Goldie (the first egg is one of these three; the others arrive in
level 2), Mirror and Puff (level 3: their eggs come with a short story as it starts, so its ×0 and
×1 practice warms them). Boss: the Bridge Troll. Accent: buttercup yellow.

| Level               | Title                | Focus                               | Activities                                                                                     |
| ------------------- | -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `sunny-meadow.1`    | Equal Groups         | Meaning of ×: groups, arrays, ×2    | Egg Grid (×2, ×5, ×10; 3); Feeding Time (×2, ×5, ×10; 8; choice): the first egg's table (§6.3) |
| `sunny-meadow.2`    | Twos and Fives       | ×2, ×5, swapping factors            | Feeding Time (×2, ×5; 10; choice); Memory Match (6 pairs)                                      |
| `sunny-meadow.3`    | Tens, Ones and Zeros | ×10, rules for ×1 and ×0            | Feeding Time (×0, ×1, ×10; 10; auto); Number Trail (×10)                                       |
| `sunny-meadow.4`    | Sharing Fairly       | Division by 2, 5, 10; fact families | Egg Grid (2); Fact Family Nest (2, 5, 10; 3); Feeding Time (÷ and missing factor; 10)          |
| `sunny-meadow.5`    | Meadow Mix           | Mixed review                        | Feeding Time (all meadow facts; 12; keypad); Memory Match (÷)                                  |
| `sunny-meadow.6`    | Meadow Stories       | Equal groups, sharing, "N more"     | Riddle Scrolls (6, pick the operation)                                                         |
| `sunny-meadow.boss` | The Bridge Troll     | Region mix                          | Boss (meter 15; cap 20)                                                                        |

### 3.2 Whispering Woods (`whispering-woods`): ×3 and ×4

New dragons: Clover (level 1), Petal (level 2). Boss: the Forest Witch.

| Level                   | Title                | Focus                                       | Activities                                                                 |
| ----------------------- | -------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| `whispering-woods.1`    | Clover Counts        | ×3 as groups and arrays; skip-counting by 3 | Egg Grid (×3); Number Trail (×3); Feeding Time (×3; 8; choice)             |
| `whispering-woods.2`    | Petal Doubles        | ×4 = double the double                      | Egg Grid (×4 as 2 × 2 groups); Feeding Time (×4; 10; choice)               |
| `whispering-woods.3`    | Woodland Recall      | ×3, ×4 recall                               | Feeding Time (×3, ×4; 12; keypad); Memory Match                            |
| `whispering-woods.4`    | Sharing in the Woods | ÷3, ÷4, fact families                       | Fact Family Nest (3, 4); Sharing Feast (÷3, ÷4); Feeding Time (÷3, ÷4; 10) |
| `whispering-woods.5`    | Woods and Meadow Mix | Review with ×2, ×5, ×10                     | Feeding Time (mix; 12; auto); Compare Stones (fact vs number; 6)           |
| `whispering-woods.6`    | Woodland Stories     | Groups, sharing, "N times as many" intro    | Riddle Scrolls (6)                                                         |
| `whispering-woods.boss` | The Forest Witch     | Region mix + review                         | Boss (meter 15)                                                            |

### 3.3 Fire Mountain (`fire-mountain`): ×6 and ×7

New dragons: Ember (level 1), Rainbow (level 2). Boss: Krakonoš. Strategy pictures: "5 groups + 1
group" and "5 groups + 2 groups".

| Level                | Title            | Focus                              | Activities                                                       |
| -------------------- | ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `fire-mountain.1`    | Ember's Spikes   | ×6 = 5 groups + 1 group            | Egg Grid (×6 split 5 + 1); Feeding Time (×6; 8; choice)          |
| `fire-mountain.2`    | Rainbow Stripes  | ×7 = 5 groups + 2 groups           | Egg Grid (×7 split 5 + 2); Feeding Time (×7; 10; choice)         |
| `fire-mountain.3`    | Hot Recall       | ×6, ×7 recall                      | Feeding Time (×6, ×7; 12; keypad); Number Trail (×7)             |
| `fire-mountain.4`    | Sharing the Fire | ÷6, ÷7, missing factors            | Fact Family Nest (6, 7); Feeding Time (÷ and missing factor; 10) |
| `fire-mountain.5`    | Mountain Mix     | Review ×2-×7                       | Feeding Time (mix; 12; auto); Memory Match                       |
| `fire-mountain.6`    | Mountain Stories | "N times as many", both directions | Riddle Scrolls (6)                                               |
| `fire-mountain.boss` | Krakonoš         | Region mix + review                | Boss (meter 18)                                                  |

### 3.4 Crystal Caves (`crystal-caves`): ×8 and ×9

New dragons: Crystal (level 1), Starry (level 2). Boss: the Gnome King. Strategies: double ×4,
10 groups − 1 group, the finger trick for ×9.

| Level                | Title           | Focus                             | Activities                                                        |
| -------------------- | --------------- | --------------------------------- | ----------------------------------------------------------------- |
| `crystal-caves.1`    | Crystal Doubles | ×8 = double ×4                    | Egg Grid (×8 as double ×4); Feeding Time (×8; 8; choice)          |
| `crystal-caves.2`    | Starry Nines    | ×9 = 10 groups − 1 group; fingers | Egg Grid (×9 as 10 − 1); Feeding Time (×9; 10; choice)            |
| `crystal-caves.3`    | Cave Recall     | ×8, ×9 recall                     | Feeding Time (×8, ×9; 12; keypad); Number Trail (×9)              |
| `crystal-caves.4`    | Gem Sharing     | ÷8, ÷9                            | Fact Family Nest (8, 9); Sharing Feast; Feeding Time (÷8, ÷9; 10) |
| `crystal-caves.5`    | Deep Cave Mix   | All tables, focus 6-9             | Feeding Time (all; 14; auto); Compare Stones (fact vs fact; 6)    |
| `crystal-caves.6`    | Cave Stories    | Word problems with 8 and 9        | Riddle Scrolls (6)                                                |
| `crystal-caves.boss` | The Gnome King  | Region mix + review               | Boss (meter 18)                                                   |

### 3.5 Sharing Lake (`sharing-lake`): division everywhere

No new dragons; the table dragons grow to youngling with division. Boss: the Water Goblin.

| Level               | Title              | Focus                                        | Activities                                          |
| ------------------- | ------------------ | -------------------------------------------- | --------------------------------------------------- |
| `sharing-lake.1`    | Fair Shares        | Division as sharing and grouping, all tables | Sharing Feast (5); Feeding Time (÷ all; 10; choice) |
| `sharing-lake.2`    | Missing Pieces     | Missing factor `? · 6 = 42`                  | Feeding Time (missing factor; 12; auto)             |
| `sharing-lake.3`    | Fact Family Island | × and : as one family                        | Fact Family Nest (all; 4); Memory Match (× ↔ ÷)     |
| `sharing-lake.4`    | Times as Many      | "N times as many", both directions           | Riddle Scrolls (`times-as-many`, `times-fewer`; 6)  |
| `sharing-lake.5`    | More or Times?     | "N more" versus "N times as many"            | Riddle Scrolls (contrast; 6); Compare Stones (6)    |
| `sharing-lake.6`    | Lake Mix           | All division, review                         | Feeding Time (÷ all; 14; keypad)                    |
| `sharing-lake.boss` | The Water Goblin   | Division mix + review                        | Boss (meter 20)                                     |

### 3.6 Leftover Lagoon (`leftover-lagoon`): division with remainder

New dragon: Pearl. Boss: the Lake Nymphs. Core range: dividend ≤ 99, quotient ≤ 9 (occasionally 10),
remainder < divisor. A 2-digit quotient with remainder is 4th-grade material and never core.

| Level                  | Title                    | Focus                              | Activities                                                             |
| ---------------------- | ------------------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| `leftover-lagoon.1`    | Pearls Left Over         | Sharing with leftovers in the bowl | Sharing Feast (with remainder; 4); Feeding Time (remainder; 8; choice) |
| `leftover-lagoon.2`    | Smaller Than the Divisor | The remainder is always smaller    | Feeding Time (remainder; 10; auto)                                     |
| `leftover-lagoon.3`    | Lagoon Recall            | Remainder fluency                  | Feeding Time (remainder; 12; keypad); Memory Match                     |
| `leftover-lagoon.4`    | Leftover Stories         | Leftover word problems             | Riddle Scrolls (leftover; 6)                                           |
| `leftover-lagoon.5`    | Lagoon Mix               | Remainders + division review       | Feeding Time (mix; 14; auto)                                           |
| `leftover-lagoon.boss` | The Lake Nymphs          | Remainder mix + review             | Boss (meter 18)                                                        |

### 3.7 Giant's Peaks (`giants-peaks`): beyond the small tables

New dragon: Boulder. Boss: the Friendly Giant. All results within 1000. 2-digit × 1-digit by
decomposition (`14 · 3 = 10 · 3 + 4 · 3`); 2-digit : 1-digit without remainder.

| Level               | Title              | Focus                                  | Activities                                                       |
| ------------------- | ------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| `giants-peaks.1`    | Giant Steps        | × 10 and × 100 (`34 · 10`, `7 · 100`)  | Feeding Time (×10, ×100; 10; auto); Number Trail (×10)           |
| `giants-peaks.2`    | Tens Times         | Tens × 1-digit (`30 · 3`, `40 · 6`)    | Number Trail (tens: 30, 60, 90 …); Feeding Time (tens; 10; auto) |
| `giants-peaks.3`    | Break It Apart     | 2-digit × 1-digit without carry        | Feeding Time (no carry; 10; choice)                              |
| `giants-peaks.4`    | Carry the Boulder  | 2-digit × 1-digit with carry           | Feeding Time (carry; 10; keypad)                                 |
| `giants-peaks.5`    | Split the Load     | 2-digit : 1-digit (`48 : 4`, `96 : 8`) | Sharing Feast (big; 3); Feeding Time (2d : 1d; 10; auto)         |
| `giants-peaks.6`    | Peak Stories       | Word problems with bigger numbers      | Riddle Scrolls (6)                                               |
| `giants-peaks.boss` | The Friendly Giant | Region mix + review                    | Boss (meter 18)                                                  |

### 3.8 Riddle Ruins (`riddle-ruins`): order, brackets, comparison, words

New dragon: Clockwork. Boss: the Golem.

| Level               | Title              | Focus                                                   | Activities                                             |
| ------------------- | ------------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| `riddle-ruins.1`    | Gears in Order     | × and : before + and −                                  | Golem Orders (no brackets; 4); Feeding Time (order; 8) |
| `riddle-ruins.2`    | Brackets First     | Brackets first                                          | Golem Orders (brackets; 4); Feeding Time (order; 8)    |
| `riddle-ruins.3`    | Compare Stones     | `<`, `>`, `=` with expressions                          | Compare Stones (expressions; 10)                       |
| `riddle-ruins.4`    | Words of the Ruins | Factor, product, dividend, divisor, quotient, remainder | Feeding Time (terms; 10; choice); Memory Match (terms) |
| `riddle-ruins.5`    | Two-Step Riddles   | Simple two-step word problems                           | Riddle Scrolls (two-step; 6)                           |
| `riddle-ruins.6`    | Ruins Mix          | Everything since Region 5                               | Feeding Time (mix; 14; auto)                           |
| `riddle-ruins.boss` | The Golem          | Region mix + review                                     | Boss (meter 20)                                        |

### 3.9 Dragon Castle (`dragon-castle`): the finale

New dragon: the Seven-Headed Dragon (hatches on the boss win). Three lessons and the finale.

| Level                | Title                   | Focus                                                               | Activities                                           |
| -------------------- | ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `dragon-castle.1`    | The Great Hall          | Grand review of all tables                                          | Feeding Time (all × and ÷; 15; keypad)               |
| `dragon-castle.2`    | Polishing the Window    | The child's weakest facts (lowest boxes)                            | Feeding Time (weakest; 12; auto); Memory Match       |
| `dragon-castle.3`    | Seven Sneezes Practice  | One problem type per head                                           | Feeding Time (mixed strands; 14); Riddle Scrolls (4) |
| `dragon-castle.boss` | The Seven-Headed Dragon | Seven heads: ×, ÷, remainder, big numbers, order, comparison, words | Boss (meter 21: three per head)                      |

After the finale the **Endless Daily Adventure** keeps spaced review going: hungry dragons, the
weakest panes, the Arena and gifts. New regions (for example 4th grade) arrive as new content
revisions.

## 4. Session flow

### 4.1 First session (the hook within five minutes)

Title (the tap also unlocks audio) → add a profile (name, keeper avatar) → prologue (≈30 s,
skippable, read-aloud) → **choose the first egg** (×2, ×5 or ×10) → placement check → Sunny Meadow
1 (Egg Grid, then Feeding Time) → **the first egg hatches** → first sticker and coins → buy a hat at
Glimmer's Market → the map makes the next level glow.

The first hatch is designed in: Hatchling needs 30 % of the table's facts answered correctly at least
once (`growth`, §6.5); a first Feeding Time of 8 problems meets ≈7 different facts (new facts first),
which is 33 % of the 21 facts of a times table in both orders.

### 4.2 Daily Adventure

One big button, about 10-15 minutes. The view's `hub.next` step decides what it does, in priority
order:

1. a pending story beat;
2. the placement check, if not done yet;
3. **snack time** for hungry dragons (their due reviews) and the valley's basket (§5.12), at the
   start of the day;
4. the next glowing level (or the next activity of a level in progress), until a level is done
   today;
5. a **minigame for variety**, once, if the day had none yet: a minigame of the furthest finished
   level, replayed on its own (`startLevel { level, activity }`, which never completes the level
   again);
6. the **gift chest**, once the daily goal is reached;
7. **snack time** again while a known fact is starving (the review guarantee, §6.3), unless a level
   is under way;
8. the next glowing level again, **while today's success is at least 70 %** (pacing, below); a
   level already under way is always continued;
9. free play (any open level, the Arena, the Market, the Album).

**Pacing** (decided after the learner simulations): the game keeps a struggling child mostly
succeeding, even if the valley takes longer. After the day's first level, a further _new_ level is
offered only while today's success is at least 70 % (the lower edge of the success band). Below
it the Daily Adventure reviews instead: snack time when something is due (§5.12), else a replay of
one activity (the same `minigame` step as above, for any activity) of the last three finished
levels: their problem activities, or their minigames too while there are fewer than two. The
review rotates with every round played, so a review that did not lift the day is not offered
again straight away. Pacing only chooses the suggestion: every open level, including those a
parent unlocked ahead, stays playable from the map. The day's first level is always offered.

After the daily goal the dragons get **sleepy** (an expression, never a lock). Play can continue.
The parent sets the goal and an optional time limit; when the limit is reached the shell ends the
round gently (`endRound{ reason: 'time-limit' }`) and shows a goodbye card.

### 4.3 Habit, not streaks

The hub shows **days practised this week** (seven dots, Monday-Sunday). There is no streak counter
to lose, no "come back or else", no notifications.

## 5. Activities

Every activity is data-driven: a level lists activities as `{ kind, skills, count, input, options }`.
"Problem" activities serve one problem at a time and are answered with `answer`; "minigame"
activities are `@aegis/narrative` minigame boards played with `minigameMove`.

General rules for all activities:

- **No failing.** A wrong answer gets a curious dragon, orange highlight, a "?" badge, a soft boop
  and "Almost! Let's look…" with the correct answer and its visual model. It never removes coins,
  stars or progress.
- **Feedback never relies on colour alone:** shape (✓ / ?), motion, sound and text all change.
- **Hints** (`hint`) show the visual model for the current problem (array, groups, strategy split,
  number line). They are free and never reduce rewards.
- Every answer costs one logical turn; re-asks are scheduled in turns (§6.4).

### 5.1 Feeding Time (`feeding`): the core

A dragon is hungry; each correct answer throws a fruit into its mouth (chomp!).

- 8-15 problems from the activity's skills (`count`).
- Input: `choice` (4 options, keyboard digits select a matching option), `keypad` (big on-screen
  keypad, digits on the keyboard) or `auto` (choice while the item is in box 0-1, keypad from box 2;
  `balance.input.keypadFromBox`).
- Problems: any problem kind the skills generate (facts, missing factors, remainders, beyond-table,
  order, terms).
- A miss re-asks the item about three problems later, at most twice per round, with the visual
  model shown first.
- Ends after `count` answers. Results: correct answers, fast answers, best streak, coins.

### 5.2 Memory Match (`memory-match`): built-in `matching`

Flip two cards; pairs are fact ↔ product (`7 · 8` ↔ `56`), fact ↔ quotient, × ↔ ÷ of a family, or
term ↔ example. Mismatches stay face-up until the child taps "Turn back" (explicit `clear`), with no
timer. `options.pairs` 3-8 (default 6). Board config: `cards: { id, pair, labelKey, backLabelKey }[]`
with notation-agnostic face labels (`fact:mul:7x8`, `num:56`, `term:product`; backs `card:back`,
contract §11.1); moves `{ type: 'select', card }` and `{ type: 'clear' }`. Completion: all pairs
matched. A coin per pair; pairs found before any mismatch on the board count as fast (the built-in
board keeps no per-card history, so this is the implementation of "first-try pairs").

### 5.3 Number Trail (`number-trail`): built-in `ordering`

Skip-count along a path: place the multiples of a table in order or fill the gaps (`options.length`
5-12, `options.gaps` 1-6). Config `items: { id, labelKey }[]`, `solution: string[]`; moves
`{ type: 'place', item, index }` and `{ type: 'submit' }`. An incorrect submission stays editable.
The trail counts the table from `1 · n`; the gap numbers are stones dealt in a shuffled order (never
already right) and the child orders them into the gaps. A right trail credits its facts (`k · n`)
and earns a coin per stone.

### 5.4 Egg Grid (`egg-grid`): custom `dv.egg-grid`

Build an array of eggs for a product: choose rows × columns (tap or drag to resize a grid in a nest).
Every rectangle with the right number of eggs is accepted; the board lists the rectangles found
(`3 × 4`, `4 × 3`, `2 × 6`…), showing commutativity and factor pairs. Strategy variants split the
grid with a coloured line (5 + 1 groups for ×6, 10 − 1 for ×9, double-double for ×4 and ×8).
Config: `{ product, maxSide, split: 'none' | 'five-plus' | 'ten-minus' | 'double', find }` (`split`
from the activity option; `find` rectangles complete the board, set by the rules to all of them);
moves `{ type: 'set', rows, columns }` and `{ type: 'submit' }`. Each new rectangle earns a coin and
credits its fact when it belongs to the activity's skills. Uses `createPlacement` for drag. Products
come from facts of the activity's skills with both factors at least 2 (a `1 × 5` "array" is only a
line of eggs), and a round's boards go from easy to hard: board _k_ of _n_ takes the _k_-th band of
the round's products, smallest first.

### 5.5 Fact Family Nest (`fact-family`): custom `dv.fact-family`

Three numbers sit in a nest (for example 6, 7, 42). Complete four equations: `6 · 7 = 42`,
`7 · 6 = 42`, `42 : 6 = 7`, `42 : 7 = 6` by dragging the numbers into the blanks. Config
`{ a, b, product }`; moves `{ type: 'fill', equation: 0-3, slot: 0-2, value }` and `{ type: 'submit' }`.
Credits the four related fact items on completion: as correct (ok) when the first check was all
right, as correct but slow (no box move) after more checks. A coin per equation.

### 5.6 Sharing Feast (`sharing-feast`): custom `dv.sharing-feast`

Share fruit between baskets: tap or drag fruit into baskets so that every basket has the same number;
leftovers stay in the bowl. Teaches division as sharing and grouping, and remainders ("the leftover
is always fewer than the baskets"). Config `{ total, baskets, remainder: boolean }`; moves
`{ type: 'put', basket }`, `{ type: 'take', basket }`, `{ type: 'submit', each, left }`. Uses
`createPlacement`.

### 5.7 Compare Stones (`compare-stones`): problem activity

Two stones carry expressions; the child picks `<`, `>` or `=` (always choice input). Problems are
`compare` problems (`7 · 8 ○ 50`, `6 · 7 ○ 5 · 9`, `2 + 3 · 4 ○ (2 + 3) · 4`). Implemented as a
problem activity (not a custom minigame, a refinement of the plan's table) so comparisons feed spaced
retrieval like any other item (`compare:*` buckets).

### 5.8 Riddle Scrolls (`riddle-scrolls`): word problems

A scroll unrolls with a short story (🔊 read-aloud). With `options.pickOperation` (default true)
the child first picks the operation and then answers the number: the operation step always offers
the four operations, + − · : in that order, and the number step its own options (or the keypad). A
wrong operation pick counts as a miss for the item and shows the right operation. Families: equal
groups, sharing,
grouping, N times as many in both directions ("Tom has 3 times as many" and "Tom has 12. That is 3
times as many as Eva has", Czech _N-krát více_ and _N-krát méně_; the stories never say "N times
fewer", see [curriculum.md](curriculum.md) §6), N more, N fewer, leftovers, two-step. Additive
families are included on purpose: "3 more" versus "3 times as many" is the classic confusion, so
Sunny Meadow 6, Sharing Lake 5 and the bosses contrast them.

### 5.9 Golem Orders (`golem-orders`): custom `dv.golem-orders`

The Golem only moves when told what to do first. An expression is shown as a row of gears; the
child taps the operation that goes first (brackets, then × and :, then + and −, left to right),
types its result, and the expression shrinks, until one number is left. Config
`{ expr: Expr }`; moves `{ type: 'pick', path }` and `{ type: 'answer', value }`. Credits the
`order:*` bucket on completion.

### 5.10 Boss Challenge (`boss`)

Fill the boss's mood meter (laughing, sleepy or happy) with correct answers; misses never lower it.
Problems mix the region's skills with spaced review of earlier skills (`boss.reviewShare`, default
20 %). The round ends when the meter is full; as a kindness cap it also ends after `count` problems
(the meter fills with a final flourish), so no child is stuck. Retry any time for more stars. A
boss with several `heads` (the Seven-Headed Dragon: 7 heads, 21 answers, no review share) shares
the meter evenly between them and is won over one head after another, each head with the next
skill of the boss activity: ×, ÷, remainders, big numbers, order of operations, comparison, words.

### 5.11 Lightning Arena (`arena`, optional)

Opens after the Bridge Troll (`balance.arena.unlockAfter`) if the parent left it on. A 60-second race
of known facts against your own best. The shell keeps the time and ends the round with
`endRound{ reason: 'time-up' }`. No penalties; a new personal best earns a sticker and a cheer.

### 5.12 Snack Time (`snack`) and Placement (`placement`)

- **Snack time** serves a hungry dragon's due items (or all hungry dragons'), 6-10 problems, auto
  input; while recent success is below 70 % only 4-6, so a session is not dominated by reviews the
  child cannot do yet (§6.3). Feeding hungry dragons _is_ the spaced review.
- **The valley's basket** (added after the learner simulations): due facts that no hatched dragon
  eats wait in the basket. These are comparisons, terms and word problems until the Seven-Headed
  Dragon hatches, and the facts of eggs not hatched yet. Snack time for every dragon serves them
  with the dragons' due facts, and the Daily Adventure offers snack time when only the basket has
  something due, so every fact the child knows is reviewed. A snack of the basket alone (no
  dragon is hungry) is as long as the basket, within the usual maximum: one problem per fact, a
  fact and its twin once (a right answer to 6 · 8 reviews 8 · 6), so a single due fact is a
  one-problem snack. Any round that runs out of things to ask finishes normally, with its results
  and coins.
- **Placement** ("Show the dragons what you know!") walks a ladder of skills
  (`placement.steps`), 2-4 problems per step, 12-24 problems in total. It stops early and gently
  after `stopAfterMisses` misses in a row. Passing a step (`passAccuracy`) marks its levels as placed:
  completed with one star, replayable for more. Parents can re-run it. It never places the first
  level (every child plays it and hatches the first egg there) or a boss level; starting a level
  instead of the check skips it. Answers count like any answer (the facts are seen, the chosen
  egg warms); placed levels give their eggs and cosmetics, but stickers only reward what the child
  did (Dressed Up needs a dragon wearing something).

## 6. Adaptive learning engine

All rules are deterministic: same actions, same content, same seed → same state hash on every
machine. Time enters only as data (`startSession.day`, `answer.elapsedMs`).

### 6.1 Items

- Every small-table fact is an item: 121 multiplication facts `mul:AxB` (A, B in 0-10, as presented)
  and 110 division facts `div:P:D` (D 1-10, quotient 0-10). Missing-factor problems practise the
  division fact.
- Open-ended skills are bucketed: `rem:d7`, `pow10:x100`, `tens:d6`, `mul2d1d:carry`,
  `div2d1d:regroup`, `order:brackets`, `compare:expression`, `word:times-fewer`, `terms:quotient`.
- Commuted facts (`mul:7x8`, `mul:8x7`) share partial credit: a correct answer to one counts as a
  "seen" review of the other for scheduling (not for mastery).

### 6.2 Leitner boxes

| Response            | Box move                 |
| ------------------- | ------------------------ |
| Correct, fast or OK | up one box (max 5)       |
| Correct, slow       | stays                    |
| Wrong               | back to box 1, invisibly |

Intervals until due, by box 0-5: **0, 0, 1, 2, 4, 8 days** _(balance `leitner.intervals`)_.

Response buckets come from `elapsedMs` measured by the shell (paused time excluded):

| Input  | Fast                                   | OK                            | Slow      |
| ------ | -------------------------------------- | ----------------------------- | --------- |
| choice | ≤ 2.5 s                                | ≤ 6 s                         | otherwise |
| keypad | ≤ 3.5 s + 0.7 s per extra answer digit | ≤ 8 s + 0.7 s per extra digit | otherwise |

**Time the arithmetic, not the reading** (decided after the learner simulations): a story takes
time to read, and that time is no part of the child's fluency. Without an allowance a right answer
to a two-step story was always slow, and an answer after an operation step was never fast: story
items never moved up a box, story levels could not reach 3 stars, and the Seven-Headed Dragon could
not be crowned. So a word problem's answer gets a reading allowance added to both limits above:

- a story answered whole (no operation step, such as a two-step story): **its words × 1 s + 4 s**
  to take it in _(`response.word.perWordMs`, `wholeStoryMs`)_;
- the number after an operation step: **a quarter of its words × 1 s** _(`rereadPercent`)_. The
  story was read for the operation, so the child only glances back.

A story's length is its template's `words`: the words of its catalog text as the child profile
counts them, a `{placeholder}` counting as one word (`storyWordCount`). The content gate checks
every count against the text. Content without `words` or without `response.word` keeps the plain
limits.

### 6.3 Round composition (the mix)

- Target success per round: **≈80-85 %** _(balance `mix.successTarget` = 82)_.
- About **70 %** likely successes (due reviews, then known facts) and **30 %** learning items
  _(`knownShare` = 70)_. The learning share moves between 10 % and 50 % with rolling accuracy over the
  last 20 answers, across days _(`minLearningShare`, `maxLearningShare`, `window`)_: a hard yesterday
  shrinks this morning's share of new facts.
- **Protecting success** (decided after the learner simulations): while recent success (the same
  20 answers) is below **70 %**, the lower edge of the success band, the game keeps the child mostly
  succeeding. A due fact missed last time counts as a learning item, not a likely success; due
  reviews, learning draws, snacks, boss reviews and the Feeding Time of the weakest facts serve the
  likeliest successes first (facts answered right last time, the most recently practised first;
  then new facts; then facts missed last time) instead of the most overdue; snacks are smaller
  (§5.12); reviews and re-asks are asked by choice, never on the keypad (except in the Arena and
  the placement check); and the Daily Adventure holds further new levels (§4.2). Inside the band
  the spaced order (most overdue first) is unchanged: switching at the 82 % target instead slowed
  an average child's mastery in the simulations.
- **The review guarantee** (added with the basket): a known fact (bronze or better, box 2+) that
  has waited **4 days** past its review day is _starving_. Wherever reviews are served (the mix's
  due draws, snacks, the boss's spaced review), a starving fact comes first, the most overdue
  first, whatever the child's success; and while one is starving the Daily Adventure offers snack
  time before any new level (§4.2). A child who plays on weekdays therefore sees every known fact
  within a week of its review day: the weekend adds at most three days.
- No immediate repeats: an item is not served again within 2 problems _(`noRepeatWithin`)_, re-asks
  excepted, and inside each tier items not served in this round come first (known items: also
  not practised today). Tables are interleaved.
- **The focus egg** (detail added in the implementation): learning draws prefer facts of the
  chosen first egg while it is an egg (else the oldest egg owned) that were never answered right,
  among eggs whose table the round practises: `2 · 0` belongs to Puff's set but is only a stray
  fact in a round of twos, so that round warms Bubbles, not Puff. Practice warms the egg, which is
  how the first Feeding Time hatches the first egg whichever table the child chose (§4.1); Sunny
  Meadow 1 therefore serves ×2, ×5 and ×10. The placement check also warms it: every other problem
  of a step is one of the chosen egg's facts when the step practises its table.
- **Rule facts** (refinement after the first playtest): `n · 0`, `n · 1` (either order), `0 : n` and
  `n : 1` follow a rule rather than being remembered one by one. A round whose own tables do not
  include 0 or 1 serves at most one of them, so they never crowd out the facts the round is about;
  Sunny Meadow 3 ("Tens, Ones and Zeros") and the meadow reviews still practise them freely.
- All draws use named PRNG streams: `problems` (items and problem shapes), `distractors` (choice
  options and their order), `rewards` (gifts, quests), `words` (names and objects in stories). Streams
  are independent, so a reward draw never changes the next problem.
- Input mode `auto`: choice while the item is in box 0-1, keypad from box 2 _(`input.keypadFromBox`)_.

### 6.4 Re-asking

A miss schedules a runtime job to re-ask the item about **3 problems later** _(`reask.delay`, in
turns; each answer is one turn)_, at most **2 per round** _(`reask.maxPerRound`)_. The re-ask shows the
visual model first. Jobs are anchored to the round's runtime phase, so leaving a round cancels any
that have not fired.

**Teach, then ask**: a fact whose last two answers were misses is shown with its picture model
before it is asked again (the problem's `teach` flag), in every round but the Arena (a race) and
the placement check (a measurement). Its answer counts like a re-ask's.

### 6.5 Mastery, the Magic Window and dragon growth

| Level  | Rule                                                             |
| ------ | ---------------------------------------------------------------- |
| dim    | box 0-1                                                          |
| bronze | box 2                                                            |
| silver | box 3-4 (or box 5 without the fast answers)                      |
| gold   | box 5 and at least 2 fast answers among the last 3 _(`mastery`)_ |

**The Magic Window** is an **11 × 11** stained-glass mosaic of all 121 multiplication facts (row =
first factor 0-10, column = second factor 0-10) plus a separate **division panel** of the 110
division facts (row = divisor 1-10, column = quotient 0-10). Each pane shows its mastery level; a known
fact that is due again "needs polishing" (a soft sparkle, never a crack).

**Dragon growth** _(balance `growth`)_. A dragon's mastery set is the items of its skills (for a
table dragon, the 21 facts of its table in both orders).

| Stage     | Requirement                                                            |
| --------- | ---------------------------------------------------------------------- |
| egg       | received (first egg choice, level rewards)                             |
| hatchling | 30 % of the set answered correctly at least once                       |
| youngling | 60 % at bronze or better, and 60 % of its division facts at bronze     |
| adult     | 90 % at silver or better (division too) and its region's boss defeated |
| crowned   | 100 % gold (division too)                                              |

**Rule facts and growth** (after the learner simulations): from bronze up, a dragon counts the rule
facts of its set (`n · 0`, `n · 1`, `0 : n`, `n : 1`) only if it is Puff (×0) or Mirror (×1), whose
facts they are. A round not about 0 or 1 serves at most one of them (§6.3), so they come round too
rarely to be reviewed to silver and gold, and they would hold every other dragon back from adult
and crowned. Bubbles therefore grows on 17 of its 21 facts (and 10 of its 11 division facts). They
still count toward hatching, which needs each fact answered right only once, and they still light
their panes in the Magic Window. Snack time serves rule facts never answered right as soon as the
due facts are fed, so Puff and Mirror meet all of theirs.

**Kindness rules.** Dragons never shrink; mastery that fades only makes panes need polishing and
dragons hungry. A dragon with at least one due fact is **hungry for snacks** _(`hungry.minDue`)_.
A fact practised today is never due again the same day, so a dragon is not hungry on the day it
hatched and a pane needs polishing only from a later day on.

### 6.6 Distractors

Choice options are plausible error patterns: neighbouring products `a · (b ± 1)` and `(a ± 1) · b`,
`a + b` instead of `a · b`, reversed digits, quotient ± 1, a swapped or ±1 remainder, and for word
problems the additive/multiplicative mix-up. Options are unique, non-negative, never the answer, and
shown in seeded order (`distractors` stream). Four options by default _(`input.choices`)_.

## 7. Rewards and economy

All values are balance data. Coins are earned only by playing; nothing is bought with money.

### 7.1 Coins

| Source                           | Coins (default)                 |
| -------------------------------- | ------------------------------- |
| Correct answer                   | 1                               |
| Streak bonus                     | +2 at every 5 correct in a row  |
| Lesson stars (first time each)   | 5 / 10 / 15 for stars 1 / 2 / 3 |
| Boss level stars                 | 10 / 20 / 30                    |
| Boss defeated (first time)       | 30                              |
| Placement check done             | 10                              |
| Daily quest                      | 5-10 each (3 quests a day)      |
| Daily gift (when not a cosmetic) | 10-25                           |

A typical 15-minute session earns roughly 50-80 coins.

### 7.2 Glimmer's Market

About 40 cosmetics in five slots (the art catalog publishes 42): **head** (hats, crowns), **neck**
(scarves, bows, medals), **eyes** (glasses, goggles, masks), **wings** (wing paints) and **nest**
(nest decorations). Prices by tier: 15-25 (starter), 30-45 (region 2-4), 50-80 (later regions and
boss rewards). Items unlock into the market as regions open (`cosmetic.unlock`). Ownership uses the
`@aegis/narrative` idempotent cosmetic grants; a bought item can be worn by **any** dragon, and each
dragon keeps its own outfit (one item per slot).

### 7.3 Stickers (about 50, one album page per region)

Stickers are data (`{ id, nameKey, page, criteria, icon, color, frame }`) composed by the art
pipeline, so new stickers need no new art.

| Page             | Stickers                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sunny Meadow     | First Hatch, Show What You Know, Meadow Explorer, Meadow Star, Troll Tickler, Ten in a Row, Dressed Up                                                      |
| Whispering Woods | Clover Hatched, Petal Hatched, Double Double (×4 at silver), Woods Explorer, The Witch's Gingerbread, Three Days                                            |
| Fire Mountain    | Ember Hatched, Rainbow Hatched, Hot Streak (15 in a row), Mountain Explorer, Krakonoš Laughs, Week Warrior (5 days in a week)                               |
| Crystal Caves    | Crystal Hatched, Starry Hatched, Finger Trick (×9 at silver), Cave Explorer, The Gnome King's Dance, Coin Collector (500 coins)                             |
| Sharing Lake     | Fair Sharer (30 division facts at bronze), First Youngling, Lake Explorer, The Goblin's Teacups, Quest Helper (10 quests)                                   |
| Leftover Lagoon  | Pearl Hatched, Leftover Expert (remainders at silver), Lagoon Explorer, The Nymph Dance, Ten Days                                                           |
| Giant's Peaks    | Boulder Hatched, Big Numbers (carrying at bronze), Peak Explorer, The Giant's Nap, Arena Runner (Arena best 20), First Grown-Up Dragon                      |
| Riddle Ruins     | Clockwork Hatched, Bracket Boss (brackets at silver), Ruins Explorer, The Golem's Orders, Word Wizard (all six terms), Twenty Days                          |
| Dragon Castle    | Half the Window (61 panes silver), Golden Window (121 panes gold), First Crown, Castle Explorer, Seven Heads Cured, Every Table (all table dragons hatched) |

Sticker icons are art icons or cosmetics (a hatch sticker is an egg in the dragon's signature
colour; an explorer sticker the region's emblem; a boss sticker a shield with the boss's token).

### 7.4 Daily quests and the gift chest

Each day three quests are drawn (`rewards` stream, weighted by `quest.weight`, from unlocked
templates): give N right answers, give N quick answers, feed N snacks, play a mini-game, finish a
level, get N right in a row. The **gift chest** opens after the daily goal (default 30 correct
answers): a weighted draw between an unowned, available cosmetic (weight 3) and 10-25 coins (weight
1); it always gives something.

### 7.5 Printables

Certificates for each crowned dragon, each region boss and the finale; flashcards of the ten hardest
facts (A4, double-sided, via `layoutPrint` / `renderPrintHtml`).

## 8. Art direction (summary; details in docs/art.md)

- Bright storybook style, vivid harmonious palette, an accent colour per region (Sunny Meadow
  buttercup, Whispering Woods fern, Fire Mountain ember, Crystal Caves amethyst, Sharing Lake lake
  blue, Leftover Lagoon teal, Giant's Peaks heather, Riddle Ruins moss, Dragon Castle royal red).
- **SVG** everything first: the parametric dragon rig (palette, spikes, horns, wing pattern, stage
  proportions from a JSON recipe), UI, icons, cosmetics (on rig anchors), sticker composition and SVG
  backgrounds. **Painted backgrounds** (valley map, nine regions, castle hall with the window frame)
  come later through the image pipeline with committed prompts and provenance; nothing depends on
  them.
- Landscape with Czech inspiration: rolling hills, a castle on a hill, pine forests, Krkonoše-like
  peaks, a millpond. No text in images; negative space for UI.
- Animation (CSS / Web Animations): breathing, blinking, wing flaps, chewing, hatching, fruit arcs,
  coin flights, confetti, a curious tilt after a miss. **Reduced motion** replaces movement with
  fades.

## 9. Audio direction (summary; details in docs/audio.md)

- About 24 SFX (chime with rising pitch per streak step, chomp, coin, egg crack, hatch fanfare, level
  up, sticker, gift, boss meter, soft boop for "almost") and 4 music loops (valley, focused practice,
  boss, victory), all from deterministic synthesis recipes with committed outputs and digests.
- Separate music and effects buses with parent volume controls; music ducks under read-aloud.
- **Read-aloud** uses the Web Speech API restricted to `localService` voices (no network). A
  verbalizer reads Czech notation in English: `56 : 7` → "fifty-six divided by seven", `4 r 3` →
  "four remainder three", `3 · 4` → "three times four". With no local English voice the button is
  hidden and the parent area explains why.

## 10. UX and accessibility

- **Touch-first** on a landscape tablet, plus desktop and phone portrait. Targets ≥ 48 px
  (`CHILD_SAFE_PRESET`); at most three primary choices per screen region; text scales to 200 % with
  reflow; the bundled Andika font (SIL OFL) has unambiguous digits.
- **Keyboard:** digits type the answer and select the matching choice; Enter submits; Backspace
  deletes; arrows and Space move through choices; Esc pauses. The on-screen keypad is always there.
- **Screen readers:** problems have text equivalents (notation.ts), feedback is announced in an
  `aria-live` region, focus is managed with `openDialog` / `replaceProjection`, and dialogs restore
  focus.
- **Pause** on visibility change; no gameplay timers except the opt-in Arena.
- **Notation:** Czech by default (`3 · 4`, `12 : 3`, `23 : 5 = 4 r 3`), international in the parent
  settings (`×`, `÷`, `R`).
- **Child safety:** no outbound links, no third-party requests (a same-origin Content Security
  Policy enforces it), no ads, no accounts, no telemetry.

## 11. Profiles and the parent area

- **Profiles:** up to four children per device (`profile-1`…`profile-4`), each with a name (≤ 16
  characters), a keeper avatar, their own dragons, progress, saves and presentation preferences.
- **Parent gate:** press and hold for two seconds, then answer a 2-digit × 2-digit question.
- **Progress:** the Magic Window, accuracy and speed per table and per skill, the ten hardest facts,
  the last 60 days' trend, days practised, total answers.
- **Settings:** notation, daily goal (10-100 correct answers) and optional time limit, Arena on/off,
  read-aloud voice and auto-read, music/effects/voice volumes, text size, reduced motion, re-run the
  placement check, unlock regions ahead.
- **Data:** backup export and import per child (local files), confirmed reset, install for offline
  use, storage status ("saved on this device"), and a notice that browser storage can be cleared.
- **Printables:** flashcards of the hardest facts and certificates.
