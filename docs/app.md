# The browser application

The shell in `src/app/**` (S3): boot, screens, persistence, input, audio, read-aloud, offline
installation and the grown-ups' area, on the packed Aegis SDK's **public exports** only
(`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`, `@aegis/browser/*`). Art generators in
`src/app/art/**` belong to S4. The game rules run behind `RuntimeAdapter<S, A, V, C>`; the
shell never decides an outcome.

Status: phase 3 (PR C): the whole valley on the real adapter (`src/rules/adapter.ts`): story,
hub, map, every activity, results, collections, goodbye with the Dragon Diary, the finale, and
the grown-ups' area with progress, printables and the game settings. What is left is in §16.

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
| `game/`                 | Game definition, view readings, timers, the map layout, the Dragon Diary, …    |
| `design/`, `styles/`    | Tokens from S4's palette, the reading font, CSS (§7)                           |
| `ui/`                   | DOM kit: buttons, keypad, choice tiles, dialogs, toasts, meters, confetti, …   |
| `math/`                 | Problems as tokens in Czech or international notation (§9), facts, pictures    |
| `speech/`               | Read-aloud: local voices, number words, the verbalizer (§11)                   |
| `audio/`                | Game audio over `createNarration`, S5's manifest, event-to-sound mapping (§10) |
| `parent/`               | The grown-ups' gate (§6), offline installation (§12), the Progress tab (§14)   |
| `print/`                | Printables: what to print, the toolkit's print documents, the sheets (§14)     |
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
`album`, `window`, `goodbye`, `parent`, `print`, `recovery`, `error`) and
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
| Day (per child)           | `dragon-valley-day`         | `profile-1` … `-4` | How today began, for the Dragon Diary     |

- **Family** (`family.ts`): up to four keepers in the fixed slots `profile-1` … `profile-4`; a new
  keeper takes the first free slot. Names are NFC-normalised, single-spaced, 1-16 characters
  (Czech letters welcome; letters, digits, spaces, `'`, `’`, `.`, `-`), unique ignoring case.
  Avatars are `keeper-1` … `keeper-8`. Removing a keeper (grown-ups only) erases that slot's
  game, preferences and day records **before** the family list drops them; the storage service's
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
  their pack until `activateLatestContent()` moves them at a safe boundary (the play screen,
  before today's session starts; never mid-round), which the real adapter refuses while a round
  or story beat is open. `session.content()` is the pack the game is on now; screens read
  content from it, never from the build's newest pack. A session has **one** commit listener on
  its host: it keeps the latest committed view (`session.view()`, never a copy per redraw, since
  the host's `getView()` clones the whole view) and fans each commit or restore out to the
  shell and the screens (`session.subscribe`); a failing screen listener cannot keep the others
  from hearing it.
- **Day** (`day.ts`): when a keeper's day starts, the shell notes which facts already shine and
  how far each dragon has grown, on the game's own day (`gameDay`: the rules never go back a
  day). The Dragon Diary is the difference from the view (§14). The record holds nothing the
  game save does not and is never part of a backup, so an unreadable one is replaced and a
  failed write leaves the diary to this page; removing, resetting or importing a keeper erases
  it.
- **Content upgrades** (`content/history.ts`): every shipped pack is archived in
  `content/history/<revision>.json` and shipped with the site (and the offline install). A save
  that pins a revision the build does not hold fetches just that file
  (`GameDefinition.loadHistory`, once per page; a failed fetch is forgotten), validated with the
  contract's registration and required to be that pack and revision; revisions that could not
  name a file are never fetched. A pack that cannot be fetched (offline before the game was
  installed) or does not match leaves the save untouched: the recovery screen explains it to a
  grown-up (`content-unavailable`) and "Try opening again" fetches it again. Backups of older
  saves load the same way.
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
renders (the controller watches the game session's listener rather than adding its own); any newer view (a commit or a restore, even with the same numeric revision) makes older
dispatchers refuse with `StaleCommandError`, and the runtime refuses a mismatched
`expectedRevision` before any rule runs. `capture()`'s dispatcher resolves once the action is
durably saved. For actions the child waits on (an answer, a board move, the next story line,
starting a level) screens use `captureSend()`: it resolves when the action is saved, or once it is
committed if the save takes longer than `SAVE_PATIENCE_MS` (250 ms), since the runtime shows the
committed view before it starts the save; the save status tracks the rest, so feedback never
waits on a slow device. A save that fails within that time rejects with `accepted: true`: a round
holds that answer (no praise for what is not stored; the save status says "Not saved" with Retry,
and another answer says "Saving stopped. Tap Retry at the top."), and when Retry stores it the
round gives its feedback and goes on. Actions that only move on (`taken()`) treat it as done.
Commands sent while another one is still saving wait for it instead of being refused as busy.
`bindVisibilityPause` pauses the host, audio and speech
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
  text and on a phone in portrait, and words and numbers stay whole: a box is never narrower than
  its longest word (`overflow-wrap: break-word`), choice tiles wrap onto more rows instead of
  splitting a label, meters, steppers and the week wrap their parts, and single-column grids use
  `minmax(0, 1fr)` so nothing pushes the page sideways. The keeper's text size is set on `<html>`
  directly (its font size, plus `data-text-scale`) together with the SDK's `--aegis-text-scale`,
  because an engine can keep the root's old size after a custom property changes (DV-QA-13:
  WebKit, once Chromium); the next screen's first frame is already at the keeper's size. On a
  landscape tablet (1180 × 820, 1024 × 768) the game
  screens fit without page scrolling: the hub sets the dragon, its week and the places beside
  today's card; the results card scrolls its celebrations inside itself (a named region in the
  Tab order) with the button onward always in view; a round's title and progress share a line
  and the picture behind a problem stands under the dragon.
