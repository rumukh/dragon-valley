# Audio

Dragon Valley's sound effects and music are original works synthesized by this repository. The
JSON recipes in `assets/audio/recipes/` are the source; `npm run audio:build` renders them into
the shipped WAV files, the manifest and the provenance record. The same recipes produce the same
bytes on every platform.

| What                    | Where                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| 29 effects, 4 loops     | `assets/audio/sfx/*.wav`, `assets/audio/music/*.wav` (shipped)        |
| Manifest (for S3)       | `assets/audio/manifest.json` (shipped)                                |
| License note            | `assets/audio/LICENSE.txt` (shipped): MIT, original works             |
| Recipes, patch library  | `assets/audio/recipes/*.json` (repository only, not shipped)          |
| Provenance              | `assets/audio/provenance.json` (repository only, not shipped)         |
| Synthesizer and tooling | `scripts/audio/` (Node 24 ESM, no npm dependencies, no native tools)  |
| Tests                   | `test/unit/audio/` (run by `npm run verify` on ubuntu and windows CI) |

## Format and budget

- **16-bit PCM WAV, mono, 22 050 Hz**, with a canonical 44-byte header. The whole pack is about
  **6.96 MB** against an **8 MB** budget (the test enforces 8 000 000 bytes).
- **Why 22.05 kHz.** At 32 kHz, the 126 s of music plus 32 s of effects would be about 10 MB and
  break the 8 MB budget, or force loops shorter than the 20–40 s brief. At 22.05 kHz the pack fits
  with about 1 MB to spare for future regions.
  - The palette is deliberately warm. Instrument energy sits below about 9.5 kHz, and the
    partials above that are what make synthesized sound fizzy or harsh. Tablet speakers reproduce
    little there anyway.
  - 22 050 Hz is exactly half of 44 100 Hz.
  - Decoded memory depends on the AudioContext rate, not the file rate, so 32 kHz files would not
    save memory.
- **Why WAV, not OGG.** WAV needs no encoder dependency, has deterministic bytes that the tests can
  pin, and decodes in every browser, including WebKit.
- Every file has a true peak of **-1 dBTP or lower** (4x oversampled), no DC offset and no clicks.
  One-shots start and end on digital zero. Loops are sample-accurate. Every loop is also a whole
  number of frames at 44.1 and 48 kHz, so a browser never truncates a decoded loop.

### Loudness tiers

`playEffect` has no per-call gain, so **the mix is baked into the files**. Leave both buses at
volume 1.0 by default; parent settings scale them down.

| Tier        | Target (LUFS)     | Sounds                                                                |
| ----------- | ----------------- | --------------------------------------------------------------------- |
| `feedback`  | -15 momentary max | chimes, coins, stars, sticker, unlock, pane, gift, purchase, fanfares |
| `character` | -16 momentary max | chomp, eggs, dragon chirp, boss laugh                                 |
| `soft`      | -18 momentary max | miss, blocked, yawn: always gentle, never punishing                   |
| `ui`        | -21 momentary max | ui-tap, keypad-tap, swoosh: frequent, so quiet                        |
| `music`     | -23 integrated    | valley, boss, victory                                                 |
| `musicCalm` | -26 integrated    | practice: unobtrusive while the child thinks                          |

Every effect is within ±0.5 LU of its tier, measured with ITU-R BS.1770 K-weighting. Loops sit
8–11 LU under the feedback tier.

### Keys

All the effects that play over music share one tonal world:

- The answer chimes climb a **C major pentatonic** ladder.
- **practice** and **victory** are in C major, and **boss** is in A minor, which uses the same
  pentatonic notes.
- Level-complete and the stars are in C major.

So chimes and fanfares always land in key over the loop that is playing.

## Integration with `@aegis/browser/audio` (for S3)

S3 owns the real wiring. This is the recommended shape (see the SDK's
`docs/api/browser-services.md`, "Audio transport").

### Creating the controller

