# The browser application

The shell in `src/app/**` (S3): boot, screens, persistence, input, audio, read-aloud, offline
installation and the grown-ups' area, on the packed Aegis SDK's **public exports** only
(`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`, `@aegis/browser/*`). Art generators in
`src/app/art/**` belong to S4. The game rules run behind `RuntimeAdapter<S, A, V, C>`; the
shell never decides an outcome.

Status: phase 2 (PR B): the Region 1 vertical slice on the real adapter (`src/rules/adapter.ts`)
and the Region 1 rules: story, hub, map, every Region 1 activity, results, collections and the
grown-ups' game settings. Phase 3 adds the remaining activities, the Dragon Diary, the progress
dashboard and printables (§16).

## 1. Layout

| Path                    | What it holds                                                                  |
| ----------------------- | ------------------------------------------------------------------------------ |
| `main.ts`, `index.html` | Boot (§2) and the static splash; the CSP is filled in by `scripts/build.mjs`   |
| `shell/app.ts`          | The persistent chrome, shared services, the active keeper's session, errors    |
| `router/`               | Screen stack and router (§3)                                                   |
| `screens/`              | Title, keepers, editor, play (story, hub, rounds, results), map, collections   |
| `persistence/`          | Family, preferences, game sessions, save status, recovery, backups (§4)        |
| `controller/`           | The command controller (§5)                                                    |
| `content/`              | Loading and validating the content pack and its strings                        |
| `game/`                 | Game definition, view readings, timers, the map layout, rule refusal codes     |
| `design/`, `styles/`    | Tokens from S4's palette, the reading font, CSS (§7)                           |
| `ui/`                   | DOM kit: buttons, keypad, choice tiles, dialogs, toasts, meters, confetti, …   |
| `math/notation.ts`      | Problems as styled tokens in Czech or international notation (§9)              |
| `speech/`               | Read-aloud: local voices, number words, the verbalizer (§11)                   |
| `audio/`                | Game audio over `createNarration`, S5's manifest, event-to-sound mapping (§10) |
| `parent/`               | The grown-ups' gate (§6) and offline installation (§12)                        |
| `i18n/messages.ts`      | Typed access to `content/catalogs/en.ui.json` (§13)                            |
| `sw.ts`                 | The offline worker (`createOfflineWorker`), built by `scripts/build.mjs`       |

## 2. Boot and readiness

`main.ts` applies the design tokens and default presentation and reads the deployment base and
offline revision from `<meta>` tags. It starts loading the reading font (waiting at most 2.5 s)
and the content pack (`content/dragon-valley.content.json`, validated against the contract's
`contentRegistration`) with its strings (`content/catalogs/en.content.json`, which must hold
every key the pack uses), reads S5's audio manifest (a missing or broken manifest means a silent
game, never a failed boot), then opens the family record while the rest finishes. The first
screen is the title, the recovery screen (an unreadable family record) or the error screen (an
invalid content pack).

The hidden `boot-status` element is the readiness signal for tests and tools:
`data-state="ready"` only after the first screen is mounted and painted, `data-screen` names the
current screen (`title`, `keepers`, `editor`, `play`, `map`, `region`, `level`, `market`, `den`,
`album`, `window`, `parent`, `recovery`, `error`) and
`data-content-revision` the validated pack's revision. Nothing is put on `window`; nothing is
written to the console. Uncaught errors and rejections are routed to the error boundary.

## 3. Router and screens

An explicit in-memory stack (`router/stack.ts`): `push`, `replace`, `reset`, `back`, `refresh`
and `backTo(key)` (return to a screen further down the stack, rebuilt).
Browser history is never used for gameplay; every screen with somewhere to go back to has a
visible Back button. Back **rebuilds** the previous screen from its entry rather than reviving
stale DOM. A navigation overtaken by a newer one is discarded before it mounts (double taps
cannot interleave screens).

Mounting goes through the SDK's `replaceProjection` (stops speech and one-shot audio, clears
announcements, moves focus to the screen's heading or chosen target) after
`assertChildSafeView` checks the candidate tree (no outbound links, no embeds). Before the swap
the router waits up to 320 ms (`PICTURE_WAIT_MS`) for the new screen's pictures (its backdrop,
the map) to be decoded while the old screen stays in view, so a change of screen never shows an
empty sky. A screen
declares its title, background field, region accent and **music state**; the shell then sets the
document title, the region accent (`--dv-accent*`), the music and a navigation sound. Escape is
offered to the screen (the round pauses). A screen that fails to build lands on the error screen.

