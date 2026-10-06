# Defects found by the QA suite

Product defects found by the end-to-end suite, reported to the coordinator for routing. Each one
is pinned by a test that states the behaviour the game should have; while the defect reproduces,
the test records it (a `known defect` annotation in the report and the CI job summary) and goes on,
and once a fix lands the same assertion passes and the summary lists the marker as "fixed?" so it
can be removed. The registry is `DEFECTS` (and `KNOWN_LAYOUT` for layout findings) in
`test/e2e/support/known-issues.ts`.

Severity: **blocker** stops a release; **major** breaks a promised behaviour for some children or
devices; **minor** is a rough edge. Engines: all three unless stated. Found against `main` at
`5848964` (S3 phase 2, the Region 1 vertical slice); DV-QA-13 and DV-QA-06's phone egg labels on
CI at `373a5d2`.

| ID       | Severity | Owner | Summary                                                                     |
| -------- | -------- | ----- | --------------------------------------------------------------------------- |
| DV-QA-01 | minor    | S3    | After a failed save and Retry, the held answer is never acknowledged        |
| DV-QA-02 | minor    | S3    | "You got 1 coins!" / "1 coins": no singular                                 |
| DV-QA-04 | minor    | S3    | Retry in the "Not saved" pill is 40 px tall                                 |
| DV-QA-05 | major    | S3    | Grown-ups' Settings scroll sideways on a phone                              |
| DV-QA-06 | major    | S3    | Words and numbers break inside (200 % tiles "1" over "8"; phone egg labels) |
| DV-QA-08 | major    | S3    | Screen focus targets drop out of the Tab order (`tabindex=-1`)              |
| DV-QA-09 | major    | S3    | After a click on Read aloud, Enter re-reads instead of sending the answer   |
| DV-QA-10 | major    | S3    | 200 % text on a phone: the hub and Egg Grid scroll sideways                 |
| DV-QA-11 | minor    | S3    | Map and road hotspots are cut off by the picture frame                      |
| DV-QA-12 | minor    | S3    | Placement results celebrate the prologue's egg as "A new egg"               |
| DV-QA-13 | major    | S3    | WebKit: a keeper's Text size 200 % does not show when the keeper opens      |

DV-QA-03 (Enter ignored when a round opened on a keypad problem) and DV-QA-07 (a missed tile's
badge pushing the round sideways at 200 %) were found against the phase-1 shell and no longer
reproduce after #13; their tests stay as regression checks.

## DV-QA-01 (minor, S3): the held answer is never acknowledged after Retry

- **Repro**: make a keeper, start the placement check, answer one problem. Let the next save fail
  (a full disk; the test injects it) and answer the next problem: the pill says **Not saved**
  with **Retry**; the round keeps the problem and the typed answer. Free the disk, tap **Retry**.
- **Expected**: the stored answer gets its "Yes!", its coins, and the round moves on.
- **Actual**: **Saved** shows, but the round keeps the old problem; pressing OK again shows
  "Saving stopped. Tap Retry at the top." (also after the save worked), and the next OK silently
  moves to the next problem. The answer was stored once (a reload resumes after it), but the
  child never saw it praised and the purse in the round stays behind until the round is left.
- **Evidence**: `test/e2e/recovery.spec.ts` › "a failed save says Not saved, holds the answer…".
  Suspected place: `src/app/screens/problems.ts` `submit`: an accepted action whose checkpoint
  failed is rethrown and ignored (`CommandRejectedError.accepted`), and nothing re-reads the
  view when `retry()` completes it.

## DV-QA-02 (minor, S3, copy): "1 coins"

- **Repro**: answer one problem right: the polite announcer says "You got 1 coins!"; a purse with
  one coin is named "1 coins".
- **Expected**: "You got 1 coin!", "1 coin".
- **Evidence**: `test/e2e/live.spec.ts`. `coins.earned`, `results.coins` and `coins.label` in
  `content/catalogs/en.ui.json` need a singular (or a count-free wording such as "Coins: 1").

## DV-QA-04 (minor, S3): Retry is smaller than the child-safe target

- **Repro**: make a save fail during a round (as DV-QA-01).
- **Expected**: every control at least 48 × 48 CSS px (`CHILD_SAFE_PRESET`, docs/app.md §7).
- **Actual**: **Retry** is 116 × 40 px: `.dv-save .dv-button { min-height: calc(var(--dv-target) -
8px) }` in `src/app/styles/components.css`. It is the one action the child is told to tap.
- **Evidence**: `test/e2e/screens.spec.ts` stop `41-save-failed`, all sizes.

## DV-QA-05 (major, S3): the grown-ups' Settings tab scrolls sideways on a phone