```ts
import { createNarration } from '@aegis/browser/audio';
import type { AudioPack } from '@aegis/browser/audio';

const audio = createNarration({
  baseUrl: document.baseURI, // slash-terminated deployment base, for example /dragon-valley/
  onState: (state) => {
    /* show "Tap for sound" while state.status === 'blocked' */
  },
  // Recommended: run the context at the pack's own rate (see "Loop seams" below).
  contextFactory: () => {
    try {
      return new AudioContext({ sampleRate: 22050, latencyHint: 'interactive' });
    } catch {
      // Fallback: a browser that rejects the option still gets working, seamless audio (below).
      return new AudioContext();
    }
  },
});
```

**Context rate: recommendation and fallback**

- **Recommended.** Construct the context with `{ sampleRate: 22050 }`, the pack's own rate.
  `decodeAudioData` then does no resampling and loop seams are exact. The browser resamples the
  context's output stream continuously, so audio quality is unchanged. Decoded PCM is also
  smaller.
- **Fallback.** Construct with the option inside `try`/`catch`, and fall back to the default
  constructor `new AudioContext()` if a browser rejects it.
  - Chrome 74+, Edge 79+, Firefox 61+ and Safari 14.1+ (iOS 14.5+) accept the option.
  - Older WebKit may throw `NotSupportedError`, or may silently ignore the option.
  - Firefox's known issue with custom rates affects only MediaStream sources, which the game does
    not use. Read-aloud uses Web Speech, not Web Audio.
- **Either path is safe.** On the default path the browser resamples each file to 44.1 or 48 kHz
  at decode time. The worst measured seam error is -54.9 dBFS (see the table under "Loop seams"),
  which is inaudible.
- `audio` exposes no context getter. To log which path is active, keep a reference to the context
  your factory returns and read its `sampleRate`.

- `manifest.json` lists every sound with an `id` and a site-relative `src`. Register them as one
  pack:

  ```ts
  const pack: AudioPack = {
    id: manifest.packId, // 'dragon-valley-audio'
    revision: manifest.revision, // 'audio-<digest>', changes whenever any file changes
    assets: manifest.sounds.map(({ id, src }) => ({ id, src })),
    lines: [],
  };
  audio.registerPack(pack);
  ```

- Call **`audio.unlock()` directly in the first trusted gesture**: the title-screen tap (plan
  §2.8). A failed or suspended unlock publishes `blocked`; retry on the next tap.
- **Effects:** `audio.playEffect(pack.id, soundId)`. Always catch the promise. A dropped effect
  (`limit`, `blocked`) must never break gameplay.
- **Music:** `audio.setAtmosphere({ packId: pack.id, asset, fadeSeconds: 1.2 })` when the screen
  state changes. Calls for the current state are idempotent. Pass `null` for explicit silence.
- **Volumes:** `audio.setVolume('music' | 'effects', value)` from the parent settings, 0 to 1,
  default 1.
- **Restore, handoff and privacy boundaries:** call `audio.clear()`, then re-select the music for
  the new projection. Never replay historical one-shot events.
- Pause and resume on visibility change. `dispose()` on teardown.
- **Read-aloud** uses Web Speech, not narration lines, so the SDK's automatic ducking does not
  apply. Consider lowering the music bus while the device speaks.

### Music states

| State                                    | Loop       |
| ---------------------------------------- | ---------- |
| `title`, `hub`, `map`, `market`, `album` | `valley`   |
| `round`, `placement`                     | `practice` |
| `boss`, `arena`                          | `boss`     |
| `results`, `finale`                      | `victory`  |

### Event map (advisory)

The manifest's `events` object holds the full list and notes. Domain event names follow plan
§3.3; the final names come from the domain contract. `ui.*` and `fx.*` are shell presentation cues.

