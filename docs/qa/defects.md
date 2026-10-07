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

| ID       | Severity | Owner | Summary                                                                               |
| -------- | -------- | ----- | ------------------------------------------------------------------------------------- |
| DV-QA-05 | minor    | S3    | WebKit: the grown-ups' Settings still scroll sideways on a phone (voice list)         |
| DV-QA-13 | minor    | S3    | WebKit, sometimes Chromium: a keeper's hub at 200 % text appears at normal size first |
| DV-QA-15 | minor    | S3    | WebKit: the keeper pictures lose their focus ring under the arrow keys                |
| DV-QA-16 | minor    | S3    | Two announcements within 40 ms: only the second is heard (intermittent)               |

### DV-QA-05 (minor, S3; WebKit): the grown-ups' Settings still scroll sideways on a phone

- **Repro** (Safari, or Playwright's WebKit 26.6; 390 × 844 with local English voices): the
  grown-ups' area, Settings.
- **Expected**: no sideways scrolling (WCAG 1.4.10).
- **Actual**: #19 fixed this in Chromium and Firefox (single-column grids, a voice list that can
  shrink), and in WebKit the panel now fits too, but the page is still 511 px wide, with blank sky
  to the right of the panel. The voice list's box is 335 px and fits; WebKit counts the text of
  its longest option, "Device default (English (United Kingdom))" (about 483 px from the list's
  left edge), in the page's scrollable width. Hiding the list, or shortening that option, brings
  the page back to 390 px. Nothing is cut off any more, hence minor (it was major).
- **Likely fix** (tried in WebKit): `.dv-select { contain: paint; }`, or `overflow: clip` on the
  row around it; `overflow: hidden` on the select itself has no effect in WebKit.
- **Evidence**: `test/e2e/screens.spec.ts` stops `26-parent-settings` and `44-settings-saved`
  (phone, WebKit: "the page scrolls sideways: 511px of content in 390px").

### DV-QA-13 (minor, S3; WebKit, sometimes Chromium): a keeper's hub at 200 % text first appears at normal size