- **Repro**: on a 390 px wide screen with local English voices (an Android device lists them as
  "English (United Kingdom)"), open the grown-ups' area, Settings.
- **Expected**: the panel reflows to the screen (WCAG 1.4.10).
- **Actual**: the page is about 555 px wide: the voice list's option "Device default (English
  (United Kingdom))" sets the minimum width of the panel's grid column (grid items default to
  `min-width: auto`), and the notation buttons, switches, sliders and the 200 % button stick out.
  Likely fix: `grid-template-columns: minmax(0, 1fr)` on `.dv-parent__panel` and
  `.dv-parent__section`, or `min-width: 0` / `width: 100%` on `.dv-select`.
- **Evidence**: `test/e2e/screens.spec.ts` stops `26-parent-settings` and `44-settings-saved`,
  phone size; screenshot `out/qa-screens/<engine>/phone/26-parent-settings.png`.

## DV-QA-06 (major, S3): words and numbers break inside narrow boxes

- **Repro**: grown-ups' area, Settings, Text size **200%**; play as that keeper. Or, at normal
  size on a 390 px wide phone, make a new keeper and reach the prologue's egg choice.
- **Expected**: whole numbers and words (plan §2.11 "text scales to 200 % with reflow").
- **Actual**: on a tablet, two-digit choice tiles stack their digits, "1" over "8" for 18, so an
  answer reads as two numbers; the keypad's **OK** splits into "O / K"; the hub's adventure button
  ("drag / ons", "know / !") and "Today' / s goal" break; on a phone the level card ("Feedin / g",
  "Memor / y") and Egg Grid ("Ro / ws", "Egg / s") break too. Narrow boxes with
  `overflow-wrap: anywhere` (body) break inside words and numbers.
- **Also at normal size, on a phone**: the three egg buttons of the prologue share the 390 px width
  (106 px each, 82 px inside their padding, one word per line in 24 px bold), so "The bubbl / y
  blue egg" and "The shiny golde / n egg" break mid-word (WebKit on Linux and Windows, Chromium on
  Linux; the words just fit with Firefox's and Edge-on-Windows' font metrics). The eggs could
  stack, or wrap two and one, on a narrow screen.
- **Evidence**: `test/e2e/reflow.spec.ts` › "a keeper's text at 200 %…" (the layout check names each
  broken word); screenshots `out/qa-screens/<engine>/text-200/tablet/16-round-choice.png`,
  `07-round-keypad.png`, `06-hub.png`; `test/e2e/screens.spec.ts` stop `05-story-eggs` (phone),
  screenshot `out/qa-screens/webkit/phone/05-story-eggs.png`.

## DV-QA-08 (major, S3): screen focus targets drop out of the Tab order

- **Repro**: Play on the title of a new family: the editor opens with focus in the name field.
  Tab to the pictures, then Shift+Tab: focus skips the name field and goes to **Back**; from
  **Back**, Tab goes to the pictures. The error screen's **Back to the start** is the same, and
  shows no focus ring while focused.
- **Expected**: every control stays in the Tab order (WCAG 2.1.1, 2.4.3) with a visible ring
  (2.4.7).
- **Actual**: `src/app/router/router.ts` (`mount`, `focus`) gives the screen's focus target
  `tabindex="-1"` when it has none (right for headings), which takes inputs and buttons out of
  sequential navigation for good, and `[tabindex='-1']:focus` in `base.css` hides their ring.
- **Evidence**: `test/e2e/keyboard.spec.ts` › "a keyboard alone makes a keeper…" and "the error
  screen offers its one button to the keyboard".

## DV-QA-09 (major, S3): Enter after a click on Read aloud re-reads the problem

- **Repro**: in a round, click **Read aloud** (or **Show me**), type the answer on the keyboard,
  press **Enter**.
- **Expected**: Enter sends the answer (docs/app.md §8: "Enter always submits").
- **Actual**: the clicked button keeps focus, so the keyboard layer leaves Enter to the browser,
  which presses Read aloud again; the answer waits until OK is pressed. Mouse plus keyboard is the
  usual way to play on the family PC. Likely fix: like the keypad keys, these buttons should not
  take focus on pointer down, or Enter should go to the answer whenever an answer is typed.
- **Evidence**: `test/e2e/input.spec.ts` › "Enter still sends the answer after the child used Read
  aloud" (annotation `DV-QA-09 evidence` names the focused element).

## DV-QA-10 (major, S3): at 200 % text on a phone, the hub and Egg Grid scroll sideways