## 4. Persistence

One IndexedDB database, `dragon-valley` (`SAVE_DATABASE`), through `IndexedDbSaveStorage` and
the SDK's `SaveService` (validated envelopes, ordered compare-and-swap writes, a kept previous
copy). Identifiers come from `src/rules/contract/ids.ts` and `persistence.ts`.

| Record                    | `gameId`                    | `profileId`        | Holds                                     |
| ------------------------- | --------------------------- | ------------------ | ----------------------------------------- |
| Family                    | `dragon-valley-family`      | `family`           | `{ profiles: [{ id, name, avatar }] }`    |
| Game save (one per child) | `dragon-valley`             | `profile-1` … `-4` | The runtime snapshot (strict checkpoints) |
| Preferences (per child)   | `dragon-valley-preferences` | `profile-1` … `-4` | Presentation and shell preferences        |

- **Family** (`family.ts`): up to four keepers in the fixed slots `profile-1` … `profile-4`; a new
  keeper takes the first free slot. Names are NFC-normalised, single-spaced, 1-16 characters
  (Czech letters welcome; letters, digits, spaces, `'`, `’`, `.`, `-`), unique ignoring case.
  Avatars are `keeper-1` … `keeper-8`. Removing a keeper (grown-ups only) erases that slot's
  game and preferences records **before** the family list drops them; the storage service's
  revision tombstones stop a stale window from writing into a reused slot. Names and avatars
  never enter game state.
- **Preferences** (`preferences.ts`): `presentation` (the SDK's `PresentationPreferences`: locale,
  text scale 1/1.25/1.5/2, reduced motion, volumes for narration/music/effects, all 1.0 by
  default because S5's mix is baked into the files), `notation` (`czech` | `international`),
  `readAloud`, `autoRead`, `voice` (a local voice URI or null), `timeLimit` (null or 5-120
  minutes). Validated strictly on load and on every edit.
- **Game sessions** (`game-session.ts`, generic over the adapter, after
  `poc/lab-shared/session.ts`): `createSaveCheckpoint` + `createRuntimeHost` with the seed
  `profileSeed(id)`. A stored envelope is validated by the codec, then restored into a throwaway
  **probe** host with the exact content revision it pinned; only then does the real host
  restore it with `durableRevision` (the record was read back from storage). Old saves keep
  their pack until `activateLatestContent()` moves them at a safe boundary (the hub; never
  mid-round), which the real adapter refuses while a round or story beat is open.
- **Save status** (`save-status.ts`): derived only from acknowledged facts. `Saved` when the
  durable revision equals the committed revision; `Saving…` while a checkpoint is pending;
  `Not saved` + **Retry** after a failed write, which calls `retryCheckpoint()` and then
  `continuePending()` - the action is never dispatched again; `Open in another window` +
  **Reopen** for a storage conflict; `Cannot save here` when storage is unavailable.
- **Recovery** (`recovery.ts`, after `poc/lab-shared/recovery.ts`): nothing turns an unreadable
  record into a new one by itself. The recovery screen offers what the stored history allows:
  save the original bytes to a file, restore the previous copy (validated like a fresh load),
  load a backup file, or a confirmed reset of exactly that record. Unreadable storage offers
  only "Try again".
- **Backups** (`backup.ts`): one child per file (`dragon-valley-backup` v1, at most 4 MiB): name,
  avatar, and the game and preferences envelopes exactly as stored. Importing into a keeper
  rebinds the envelopes to that keeper's profile ID and then validates them like a normal load;
  an imported game is persisted with `retryCheckpoint()`.
- **Storage persistence** (`storage.ts`): the grown-ups' area shows usage and asks for
  `navigator.storage.persist()` (only there, because some browsers show an adult-facing prompt).

## 5. Command controller

`controller/commands.ts` (after `poc/lab-shared/commands.ts`) is the only way screens dispatch.
`capture()` binds a dispatcher to the committed revision **and** a view generation when a screen
renders; any newer view (a commit or a restore, even with the same numeric revision) makes older
dispatchers refuse with `StaleCommandError`, and the runtime refuses a mismatched
`expectedRevision` before any rule runs. `bindVisibilityPause` pauses the host, audio and speech
when the page is hidden; `resume(reason)` continues accepted work. Refused actions play
`ui.blocked`; a paused game or a refused action also shows a gentle toast ("The game is paused.",
"That did not work. Please try again."), except while a save is blocked or the game is busy, where
the save status already says what is going on. Phase 2 localises rule rejections
as `error.<code>` keys in `en.ui.json` and never shows diagnostic text to a child.

## 6. The grown-ups' gate

Press and hold for two seconds (the button fills up; letting go early empties it), then answer a
two-digit × two-digit multiplication on the keypad. Factors are never multiples of ten, never
repeated digits, never equal, and never the previous question. A wrong answer asks a new
question: no lockout, no penalty. The question is made by the shell, not the rules.

## 7. Design system

Direction: a storybook toy shelf. Every control is a chunky candy object a child presses with
confidence, on sky-and-meadow fields with S4's toy-vinyl art; never a flat app dashboard. The
child always sees the valley and their egg, taps big obvious things, knows the game is saved, and
gets kind, specific help after a miss.

- **Tokens** (`design/tokens.ts`): every colour comes from S4's `assets/art/palette.json` (via
  `src/app/art/palette.ts`) as `--dv-*` custom properties; region accents switch
  `--dv-accent*`. Sizes derive from the SDK's `CHILD_SAFE_PRESET` (`--dv-target` 48 px,
  `--dv-reading` 24 px). CSS reads colours only through tokens (enforced by a unit test).