- **Feedback never relies on colour alone**: correct is green + check + happy egg; a miss is
  warm orange + `?` + a curious egg + "Almost! Let's look…", with the visual model shown first.
  Term questions mark the asked-about number with a marker **and** an underline.
- **The picture behind a problem** (`math/model.ts` chooses it, `ui/models.ts` draws it) shows
  after a miss, before a re-ask, when a fact is taught and on Show me. The small tables keep
  pictures to count: an array up to 10 × 10, and equal groups, with leftovers apart. Beyond them
  the written strategy is drawn:
  - `place-shift`: · 10, · 100, : 10 and : 100. The digits move in an H T O chart, and the new
    zeros are marked.
  - `tens-groups`: `30 · 3` as ten-rods in groups, "3 tens · 3 = 9 tens = 90". With many rods
    it is one group and "· b".
  - `split-mul`: `38 · 8` as an area model of tens and ones.
  - `split-div`: `96 : 8` as the area model the other way round.
  - `order-steps`: an expression of two or more operations, one row per step, in Golem Orders'
    order. The step that goes first has a marker and an underline.

  Tens are violet rods and ones yellow dots, so shape and labels tell them apart. Each worked
  line is written in the child's notation and read as words to screen readers. It ends with the
  answer only after a miss (`showModel(problem, true)`). Before the answer it ends with an empty
  box, so the picture shows the way and leaves the last step. A figure fills the slot's width, and
  its drawing scales with it up to a fifth of the screen's height (a seventh in a boss round). Its
  steps are written one per line in rem; a long step wraps after a + or − and never sideways.
  `node scripts/art/models-gallery.mjs` draws every kind for review. It also checks each one in
  the slot's budget at the five child viewports, in normal and boss rounds at 100 % and 200 %
  text, and fails when a figure is too tall or reaches out of the column.

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
  leaves Enter/Space on a focused button to the browser, so one press is one action. Tools beside
  an answer (Read aloud, Show me: `keepsFocus`) do not take focus from a pointer, so Enter still
  sends the typed answer. The router gives `tabindex="-1"` only to headings and containers it
  focuses; controls keep their place in the Tab order and always show their focus ring.

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
A unit test checks sentence length, placeholders and that every key is used. Messages about a
count have a singular and a plural key (`coins.earned.one` / `.other`, …), chosen by
`plural(t, count, one, other)`: "You got 1 coin!", "Find 1 way." A translation adds
`cs.ui.json` with the same keys. Content strings (levels, dragons, stories) are in
`en.content.json`, validated by `scripts/validate-content.mjs`.

