# Accessibility report

Dragon Valley v1 at commit `5d98ee3` (main after #46 and #47), as the QA suite checks it on every CI run in Chromium, Firefox
and WebKit, against WCAG 2.2 levels A and AA and the plan's own promises (plan §2.10-2.12).

**In short:**

- No serious or critical axe violation on any screen, in any engine, at any size.
- No major defect is open. Two minor ones are, both for S3 and both in WebKit only.
- No axe finding of any level since #46, which fixed the last three moderate ones.
- Some things only a person can check, above all screen readers on a real iPad and Windows forced
  colours (below).

## How it is checked

| Check                 | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                | Where                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| axe-core              | WCAG 2.2 A/AA and best-practice rules on all 51 screens and states the game can show (among them the Dragon Diary, the grown-ups' Progress and Print, the print preview, the finale and Compare Stones), at the tablet (1180 × 820) and phone (390 × 844) sizes, in three engines (the desktop shares the tablet's layout); serious and critical findings fail the run, moderate and minor ones are listed in the job summary | `screens.spec.ts`, `support/a11y.ts`                     |
| Layout                | No sideways scrolling, nothing cut off or outside the screen, every control at least 48 × 48 px, no word broken in the middle: on every stop at all three sizes (desktop 1440 × 900 too), at 200 % text and at 200 % browser zoom                                                                                                                                                                                             | `support/layout.ts`, `screens.spec.ts`, `reflow.spec.ts` |
| Keyboard              | Tab order forward and back on each screen, a visible ring on every stop (by its pixels in the keeper editor), focus on each new screen's heading or answer, dialogs that keep focus inside and give it back, every round, board and boss by keys alone                                                                                                                                                                        | `keyboard.spec.ts`, `input.spec.ts`, `boards.spec.ts`    |
| Announcements         | Misses with their fact, typed digits, praise, coins, results and toasts are spoken politely, a failed save assertively, and every live region exists before it speaks                                                                                                                                                                                                                                                         | `live.spec.ts`                                           |
| Motion                | Nothing flies or keeps moving with the device's reduced motion or a keeper's own Reduce motion                                                                                                                                                                                                                                                                                                                                | `motion.spec.ts`                                         |
| Read-aloud            | Only local English voices; the words match the written problem in either notation; no local voice hides the button and the grown-ups' area says why                                                                                                                                                                                                                                                                           | `read-aloud.spec.ts`, `settings.spec.ts`                 |
| Text size             | A keeper at 200 % text through the hub, a whole round and the valley at three sizes; every screen at 200 % browser zoom                                                                                                                                                                                                                                                                                                       | `reflow.spec.ts`                                         |
| The checks themselves | Each check is shown a planted fault and must report it (a nameless button, a cut-off control, a ring removed by a rule or hidden under art)                                                                                                                                                                                                                                                                                   | `harness.spec.ts`                                        |

## WCAG 2.2 A and AA

| Criterion                        | Level | Result                                                                                                                                                                         |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1.1 Non-text Content           | A     | Pass (axe): pictures that carry meaning are named, decorative art is hidden from assistive technology                                                                          |
| 1.3.1 Info and Relationships     | A     | Pass (axe; the keeper pictures are one named radio group, the keypad and choices are named groups)                                                                             |
| 1.3.4 Orientation                | AA    | Pass: landscape tablet and desktop, portrait phone                                                                                                                             |
| 1.4.1 Use of Color               | A     | Pass: feedback is words, a symbol and a sound as well as a colour ("Almost! Let's look…" is checked as text)                                                                   |
| 1.4.3 Contrast (Minimum)         | AA    | Pass (axe, every stop, three engines)                                                                                                                                          |
| 1.4.4 Resize Text                | AA    | Pass, with **DV-QA-13**: in WebKit a keeper's hub at 200 % text can come into sight at normal size for a frame (6 of 8 openings; Chromium fixed by #49). Pinch zoom is allowed |
| 1.4.10 Reflow                    | AA    | Pass at every size, at 200 % text and at 200 % zoom, in all three engines (DV-QA-05, the last sideways scroll in WebKit, fixed by #41)                                         |
| 1.4.11 Non-text Contrast         | AA    | Not measured: rings are proven present, not their contrast. Manual check                                                                                                       |
| 1.4.12 Text Spacing              | AA    | Not tested. Manual check                                                                                                                                                       |
| 1.4.13 Content on Hover or Focus | AA    | Not tested                                                                                                                                                                     |
| 2.1.1 Keyboard                   | A     | Pass: every screen, round, board, boss and the grown-ups' gate (held with Space)                                                                                               |
| 2.1.2 No Keyboard Trap           | A     | Pass: dialogs hold focus while open and give it back                                                                                                                           |
| 2.1.4 Character Key Shortcuts    | A     | Digits, Enter, Backspace and Esc act only on the round in play. Not assessed further                                                                                           |
| 2.2.1 Timing Adjustable          | A     | No time limit on answers; the only timed play is the optional Arena; the grown-ups' daily limit is theirs to set. The gate's two-second hold is a child lock                   |
| 2.2.2 Pause, Stop, Hide          | A     | Pass with a preference: breathing, blinking and flying coins stop with reduced motion (device or keeper)                                                                       |
| 2.4.2 Page Titled                | A     | Pass (axe)                                                                                                                                                                     |
| 2.4.3 Focus Order                | A     | Pass: Tab order checked both ways on each screen                                                                                                                               |
| 2.4.6 Headings and Labels        | AA    | Pass: every screen has a level-one heading, the startup-failure screen too since #46                                                                                           |
| 2.4.7 Focus Visible              | AA    | Pass, with **DV-QA-15**: in WebKit the keeper pictures lose their ring after an arrow key (WebKit's own `:focus-visible` behaviour)                                            |
| 2.4.11 Focus Not Obscured        | AA    | Pass where checked by pixels (the keeper editor, including a ring hidden under art); other screens by computed style only                                                      |
| 2.5.1 Pointer Gestures           | A     | Pass: every action is a single tap (the Egg Grid's nests are tapped, not dragged)                                                                                              |
| 2.5.2 Pointer Cancellation       | A     | Pass: letting go of the gate's lock early opens nothing                                                                                                                        |
| 2.5.7 Dragging Movements         | AA    | Pass: nothing needs dragging                                                                                                                                                   |
| 2.5.8 Target Size (Minimum)      | AA    | Pass, and stricter: every control is at least 48 × 48 px (AA asks 24), at every size and at 200 % text                                                                         |
| 3.1.1 Language of Page           | A     | Pass: `lang="en"`                                                                                                                                                              |
| 3.3.1 Error Identification       | A     | Pass: a name problem says in words what is wrong; a miss shows the right fact and its picture (whether the name problem is announced is not tested)                            |
| 3.3.2 Labels or Instructions     | A     | Pass (axe; every field and control is named)                                                                                                                                   |
| 3.3.8 Accessible Authentication  | AA    | Not applicable: the grown-ups' gate (hold, then a two-digit × two-digit question) is a child lock, not a sign-in                                                               |
| 4.1.2 Name, Role, Value          | A     | Pass (axe; meters report their value, choices their pressed state, the pictures their checked state)                                                                           |
| 4.1.3 Status Messages            | AA    | Pass: misses, praise, coins, results and toasts are announced; messages that come together are queued, none lost (DV-QA-16, fixed by #41)                                      |

## Open defects

All owned by S3; full write-ups with repro and suggested fixes in [defects.md](defects.md).

| ID       | Engines              | Summary                                                        |
| -------- | -------------------- | -------------------------------------------------------------- |
| DV-QA-13 | WebKit, intermittent | A keeper's hub at 200 % text comes into sight at normal size   |
| DV-QA-15 | WebKit               | The keeper pictures lose their focus ring under the arrow keys |

Sixteen defects found by the suite have been fixed and stay pinned as regression checks: among them
the 40 px Retry button, words broken at 200 % text, sideways scrolling at 200 % on a phone, map
hotspots cut off, focus targets that lost their ring, celebrations that a keyboard could not reach
(axe, serious), Enter re-reading the problem after Read aloud, the last sideways scroll in WebKit,
a lost announcement, a × 0 fact sent to look at a picture it did not have, and term cards that did
not mark their number ([defects.md](defects.md), "Fixed").

## Advice: moderate axe findings (all fixed by #46)

Since #46 the job summaries list no axe advice in any engine (before it, every walk reported
`region` about 95 times and `page-has-heading-one` twice). What was found:

| Finding                | Where                                                                                                                       | Suggested fix                                                                                                           | Owner | Done |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----- | ---- |
| `region`               | The `boot-status` line ("Ready") on every screen: outside any landmark, and read by screen readers at the end of every page | It is a signal for tools: `aria-hidden="true"` keeps it out of the way (tests read its attributes, not its text)        | S3    | #46  |
| `region`               | The toasts' text ("Settings saved.", "Backup loaded for Ada.") outside any landmark                                         | The announcer already speaks it: hide the visual copy from assistive technology, or put the toasts in a labelled region | S3    | #46  |
| `page-has-heading-one` | The startup-failure screen                                                                                                  | An `<h1>` for its title, as every other screen has                                                                      | S3    | #46  |

## Beyond WCAG: the plan's promises (§2.11)

| Promise                                                  | Result                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Touch-first, targets of at least 48 px                   | Pass at every size and at 200 % text; whole rounds and both boards played by touch                                 |
| Text scales to 200 % with reflow                         | Pass (DV-QA-13 above)                                                                                              |
| Digits, Enter, Backspace, arrows, Space and Esc          | Pass: keypad and keyboard give the same answer step by step; choice tiles wrap; Esc pauses                         |
| Feedback in a live region, focus managed with dialogs    | Pass                                                                                                               |
| The game pauses when the page is hidden                  | Pass: hidden time does not count against answers, the Arena's clock stops, read-aloud stops (`visibility.spec.ts`) |
| Read-aloud with local voices only                        | Pass                                                                                                               |
| Reduced motion, from the device or the keeper's settings | Pass                                                                                                               |

## Needs a person before release

- **Screen readers on real devices**: VoiceOver with Safari on an iPad (the main device), NVDA with
  Firefox or Edge on Windows, TalkBack with Chrome on Android. Play the first run, a round with a
  miss, a board and the grown-ups' gate (VoiceOver's double-tap and hold), and use read-aloud with a
  screen reader running (two voices at once?).
- **Windows forced colours (high contrast)**: focus rings, the keypad, the Magic Window's states and
  the boss meter are not checked in it.
- **Colour vision**: the Magic Window's gold, silver and bronze and the feedback colours, with a
  colour-blindness simulator.
- **Text spacing** (1.4.12) and **non-text contrast** of rings and control edges (1.4.11).
- **Switch access** and one-handed play on a tablet.
- **The playtest with the child** (plan §4.6): reading load, the story's words (see
  [copy-review.md](copy-review.md)) and whether the help after a miss is understood.
