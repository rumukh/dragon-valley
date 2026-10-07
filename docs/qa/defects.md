# Defects found by the QA suite

Product defects found by the end-to-end suite, reported to the coordinator for routing. Each open
defect is pinned by a test that states the behaviour the game should have; while it reproduces,
the test records it (a `known defect` annotation in the report and the CI job summary) and goes
on. When a fix lands the same assertion passes and the summary lists the marker under "fixed?";
once the fix is verified on every engine the defect leaves the registry and its assertion stays
as a plain regression check. The registry is `DEFECTS` (with `KNOWN_LAYOUT` for layout findings)
in `test/e2e/support/known-issues.ts`, and `KNOWN_AXE` in `test/e2e/support/a11y.ts` for axe
findings. A full run also lists the registered defects no test met, so an allowance cannot
outlive its defect unnoticed.

Severity: **blocker** stops a release; **major** breaks a promised behaviour for some children or
devices; **minor** is a rough edge. Engines: all three unless stated.

## Open

| ID       | Severity | Owner | Summary                                                                            |
| -------- | -------- | ----- | ---------------------------------------------------------------------------------- |
| DV-QA-13 | minor    | S3    | WebKit, intermittent: a keeper's hub at 200 % text comes into sight at normal size |
| DV-QA-15 | minor    | S3    | WebKit: the keeper pictures lose their focus ring under the arrow keys             |
| DV-QA-19 | minor    | S3    | The hub says "Bubbles's egg"; the copy brief writes "Bubbles' egg"                 |

### DV-QA-13 (minor, S3; WebKit, intermittent): a keeper's hub at 200 % text first comes into sight at normal size

- **Repro** (Playwright's WebKit 26.6): give a keeper Text size **200%** in the grown-ups' area,
  then open that keeper from "Who is playing?".
- **Expected**: the hub comes into sight at 200 %. After #49 Chromium does (6 of 6 openings:
  the stage stays transparent for 7 frames, until the hub is restyled), and Firefox always has.
- **Actual** (at `44ab948`, after #49): in WebKit, 6 of 8 openings still show the hub at 100 %
  first. Frame by frame: the hub is mounted and the stage gets `data-restyling="true"` in the same
  task, yet at the first animation frame the stage's computed opacity is still 1 and the greeting
  computes at 43.2 px, not 86.4 px. At the next frame the stage is transparent and the greeting
  86.4 px; the stage turns opaque again once the hub's own size is 48 px. WebKit applies the
  attribute rule (`.dv-stage[data-restyling='true'] { opacity: 0 }`) a frame late: exactly the
  frame drawn at the old size. In 2 of 8 the stage was transparent from the first frame. The page
  cannot tell what was painted; this is the same computed-style evidence the defect was found by.
- **Before #49** (at `0827c3a`): 6 of 6 WebKit openings drew the greeting at 43.2 px for
  140-435 ms, and Chromium on CI sometimes did too (2 of 4 runs).
- **Likely fix**: make the stage transparent, and flush its style, before the new screen is
  inserted: set `data-restyling` when `applyPresentation` sees the scale change (or just before
  `replaceProjection`), then read `getComputedStyle(stage).opacity` so WebKit applies the rule
  before the screen's first frame. Minor: the setting is never lost, but a 200 % reader can see
  small text for a frame or so whenever their keeper opens.
- **Evidence**: `test/e2e/reflow.spec.ts` › "a keeper's text at 200 %…" watches every animation
  frame from the tap on the keeper and keeps the sizes at the first frame the greeting is in sight
  (it and its ancestors at least half opaque), against the same hub at 100 %; the job summary
  records them (`DV-QA-13 evidence`, with the frames it was kept out of sight). Chromium and
  Firefox check it strictly; in WebKit it is marked intermittent (a run without it is noted, not
  taken for a fix).

### DV-QA-15 (minor, S3; WebKit): the keeper pictures lose their focus ring under the arrow keys

- **Repro** (Safari, or Playwright's WebKit 26.6): in the keeper editor, Tab to the pictures (the
  focused picture shows its dark ring), then press an arrow key.
- **Expected**: the picture the arrow moved to shows the focus ring, as in Chromium and Firefox.
- **Actual**: no focus ring; only the violet "chosen" ring and dot, which move with the choice.
  WebKit does not match `:focus-visible` on a radio that an arrow key focused, and the pictures
  draw their ring only for it (`.dv-avatar-choice:has(input:focus-visible)`, `screens.css`). It is
  WebKit's own behaviour: a plain page with three radios does the same (focus-visible true after
  Tab, false after each arrow that moves, true again after a key press that does not move). The
  choice is still visible and the next Tab or Shift+Tab brings the ring back, hence minor.