- **Components**: candy buttons, big choice tiles, cards, modal dialogs, toasts, an `aria-live`
  announcer, meters, star rating, coin counter with fly-in, confetti and screen transitions.
  Motion uses transform and opacity only and stops with `prefers-reduced-motion` or the child's
  own setting (`data-reduced-motion` on `<html>`). A control's face lifts on hover and sinks when
  pressed while its hit area stays at rest, so an edge never jitters or loses a click. Screens
  settle in from above in 200 ms, starting partly visible (a slow first frame never shows an
  empty screen), so a transition never flashes a scrollbar. Everything reflows at 200 %
  text and on a phone in portrait. On a landscape tablet (1180 × 820, 1024 × 768) the game
  screens fit without page scrolling: the hub sets the dragon, its week and the places beside
  today's card; the results card scrolls its celebrations inside itself with the button onward
  always in view; a round's title and progress share a line and the picture behind a problem
  stands under the dragon.
- **Feedback never relies on colour alone**: correct is green + check + happy egg; a miss is
  warm orange + `?` + a curious egg + "Almost! Let's look…", with the visual model shown first.
  Term questions mark the asked-about number with a marker **and** an underline.
- **Font**: "DV Reading", a Latin subset of **Andika 7.000** (SIL Open Font License 1.1), WOFF2,
  Regular and Bold, about 38 KB each, in `assets/fonts/dv-reading/` with `OFL.txt` (shipped)
  and `provenance.json` (source URL, version, SHA-256 of the archive, originals and subsets;
  not shipped). It is renamed because subsetting is a modification and "Andika" is a Reserved
  Font Name. `node scripts/fonts/subset-andika.mjs --source <Andika-7.000 folder> --check`
  rebuilds it byte for byte (dev dependency `subset-font`). No remote fonts.
- **Icons and pictures**: S4's `renderIcon` (including the interface glyphs), `renderAvatar`,
  `renderDragon`, `renderHatch`, `renderBoss`, `renderSticker`, `renderCosmeticIcon` and
  `renderMagicWindow`, each with a unique ID prefix. A few glyphs S4's set does not have (minus,
  sparkle, book, map, gift, bag, window) are drawn in `ui/icons.ts`. Small and background
  dragons are drawn still and animated art carries no CSS filters, so a page never animates more
  than it needs (software-rendered browsers otherwise burn CPU).

## 8. Input

- **Keypad** (`ui/keypad-state.ts`, `ui/keypad.ts`): 0-9, backspace and OK, with the physical
  keyboard doing the same (digits, Backspace, Enter). **Remainder mode** has two fields, the
  quotient and the remainder, written `4 r 3` (Czech) or `4 R 3` (international); typing `r`,
  Space or the arrow keys, or a tap on a field, moves between them. Keys do not take focus when
  clicked, so Enter always submits.