## 14. The game screens

**The play screen** (`screens/play.ts`) is one router entry per keeper (`play:<id>`) that shows
whatever the view requires: a story beat, the active round (a problem round or a minigame
board), the results of a finished round, or else the hub. Building it first activates newer
content for a save from before an update (unless a round or a story is still open), then starts
the day's session when the local date changed (`startSession`; time reaches the rules only as
this date). After an action that changes what the game shows, a screen
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
  arrives as `story.advanced` and is shown from the content graph before moving on. The
  **finale** beat shows the Seven-Headed Dragon with every head cured; from its second line the
  Magic Window is whole again, every pane gold, in the castle hall's niche (hall and window are
  one SVG in the hall's units, `hallBackdrop`, so the window stays in the niche at every size),
  and its last line ends in confetti.
- **Hub** (`hub.ts`): the featured dragon (the first egg's) with the facts it still needs for its
  next stage (the rules' exact `next.have` of `next.need`), the other dragons, the week's played
  days (a habit view, never a streak), today's
  goal and quests (with their claim buttons), the gift chest and one **Daily Adventure** button
  that does what `hub.next` suggests (placement, snack, the next level or the level in
  progress, once a day a replay of one game of a finished level ("Play again: Memory Match",
  `startLevel` with its `activity`), the gift, or free play on the map). Places: the valley map,
  Market, Dragon Den, Sticker Album, Magic Window and, once open, the Lightning Arena. When the
  grown-ups' time limit is used up, it offers a goodbye instead. Back from the hub says goodbye
  when the day brought something, else it goes straight to the keepers.
- **Goodbye and the Dragon Diary** (`goodbye.ts`, `game/diary.ts`): the featured dragon waves
  and the diary tells what today brought, made from data rather than written: facts that began
  to shine today (bronze or better, compared with the day's baseline, §4), dragons that hatched
  or grew, and stickers earned today. It can be read aloud (facts in words, in the keeper's
  notation) and leads back to the valley or on to the keepers.
- **Map, region road and level card** (`map.ts`): S4's `valley-map` with the content's regions
  as the SDK's `createHotspotList` buttons, in the valley's order (a tap anywhere inside a
  region works through `logicalPoint` and `hitHotspot`; places the content does not have yet
  sleep under a lock). While the names fit, the buttons stand on the picture, each exactly one
  target high; when the map is narrower than 36 text sizes (a phone, or 200 % text) or any two
  names would touch, the same buttons line up under the picture across the whole width and the
  picture keeps each place's emblem as a pin (a `ResizeObserver` decides; one set of buttons
  either way). A region zooms the same picture to its stretch of road with one button per
  level (locked, open, the glowing next one, or its stars) and the boss. Buttons are placed
  from percentages (`--x`, `--y`) so they never leave the frame: a place's name is anchored in
  proportion to where it stands, and pins and markers stay half their size from the edges;
  pins and markers follow the picture's size, not the text size. The level card lists the
  activities and starts, continues or replays the level.
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
  Sign tiles draw their sign half as big again. A story sits on a parchment **scroll** with
  wooden rods and the speaker on it, and a new one unrolls from the top. **Compare Stones** lay
  each side of a comparison on a pebble with the sign's place between them; once answered, each
  stone with an expression shows its value and the place the right sign. **The Seven-Headed
  Dragon** is won over head by head: three right answers cure a head (`curedHeads`: the meter
  shared evenly), cured heads smile from the left, pips and words say how many, and a cured head
  hops with confetti and "A head is cured!".
- **Minigames** (`minigames.ts`): Memory Match, Number Trail, Egg Grid and Fact Family Nest on
  the rules' typed boards (`MinigameRoundView.current`, faces through the contract's
  `formatFace`), every move tagged with the board revision. A finished board cheers on
  `minigame.completed`. The Egg Grid is a field of `maxSide × maxSide` spots beside its
  controls: one tap builds the nest up to that spot (the steppers do the same from the
  keyboard), the nest is told in words ("5 rows of 7") and only Check tells its total ("Yes! 5
  rows of 7 is 35.", or after a wrong nest "5 rows of 8 is 40. We need 35."); the strategy
  pictures (five-plus, double, ten-minus) are drawn on the field.
  - **Sharing Feast** (`boards/feast.ts`): a bowl over a row of baskets. A tap gives a basket one
    fruit, its minus takes one back, "One for each basket" deals a round, and from 20 fruit on a
    bag of ten goes in at once (drawn as a bag marked 10). The question is the division the
    baskets show, `12 : 3 = ?` or `13 : 3 = ? r ?`, on the keypad; the rules' checks come back
    as kind lines (not fair yet, the bowl can still go round, count again). An answer bigger
    than the whole feast is answered on the board, since the rules refuse that move.
  - **Golem Orders** (`boards/golem.ts`): the expression as numbers and gears; a gear is the
    sign of its operation (`pathTokens` give every sign its operation's path), picking one marks
    its part of the line and the keypad asks its result. The steps are written the school way
    (`8 + 2 · 3 = 8 + 6`, each step on one line), and the finished board's chain stays on show
    while the next one starts.
  - Boards with a keypad beside their own buttons use the keypad's `claimFocus`: typing moves
    focus to the keypad, so Enter sends the answer instead of pressing the focused button.
- **Results** (`results.ts`): an egg that hatched first gets its own full-size celebration
  (`hatch.ts`), one dragon at a time: S4's hatch sequence cropped to the egg and drawn big, the
  hatch sounds started so the fanfare lands on the pop (not when the answer was committed),
  confetti, the name card and "Hooray!". Then stars, the score, coins, and the round's other
  celebrations: growing, new eggs, stickers, regions, the Arena's best. Then the level's next
  activity, or back to the valley.
- **Collections** (`collections.ts`): Glimmer's Market (`buy`), the Dragon Den (`equip`, eggs only
  in the nest), the Sticker Album and the Magic Window (S4's window with a legend). Long
  collections show one part at a time (`ui/tabs.ts`: toggle buttons in a labelled group, Left
  and Right between them): the Album one region page (emblem tabs with a check on a full page,
  arrows that turn around the ends; it opens at the page looked at last, else the furthest open
  region's), the Market one shelf per slot (each tab shows one of its things; it opens at the
  shelf looked at last, else the first with something to buy now). Sticker and item pictures
  keep a picture's size at 200 % text.
- **The grown-ups' Progress tab** (`parent-progress.ts`, shaped by `parent/progress.ts` from the
  view): a summary (days, answers, panes that shine, dragons), the Magic Window as two plain
  grids with their axes (S4's `renderMasteryGrid`, multiplication 11 × 11 and division 10 × 11)
  and a legend, the times tables (facts mastered, right and quick answers; a table nobody has
  answered says so, inferred from the hardest list since the view gives shares, not counts),
  the hardest facts in the keeper's notation, the last 60 calendar days as bars (gaps show) with
  the practised days as a list, and every skill begun. Numbers are lists that reflow, never
  tables.
- **Printables** (`parent-print.ts`, `print.ts`, `print/`): the Print tab offers flashcards of
  the ten hardest facts or of one times table (`k · n` and `k · n : n`), and certificates for
  each crowned dragon, each region boss won over and the finale. Documents are laid out by the
  narrative toolkit's `layoutPrint` on A4: flashcards 2 × 5 per sheet, printed on both sides
  flipping on the long edge (fronts and backs mirrored), certificates one per page. The preview
  screen draws the sheets in the app (Andika, the art) and prints them with `window.print()` and
  print CSS (`@page` A4, nothing but the sheets); "Save as a file" downloads
  `renderPrintHtml`'s standalone page. A layout that would not fit is reported, never clipped.
- **The grown-ups' settings** add the time limit for one sitting (a preference; the shell counts
  play time per keeper and page and ends a round gently with `endRound{ reason: 'time-limit' }`)
  and the settings the rules own, sent as actions: the daily goal, the Arena, opening regions
  early and running the placement check again.

Rule refusals show a child-friendly line by code (`error.<code>`, `game/errors.ts`).

## 15. Testing

- **Unit** (`test/unit/app/`, Vitest): router stack, keypad state machine (incl. remainder
  mode), gate questions, family and preference schemas, records and recovery, game sessions
  (checkpoints, retry, restore, content activation), content upgrades (`content-upgrade.test.ts`:
  fetching the pinned pack, recovery while it is out of reach, mismatched files, backups, and S2b's
  real save of the deployed slice restored with the shipped `content/history/1.0.0.json` and
  moved to the newest pack with its progress), backups, save status, the catalog (with every
  vocabulary the screens build keys from), tokens, fonts, notation and the verbalizer, voices, the
  audio manifest, sound mapping and game audio; and for the game screens: view readings checked
  against the real rules, response time and the play clock, problem pictures, answer labels,
  card faces, the map layout, the content strings, the v1 boards (`boards.test.ts`) and the
  collections' pages and shelves (`collections.test.ts`); the session's one listener (no view
  copies, a failing listener isolated, restores delivered), the Progress tab's shaping and what
  there is to print, laid out by the narrative toolkit (`progress-print.test.ts`), the Dragon
  Diary and its day record (`diary.test.ts`), the game day and the heads of the finale boss.
- **DOM** (`test/unit/app/dom/`, happy-dom): keypad, choice tiles, the router and Compare Stones.
- **Browser** (`test/e2e/profiles.spec.ts`, Playwright): a new keeper's prologue, first egg and
  hub, kept after a reload; the placement check by keyboard with a kind miss, results and saved
  coins after a reload; the grown-ups' gate; notation, a rule setting, a rename and the pause
  dialog; a tablet screen (1180 × 820, 1024 × 768) holding the hub, the Egg Grid (built by
  tapping, totals told by Check) and the results without page scrolling. `upgrade.spec.ts`: the
  slice's save loaded as a backup opens on the newest pack with its coins, and while the archived
  pack is out of reach it waits on the recovery screen until "Try opening again".
  `progress.spec.ts`: answers show up in the Progress tab, and a times table prints as
  flashcards (preview, print, file) and Back keeps the tab. `goodbye.spec.ts`: a day with
  stickers ends with goodbye and the diary, kept over a reload. `finale.spec.ts`: the
  Seven-Headed Dragon's first head cured after Dragon Castle is opened ahead, and the finale
  beat from a save the rules win in Node (`support/finale.ts`). `map.spec.ts`: with every
  region open, no two names on the map overlap, on the picture at 100 % and under it at 200 %.
  The screen tour (`support/tour.ts`, docs/qa/screens.md) also walks goodbye, the Progress and
  Print tabs, the print preview, Riddle Ruins and the finale. CI runs
  Chromium, WebKit and Firefox. Locally the default project is the installed
  Edge; `$env:DV_E2E_ALL_ENGINES = '1'; npm run test:e2e` runs all three (set `DV_E2E_PORT` to a
  free port when another checkout already serves 4321).

## 16. Phase 3 and later

Still to come: a persisted per-day time limit (today it counts per page load), `fx.*` cues for
the remaining moments, and credits after the finale.

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
- `RuntimeHost.getView()` clones the whole view on every call, and every view or commit listener
  gets its own copy: with the whole v1 pack that is the main cost of a redraw. The shell keeps
  one commit listener per keeper and reads the view it was handed (§4); a read-only, shared view
  accessor would make that unnecessary.