- **Repro** (Playwright's WebKit 26.6, on Windows, and on the Ubuntu runner before #19): give a
  keeper Text size **200%** in the grown-ups' area, then open that keeper from "Who is playing?".
- **Expected**: the hub appears at 200 %, as in Chromium and Firefox (6 of 6 openings each).
- **Actual** (at `0827c3a`, after #19): in 6 of 6 openings the hub's text is drawn at its normal
  size first. The greeting is 43.2 px, not 86.4 px, for 140-435 ms, then everything jumps to
  200 %. `<html>` already carries the scale (`--aegis-text-scale: 2`, `data-text-scale="2"`), yet
  its computed size is still 24 px in 2 of 6. #19 mirrors the scale in `data-text-scale` so that
  WebKit restyles the root, but no rule reads that attribute, so it restyles nothing; the root's
  size is right more often since, the text below it is not. Two further tries, through a test
  shim and not in the game: setting the root's `font-size` inline whenever the scale changes
  changed nothing; forcing a style and layout flush right after it made the root right in 6 of 6,
  but the hub's text still lagged 145-185 ms. WebKit keeps the newly mounted screen's text styled
  against the old root size until its next rendering update.
- **Also in Chromium, sometimes**: on CI the root was still 24 px as the hub
  appeared in 2 of the last 4 Chromium runs of the test (runs 37562539633, main after #26, and
  37564290512, #28), while Chromium is right at once on every other run and locally. So the cause
  is not WebKit's alone: the hub is shown before the keeper's text size has taken effect, and a
  slower engine or a busy machine lets a frame through. The registry marks it as always open in
  WebKit and intermittent in Chromium (a run without it is noted, not taken for a fix); Firefox
  has always been right at once and stays strict.
- **Ideas** (untested): keep the new screen hidden until the next animation frame after a text
  size change (e.g. `visibility: hidden` on the stage until `requestAnimationFrame`), so no child
  sees it at the wrong size; or apply the keeper's presentation earlier, before "Who is playing?"
  starts the change of screen. Minor: the setting is never lost, but a 200 % reader sees small
  text flash for up to half a second whenever their keeper opens.
- **Evidence**: `test/e2e/reflow.spec.ts` › "a keeper's text at 200 %…" compares the root and the
  greeting as the hub appears with the same hub at 100 %; where it shows, it records how long until
  200 % (`DV-QA-13 evidence` in the job summary).

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

### DV-QA-16 (minor, S3; intermittent): two announcements within 40 ms, only the second is heard

- **Seen** on CI (WebKit, run 37551404338) at the end of the placement check: the results
  appeared with their heading focused, but the polite announcer said "You got 11 coins!" (the
  last answer's coins) instead of "The dragons saw what you know!".
- **Cause**: `ui/announcer.ts` empties the region and writes a message 40 ms later; a second
  `announce()` inside those 40 ms cancels the first (`clearTimeout`), so only the last of two
  close messages is ever written. And the coin counter (`ui/meters.ts`, `gain`) announces only
  after its coins have flown (up to about 1 s for five coins), which the round does not wait for
  before moving on: on a slow device the last answer's coin line lands as the results appear.
- **Expected**: each message is heard, in order (plan §2.11).
- **Likely fix**: queue messages (write the next one after the previous has been written), or
  join messages that arrive together; and announce the coins when they are earned, not when the
  last coin lands (or drop the line once its screen is gone). Minor: the results' heading takes
  focus, so a screen reader still reads it there; it is the live line that is lost.
- **Evidence**: `test/e2e/live.spec.ts` › "a round speaks its feedback…": the results headline must
  be announced politely. It depends on timing, so the defect is marked `intermittent`: a run where
  the line is heard is noted as "not seen this time", not as a fix.

## Fixed

Each was verified fixed by the suite in Chromium (Edge), Firefox and WebKit, and its assertion now
runs as a regression check. (DV-QA-05 is fixed in Chromium and Firefox and stays open for WebKit;
DV-QA-13 stays open for WebKit and, sometimes, Chromium.) The full write-ups (repro, cause,
suggested fix) are in this file's
history: `git log -p -- docs/qa/defects.md`.

| ID       | Was                                                                                       | Fixed by | Regression check                                                                         |
| -------- | ----------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| DV-QA-01 | After a failed save and Retry, the stored answer was never praised; the round stood still | #19      | `recovery.spec.ts` › a failed save says "Not saved"…                                     |
| DV-QA-02 | "You got 1 coins!", "1 coins": no singular                                                | #19      | `live.spec.ts` › "a round speaks its feedback…" ("You got 1 coin!")                      |
| DV-QA-03 | Enter was ignored when a round opened on a keypad problem (phase-1 shell)                 | #13      | `input.spec.ts` › "a round that opens on a keypad problem takes Enter from the keyboard" |
| DV-QA-04 | Retry in the "Not saved" pill was 40 px tall                                              | #19      | layout checks at `screens.spec.ts` stop `41-save-failed`                                 |
| DV-QA-06 | Words and numbers broke inside narrow boxes (200 % tiles "1" over "8"; phone egg labels)  | #19      | layout checks in `reflow.spec.ts` (`text-200`) and at stop `05-story-eggs` (phone)       |
| DV-QA-07 | A missed tile's badge pushed the round sideways at 200 % (phase-1 shell)                  | #13      | layout checks in `reflow.spec.ts` (`text-200`, `16-round-choice`)                        |
| DV-QA-08 | Screens' focus targets dropped out of the Tab order and lost their ring                   | #19      | `keyboard.spec.ts`: the editor (by pixels) and the error screen                          |
| DV-QA-09 | Enter after a click on Read aloud re-read the problem instead of sending the answer       | #19      | `input.spec.ts` › "Enter still sends the answer after the child used Read aloud"         |
| DV-QA-10 | At 200 % text on a phone the hub and the Egg Grid scrolled sideways                       | #19      | layout checks in `reflow.spec.ts` (`text-200`, phone)                                    |
| DV-QA-11 | Map and road hotspots were cut off by the picture's frame                                 | #19      | layout checks at stops `13-map` and `14-region`, and in `reflow.spec.ts`                 |
| DV-QA-12 | The placement results celebrated the prologue's egg as "A new egg"                        | #17      | `persistence.spec.ts` › "a finished round is kept…"                                      |
| DV-QA-14 | The results' scrolling celebrations could not be reached by keyboard (axe, serious)       | #19      | axe at `screens.spec.ts` stop `11-round-results` (tablet and phone)                      |

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
- The finale ends like any boss level: "Level complete! The Seven-Headed Dragon, 21 of 21 right",
  a new egg (the Seven-Headed Dragon) and the sticker "Seven Heads Cured"; the finale's own
  celebration is phase 3 (docs/app.md §16).
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