| Event                 | Sounds                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| `answer.correct`      | `chime-1`..`chime-5` by streak, holding at 5; any miss restarts at 1    |
| `answer.incorrect`    | `miss`                                                                  |
| `fx.dragon-eating`    | `chomp` (Feeding Time, about 0.3 s after the chime)                     |
| `coins.earned`        | `coin` for 1–4 coins, `coin-shower` for 5 or more                       |
| `level.completed`     | `level-complete`, then `star-1`..`star-3` about 0.4 s apart             |
| `dragon.hatched`      | `egg-wobble`, `egg-crack`, `hatch-fanfare` in sequence                  |
| `dragon.grew`         | `map-unlock`, then `dragon-chirp`                                       |
| `dragon.crowned`      | `hatch-fanfare`                                                         |
| `pane.lit`            | `pane-light` (stagger several by 150 ms or more, at most 3 overlapping) |
| `region.unlocked`     | `map-unlock`                                                            |
| `sticker.earned`      | `sticker`                                                               |
| `quest.completed`     | `chime-5`                                                               |
| `gift.opened`         | `gift-open`                                                             |
| `item.purchased`      | `purchase`                                                              |
| `boss.defeated`       | `boss-won`                                                              |
| `finale.completed`    | `hatch-fanfare`, then music state `finale`                              |
| `fx.boss-laugh`       | `boss-laugh` when a correct answer fills the boss meter                 |
| `fx.dragon-happy`     | `dragon-chirp`                                                          |
| `fx.dragon-sleepy`    | `dragon-yawn` (after the daily goal)                                    |
| `ui.tap`, `ui.keypad` | `ui-tap`, `keypad-tap`                                                  |
| `ui.navigate`         | `swoosh`                                                                |
| `ui.blocked`          | `blocked`                                                               |

`item.promoted`, `reask.scheduled`, `session.started` and `round.completed` are silent by design:
they coincide with sounds that already play.

### Voice limits and throttling

`createNarration` allows **16 active voices** by default, and a music crossfade holds two. A new
effect beyond the limit is rejected with a `limit` error. Keep effects within about 12 and throttle
bursts. Suggested limits are in `manifest.voices.throttle`:

- One `coin-shower` replaces any burst of five or more coins. It is a single voice.
- `coin`: at least 70 ms apart, at most 3 at once.
- Keypad and UI taps: at least 35 ms apart, at most 2 at once.
- `chomp`: one at a time. Panes: 150 ms apart, at most 3 at once.
- Sparkle-heavy rewards (stars, sticker, gift, unlock): no more than two at once.

### Memory and first-play latency

Buffers decode lazily on first use and stay cached until `releasePack`. Decoded PCM is about
**13.9 MB at a 22.05 kHz context** (about 30 MB at 48 kHz), well inside the 64 MiB default budget.
The first play of each effect pays a fetch (from the offline cache) and a decode, a few
milliseconds for these small files. The SDK has no explicit preload call. If a first-play delay
is ever noticeable, report it as an SDK gap rather than working around it.

## Loop seams and decode-time resampling

Loops are rendered circularly. Note tails, filters, reverb, echo and the limiter all wrap around
the loop point, so each file is exactly one period of a periodic signal.

Browsers resample every file to the AudioContext rate in `decodeAudioData` and pad both ends with
zeros. A looping buffer can therefore pick up a tiny error at its seam. To minimise it:

- Each loop's start point was chosen at its quietest instant within the last beat.
- The final pickup notes are detached.

Measured in Chromium 151 by decoding each loop once and tiled twice at each context rate, then
comparing the samples around the seam:

| Loop     | Recommended path: 22.05 kHz context | Fallback path: 44.1 kHz | Fallback path: 48 kHz |
| -------- | ----------------------------------- | ----------------------- | --------------------- |
| valley   | 0 (exact)                           | -60.2 dBFS              | -59.5 dBFS            |
| practice | 0 (exact)                           | -57.7 dBFS              | -57.0 dBFS            |
| boss     | 0 (exact)                           | -55.6 dBFS              | -54.9 dBFS            |
| victory  | 0 (exact)                           | -59.2 dBFS              | -58.6 dBFS            |

- **Recommended path.** The decoded buffer keeps the file's frame count and maps 1:1 onto the
  file's samples, so the loop wraps with no error at all. The only difference is Chrome's int16 to
  float scale, which divides positive samples by 32767 and negative ones by 32768.
