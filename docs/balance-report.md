# Balance report

Four synthetic children play the whole v1 valley through the real rules for 12 weeks, and three
of them for a school year. This report records what they measured with content 1.2.0, the balance
it sets and why, and what the balance block cannot fix.

- **Code**: the learner model `test/sim/learners.ts`, the driver `test/sim/driver.ts` and the named
  checks `test/sim/report.ts`. [testing.md §4](testing.md#4-learner-simulation-bots) explains how
  they fit together.
- **Content and rules**: content 1.2.0 (nine regions, 59 levels, 15 dragons) on the rules of S2b's
  PR C (#27, the struggling child's success), PR D (#31, rule facts and the valley's basket) and
  PR E (#32, the reading allowance), with the snack hotfix (#34). Content 1.1.0 is measured on the
  same rules for comparison (§4.3).
- **Runs**: 84 days from Monday 2026-10-05 with seed `simulation`; the struggling and average
  children also with seeds `s2`-`s5` (§4.2); the average, slow and struggling children over 365
  days for the market (§4.4). A child takes time to read a story's English text (§2).
- **Reproduce**:
  - `node scripts/simulate.mjs --days 84 --check` runs the content's balance; `--seed s2`,
    `--learners average,struggling` and `--days 365` choose the run.
  - `--no-reading` drops the reading time, as every run before 1.2.0 did.
  - `--balance file.json` merges a partial balance block first; `--answers` writes every answer
    with its tier, box, bucket and the child's recall.
  - With the v1 pack a commit costs about 30 ms: 4,200-6,600 commits a child in 84 days, 12,500-
    21,000 in a year. On a busy machine an 84-day run of four children took 12-15 minutes and the
    365-day run 47.

## 1. Summary

**What works.** With content 1.2.0 every child plays the valley end to end, and every check
passes but one, Mirror's egg for the struggling child (§5.8):

- no step is rejected (the snack that once got stuck is fixed, §5.7);
- every level and boss is done by day 15 (perfect), 28 (average) and 38 (slow); the struggling
  child keeps moving and finishes all 59 levels by day 67 (57-77 over five seeds);
- success: the average child's session median is 82 % (82-83 % over five seeds, 49-52 of 60
  sessions in the 70-90 % band); the struggling child's is 61 % (61-64 %), above its 60 % floor;
- the average child grows all 11 times-table dragons to adult by day 70, on five of five seeds;
- no known fact (bronze and up) waits more than 6 days past its review;
- coins: the average child earns a median of 77 a session (72-81 over five seeds; design 50-80);
- the market: over a school year the average child gets something new every 5 sessions (median;
  never more than 10 apart) and has something to save for until its 117th session; every child
  buys a starter on its first day.

**What 1.2.0 changes** (§6), on today's rules, seed `simulation`, day 84. Both runs are without
the reading time, since 1.1.0 has no reading allowance (1.2.0 with reading: §4.1):

| Measure                                            | 1.1.0   | 1.2.0                       |
| -------------------------------------------------- | ------- | --------------------------- |
| Average: times-table dragons adult                 | 3 of 11 | 11 of 11 (day 70)           |
| Average: window / division facts still dim         | 5 / 31  | 0 / 0                       |
| Average: facts due at session start (median)       | 51      | 16                          |
| Average: coins per session (median)                | 98      | 77                          |
| Average: every cosmetic owned                      | day 31  | day 163 (a school year run) |
| Slow: silver panes (window and division), no gold  | 126     | 157                         |
| Slow: facts due at session start (median)          | 77      | 35                          |
| Struggling: session median success                 | 61 %    | 61 %                        |
| Struggling: silver panes                           | 18      | 38                          |
| Perfect: table dragons adult / crowned in 12 weeks | 11 / 9  | 10 / 8                      |

"Due" counts known facts whose review day had come when a session began, over the last 10
sessions. The perfect child loses one adult and one crown: Ember's 6 : 6 and 54 : 6 are never
asked once the reviews are spaced further apart (§5.9, S2b's PR F).

**The learning change is the intervals alone.** PR B's report proposed a wider "ok" (9 s / 11 s)
with the longer intervals. On PR C's rules it no longer earned its place: the intervals alone grow
the average child's 11 of 11 dragons, and with the same intervals the wider "ok" cost the
struggling child about 5 points of success (median 57 % against 62 %). It promoted that child's
steady 6.7 s answers faster than its memory kept them. The coordinator withdrew it; "ok" stays at
6 s / 8 s (§6).

**Word problems** are timed for the arithmetic, not the reading (F1b, §4.5). A Czech child reading
English needs time for a story; without an allowance the average child's two-step stories were
all slow, and the perfect child replayed story levels about 1,300 times chasing a third star. With
F1b the stories bucket as if reading took no time, or better.

**What the balance block cannot fix** (§5): Mirror's egg for the struggling child (9-13 sessions
on four of five seeds) and Ember's two facts the perfect child is never asked, both in S2b's
PR F; the struggling child's stretch band (70-90 %: 4-8 of its 48 sessions); and the struggling
child grows no dragon to adult in a school year (§4.4).

## 2. The children

Each child knows every fact to some strength from 0 to 100.

- **Practice and forgetting.** Strength grows with practice: a right answer closes `gain` % of the
  gap, a miss half as much, because "Let's look" shows the answer. Strength fades by `forget`
  points a day divided by the fact's stability.
- **Stability.** It starts at 1 + strength / 10 for knowledge from earlier grades, grows by 1 with
  every success on a new day, and halves with a miss.
- **Right answers.** The chance of a right answer is a guess among the options plus the rest
  scaled by recall.
- **Response time.** Thinking time comes from recall: fluent at 85 or more, steady at 55 or more,
  unsure below that. Keypad answers then add typing time per digit.
- **Reading** (since 1.2.0). A story's English text takes the child its words times a reading
  speed: all of it before the operation step (which the rules do not time), a quarter of it to
  find the numbers again before the answer that follows, and all of it plus a second step of
  thinking before the answer of a story without an operation step (the two-step stories).
- **Knowledge keys.** A product is one fact in both orders, a quotient its own fact, and each
  remainder, big-number, order, comparison, word or terms bucket one skill.

Minigame boards are played by the trace harness, clumsily for the struggling child. Story beats
take their first choice. At the end of each session the child claims quests, opens the gift and
buys the cheapest affordable cosmetic.

| Child      | 2nd-grade facts (× / :) | New facts 6-9 (× / :) | Words / other skills | Gain | Forget | Choice: fluent / steady / unsure | Keypad think + per digit | Reads a word | Answers a day | Plays     |
| ---------- | ----------------------- | --------------------- | -------------------- | ---- | ------ | -------------------------------- | ------------------------ | ------------ | ------------- | --------- |
| perfect    | 100                     | 100                   | 100                  | -    | -      | 1.5 s                            | 1.5 s + 0.3 s            | 0.3 s        | 45            | every day |
| average    | 85 / 70                 | 15 / 5                | 50 / 30              | 35 % | 4      | 1.8 / 4.2 / 7.5 s                | 1.8-9 s + 0.5 s          | 0.6 s        | 45            | Mon-Fri   |
| struggling | 60 / 45                 | 5 / 0                 | 25 / 10              | 20 % | 6      | 4.3 / 6.7 / 10 s                 | 4.3-11.5 s + 0.8 s       | 0.9 s        | 35            | 4 days    |
| slow       | 85 / 70                 | 15 / 5                | 50 / 30              | 35 % | 4      | 4.5 / 7 / 9 s                    | 4.5-10 s + 0.9 s         | 0.9 s        | 35            | Mon-Fri   |

**Why these numbers.**

- **Priors.** The Czech 2nd grade teaches the tables of 2-5 and 10, with 0 and 1 as rules. A fact
  with either factor in those tables is review: `7 · 2` is in the table of 2. Division is
  practised less, so it starts lower.
- **The struggling child** follows testing.md §4: it needs many exposures, forgets quickly, is
  slow and often misses the 6-9 tables.
- **The slow child** knows and learns like the average child but is never quick. It tests that
  gold needs quick answers.
- **Reading speeds** are assumptions for an 8-9-year-old Czech child reading English, slower than
  a native reader; read-aloud would make them faster.
- **Fixed in advance.** The parameters were set before the balance was measured and were not
  tuned to pass a check.
- **Model dependence.** These children are models, so absolute numbers are model-dependent;
  comparisons between balances are the robust part. The playtest with real children (testing.md
  §6) is the check on the model.

## 3. Targets

The checks are named; each label states what it measured.

| Check              | Target                                                                               | Source                    |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------- |
| success band       | average: 75 % of sessions at 70-90 % success, median inside                          | testing.md §4             |
| struggling success | struggling: median success per session at least 60 % (acceptance), 70-90 % (stretch) | testing.md §4, after §5.1 |
| tables mastered    | average: every times-table dragon adult within 12 weeks                              | brief; a school trimester |
| rewarded           | every child earns coins every session                                                | testing.md §4             |
| weekly progress    | average, struggling, slow: a level, hatch, growth, sticker or lit pane every week    | testing.md §4             |
| gift               | the gift opens every session that reaches the daily goal                             | design §7.4               |
| hatch pace         | every egg hatches within 5 sessions of arriving                                      | design §4.1, §6.5         |
| no dead end        | perfect, average, slow: every level completed, every boss won over                   | testing.md §4             |
| steady path        | struggling: a new level every week with play; finished regions' bosses won; ≥ 45/59  | coordinator (1.2.0)       |
| no starving        | no known fact (bronze and up, box 2+) waits more than 7 days past its review day     | testing.md §4             |
| coins              | average: median 50-80 coins per session (a typical session; others as measured)      | design §7.1               |
| market lasts       | average, 365 days: something on sale it cannot afford yet after 110 sessions         | coordinator (1.2.0)       |
| market pace        | median wait for something new: average ≤ 6 (never > 10), slow ≤ 8, struggling ≤ 12   | coordinator (1.2.0)       |
| starter week       | every child buys its first cosmetic in its first week                                | coordinator (1.2.0)       |
| fluency            | the slow child earns silver but never gold                                           | design §6.5               |
| perfect pace       | the perfect child reaches the finale within 4 weeks                                  | design §3                 |

**The struggling child has a target of its own.** A struggling child progresses more slowly but
keeps succeeding: the game must never leave it wrong more often than right. So the struggling
child is accepted at a session median of at least 60 % success, and the average child's band is
its stretch goal.

**And a steady path instead of the whole valley.** The coordinator's decision for 1.2.0: "The
plan's intent was 'no dead-end unlocks; the struggling bot still progresses', not 'finishes the
curriculum in 12 weeks'. For a struggling child, success matters more than speed, and more
protection means slower progress by design." So the struggling child is not held to every level
and boss in 12 weeks (the perfect, average and slow children still are). It must keep moving:

- no stall: while levels remain, every week with play completes at least one new level;
- the boss of every region whose lessons it finished is won over (lessons finished in the run's
  last week may still have the boss ahead);
- a regression floor: at least 45 of the 59 levels (¾) within the 84 days.

**Coins are judged for the average child.** Coins come from right answers, so the slow and
struggling children earn less than a typical session's 50-80 (medians 46 and 42). Their coins are
reported as measured; their market waits are their binding targets.

**The market's targets** (decisions O5 and O5c): a new item about every five sessions, about
weekly, matters more to an 8-year-old than a market that lasts the whole year, and it is kinder to
slower children. The valley's own rewards (stickers, hatching, growth, the window, the finale)
carry the rest of the year.

## 4. Results

Spreads are min / median / max over the sessions played. "Due" counts known facts (bronze and up)
whose review day had come when a session began, over the last 10 sessions.

### 4.1 Content 1.2.0 (seed `simulation`, reading modelled)

| Child      | Sessions | Success | Success per session | Quick | Valley done | Table dragons adult | Crowned | Window dim / bronze / silver / gold | Division panel  | Due          | Longest overdue |
| ---------- | -------- | ------- | ------------------- | ----- | ----------- | ------------------- | ------- | ----------------------------------- | --------------- | ------------ | --------------- |
| perfect    | 84       | 100 %   | 100 / 100 / 100 %   | 100 % | day 15      | 10 of 11            | 8       | 1 / 0 / 0 / 120                     | 3 / 0 / 0 / 107 | 0 / 2 / 4    | 4 days          |
| average    | 60       | 81 %    | 65 / 82 / 96 %      | 55 %  | day 28      | 11 of 11 (day 70)   | 0       | 0 / 0 / 46 / 75                     | 0 / 3 / 57 / 50 | 7 / 16 / 72  | 6 days          |
| struggling | 48       | 61 %    | 36 / 61 / 77 %      | 0 %   | day 67      | 0 of 11             | 0       | 91 / 2 / 28 / 0                     | 105 / 0 / 5 / 0 | 3 / 8 / 19   | 6 days          |
| slow       | 60       | 79 %    | 65 / 78 / 92 %      | 0 %   | day 38      | 0 of 11             | 0       | 28 / 7 / 86 / 0                     | 41 / 8 / 61 / 0 | 31 / 52 / 68 | 6 days          |

| Child      | Coins per session | Coins by source (12 weeks)                                  | Daily goal | Stickers | First purchase | Wait for something new (sessions) |
| ---------- | ----------------- | ----------------------------------------------------------- | ---------- | -------- | -------------- | --------------------------------- |
| perfect    | 54 / 63 / 182     | answers 4206, stars 816, streaks 687, quests 577, gifts 333 | 84 of 84   | 52       | day 0          | 1 / 2 / 10                        |
| average    | 44 / 77 / 157     | answers 3365, stars 492, quests 435, streaks 245, gifts 219 | 59 of 60   | 49       | day 0          | 1 / 4 / 7                         |
| struggling | 17 / 42 / 101     | answers 1616, quests 224, stars 168, bosses 135, streaks 53 | 3 of 48    | 40       | day 0          | 1 / 4 / 8                         |
| slow       | 28 / 46 / 117     | answers 2217, stars 282, quests 229, streaks 177, gifts 151 | 36 of 60   | 45       | day 0          | 1 / 4 / 10                        |

Every check passes except hatch pace for the struggling child (Mirror's egg: 9 sessions, §5.8).

- **Perfect.** The finale on day 15. The window is gold but for 10 · 10, the division panel but
  for 6 : 6, 54 : 6 and 56 : 7: 227 gold panes (229 with 1.1.0). Table dragons: 10 adult and 8
  crowned (Bubbles, Sunny, Puff, Mirror, Clover, Petal, Crystal, Starry); Goldie and Rainbow are
  adult, and Ember stays a youngling because 6 : 6 and 54 : 6 are never asked (§5.9). Pearl,
  Boulder and Clockwork are crowned, the Seven-Headed Dragon adult with 97 % gold. 24 adult and
  crowned entries in all (26 with 1.1.0).
- **Average.** 52 of 60 sessions in the band; all 11 table dragons adult (the last on day 70); no
  dim fact; 103 silver and 125 gold panes. It crowns no table dragon in 12 weeks (7 by the end of
  a school year, §4.4).
- **Slow.** Median 78 %, 48 of 60 sessions in the band. Silver but never gold: 147 silver panes
  (86 in the window, 61 in division), no gold, no dragon crowned. No table dragon is adult in 12
  weeks; over a school year all 11 are, by day 149, still without gold. Market waits: median 4,
  longest 10 (target ≤ 8).
- **Struggling.** Median 61 %, 4 of 48 sessions in the band. A new level every week until the
  valley is done on day 67, every boss won over; 33 silver panes. Market waits: median 4, longest
  8 (target ≤ 12).

### 4.2 Five seeds

The struggling and average children with seeds `simulation`, `s2`-`s5` (content 1.2.0, reading):

| Seed       | Struggling: median / in band | Valley done | Mirror's egg | Average: median / in band | Table dragons adult | Coins (median) | Longest overdue |
| ---------- | ---------------------------- | ----------- | ------------ | ------------------------- | ------------------- | -------------- | --------------- |
| simulation | 61 % / 4 of 48               | day 67      | 9 sessions   | 82 % / 52 of 60           | 11 of 11            | 77             | 6 days          |
| s2         | 63 % / 6 of 48               | day 64      | 13 sessions  | 83 % / 49 of 60           | 11 of 11            | 81             | 6 days          |
| s3         | 64 % / 5 of 48               | day 57      | on time      | 82 % / 52 of 60           | 11 of 11            | 72             | 6 days          |
| s4         | 63 % / 5 of 48               | day 67      | 10 sessions  | 82 % / 50 of 60           | 11 of 11            | 77             | 6 days          |
| s5         | 63 % / 8 of 48               | day 77      | 9 sessions   | 82 % / 52 of 60           | 11 of 11            | 74             | 6 days          |

Every seed passes every check but two: Mirror's egg (four seeds, §5.8) and the average child's
coins on `s2`, one over the design's 80.

### 4.3 Without reading, and content 1.1.0

The same 84 days without the reading time (`--no-reading`), and content 1.1.0 on the same rules
(which has no reading allowance, run without reading):

| Child      | Run           | Median / in band | Table dragons adult / crowned | Silver / gold panes | Dim (window / division) | Due (median) | Coins (median) | Every cosmetic owned in 84 days |
| ---------- | ------------- | ---------------- | ----------------------------- | ------------------- | ----------------------- | ------------ | -------------- | ------------------------------- |
| perfect    | 1.1.0         | 100 % / -        | 11 / 9                        | 0 / 229             | 0 / 2                   | 20           | 104            | day 17                          |
|            | 1.2.0         | 100 % / -        | 10 / 8                        | 0 / 227             | 1 / 3                   | 2            | 63             | no                              |
|            | 1.2.0 reading | 100 % / -        | 10 / 8                        | 0 / 227             | 1 / 3                   | 2            | 63             | no                              |
| average    | 1.1.0         | 83 % / 50 of 60  | 3 / 0                         | 39 / 150            | 5 / 31                  | 51           | 98             | day 31                          |
|            | 1.2.0         | 82 % / 52 of 60  | 11 / 0                        | 103 / 125           | 0 / 0                   | 16           | 77             | no                              |
|            | 1.2.0 reading | 82 % / 52 of 60  | 11 / 0                        | 103 / 125           | 0 / 0                   | 16           | 77             | no                              |
| slow       | 1.1.0         | 80 % / 50 of 60  | 0 / 0                         | 126 / 0             | 39 / 51                 | 77           | 71             | day 42                          |
|            | 1.2.0         | 82 % / 45 of 60  | 0 / 0                         | 157 / 0             | 24 / 40                 | 35           | 46             | no                              |
|            | 1.2.0 reading | 78 % / 48 of 60  | 0 / 0                         | 147 / 0             | 28 / 41                 | 52           | 46             | no                              |
| struggling | 1.1.0         | 61 % / 6 of 48   | 0 / 0                         | 18 / 0              | 106 / 106               | 10           | 56             | day 64                          |
|            | 1.2.0         | 61 % / 6 of 48   | 0 / 0                         | 38 / 0              | 84 / 107                | 8            | 42             | no                              |
|            | 1.2.0 reading | 61 % / 4 of 48   | 0 / 0                         | 33 / 0              | 91 / 105                | 8            | 42             | no                              |

- The reading time changes nothing for the perfect and average children: F1b allows 1 s a word,
  and they read at 0.3 and 0.6 s. The slow and struggling children read at 0.9 s and think slowly
  as well, so a few more of their story answers land in "slow"; their paths differ a little.
- With content 1.1.0 the average child grows 3 of 11 dragons, earns 98 coins a session and owns
  the whole market by day 31; the perfect child owns it by day 17.

### 4.4 The market over a school year

365 days (content 1.2.0, reading). "On sale" counts the cosmetics in the market the child does not
own; "dearer" those it cannot afford with its coins; level rewards are given and count as owned.

| Session | Average: day, owned, coins, on sale (dearer) | Slow: day, owned, coins, on sale (dearer) | Struggling: day, owned, coins, on sale (dearer) |
| ------- | -------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| 1       | 0, 2, 94, 10 (8)                             | 0, 2, 96, 10 (8)                          | 0, 2, 81, 8 (6)                                 |
| 20      | 25, 26, 72, 15 (15)                          | 25, 20, 254, 15 (15)                      | 32, 17, 7, 13 (13)                              |
| 40      | 53, 30, 366, 12 (12)                         | 53, 28, 307, 14 (14)                      | 67, 27, 269, 15 (15)                            |
| 60      | 81, 34, 286, 8 (8)                           | 81, 30, 361, 12 (12)                      | 102, 29, 84, 13 (13)                            |
| 80      | 109, 37, 215, 5 (5)                          | 109, 33, 95, 9 (9)                        | 137, 30, 228, 12 (12)                           |
| 100     | 137, 39, 585, 3 (3)                          | 137, 35, 239, 7 (7)                       | 172, 31, 388, 11 (11)                           |
| 120     | 165, 42, 194, 0                              | 165, 37, 328, 5 (5)                       | 207, 33, 36, 9 (9)                              |
| 140     | 193, 42, 1409, 0                             | 193, 39, 374, 3 (3)                       | 242, 34, 141, 8 (8)                             |
| 160     | 221, 42, 2520, 0                             | 221, 41, 351, 1 (1)                       | 277, 35, 228, 7 (7)                             |
| 180     | 249, 42, 3651, 0                             | 249, 42, 902, 0                           | 312, 36, 229, 6 (6)                             |
| 209     |                                              |                                           | 364, 37, 511, 5 (5)                             |
| 261     | 364, 42, 8239, 0                             | 364, 42, 5668, 0                          |                                                 |

| Child      | Sessions | Something to save for until | Every cosmetic owned  | Wait for something new: median / longest | Coins a session: during the valley / after |
| ---------- | -------- | --------------------------- | --------------------- | ---------------------------------------- | ------------------------------------------ |
| average    | 261      | session 117 (target ≥ 110)  | session 118 (day 163) | 5 / 10 (targets ≤ 6, ≤ 10)               | 91 / 59                                    |
| slow       | 261      | session 164                 | session 165 (day 228) | 8 / 11 (target ≤ 8)                      | 63 / 49                                    |
| struggling | 209      | the whole year              | never (5 left)        | 8 / 19 (target ≤ 12)                     | 46 / 27                                    |

- Every child buys a starter on day 0; the market then keeps something new coming about weekly.
  Once it is empty the coins have no use (the average child ends the year with 8,239): more
  cosmetics in a later art batch would let the market last longer at the same pace.
- Over a year the average child's success climbs above the band (session medians by quarter: 82,
  87, 92 and 95 %), so its band check fails on the year run (147 of 261 sessions): the band is a
  12-week target, and a child who has mastered the tables answers right more often. The slow
  child grows all 11 table dragons to adult by day 149, still without gold.
- **The struggling child grows no dragon to adult in a year**: 50 window and 15 division panes
  silver at the end, success 61-65 % by quarter. It practises 140 answers a week on four days and
  forgets quickly; whether a real struggling child fares better is a question for the playtest
  (testing.md §6), and the model ignores the picture model the rules show before a fact missed
  twice (§7).

### 4.5 Word problems

Right answers to stories by bucket. The first two columns are from the word-timing study before
F1b (the C4 intervals, no allowance): without the reading time, and with it. The last is content
1.2.0 with reading and F1b.

| Child      | Story answer            | No reading      | Reading, no allowance  | 1.2.0 (reading, F1b)   |
| ---------- | ----------------------- | --------------- | ---------------------- | ---------------------- |
| perfect    | after an operation step | 138: fast 100 % | 1,271: ok 96 %         | 142: fast 100 %        |
|            | whole (two-step)        | 15: fast 100 %  | 113: slow 100 %        | 19: fast 100 %         |
| average    | after an operation step | 105: fast 89 %  | 96: ok 90 %, slow 10 % | 118: fast 94 %         |
|            | whole (two-step)        | 15: fast 60 %   | 78: slow 100 %         | 17: fast 100 %         |
| slow       | after an operation step | 82: slow 24 %   | 146: slow 100 %        | 92: slow 16 %          |
|            | whole (two-step)        | 18: slow 56 %   | 20: slow 100 %         | 13: slow 23 %          |
| struggling | after an operation step | 16: slow 100 %  | 16: slow 100 %         | 25: ok 20 %, slow 80 % |
|            | whole (two-step)        | 9: slow 100 %   | 9: slow 100 %          | 16: slow 100 %         |

- Without an allowance, a story's right answer was almost always slow, so story items never
  moved up a box, story levels could not reach 3 stars (the perfect child replayed them about
  1,300 times) and the Seven-Headed Dragon could not be crowned (the perfect child's 63 % gold;
  97 % with F1b).
- With F1b the stories bucket as without reading, or a little better: the allowance is generous
  for a child reading at up to 1 s a word. The struggling child's story answers stay slow because
  it thinks slowly, not because it reads slowly.

## 5. Findings

These went to S2b (rules and content) and to the design. Their status with content 1.2.0:

1. **The struggling child was flooded** (PR B's runs: median 37 % per session). The cause was in
   the rules: the mix counted every due fact as a likely success, even one missed last time, and
   snacks had no success control. **Fixed in S2b's PR C (#27)**: the mix keyed on "the last answer
   was a miss"; a further new level today only while today's success is at least 70 %; choice
   input and the picture model first for a fact missed twice while success is low; smaller snacks
   and fewer new facts while success is under target. The struggling child's median is now
   61-64 % over five seeds; the stretch band (70-90 %) holds 4-8 of its 48 sessions.
2. **Rule facts blocked growth** (n · 0, n · 1, 0 : n, n : 1, at most one per round). **Fixed in
   S2b's PR D (#31)**: snack time serves rule facts never answered right, and from bronze up they
   count only for Puff and Mirror. The average child grows 11 of 11 table dragons on five of five
   seeds.
3. **A fact a level never drew is never introduced later.** Still open for two facts: the perfect
   child is never asked 6 : 6 and 54 : 6 (§5.9).
4. **Facts no dragon owns were never reviewed** (comparisons, terms, most word families). **Fixed
   in S2b's PR D**: the valley's basket (snack time for every dragon serves due facts no hatched
   dragon eats) and the review guarantee (a known fact 4 or more days overdue comes first, and the
   Daily Adventure offers snack time before new levels while one is starving). No known fact now
   waits more than 6 days.
5. **Coins and the market** (two to four times the design's coins; the market empty the day the
   valley ends). **Fixed in this balance (O5c, §6)**: the average child earns 77 a session and the
   market lasts to session 117 of a school year.
6. **Pace.** The valley takes 15-38 days (67 for the struggling child). A child meets the four new
   tables (6-9) within about two weeks. The design should confirm this is intended.
7. **A snack of the basket alone could get stuck** (found by the perfect child with the C4
   intervals, day 68). With no dragon hungry and one basket fact due, snack time had a target of
   6; the first answer emptied the basket and the next draw threw, so every answer failed and only
   Quit got out. **Fixed in #34**: a draw on an empty pool returns nothing, a round with nothing
   left to serve finishes normally, and a snack of the basket alone is as long as the basket.
8. **Mirror's egg hatches late for the struggling child**: 9 sessions with seed `simulation`, 13,
   10 and 9 on `s2`, `s4` and `s5` (on time on `s3`); the target is 5. Mirror's facts are rule
   facts (n · 1, n : 1); with 1.1.0's shorter intervals the egg hatched on time. A content fix
   (Mirror's hatchling stage at 20 %) hatched it on time but cost the struggling child's worst
   seed a point of success (60 %), so the coordinator sent a targeted fix to S2b's PR F. **Known
   gap in 1.2.0.**
9. **The perfect child is never asked 6 : 6 or 54 : 6** in 12 weeks, so Ember stays a youngling;
   with 1.1.0's shorter intervals every table dragon grows adult by day 26. S2b's PR F adds a
   coverage guarantee. **Known gap in 1.2.0.**

## 6. The balance change

Content 1.2.0 changes only the balance block, prices, coin rewards and the stories' word counts:

| Value                         | 1.1.0                                                  | 1.2.0                                                           | Why                                                                                                                                                                                                                                                  | Measured effect (§4)                                                                       |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `leitner.intervals`           | 0, 0, 1, 2, 4, 8                                       | 0, 1, 2, 4, 8, 16 (C4)                                          | With at most 8 days between reviews, ~250 facts need ~30 reviews a day just to stay known: most of a 45-answer session. Doubling intervals are the standard Leitner schedule. Box 1 waits a day: a fact is never due again the day it was practised. | Average: 11 of 11 dragons adult (3), no dim fact (5 / 31), due 16 (51). Slow: due 52 (77). |
| `response.*.okMs`             | 6000 / 8000                                            | unchanged                                                       | The wider "ok" (9000 / 11000) of PR B's report was withdrawn: on PR C's rules it cost the struggling child about 5 points (57 % against 62 %) and the intervals alone grow 11 of 11.                                                                 | Struggling: 61-64 % over five seeds.                                                       |
| `response.word` (new)         | none                                                   | 1000 ms a word, 4000 ms, 25 % reread (F1b)                      | Time the arithmetic, not the reading: a story answered whole gets its words times 1 s plus 4 s; the number after an operation step a quarter of the words times 1 s.                                                                                 | Story answers bucket as without reading (§4.5).                                            |
| `wordTemplates[].words` (new) | none                                                   | 12-23 (median 17), from the catalog text                        | The story's length, counted by the content gate as the child profile counts words.                                                                                                                                                                   | (with the line above)                                                                      |
| `coins.streakBonus`           | 2                                                      | 1                                                               | Coins at two to four times the design's 50-80 a session.                                                                                                                                                                                             | Average: 77 a session (98).                                                                |
| `coins.bossDefeated`          | 30                                                     | 15                                                              | Same.                                                                                                                                                                                                                                                | (with the line above)                                                                      |
| `levels[].rewards.coins`      | lessons 5/10/15, bosses 10/20/30                       | × 0.4: lessons 2/4/6, bosses 4/8/12                             | Same; stars were the largest source after answers.                                                                                                                                                                                                   | (with the line above)                                                                      |
| `quests[].coins`              | 5-15                                                   | × 0.3, at least 2: 2-5                                          | Same.                                                                                                                                                                                                                                                | (with the line above)                                                                      |
| `gift`                        | 10-25 coins or a cosmetic (cosmetic weight 3, coins 1) | 2-6 coins, never a cosmetic                                     | A gifted cosmetic empties the market faster; the gift stays a daily surprise.                                                                                                                                                                        | (with the lines above and below)                                                           |
| `cosmetics[].price`           | 15-80                                                  | starters 15-25; Sunny Meadow 175-325; +25 a region to 600 (O5c) | Something new about every five sessions for most of a school year, rather than an empty market the day the valley ends. A level's own reward items are priced at the top of their tier and given, never sold.                                        | Average: market to session 117, waits 5 / 10; starter on day 0 for every child.            |

**Kept on purpose.**

- `fastMs` (2.5 s / 3.5 s) and `mastery` keep gold tied to quick answers: the slow child earns
  silver everywhere and never gold.
- `mix` keeps the average child at a median of 82 % success, in the band.
- `growth`: lowering adult to 80 % would hide the struggling child's slow growth (§4.4), not fix
  it; Mirror's hatching is fixed in the rules (§5.8).
- `daily.goalAnswers`: the struggling child reaches 30 right answers in 3 of 48 sessions. Parents
  can lower the goal; lowering it for everyone would not help the others.

**Decided.**

- The coordinator chose C4 (intervals 0, 1, 2, 4, 8, 16 with "ok" unchanged) over C6 (a 12-day
  last interval: the average child grew only 6-9 of 11 dragons) and withdrew the wider "ok".
- The economy: O5 (gift coins only, prices for a new item about every five sessions), then O5c
  (each region 25 coins dearer, inside 150-600; starters 15-25).
- Word timing: F1b, with the schema of S2b's PR E (a template's `words`, the balance's
  `response.word`; content without them keeps the plain limits).

## 7. Limits

- **The model.**
  - No real child learns like these models: the numbers compare balances, they do not predict a
    classroom.
  - Boards do not teach the model anything, and neither does the picture model the rules show
    before a fact missed twice (`teach`): the model ignores it. Crediting it would raise the
    struggling child's success (S2b measured about a point).
  - Each knowledge key is independent: knowing 7 · 8 does not help with 56 : 7.
  - Response times and reading speeds are assumptions. Read-aloud would make reading faster.
- **Seeds.** The struggling and average children ran five seeds, the others one. Checks near a
  threshold move with the path: the average child's coins (72-81) and Mirror's egg (on time to 13
  sessions).
- **The year.** The 365-day runs measure the market; the 12-week targets (the success band above
  all) are not meant for a year.
- **Cost.** A simulated child costs about 30 ms a commit with the v1 pack, so the 12-week and
  year runs stay outside the gate. A scheduled CI job running `node scripts/simulate.mjs --check`
  would catch balance and content regressions.