- **Choice tiles** (`ui/tiles.ts`): digits type a choice's label (type-ahead), arrows move,
  Space or Enter choose; a missed choice is blocked, not hidden. Escape pauses a round.
- Keyboard handling is a stack of handlers (`ui/keyboard.ts`) that ignores text fields and
  leaves Enter/Space on a focused button to the browser, so one press is one action.

## 9. Notation

Problems arrive as the contract's notation-agnostic `Problem`. `math/notation.ts` turns them
into styled tokens (numbers, signs, brackets, answer boxes, the highlighted term) using the
contract's symbols: `·` `:` `r` (Czech, the default) or `×` `÷` `R` (international), switched
per child in the grown-ups' area. A long problem wraps only at the equals sign.

## 10. Audio

One `createNarration` instance (`audio/game-audio.ts`) with an `AudioContext` at the pack's own
22 050 Hz where the browser allows it.

- **Unlock** on the first trusted gesture (the title's Play tap, or any first tap or key).
- **Buses**: music and effects volumes from the child's preferences; music is lowered to 35 %
  while read-aloud speaks.
- **Events to sounds** come from S5's `assets/audio/manifest.json` (`audio/manifest.ts` →
  `AudioMap`; the silent stub when the manifest is unreadable). Live commit events only, never
  replayed history. Policies: `streak` (chime _n_ for the _n_-th correct answer in a row),
  `amount` (coin for 1-4 coins, coin shower for 5+), `sequence` (all sounds in order, timed by
  their lengths with at most 0.7 s between them; `level.completed` plays one star sound per star),
  `first`, `cycle`, `random`. The cue context comes from the event payloads
  (`answer.correct.streak`, `coins.earned.amount`, `level.completed.stars`).
- **Shell cues**: `ui.tap` (gate hold, eggs, cards, stones), `ui.keypad` (keys and typed digits),
  `ui.navigate` (push and Back, gate unlocked), `ui.blocked` (refused actions),
  `fx.dragon-eating` (a fruit reaches the dragon's mouth), `fx.boss-laugh` (a right answer
  tickles the boss) and `fx.dragon-happy` (a matched pair, a finished board).
- **Overlap control** when a sound starts: the manifest's per-sound minimum interval and
  concurrency (group advice such as `sparkle-family` is not a sound and is skipped), a default
  30 ms per sound, and at most six effects starting within 250 ms.
- **Music states** (`Screen.music`): title, keepers and editor `title`; hub and story `hub`; map,
  region and level card `map`; Market and Den `market`; Album and Window `album`; rounds and
  minigames `round`; boss rounds `boss`; results `results`; the grown-ups' area, recovery and
  error are silent. Changes crossfade over the manifest's 1.2 s; the same track continues across
  screens that share it.
- Nothing plays while paused or hidden; `clear()` on restore and keeper switch drops pending
  sequence sounds and playing sounds. Every audio failure is contained: the game works silently.

## 11. Read-aloud

`speech/read-aloud.ts` uses the Web Speech API with **local English voices only**
(`localService === true`, an `en` language); every utterance names its voice explicitly so the
browser can never fall back to a network voice. The grown-ups choose the voice; read-aloud and
auto-read are per child. Speech is cancelled on every screen change, on pause and when the page is
hidden. With no local English voice the speaker button is hidden and the grown-ups' area explains
why.

`speech/verbalizer.ts` speaks the contract's problems the way they are written, identically for
both notations: "Fifty-six divided by seven equals what?", "four remainder three", brackets as
"open bracket … close bracket", comparisons as "Which sign goes between … and …?", term
questions as the sentence then "What do we call forty-two?" (naming "the second four" when a
number appears twice). Word problems read their catalog story first (phase 2), then the
arithmetic. Numbers are British English (`speech/numbers.ts`, up to 999 999).

## 12. Offline installation

In the grown-ups' area (`parent/offline.ts`, after `poc/lab-shared/shell.ts`): the build's
`resource-graph.json` is fetched through `createInstallationRequest` (bypassing the worker's
pinned responses), installed with `OfflinePackStore` into a staged cache published only when
every digest matches, and the worker is registered with `registerOfflineWorker`. Status and
progress are shown ("Downloading 12 of 64 files…"); "Installed" appears only after both succeed. Checking for an
update installs a newer revision next to the running one; the waiting worker takes over the next
time the game is opened. There is no forced reload, and content moves to a new pack only at the
hub (§4).