- **Fallback path.** The error lasts about a millisecond at the downbeat, 55 dB or more below full
  scale, which is inaudible. Every loop is a whole number of frames at 44.1 and 48 kHz, so the
  decoded loop period never drifts.
- The test suite simulates the decode resampler and fails if a seam error exceeds -45 dBFS.

## Working on the sounds

```sh
npm run audio:build     # render every recipe; writes WAVs, manifest.json and provenance.json
npm run audio:verify    # re-render in memory: byte-identical files, then every quality gate
npm run audio:report    # analysis JSON and waveform/spectrogram PNGs in out/audio-report/
npm run audio:audition  # out/audio-audition/index.html: play everything like the game does
```

`audio:report` and `audio:build` accept `--only id1,id2`.

To change a sound:

1. Edit its recipe.
2. Run `npm run audio:build`.
3. Check the report or the audition page.
4. Commit the recipe, the WAV, `manifest.json` and `provenance.json` together. CI re-synthesizes
   everything on ubuntu and windows and fails on any byte difference.

### Recipes

Each recipe is one JSON file named after its sound ID: lower-case kebab words, valid as a content
ID.

- **`kind: "sfx"`**: a `duration`, plus `tracks` of `voices` (explicit events in seconds), `notes`
  (melody notation at a tempo) or `scatter` (seeded random clusters such as coin showers).
- **`kind: "music"`**: `tempo`, `meter`, `form` and `sectionBars`. Chord `chords` charts per
  section feed voice-led `pattern`s (`comp`, `sustain`, `arp`). Melodies and bass lines are written
  as `phrases`, and drums use step `steps`.
- **Instruments** extend the shared patch library `recipes/_patches.json` (`{ "extends":
"celesta" }`) and override any field. Patches cover sources (band-limited oscillators,
  additive/modal partials, 2-operator FM, coloured noise), envelopes, filters, formants, vibrato,
  drift and drive.
- **Mixing:** each track has a gain and sends to `buses` (FDN reverb, damped echo). The master
  normalises to the recipe's loudness tier under a soft look-ahead limiter and a -1 dBTP ceiling.
- **Melody notation:** `C5:q F5:e G5:e A5:q | ...`. Durations are `w h q e s t`, with dots and
  `3` for triplets. Articulations are `'` staccato, `_` tenuto, `>` and `!` accents, `?` ghost and
  `~` tie. Dynamics tokens are `pp`..`ff`. Every bar is checked against the meter.
- **Events:** `recipes/_manifest.json` is the source of the event map, music states, tiers and
  throttling hints.

### Determinism

ECMAScript lets engines approximate `Math.sin`, `Math.exp`, `Math.pow`, `Math.log` and
`Math.sqrt`. The synthesizer therefore never calls them:

- `scripts/audio/lib/dmath.mjs` implements sine, exponential, logarithm, square root and friends
  with IEEE-754 basic arithmetic only. That arithmetic is correctly rounded everywhere, and the
  error is about 1e-15.
- Randomness is seeded mulberry32 and FNV/murmur hashing. Every voice, scatter and humanised note
  derives its own seed from the recipe seed, so loops stay periodic and edits stay local.
- Dither is seeded TPDF.
- `test/unit/audio/determinism.test.ts` pins literal bit patterns of the primitives.
  `test/unit/audio/pack.test.ts` re-synthesizes all 33 files against the SHA-256 values committed
  in `provenance.json`. Both run on ubuntu and windows.

## Known limitations

- Everything was verified numerically: levels, spectra, onsets, seams, clicks and a real Chromium
  decode. Human listening is the audition gate; tweak recipes from that feedback.
- BS.1770 momentary loudness under-reads very short sounds, so the UI tier is set lower on purpose.
- The instruments are stylised synthesis (clarinet, accordion, voices), not sampled realism. They
  were chosen to be warm, light and friendly on tablet speakers.