- **Likely fix**: show the ring while the keyboard is in use, not only for `:focus-visible`: for
  example mark the picker on an arrow keydown and unmark it on pointerdown, and style
  `.dv-avatar-picker[data-keys] .dv-avatar-choice:has(input:focus)`. (The pictures are the only
  native radio group in the game; the grown-ups' choices are buttons.)
- **Evidence**: `test/e2e/keyboard.spec.ts` › "the keeper editor by keyboard alone › the pictures
  are one named radio group…" (the ring by pixels after the arrows; strict in Chromium and
  Firefox).

### DV-QA-19 (minor, S3): the hub says "Bubbles's egg"

- **Repro** (any engine, main at `22cdedc`): make a new keeper and choose Bubbles, the first of
  the three eggs.
- **Expected**: the nest's caption and its picture's name say "Bubbles' egg". This is the copy
  brief's own example (the coordinator's PR C request): a name ending in "s" takes only the
  apostrophe.
- **Actual**: "Bubbles's egg", both under the egg and as the picture's accessible name. The same
  rule gives the hatching art's label "Bubbles's egg wobbles and cracks." (`hatch.hatching`, while
  the egg cracks) and the screen-reader list of other dragons on the hub's "My dragons" button
  (`stage.egg` again, while Bubbles is still an egg and another dragon is featured). The cause is
  `content/catalogs/en.ui.json`, `stage.egg` ("{name}'s egg") and `hatch.hatching` ("{name}'s egg
  wobbles and cracks."), which add "'s" to every name. Bubbles is the only dragon whose name ends
  in "s". No word-problem name does, so S2b's `word.grouping.holiday` ("{name}'s holiday") reads well.
- **Likely fix**: form possessives in one place, for example a `possessive(name)` helper (add "'"
  after a final "s", otherwise "'s"). Pass its result as an `{owner}` parameter (`"{owner} egg"`)
  to `stage.egg` and `hatch.hatching`. The grown-ups' texts that name a keeper
  (`parent.keepers.removeBody`, `parent.data.*`, `parent.progress.unreadable`,
  `parent.print.hardestTitle`, `recovery.game`, `recovery.preferences`) would then read
  "Jonas' dragons" for a keeper called Jonas, the same as the children's screens. Minor: the
  meaning is clear, but it is the first dragon most children meet, and the form contradicts the brief.
- **Evidence**: `test/e2e/first-run.spec.ts` › "the nest says whose egg it is…" (the picture's
  accessible name and the hub's text). "Sunny's egg" and "Goldie's egg" are checked strictly in the
  same file. Details: [copy-review.md](copy-review.md), "Possessives".

## Fixed

Each was verified fixed by the suite in Chromium (Edge), Firefox and WebKit, and its assertion now
runs as a regression check. (DV-QA-13 is fixed in Chromium by #49 and stays open for WebKit.) The full
write-ups (repro, cause, suggested fix) are in this file's history:
`git log -p -- docs/qa/defects.md`.

| ID       | Was                                                                                          | Fixed by | Regression check                                                                                           |
| -------- | -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| DV-QA-01 | After a failed save and Retry, the stored answer was never praised; the round stood still    | #19      | `recovery.spec.ts` › a failed save says "Not saved"…                                                       |
| DV-QA-02 | "You got 1 coins!", "1 coins": no singular                                                   | #19      | `live.spec.ts` › "a round speaks its feedback…" ("You got 1 coin!")                                        |
| DV-QA-03 | Enter was ignored when a round opened on a keypad problem (phase-1 shell)                    | #13      | `input.spec.ts` › "a round that opens on a keypad problem takes Enter from the keyboard"                   |
| DV-QA-04 | Retry in the "Not saved" pill was 40 px tall                                                 | #19      | layout checks at `screens.spec.ts` stop `41-save-failed`                                                   |
| DV-QA-05 | The grown-ups' Settings scrolled sideways on a phone (last in WebKit: the voice list)        | #19, #41 | layout checks at `screens.spec.ts` stops `26-parent-settings`, `44-settings-saved` (phone)                 |
| DV-QA-06 | Words and numbers broke inside narrow boxes (200 % tiles "1" over "8"; phone egg labels)     | #19      | layout checks in `reflow.spec.ts` (`text-200`) and at stop `05-story-eggs` (phone)                         |
| DV-QA-07 | A missed tile's badge pushed the round sideways at 200 % (phase-1 shell)                     | #13      | layout checks in `reflow.spec.ts` (`text-200`, `16-round-choice`)                                          |
| DV-QA-08 | Screens' focus targets dropped out of the Tab order and lost their ring                      | #19      | `keyboard.spec.ts`: the editor (by pixels) and the error screen                                            |
| DV-QA-09 | Enter after a click on Read aloud re-read the problem instead of sending the answer          | #19      | `input.spec.ts` › "Enter still sends the answer after the child used Read aloud"                           |
| DV-QA-10 | At 200 % text on a phone the hub and the Egg Grid scrolled sideways                          | #19      | layout checks in `reflow.spec.ts` (`text-200`, phone)                                                      |
| DV-QA-11 | Map and road hotspots were cut off by the picture's frame                                    | #19      | layout checks at stops `13-map` and `14-region`, and in `reflow.spec.ts`                                   |
| DV-QA-12 | The placement results celebrated the prologue's egg as "A new egg"                           | #17      | `persistence.spec.ts` › "a finished round is kept…"                                                        |
| DV-QA-14 | The results' scrolling celebrations could not be reached by keyboard (axe, serious)          | #19      | axe at `screens.spec.ts` stop `11-round-results` (tablet and phone)                                        |
| DV-QA-16 | Two announcements within 40 ms: only the second was heard (the results' headline lost)       | #41      | `live.spec.ts` › "a round speaks its feedback…" (the headline heard; S3's announcer unit test queues them) |
| DV-QA-17 | Memory Match's term cards did not show which number of the example was meant                 | #46      | `activities.spec.ts` › "Memory Match term cards…": the example marks its number and says which             |
| DV-QA-18 | A missed × 0 fact was sent to "Look first!" and "Look at the picture first", with no picture | #45      | `teach.spec.ts` › "a × 0 fact asked again…" and "…taught…": the rule drawn as plates, first                |

### The coordinator's Region 1 playtest (the deployed `5848964`)

Found by hand and fixed before the suite pinned them; `playtest.spec.ts` now holds each one on
every engine (measured on Edge, Chromium, Firefox and WebKit before it was merged):

| Finding                                                                                                                          | Fixed by | Regression check (`playtest.spec.ts`)                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Riddle Scrolls' sign step showed number tiles under "Which sign do we need?" and marked the right number a miss (Sunny Meadow 6) | #14, #17 | "Sunny Meadow 6: …": every story asks its sign on sign tiles only (`+ − · :`), then its number; both answers praised                                                                      |
| The hub, the results and the Egg Grid needed page scrolling at 1180 × 820 and 1024 × 768                                         | #17      | "on a tablet …": the hub, the Egg Grid, a round, each hatch and the results at both sizes (with `profiles.spec.ts`, which plays at 1024 × 768)                                            |
| The hatched dragon was small among the results' words                                                                            | #17      | "on a tablet …": at least 200 px each way, wholly on screen, no word on it (Bubbles measured 365 × 400 px at 1180 × 820, 318 × 348 px at 1024 × 768)                                      |
| A change of screen showed an empty sky for a moment (the new screen faded in from nothing)                                       | #17      | "a change of screen …": a journey of 24 steps through every kind of screen, never blank for more than 300 ms (none blank at all), Chromium with a 4× slower processor; also a whole level |

## Observations for design review (not defects)

- A new keeper's placement results also award "Dressed Up" (criterion: owns one cosmetic) before
  the child has dressed anything; the cosmetic comes with the levels the check skips. The name
  promises an outfit (S2b content).
- At 200 % text the problem itself is capped by the viewport (`.dv-problem` uses
  `min(3rem, 11vw)`, `min(2rem, 7.5vw)` for long problems), so on a phone it is smaller than the
  prompt and buttons around it.
- Feedback no longer waits on a slow save (#19: the praise comes when the answer is saved, or 250 ms
  after it is committed if saving takes longer). Measured since ([performance.md](performance.md)):
  with the processor four times slower the save takes 130-160 ms and the feedback follows at
  150-190 ms, inside the patience; `perf.spec.ts` holds the median to 500 ms.
- axe reports only moderate findings: `region` (toasts, the announcer and the
  boot status sit outside landmarks) and `page-has-heading-one` on the startup failure screen.
- Remainder mode (`4 r 3` / `4 R 3`) is played both ways since v1: typed in the leftover Sharing
  Feast (`boards.spec.ts`), tapped in Leftover Lagoon 2's Feeding Time (`regions.spec.ts`).
- A mixed round serves a keeper who is still learning their focus egg's facts first
  (`selection.ts`, `pickLearning`). With regions opened early, a new keeper's Dragon Castle 3
  (seven skills: tables, division, remainders, two-digit × one-digit, the order of operations,
  comparisons, stories) asked only × and : facts in 14 problems, eight of them the 2-table of their
  first egg. Fine for a child who arrives there by play; worth a look for children whose grown-ups
  open regions early (S2b).
- The finale's level ends like any boss level: "Level complete! The Seven-Headed Dragon, 21 of 21
  right", a new egg (the Seven-Headed Dragon) and the sticker "Seven Heads Cured"; since #29 the
  finale beat also shows every head cured and the Magic Window whole again (S3's
  `finale.spec.ts`).
- The keeper pictures are a sound radio group for keyboards and screen readers: the group is named
  "Pick your keeper", each radio by its description ("A short bob and a star pin"), the checked
  state is exposed, Tab enters at the chosen picture, arrows and Space choose, and the choice is
  the keeper's picture afterwards (Chromium and Firefox wrap at the ends, WebKit stops: native).
  Each radio is a 1 px transparent input in the middle of its picture, so a click or tap anywhere
  else lands on the label, which checks it (fine). A screen reader exploring by touch lands on the
  label too, not the radio: Chromium's accessibility hit test at 20 % / 30 % of a picture finds a
  nameless `LabelText`; only the exact centre finds the radio. A double tap on the label still
  checks it, but VoiceOver and TalkBack were not tried; stretching the transparent input over the
  whole picture (inset 0, above the art) would make every touch land on the radio itself.
- In a keypad round at tablet size the prompt "Type the answer." stands on the painted sky with no
  backdrop, where the scene's birds fly: one crosses its "T", so it reads like a strikethrough
  (screens `07-round-keypad` and `10-round-miss`, tablet). The choice round's prompt sits lower and
  stays clear. A backdrop like the other text panels, or birds outside the space the UI uses,
  would fix it (S3, or S4 for the art).
- A board move sent while the previous one is still being saved is dropped without a sign
  (`src/app/screens/minigames.ts`, `context.move`: `if (busy) return false`). The window is a few
  milliseconds on a healthy save but up to 250 ms on a slow device, so a quick second tap on Deal
  can be lost. Queueing the move, or showing the board as busy, would fix it (S3). The test
  helpers wait for each move to be taken (`support/boards.ts`).