## 13. Messages

All English text lives in `content/catalogs/en.ui.json` (S3), imported at build time so each key
is a compile-time type, and read through the SDK's `createMessages`, which refuses missing keys
and missing placeholder values. Child-facing sentences keep to the narrative toolkit's child
profile (at most ten words); keys under `parent.`, `recovery.` and `startup.` are for grown-ups.
A unit test checks sentence length, placeholders and that every key is used. A translation adds
`cs.ui.json` with the same keys. Content strings (levels, dragons, stories) are in
`en.content.json`, validated by `scripts/validate-content.mjs`.

## 14. The game screens

**The play screen** (`screens/play.ts`) is one router entry per keeper (`play:<id>`) that shows
whatever the view requires: a story beat, the active round (a problem round or a minigame
board), the results of a finished round, or else the hub. Entering it starts the day's session
when the local date changed (`startSession`; time reaches the rules only as this date) and, at
the hub, activates newer content. After an action that changes what the game shows, a screen
calls `app.continueGame(id)`, which returns to the play entry and rebuilds it; maps, level cards
and collections open on top of it. A restore rebuilds it from the restored view. Live commit
events are kept briefly in the keeper's **event inbox** for the screens that celebrate them
(the closing line of a beat, hatching, stickers, a finished board, the Arena's score); a round's
start empties it (results celebrate only that round), a restore empties it too, so nothing is
ever replayed. Stickers earned outside a round (dressing a dragon, a quest, the gift) get a
toast where they were earned.

- **Story** (`story.ts`): the beat's scene (S4 backgrounds; scene ids are background ids), old
  Glimmer or the boss of a boss level, one line at a time with read-aloud, Next and Skip.
  Glimmer's face follows the line (curious, sleepy, happy, proud; `lineExpression` in
  `scene.ts` keeps them for the version-1 lines until the story data carries a mood). The
  first-egg beat offers its choices as three eggs. A beat's last line ends it in the rules, so it
  arrives as `story.advanced` and is shown from the content graph before moving on.
- **Hub** (`hub.ts`): the featured dragon (the first egg's) with the facts it still needs for its
  next stage (the rules' exact `next.have` of `next.need`), the other dragons, the week's played
  days (a habit view, never a streak), today's
  goal and quests (with their claim buttons), the gift chest and one **Daily Adventure** button
  that does what `hub.next` suggests (placement, snack, the next level or the level in
  progress, the gift, or free play on the map). Places: the valley map, Market, Dragon Den,
  Sticker Album, Magic Window and, once open, the Lightning Arena. When the grown-ups' time limit
  is used up, it offers a goodbye instead.
- **Map, region road and level card** (`map.ts`): S4's `valley-map` with the content's regions
  as the SDK's `createHotspotList` buttons placed over the picture (a tap anywhere inside a
  region works through `logicalPoint` and `hitHotspot`; places the content does not have yet
  sleep under a lock). A region zooms the same picture to its stretch of road with one button
  per level (locked, open, the glowing next one, or its stars) and the boss. The level card lists
  the activities and starts, continues or replays the level.
- **Problem rounds** (`problems.ts`): Feeding Time, the Boss Challenge, snack time, the placement
  check and the Lightning Arena on `ProblemRoundView`. Choice tiles or the keypad as the view
  resolves each problem (remainders, signs, operations and terms included); a right answer
  throws a fruit along an arc into the dragon's mouth (S4's anchors; an egg glows instead) or a
  sparkle onto the boss, whose pose follows its mood meter; a miss shows the right fact and its
  picture until the child goes on; re-asks show the picture first and the hint shows it on
  request. Response time excludes paused and hidden time. Placement answers with
  `placementAnswer` and shows its ladder steps; the Arena runs the shell's one-minute race and
  ends with `endRound{ reason: 'time-up' }`. A Riddle Scrolls story first asks for its sign: the
  sum is drawn with an empty sign slot (`5 ○ 4 = ?`; a leftover story asks only `23 ○ 5 = ?`),
  read as "Five, which sign, four, equals what?", and answered with the four sign tiles
  (`stepChoices`: whatever the input mode); a right sign is a chirp, then the number is asked.
  Sign tiles draw their sign half as big again.