- **Repro**: Text size 200 %; play as that keeper on a 390 px wide screen.
- **Actual**: the hub is 551 px wide (`.dv-hub__side` and its card do not shrink); the adventure
  button and the place buttons (Valley map, Market, Dragon Den, Stickers, Magic Window) stick out.
  The Egg Grid board is 478 px wide; "More: Rows", "More: Eggs in a row" and **Check** stick out.
- **Evidence**: `test/e2e/reflow.spec.ts`, stops `text-200/06-hub`, `12-hub-after` and
  `17-egg-grid` at phone size; screenshots under `out/qa-screens/<engine>/text-200/phone/`.

## DV-QA-11 (minor, S3): map and road hotspots are cut off by the picture frame

- **Repro**: open the valley map on a phone, or the Sunny Meadow road at 200 % text or zoom.
- **Actual**: on a phone the one awake place's label, "Sunny Meadow", starts 63 px left of the
  screen and is clipped by the map frame; at 200 % text or browser zoom, level 1's marker and the
  boss are clipped at the road picture's edge, and on a phone at 200 % several level markers stick
  out of the screen. Hotspots are placed in picture coordinates without keeping them inside the
  frame.
- **Evidence**: `test/e2e/screens.spec.ts` stops `13-map` and `14-region` (phone),
  `test/e2e/reflow.spec.ts` (`text-200` and zoom); screenshot
  `out/qa-screens/<engine>/phone/13-map.png`.

## DV-QA-12 (minor, S3): the placement results celebrate the prologue's egg again

- **Repro**: a new keeper chooses the blue egg (Bubbles) in the prologue (the hub shows it in the
  nest), then takes the placement check.
- **Expected**: the results list the eggs the check unlocked (Sunny, Goldie, Mirror, Puff).
- **Actual**: they also say "A new egg: Bubbles". The rules grant the first egg once, at the
  choice (`grantEgg` is idempotent); the shell's event inbox carries that earlier `egg.received`
  into the next results screen.
- **Evidence**: `test/e2e/persistence.spec.ts` › "a finished round is kept…".

## DV-QA-13 (major, S3; WebKit): a keeper's Text size 200 % does not show when the keeper opens

- **Repro** (WebKit; seen in Playwright's WebKit on the Ubuntu CI runner): make a keeper, go back
  to the keepers, grown-ups' area, Settings, Text size **200%**, close the grown-ups' area and
  play as that keeper.
- **Expected**: the hub and everything after it at 200 % (root font size 48 px).
- **Actual**: `<html>` carries `--aegis-text-scale: 2` from the moment the keeper opens (the
  trace's DOM snapshots show it), yet `getComputedStyle(html).fontSize` stays `24px` and the hub
  is drawn at normal size: the failure screenshot taken seconds later still shows 100 % text. The
  root font size is `calc(var(--dv-reading, 24px) * var(--aegis-text-scale, 1))` (`base.css`), and
  the SDK's `applyPresentationPreferences` changes only that custom property on `<html>`; WebKit
  does not recompute the root's font size from it until something else restyles `<html>`. It does
  not reproduce in Chromium, Firefox or WebKit on Windows, and `settings.spec.ts`, which changes
  Reduce motion at the same time (an attribute on `<html>`), sees 48 px everywhere.
- **Likely fix** (S3, in `applyPresentation`): also mirror the scale in an attribute on `<html>`
  (for example `data-text-scale`), or set the root `font-size` itself, so WebKit restyles the
  root; an SDK note: `applyPresentationPreferences` could do the same for every consumer.
- **Evidence**: `test/e2e/reflow.spec.ts` › "a keeper's text at 200 %…": when the size stays at
  24 px it attaches `DV-QA-13 evidence` (what `<html>` says before and after a no-op restyle, also
  in the job summary), then restyles `<html>` itself so the rest of the walk still checks 200 %.

## Observations for design review (not defects)

- A new keeper's placement results also award "Dressed Up" (criterion: owns one cosmetic) before
  the child has dressed anything; the cosmetic comes with the levels the check skips. The name
  promises an outfit (S2b content).
- At 200 % text the problem itself is capped by the viewport (`.dv-problem` uses
  `min(3rem, 11vw)`, `min(2rem, 7.5vw)` for long problems), so on a phone it is smaller than the
  prompt and buttons around it.
- Strict durability makes feedback wait for the save: on a heavily loaded machine (Firefox,
  Windows, parallel tests) one answer took over 8 s to show "Yes!". On real devices this is
  usually instant; the performance budgets in PR C will measure it.
- axe reports only moderate findings: `region` (toasts, the announcer and the boot status sit
  outside landmarks) and `page-has-heading-one` on the startup failure screen.
- Remainder mode (`4 r 3` / `4 R 3`) cannot be reached in play until Region 6 content lands; the
  keypad logic is unit-tested and the e2e parity check covers number mode.
