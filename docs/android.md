# The Android app

Dragon Valley for Google Play: the same game as the web version, packaged as an Android app that
carries every file it needs, works without a connection from its first launch, and cannot reach a
network at all. Package `io.github.rumukh.dragonvalley`, store title "Dragon Valley: Math
Adventure", published by Indigenous Alien. The store listing and the Play Console answers are in
[play/README.md](play/README.md).

## 1. Layout

| Path                                       | What                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `android/`                                 | The Gradle project (wrapper pinned to Gradle 9.9.2 by checksum, Android Gradle Plugin 9.5.3)     |
| `android/app/src/main/java/…/dragonvalley` | The shell: `MainActivity`, `Bridge`, `Documents`, `DeviceSpeech`, `SiteAssets`                   |
| `android/app/src/main/res/`                | Launcher icon (adaptive: the sun colour behind Bubbles), colours, theme, the two native strings  |
| `src/app/platform/`                        | The game's side: `platform.ts` (browser or app), `android.ts` (the bridge), `android-speech.ts`  |
| `scripts/android/`                         | `build.mjs` (game + Gradle + checks), `upload-key.mjs`, `art.mjs` (icon, Play graphics), helpers |
| `docs/play/`                               | Store listing, Play Console answers, the Play icon, feature graphic and screenshots              |

## 2. The shell

