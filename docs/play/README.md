# Google Play: listing and Play Console answers

What to enter in Play Console for **Dragon Valley: Math Adventure**
(`io.github.rumukh.dragonvalley`), developer **Indigenous Alien**. Every answer below follows from
what the app does ([../android.md](../android.md)); change the app and this file together. The
counts in brackets are the characters used of Google Play's limits.

## Create the app

| Field            | Answer                                             |
| ---------------- | -------------------------------------------------- |
| App name         | Dragon Valley: Math Adventure (29 of 30)           |
| Default language | English (United Kingdom) – en-GB                   |
| App or game      | Game                                               |
| Free or paid     | Free                                               |
| Declarations     | Developer Program Policies, US export laws: accept |

## Main store listing

**Short description** (80 of 80):

> Raise dragons by mastering math, grades 1-3. No ads, no accounts, fully offline.

**Full description** (1,572 of 4,000; paste the block as it is, one line per paragraph):

```text
Every right answer warms a dragon egg. Keep going, and the dragon hatches, grows and earns its crown!

Dragon Valley is a cheerful math adventure for children in 1st to 3rd grade (ages 6 to 9), made for the Czech primary-school math program and written in English.

WHAT CHILDREN PRACTISE
• Counting, comparing, and adding and taking away within 20 and 100
• Times tables and division, from ×2 and ×5 to the whole 10 × 10 square
• Division with a remainder, ×10 and ×100, two-digit × one-digit
• Order of operations, comparing expressions, math words and word problems

HOW THEY PLAY
• A short placement check finds the right start, never too easy or too hard
• Fourteen places in the valley, each with a friendly boss to win over
• Board games such as Sharing Feast, Golem Orders, Memory Match and Number Trail
• A missed fact comes back with a picture that shows why, never a penalty
• Coins, stickers, a market of hats and nests, a daily goal and a gift chest
• The Seven-Headed Dragon waits at the end of the road

FOR GROWN-UPS
• No ads, no accounts, no purchases, no tracking and no links out
• Works fully offline: the app has no permission to use the internet
• Up to four children, each with their own dragons, progress and settings
• A grown-ups' area behind a check for adults: progress for every fact, printable flashcards and certificates, backups, a play-time limit, text up to 200 % and reduced motion
• Problems written the Czech school way (3 · 4, 12 : 3) or the international way (3 × 4, 12 ÷ 3)
• Read-aloud uses only the voices installed on your device
```

| Asset             | File                                                         |
| ----------------- | ------------------------------------------------------------ |
| App icon          | `graphics/icon-512.png` (512 × 512)                          |
| Feature graphic   | `graphics/feature-graphic.png` (1024 × 500, no transparency) |
| Phone screenshots | `screenshots/phone-*.jpg` (1080 × 1920, 9:16)                |
| 7-inch tablet     | `screenshots/tablet10-*.jpg` (the same set fits both slots)  |
| 10-inch tablet    | `screenshots/tablet10-*.jpg` (2560 × 1600, 16:10)            |

The screenshots are JPEGs of the release build on Android 16 emulators, within Google Play's
limits (phone sides 320 to 3,840 px, tablet sides 1,080 to 3,840 px, at most 2.3:1; games need
three or more 9:16 or 16:9 phone screenshots to be promoted). The tablet set, in order: the hub
with a dragon, a times-table round, the Sunny Meadow map, the rewards after the placement check,
Memory Match and the Dragon Den. The phone set: choosing the first egg, a times-table round, the
valley map and a dragon hatching.

## Store settings

| Field          | Answer                                                |
| -------------- | ----------------------------------------------------- |
| Category       | Game › Educational                                    |
| Tags           | Educational, Math, Kids (as Play Console offers them) |
| Email          | rus.mukhamedov@gmail.com                              |
| Website        | https://rumukh.github.io/dragon-valley/ (optional)    |
| Privacy policy | https://rumukh.github.io/dragon-valley/privacy.html   |

The privacy policy page is published from `main` by the Pages workflow; it is the same text the
grown-ups' About tab shows (`parent.privacy.*` in `content/catalogs/en.ui.json`). Check that the
address opens before submitting.

## App content

| Section                     | Answer                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy              | The address above                                                                                                                                                                                       |
| Ads                         | No, the app does not contain ads                                                                                                                                                                        |
| App access                  | All functionality is available without special access. Note for reviewers: the grown-ups' area opens after holding the button for 2 seconds and answering a two-digit multiplication; there is no login |
| Content rating              | Questionnaire as below                                                                                                                                                                                  |
| Target audience and content | Ages 6-8 and 9-12. The app is designed for children, so the Families policy applies; nothing in it needs a neutral age screen                                                                           |
| News app                    | No                                                                                                                                                                                                      |
| Data safety                 | As below                                                                                                                                                                                                |
| Advertising ID              | No, the app does not use an advertising ID                                                                                                                                                              |
| Government app              | No                                                                                                                                                                                                      |
| Financial features          | None                                                                                                                                                                                                    |
| Health apps                 | Not a health app                                                                                                                                                                                        |

### Content rating questionnaire

Category: **Game**. Every content question is answered **No**: no violence (bosses are won over
by right answers, which tickle or cure them), nothing frightening, no sexual content, no bad
language, no controlled substances, no crude humour, no gambling, simulated gambling or loot boxes
(coins are earned by playing and only buy hats and nests). Interactive elements: users cannot
interact or exchange content, no location is shared, nothing can be bought, and there is no
unrestricted internet. Expected rating: IARC 3+, PEGI 3, ESRB Everyone, USK 0.

### Data safety

- Does your app collect or share any of the required user data types? **No.**
- Nothing leaves the device: the app has no internet permission, no analytics or crash SDK, and
  only AndroidX libraries. Names, pictures, progress and settings stay in the app's storage; a
  backup file goes only where a grown-up saves it, at their request.
- Because no data is collected, there are no accounts, nothing to encrypt in transit and no
  deletion request to offer; uninstalling the app deletes everything.

### Families policy

- No ads, no SDKs, no data collection; no location, contacts, camera or microphone.
- No links out of the app; the grown-ups' area is behind an adult check.
- Read-aloud uses only voices installed on the device (Android text-to-speech, network voices
  refused by the shell).

## Testing and release

- A personal developer account created after 13 November 2023 needs a **closed test** with at least
  **12 testers opted in for 14 days in a row** before it can apply for production access. Add the
  testers' Google accounts to the closed track's tester list and share the opt-in link.
- Upload `out/android/dragon-valley-<version>-<code>.aab` (`npm run android:release`) and accept
  Play App Signing on the first upload; the upload key's certificate is in
  [../android.md](../android.md) §5.

**Release notes, 1.1.0 (1)** (en-GB):

> The first Android release: the whole Dragon Valley adventure for grades 1 to 3, fully offline,
> with no ads and no accounts.