- **Minigames** (`minigames.ts`): Memory Match, Number Trail, Egg Grid and Fact Family Nest on
  the rules' typed boards (`MinigameRoundView.current`, faces through the contract's
  `formatFace`), every move tagged with the board revision. A finished board cheers on
  `minigame.completed`. The Egg Grid is a field of `maxSide × maxSide` spots beside its
  controls: one tap builds the nest up to that spot (the steppers do the same from the
  keyboard), the nest is told in words ("5 rows of 7") and only Check tells its total ("Yes! 5
  rows of 7 is 35.", or after a wrong nest "5 rows of 8 is 40. We need 35."); the strategy
  pictures (five-plus, double, ten-minus) are drawn on the field.
- **Results** (`results.ts`): an egg that hatched first gets its own full-size celebration
  (`hatch.ts`), one dragon at a time: S4's hatch sequence cropped to the egg and drawn big, the
  hatch sounds started so the fanfare lands on the pop (not when the answer was committed),
  confetti, the name card and "Hooray!". Then stars, the score, coins, and the round's other
  celebrations: growing, new eggs, stickers, regions, the Arena's best. Then the level's next
  activity, or back to the valley.
- **Collections** (`collections.ts`): Glimmer's Market (`buy`), the Dragon Den (`equip`, eggs only
  in the nest), the Sticker Album and the Magic Window (S4's window with a legend).
- **The grown-ups' settings** add the time limit for one sitting (a preference; the shell counts
  play time per keeper and page and ends a round gently with `endRound{ reason: 'time-limit' }`)
  and the settings the rules own, sent as actions: the daily goal, the Arena, opening regions
  early and running the placement check again.

Rule refusals show a child-friendly line by code (`error.<code>`, `game/errors.ts`).

## 15. Testing

- **Unit** (`test/unit/app/`, Vitest): router stack, keypad state machine (incl. remainder
  mode), gate questions, family and preference schemas, records and recovery, game sessions
  (checkpoints, retry, restore, content activation), backups, save status, the catalog (with every
  vocabulary the screens build keys from), tokens, fonts, notation and the verbalizer, voices, the
  audio manifest, sound mapping and game audio; and for the game screens: view readings checked
  against the real rules, response time and the play clock, problem pictures, answer labels,
  card faces, the map layout and the content strings.
- **DOM** (`test/unit/app/dom/`, happy-dom): keypad, choice tiles and the router.
- **Browser** (`test/e2e/profiles.spec.ts`, Playwright): a new keeper's prologue, first egg and
  hub, kept after a reload; the placement check by keyboard with a kind miss, results and saved
  coins after a reload; the grown-ups' gate; notation, a rule setting, a rename and the pause
  dialog; a tablet screen (1180 × 820, 1024 × 768) holding the hub, the Egg Grid (built by
  tapping, totals told by Check) and the results without page scrolling. CI runs Chromium,
  WebKit and Firefox. Locally the default project is the installed
  Edge; `$env:DV_E2E_ALL_ENGINES = '1'; npm run test:e2e` runs all three (set `DV_E2E_PORT` to a
  free port when another checkout already serves 4321).

## 16. Phase 3 and later

The remaining activities (Compare Stones and Riddle Scrolls visuals, Sharing Feast, Golem
Orders), the Dragon Diary, the grown-ups' progress dashboard (window, tables, hardest facts,
trend), printables (flashcards and certificates through `@aegis/narrative` `layoutPrint` /
`renderPrintHtml`), `fx.*` cues for the remaining moments, and a persisted per-day time limit
(today it counts per page load).

## 17. SDK notes

Gaps found while building the shell (filed upstream by the coordinator, never patched here):

- `CHILD_SAFE_CSS` is not injected. Its `.aegis-child button` defaults (specificity 0,1,1) beat
  single-class component styles, and its reduced-motion rule matches only when
  `data-reduced-motion` is on the `.aegis-child` element itself, while the natural root for
  `applyPresentationPreferences` is `<html>` (it also sets `lang`). The shell implements the same
  thresholds (48 px targets, 24 px text, both reduced-motion sources) in its own CSS.
- A failed `playEffect` (for example a dropped effect at the voice limit) sets the whole
  narration state to `failed`; the shell catches and ignores effect failures.
- No way to ask whether the audio context is running other than tracking `unlock()`.
- No helper to rebind a save envelope to another profile ID (backups do it by hand).
- No preloading of effects: the first play of each sound waits for its download and decode.