`MainActivity` shows one full-screen WebView. The game is built with base `/` into
`out/android/site/www` and packaged as the app's `assets/www`; `SiteAssets` serves it at
`https://appassets.androidplatform.net/` (androidx.webkit's local origin for app files) with each
file's exact media type, the same types the web build allows (`scripts/lib/site.mjs`). Any other
request is answered "not found" in the app, and the page can never navigate away from
`index.html`.

- **No permissions.** The manifest asks for none, so without `INTERNET` nothing in the app can
  reach a network. `scripts/android/build.mjs` fails a build whose APK asks for any permission
  (AndroidX's own signature-only `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` aside), and
  `test/tooling/android.test.ts` checks the manifest.
- **Privacy settings.** WebView usage statistics are opted out and Safe Browsing is off (both in the
  manifest), cookies are refused, file and content URLs cannot load, and Android backup is off
  (`allowBackup="false"`): progress stays on the device, and backup files are the grown-ups' way to
  move it.
- **The origin never changes.** Saved games live in the storage of
  `https://appassets.androidplatform.net`; another origin, or another application ID, would leave
  every child's progress behind after an update.
- **Full screen.** The system bars are hidden (a swipe shows them for a moment). The page keeps
  clear of a camera cutout and of the on-screen keyboard (the keeper's name).
- **Upright on phones.** Below a smallest width of 600 dp the app asks for portrait: on a phone
  lying on its side a round's problem and its keypad do not fit one screen. Tablets and unfolded
  foldables turn freely (Android 16 ignores orientation requests on large screens anyway).
- **Old WebViews.** The game's styles need WebView 111 or later (`color-mix()`, `:has()`, container
  queries) and the bridge needs WebMessageListener. An older WebView gets a plain native message
  asking a grown-up to update Android System WebView.
- **A stopped renderer.** If Android stops the page's renderer (to free memory), the shell starts
  the game again from its title; every answer was already saved.
- Leaving the app (`onPause`) stops speech; the page pauses its round itself when it is hidden.

## 3. The bridge

The page talks to the device only through `dvAndroid`, a WebMessageListener object the shell
injects for its own origin, in the main frame only, before any page script runs
(`src/app/platform/android.ts` ↔ `Bridge.java`). Messages are JSON: a request
`{ id, method, args }` gets `{ id, result }` or `{ id, error }`; events are `{ event, data }`.

| Request         | Arguments                               | Answer                                                                    |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `hello`         |                                         | `{ version: 1 }`; the shell then sends the speech voices                  |
| `files.save`    | `name`, `type`, `text`                  | `{ status: 'saved' }` after every byte is written, or `'cancelled'`       |
| `files.open`    | `maxBytes`                              | `{ status: 'opened', text }` or `'cancelled'`; `too-large`, `read-failed` |
| `print`         | `title`                                 | the system's print screen opens with the page (A4 by default)             |
| `speech.voices` |                                         | installed voices that need no network: `voiceURI`, `name`, `lang`, …      |
| `speech.speak`  | `id`, `text`, `voice`, `rate`, `volume` | refused unless `voice` is one of those voices                             |
| `speech.cancel` |                                         | stops speaking                                                            |
| `exit`          |                                         | the app goes to the background, the game kept as it was                   |

Events: `back` (the Back button or gesture), `speech.voices` (the list changed, or the engine is
ready) and `speech.end` (`{ id }`: a line finished, failed or was stopped).

How the game uses it (`Platform`, `src/app/platform/platform.ts`; a browser keeps its own ways):

- **Backups.** "Save a backup" opens the system's save screen; "Backup of … saved as a file." shows
  only once the file was written. A closed screen says nothing, a failed write says the backup was
  not saved. "Load a backup" and the recovery screen open files through the system's own screen.
- **Read-aloud.** Android's WebView has no Web Speech voices, so `android-speech.ts` gives
  read-aloud the Web Speech API's shape over the device's text-to-speech. Only voices installed on
  the device are listed or used; with none, read-aloud is hidden and the grown-ups' area says to
  install an English voice.
- **Printing.** The print preview's Print opens Android's print screen (a printer or Save as PDF);
  "Save as a file" saves the HTML through the save screen.
- **Back.** It closes the open dialog, pauses a round (Back again resumes it), presses the screen's
  own Back button, or goes back a screen; where nothing is behind, the app goes to the background.
- **Grown-ups' area.** No "Offline" tab (the app is the offline copy), app wording for storage, and
  in About the license notices and the privacy policy, read in place.

`test/e2e/android.spec.ts` runs these flows in a browser against a stand-in for the shell that
answers exactly as `Bridge.java` does; `test/unit/app/android-bridge.test.ts` checks the protocol.

## 4. Building

Requirements: Node 24 (as for the web build), Android Studio or its JDK (17 or later; the scripts
use `JAVA_HOME`, else Android Studio's own) and the Android SDK (`ANDROID_HOME`, else Android
Studio's default place). Gradle downloads its own distribution and the AndroidX libraries; it
installs a missing SDK platform or build-tools itself.

```powershell
npm run android:build        # debug APK: out/android/dragon-valley-<version>-debug.apk
npm run android:release      # release: out/android/dragon-valley-<version>-<code>.aab and .apk
npm run android:art          # redraw the launcher icon and the Play graphics (docs/assets.md)
```

Each build first rebuilds the game into `out/android/site/www`, then runs Gradle, then checks that
the APK asks for no permissions, and prints the SHA-256 of what it wrote. The release bundle is
what Google Play receives; the release APK is the same app for a test device
(`adb install out/android/dragon-valley-<version>-<code>.apk`). The scripts run the wrapper through
`sh` on Linux and macOS; to run `android/gradlew` by hand there, commit it executable once
(`git add --chmod=+x android/gradlew`), since a Windows checkout does not record the bit.

| Setting       | Value                        | Why                                                                   |
| ------------- | ---------------------------- | --------------------------------------------------------------------- |
| `minSdk`      | 26 (Android 8.0)             | adaptive icons; older devices cannot run a recent WebView well        |
| `targetSdk`   | 36 (Android 16)              | what Google Play requires of new apps since 31 August 2026            |
| `compileSdk`  | 37.2                         | AndroidX Activity 1.13 and Core 1.19 need it; behaviour stays at 36   |
| `versionCode` | raise by one for each upload | Google Play refuses a bundle whose code it has seen                   |
| `versionName` | `1.1.0`                      | what the store shows; the About tab shows the game's offline revision |

No native code is packaged, so the 16 KB memory page requirement holds as it is. Release builds are
shrunk with R8 and pass Android lint's release checks.

## 5. The upload key

Google Play signs the app for devices with a key it keeps (Play App Signing). Bundles are uploaded
signed with an upload key that stays on the developer's computer:

```powershell
npm run android:upload-key -- --name "Indigenous Alien"
```

writes `%USERPROFILE%\.dragon-valley\upload-key.jks` (PKCS 12, RSA 4096, valid 30 years) and
`upload-key.properties` beside it, with a generated password; `android/app/build.gradle.kts` reads
the properties (`DV_UPLOAD_KEY` names another file). It never replaces an existing key. Neither file
ever enters the repository. **Back both up together** (a password manager or an encrypted drive);
if they are lost, the account owner asks for an upload key reset in Play Console.

The key made on 2026-11-26 has the certificate SHA-256
`32:2D:A6:7A:D3:DF:15:7E:C6:2F:17:A1:23:60:7A:7E:52:4E:B7:A5:EB:D2:76:62:4D:B1:31:11:71:4F:CF:FF`;
Play Console shows the same value under App integrity once the first bundle is uploaded.

## 6. Releasing on Google Play

1. On `main`, raise `versionCode` (and `versionName` for a visible change) in
   `android/app/build.gradle.kts`; game content changes still go through `npm run content:bump`.
2. `npm run verify`, the e2e suite, then `npm run android:release`.
3. Check the release APK on an emulator or device (§7).
4. In Play Console (first time: create the app as a free game, default language English (United
   Kingdom), and fill in the listing and every App content section from
   [play/README.md](play/README.md)), upload the `.aab` to a testing track with the release notes.
   A personal developer account created after 13 November 2023 must run a closed test with at least
   12 testers opted in for 14 days in a row before it can apply for production.
5. Promote the release to production when the test and Google's review pass.

## 7. Checking a build on a device or emulator

On an Android 16 tablet (the Pixel Tablet emulator is enough) and a phone, with airplane mode on
before the first launch:

- The game starts offline; a new keeper finishes a round; after a force stop and a cold start the
  coins, the day's answers and the dragon's facts are as they were.
- Grown-ups → Saved data: a backup saved to Downloads exists there and loads back into the keeper
  with the same progress; closing the save screen shows no "saved" message.
- With an English voice installed (Settings → Accessibility → Text-to-speech), the voice list shows
  it and Read aloud speaks; without one, the grown-ups' area says to install it.
- Print → a printable → Print opens Android's print screen; Save as PDF writes its pages.
- Back closes the gate, pauses and resumes a round, leaves the hub, and on "Who is playing?" puts
  the app in the background; reopening shows the same screen.
- About shows the privacy policy and, opened in place, the license notices.

The first emulator check (2026-11-26, a debug build in a temporary wrapper) found two faults this
shell fixes: a backup reported as saved when no file had been written, and no read-aloud voices,
because Android's WebView has none. `test/e2e/android.spec.ts` guards both on every CI run.
`docs/play/screenshots/` holds the store screenshots, taken from the release build.

The release build's emulator check (2026-11-27, Android 16 Pixel Tablet and a 1080 × 1920 phone,
offline throughout) passed every item above, an app update keeping the progress. One limitation
remains, on phones only: the game is laid out for tablets, so in portrait some screens scroll a
little. Feeding Time's second row of answers, the rewards after the placement check and Memory
Match's "Turn back" can start below the fold. Nothing is cut off or too small to tap.
