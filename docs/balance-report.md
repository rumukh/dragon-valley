# Balance report

Four synthetic children play the whole v1 valley through the real rules for 12 weeks. This
report records what they measured, what the balance block can fix, and what it cannot.

- **Code**: the learner model `test/sim/learners.ts`, the driver `test/sim/driver.ts` and the named
  checks `test/sim/report.ts`. [testing.md §4](testing.md#4-learner-simulation-bots) explains how
  they fit together.
- **Content**: 1.1.0, nine regions, 59 levels and 15 dragons (S2b's v1 pack, with the order of
  operations fix of #22). The runs are 84 days from Monday 2026-10-05 with seed `simulation`.
- **Reproduce**:
  - `node scripts/simulate.mjs --days 84 --check` runs the content's balance.
  - Add `--balance file.json` to merge a partial balance block first (§6 lists the one proposed),
    and `--answers` to write every answer with its tier, box and the child's recall (§5.1).
  - Each run takes about 4 minutes on four processes, 4,000-6,500 commits per child.

## 1. Summary

**What works.** Every child plays the valley end to end:

- no step is rejected;
- every level is completed and every boss is won over, by day 14 (perfect), 23 (average),
  30 (slow) and 36 (struggling);
- every child hatches its first egg in its first session and earns coins in every session;
- the gift opens every day the daily goal is reached.

**Balance changes proposed** (§6): longer Leitner intervals, a wider "ok" response time, and
smaller streak and gift coins. For the average child they change these results at 12 weeks:

| Measure (average child, day 84)              | Current balance | Proposed |
| -------------------------------------------- | --------------- | -------- |
| Times-table dragons adult                    | 3 of 11         | 11 of 11 |
| Window facts still dim                       | 8               | 0        |
| Division facts still dim                     | 27              | 0        |
| Facts due at session start, last 10 sessions | 46              | 20       |
| Longest a known fact waited past its review  | 68 days         | 40 days  |

The slow-but-accurate child lights 185 silver panes instead of 140, still with no gold: gold
needs quick answers. Its due facts fall from 132 to 28.

**What balance cannot fix** (§5, for S2b and the design):

- the struggling child's success (median 37 % per session, at least 60 % needed): a selection
  defect and the pace of new material, which S2b's rules change addresses (§5.1);
- facts no dragon owns, which are never reviewed;
- rule facts (n · 0, n · 1, 0 : n, n : 1), which block dragons from adult and crowned;
- coins earned during the valley: two to four times the design's 50-80 per session;
- a market emptied the day the valley ends.

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
- **Knowledge keys.** A product is one fact in both orders, a quotient its own fact, and each
  remainder, big-number, order, comparison, word or terms bucket one skill.

Minigame boards are played by the trace harness, clumsily for the struggling child. Story beats
take their first choice. At the end of each session the child claims quests, opens the gift and
buys the cheapest affordable cosmetic.

| Child      | 2nd-grade facts (× / :) | New facts 6-9 (× / :) | Words / other skills | Gain | Forget | Choice: fluent / steady / unsure | Keypad think + per digit | Answers a day | Plays     |
| ---------- | ----------------------- | --------------------- | -------------------- | ---- | ------ | -------------------------------- | ------------------------ | ------------- | --------- |
| perfect    | 100                     | 100                   | 100                  | -    | -      | 1.5 s                            | 1.5 s + 0.3 s            | 45            | every day |
| average    | 85 / 70                 | 15 / 5                | 50 / 30              | 35 % | 4      | 1.8 / 4.2 / 7.5 s                | 1.8-9 s + 0.5 s          | 45            | Mon-Fri   |
| struggling | 60 / 45                 | 5 / 0                 | 25 / 10              | 20 % | 6      | 4.3 / 6.7 / 10 s                 | 4.3-11.5 s + 0.8 s       | 35            | 4 days    |
| slow       | 85 / 70                 | 15 / 5                | 50 / 30              | 35 % | 4      | 4.5 / 7 / 9 s                    | 4.5-10 s + 0.9 s         | 35            | Mon-Fri   |

**Why these numbers.**

- **Priors.** The Czech 2nd grade teaches the tables of 2-5 and 10, with 0 and 1 as rules. A fact
  with either factor in those tables is review: `7 · 2` is in the table of 2. Division is
  practised less, so it starts lower.
- **The struggling child** follows testing.md §4: it needs many exposures, forgets quickly, is
  slow and often misses the 6-9 tables.
- **The slow child** knows and learns like the average child but is never quick. It tests that
  gold needs quick answers.
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
its stretch goal. It was first held to the band itself; the rules changes of §5.1 are measured
against the new target.

**And a steady path instead of the whole valley.** The coordinator's decision for 1.2.0: "The
plan's intent was 'no dead-end unlocks; the struggling bot still progresses', not 'finishes the
curriculum in 12 weeks'. For a struggling child, success matters more than speed, and more
protection means slower progress by design." So the struggling child is not held to every level
and boss in 12 weeks (the perfect, average and slow children still are). It must keep moving:

- no stall: while levels remain, every week with play completes at least one new level;
- the boss of every region whose lessons it finished is won over (lessons finished in the run's
  last week may still have the boss ahead);
- a regression floor: at least 45 of the 59 levels (¾) within the 84 days.

Its full completion is reported as measured.

## 4. Results

Spreads are min / median / max over the sessions played. "Due" counts known facts whose review
day had come when a session began, over the last 10 sessions.

**Scope note.** The runs below counted every fact answered right at least once as known. The
checks now count only facts at bronze and up (Leitner box 2+): facts in box 0-1 are still being
learned and are served as learning items (the coordinator's decision on the no-starving scope).
The 1.2.0 balance PR refreshes these tables with that scope.

### 4.1 Current balance (content 1.1.0)

| Child      | Sessions | Success | Success per session | Quick | Valley done | Table dragons adult | Crowned | Window dim / bronze / silver / gold | Division panel   | Due             | Longest overdue |
| ---------- | -------- | ------- | ------------------- | ----- | ----------- | ------------------- | ------- | ----------------------------------- | ---------------- | --------------- | --------------- |
| perfect    | 84       | 100 %   | 100 / 100 / 100 %   | 100 % | day 14      | 10 of 11            | 5       | 2 / 0 / 0 / 119                     | 5 / 0 / 0 / 105  | 18 / 22 / 28    | 74 days         |
| average    | 60       | 83 %    | 63 / 84 / 95 %      | 63 %  | day 23      | 3 of 11             | 0       | 8 / 0 / 21 / 92                     | 27 / 6 / 21 / 56 | 39 / 46 / 71    | 68 days         |
| struggling | 48       | 41 %    | 17 / 37 / 80 %      | 0 %   | day 36      | 0 of 11             | 0       | 119 / 2 / 0 / 0                     | 110 / 0 / 0 / 0  | 187 (all)       | 60 days         |
| slow       | 60       | 78 %    | 56 / 80 / 95 %      | 0 %   | day 30      | 0 of 11             | 0       | 34 / 7 / 80 / 0                     | 46 / 4 / 60 / 0  | 120 / 132 / 153 | 58 days         |

| Child      | Coins per session | Coins by source (12 weeks)                                      | Daily goal | Stickers | All cosmetics owned |
| ---------- | ----------------- | --------------------------------------------------------------- | ---------- | -------- | ------------------- |
| perfect    | 77 / 103 / 327    | answers 4228, stars 2040, quests 1934, streaks 1404, gifts 1273 | 84 of 84   | 52       | day 14              |
| average    | 65 / 105 / 231    | answers 2947, quests 1245, stars 1055, gifts 824, streaks 532   | 58 of 60   | 48       | day 23              |
| struggling | 7 / 26 / 143      | answers 1244, quests 455, stars 420, bosses 270, streaks 36     | 2 of 48    | 38       | day 38              |
| slow       | 29 / 69 / 176     | answers 2313, stars 705, quests 703, gifts 612, streaks 378     | 41 of 60   | 45       | day 30              |

Failing checks:

- average: tables mastered (3 of 11 adult), no starving (68 days) and coins (median 105);
- struggling: success (median 37 %, at least 60 % needed; 2 of 48 sessions at 70-90 %), weekly
  progress (6 of 12 weeks), no starving (60 days) and coins (median 26);
- slow: no starving (58 days).

### 4.2 Proposed balance (§6)

| Child      | Sessions | Success | Success per session | Quick | Valley done | Table dragons adult | Crowned | Window dim / bronze / silver / gold | Division panel   | Due             | Longest overdue |
| ---------- | -------- | ------- | ------------------- | ----- | ----------- | ------------------- | ------- | ----------------------------------- | ---------------- | --------------- | --------------- |
| perfect    | 84       | 100 %   | 100 / 100 / 100 %   | 100 % | day 14      | 10 of 11            | 5       | 1 / 0 / 0 / 120                     | 8 / 0 / 0 / 102  | 3 / 4 / 6       | 66 days         |
| average    | 60       | 80 %    | 60 / 82 / 97 %      | 51 %  | day 23      | 11 of 11 (day 79)   | 0       | 0 / 2 / 52 / 67                     | 0 / 6 / 56 / 48  | 17 / 20 / 58    | 40 days         |
| struggling | 48       | 39 %    | 10 / 37 / 77 %      | 0 %   | day 38      | 0 of 11             | 0       | 103 / 4 / 14 / 0                    | 105 / 1 / 4 / 0  | 167 / 170 / 174 | 55 days         |
| slow       | 60       | 78 %    | 47 / 77 / 92 %      | 0 %   | day 30      | 2 of 11             | 0       | 10 / 1 / 110 / 0                    | 22 / 13 / 75 / 0 | 13 / 28 / 52    | 59 days         |

| Child      | Coins per session | Coins by source (12 weeks)                                    | Daily goal | Stickers | All cosmetics owned |
| ---------- | ----------------- | ------------------------------------------------------------- | ---------- | -------- | ------------------- |
| perfect    | 62 / 86 / 304     | answers 4170, stars 2040, quests 1870, gifts 730, streaks 693 | 84 of 84   | 52       | day 14              |
| average    | 49 / 105 / 207    | answers 3115, quests 1341, stars 1275, gifts 427, streaks 234 | 59 of 60   | 50       | day 23              |
| struggling | 4 / 26 / 133      | answers 1164, stars 410, quests 398, bosses 270, streaks 20   | 1 of 48    | 40       | day 39              |
| slow       | 23 / 71 / 184     | answers 2412, quests 856, stars 835, gifts 270, streaks 170   | 37 of 60   | 47       | day 30              |

Changes in the checks:

- **Now passing.**
  - average: tables mastered (all 11 adult, the last on day 79);
  - struggling: weekly progress (12 of 12 weeks; panes light up).
- **Still failing.**
  - average: no starving (40 days) and coins (median 105; after the valley the median is 86);
  - struggling: success (median 37 %), no starving (55 days) and coins;
  - slow: no starving (59 days).
- **Changed with the run's path.** The struggling child's Mirror egg hatches after 8 sessions
  (3 before), which fails hatch pace. Mirror's facts are all rule facts (§5.2), so it depends on
  how often they are drawn.

## 5. Findings the balance block cannot fix

These go to S2b (rules and content) and to the design.

1. **The struggling child is flooded.**
   - The Daily Adventure serves new levels one after another, and a level completes with one star
     at any accuracy. The struggling child finishes the valley by day 36-38, nearly three new
     levels a session.
   - Its answer records (`--answers`, proposed balance, 1,972 answers) show where the misses come
     from:
     - 66 % of its answers are due reviews, right 37 % of the time. Three quarters of those are
       facts in box 1 (missed, or right only once), due again the next day: right 32 %.
     - 63 % are snacks, right 35 %. Every dragon is hungry every day, and a snack serves the most
       overdue facts first.
     - 55 % are facts it recalls below 25, where it can only guess.
     - Success falls as the material piles up: 67 % in week 1, 46-52 % in weeks 3-5 and 27-36 %
       from week 6. Sessions then start with 170-187 facts due, and the daily goal is reached
       once or twice in 48 sessions.
   - No balance candidate moved its median above 40 %: longer intervals, a wider "ok", or both.
   - The cause in the rules (found by S2b from these numbers): the mix counts every due fact as a
     likely success, even one missed last time. When success is low the learning share shrinks
     to 10 %, so about 90 % of draws go to the most overdue misses. Snacks have no success control
     at all.
   - Two prototypes, measured but not merged (proposed balance; median success per session):
     - Due facts in box 0-1 drawn as learning items, in mixed rounds and snacks: struggling 37 %
       (over all its answers 39 → 43 %); slow 77 → 80 %. It also slowed the perfect child's dragons
       (adult 10 → 7), because box 1 also holds facts just answered right for the first time.
     - The same, plus pacing (after the day's first level, another new level only while today's
       success is at least 70 %): struggling 46 %, valley done on day 81 instead of 38. The average
       and slow children stay inside their targets.
   - Neither reaches 60 %: at 140 answers a week this model cannot hold the year's ~230 facts at
     the valley's pace.
   - **Decided** (the coordinator, for S2b's rules change):
     - the mix fix keyed on "the last answer was a miss", not the box;
     - pacing: a further new level today only while today's success is at least 70 %;
     - choice input and the picture model first for a fact missed again and again, while
       success is low;
     - smaller snack rounds and fewer new facts while success is under target.
   - **Acceptance**: the struggling child's session median at least 60 % (stretch 70-90 %, §3),
     every other child inside its targets. The balance PR re-measures on the changed rules.
2. **Rule facts block growth.**
   - n · 0, n · 1, 0 : n and n : 1 are served at most once per round outside the 0 and 1 levels.
     Yet they are 4 of the 21 facts of every table dragon and most of Mirror's set.
   - They are most of the facts still dim at the end, even for the perfect child: 5 · 1, 3 : 1,
     4 : 1, 7 : 1, 8 : 1, 0 : 8 and 0 : 9.
   - Adult needs 90 % silver and crowned 100 % gold, so they hold dragons back. The perfect child
     crowns only 5 of 11 times-table dragons in 12 weeks, and one never becomes adult (Ember with
     the current balance, Mirror with the proposed one). With the proposed balance the struggling
     child's Mirror egg takes 8 sessions to hatch.
3. **A fact a level never drew is never introduced later.**
   - Snacks and boss reviews serve only facts answered right before.
   - A child who earns 3 stars everywhere never replays a level. The perfect child answers 48 : 6
     and 49 : 7 at most once in 12 weeks; with the current balance 18 : 6, 36 : 6, 35 : 7 and
     20 : 10 too. They stay dim.
4. **Facts no dragon owns are never reviewed, except by replays.**
   - These are comparisons, terms and most word families: no snack serves them.
   - The longest waits past the review day:
     - compare:fact-number: 68 days at a session start (average, current balance), 40 days with the
       proposed balance;
     - at the end of the 12 weeks, word:fewer-than had waited 61 days and terms:factor 59 (average,
       current balance).
   - This is the main reason the no-starving check fails for every child.
5. **Coins and the market.**
   - The design expects 50-80 coins a session. Valley sessions earn medians of 144 (average) and
     272 (perfect).
   - Most of it is level stars (lessons 5/10/15, bosses 10/20/30), the boss bonus, and quests
     (about 21 a session).
   - All 42 cosmetics are owned the day the valley ends: day 14, 23, 30 or 38, mostly from level
     rewards and gifts. After that the coins have no use: the average child ends with over 6,000.
   - The balance block trims what it can (§6). The rest needs smaller star and quest coins, more
     or pricier cosmetics, a coin sink, or a restated target.
6. **Pace.** The valley takes 14-38 days. A child meets the four new tables (6-9) within about two
   weeks. The design should confirm this is intended.

## 6. The balance change

PR C changes only these values in the content `balance` block. The run in §4.2 used this
override:

```json
{
  "leitner": { "intervals": [0, 1, 2, 4, 8, 16] },
  "response": { "choice": { "okMs": 9000 }, "keypad": { "okMs": 11000 } },
  "coins": { "streakBonus": 1 },
  "gift": { "coinsMin": 5, "coinsMax": 15 }
}
```

| Value                    | Current          | Proposed          | Why                                                                                                                                                                                                                                                          | Measured effect                                                                                                          |
| ------------------------ | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `leitner.intervals`      | 0, 0, 1, 2, 4, 8 | 0, 1, 2, 4, 8, 16 | With at most 8 days between reviews, ~250 facts need ~30 reviews a day just to stay known. That is most of a 45-answer session. Doubling intervals are the standard Leitner schedule. Box 1 waits a day: a fact is never due again the day it was practised. | Average: due 46 → 20, every table dragon adult (3 → 11), no dim facts. Slow: due 132 → 28.                               |
| `response.choice.okMs`   | 6000             | 9000              | A right answer slower than "ok" never moves its box. A child who answers right in 6-9 s never lights a pane: the struggling child had 2 bronze panes after 12 weeks. Gold still needs quick answers (`fastMs` unchanged), so fluency is still required.      | Struggling: 18 silver panes (was 0), progress every week (was 6 of 12). Slow: 185 silver panes (was 140), still no gold. |
| `response.keypad.okMs`   | 8000             | 11000             | Same reason for typed answers; the extra 0.7 s per digit stays.                                                                                                                                                                                              | (with the line above)                                                                                                    |
| `coins.streakBonus`      | 2                | 1                 | Coins have no use once the market is empty. The bonus still comes every 5 in a row, and so does the proud dragon.                                                                                                                                            | Streak coins halved.                                                                                                     |
| `gift.coinsMin/coinsMax` | 10-25            | 5-15              | After the valley every gift is coins.                                                                                                                                                                                                                        | Average after the valley: 89 → 86 coins a session. Perfect: 100 → 83.                                                    |

**Kept on purpose.**

- `fastMs` (2.5 s / 3.5 s) and `mastery` keep gold tied to quick answers.
- `mix` keeps the average child at a median of 82 % success, in the band.
- `growth`: lowering adult to 80 % would hide the rule-fact finding (§5.2), not fix it.
- `daily.goalAnswers`: the struggling child reaches 30 right answers once in 48 sessions. That is
  better solved by §5.1 than by lowering the goal for everyone; parents can lower it.

**Decided.** Widening "ok" relaxes the design's "correct but slow stays" line (§6.2): answers of
6-9 s now move boxes up to silver. The coordinator approved it: spaced retrieval should promote a
right answer, and fluency is rewarded separately by gold, crowned dragons and three stars, which
stay tied to `fastMs`. The balance PR rewords design §6.2 accordingly.

## 7. Limits

- **The model.**
  - No real child learns like these models: the numbers compare balances, they do not predict a
    classroom.
  - Boards do not teach the model anything.
  - Each knowledge key is independent: knowing 7 · 8 does not help with 56 : 7.
  - The response times are assumptions. A slow reader below the "ok" limits behaves like the
    average child.
- **One seed.** Every run uses the seed `simulation`. Single checks near a threshold can move with
  the path (hatch pace in §4.2), and the band checks have some margin.
- **Cost.** A simulated child costs about 30 ms a commit with the v1 pack and the Aegis SDK of #20
  (50-200 ms before it), so the 12-week runs stay outside the gate. A scheduled CI job running
  `node scripts/simulate.mjs --check` would catch balance and content regressions.
