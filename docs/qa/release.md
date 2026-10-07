# Release checklist: v1.0.0

Everything below holds on the commit to be tagged. Items marked _(person)_ cannot be checked by a
test; the rest are read from CI and the live site. The coordinator ticks the list and tags.

## 1. The build

- [ ] `main` is green on the release commit: CI (verify on Ubuntu and Windows, and the 16 e2e jobs:
      4 on Chromium, 4 on Firefox, 8 on WebKit) and the Pages deployment from that commit.
- [ ] Each e2e job summary lists only the known defects below, and its "Performance" section shows
      every budget met ([performance.md](performance.md)).
- [ ] The live site is that commit. The build is reproducible, so building the commit again and
      comparing the offline revision proves the deployed files are its files:

  ```powershell
  node scripts/build.mjs --base /dragon-valley/ --out out/release-check
  Select-String -Path out/release-check/index.html -Pattern 'dv-offline-revision'
  (Invoke-WebRequest https://rumukh.github.io/dragon-valley/ -UseBasicParsing).Content |
    Select-String -Pattern 'dv-offline-revision' | ForEach-Object { $_.Matches.Value }
  ```

- [ ] The content pack's revision is final for v1 (today `1.3.0`; `1.0.0`, `1.1.0` and `1.2.0` are
      archived). Every later content change runs `npm run content:bump`, which archives `1.3.0` in
      `content/history/` so v1 saves upgrade ([contract.md](../contract.md),
      [content.md](../content.md) §1).
- [x] The README's four screenshots (`docs/images/`) show the release build: retaken by #57 from
      the tablet screen walks (1180 × 820, `screens.spec.ts`) as JPEGs of about 100 KB each, the
      hub now saying "Bubbles' egg". Retake them the same way after any visible change.

## 2. Defects and decisions

- [x] No open blocker or major defect ([defects.md](defects.md)): the last major one, DV-QA-17,
      was fixed by #46. None is open: the last three minor ones (DV-QA-13 and DV-QA-15 in WebKit,
      DV-QA-19 "Bubbles's egg" on every engine) were fixed by #57.
- [x] _(person)_ The copy decisions are made ([copy-review.md](copy-review.md), "Needs a human
      decision") and the agreed changes merged (S2b: #38, #40, #43; S3: #41, #46). Possessives
      were reviewed after #52; the one finding, DV-QA-19, was fixed by #57.
- [x] The accessibility advice is fixed or accepted ([accessibility.md](accessibility.md):
      `boot-status` hidden from screen readers, toasts, the startup-failure screen's heading): fixed
      by #46; no axe finding of any level since.

## 3. Human checkpoints (plan §4.6)

- [ ] _(person)_ Dragon designs and painted backgrounds approved (the screens for review:
      [screens.md](screens.md)).
- [ ] _(person)_ Audio auditioned: every effect and the four music loops.
- [ ] _(person)_ Copy reviewed (above).
- [ ] _(person)_ Playtest with the child, and its findings triaged.
- [ ] _(person)_ The manual accessibility checks ([accessibility.md](accessibility.md), "Needs a
      person"), at least VoiceOver with Safari on an iPad.

## 4. On real devices, on the live site

- [ ] _(person)_ iPad, Safari: a new keeper through the story and the placement check to the first
      hatch; the grown-ups install it for offline play; in airplane mode the game reopens and keeps
      the progress.
- [ ] _(person)_ An Android tablet with Chrome, and a Windows laptop with Edge: the same first run.
- [ ] _(person)_ Read-aloud speaks with the device's English voice; on a device without one the
      button is hidden and the grown-ups' area says why.
- [ ] _(person)_ Nothing leaves the device: the browser's network panel lists only requests to
      `rumukh.github.io/dragon-valley/`.

## 5. Tag and release (coordinator)

### The release candidate

Once §1 and §2 hold, the commit is tagged as a release candidate and published as a GitHub
pre-release, so everyone doing the human checkpoints (§3, §4) checks the same known build:

```powershell
git tag -a v1.0.0-rc.1 -m "Dragon Valley v1.0.0-rc.1"
git push origin v1.0.0-rc.1
gh release create v1.0.0-rc.1 --repo rumukh/dragon-valley --verify-tag --prerelease --title "Dragon Valley v1.0.0-rc.1" --notes-file release-notes-rc.md
```

A finding from the checkpoints is fixed on `main` and the next candidate is tagged (`-rc.2`, …).
v1.0.0 goes on the last candidate's commit once everything above holds.

### v1.0.0

On the release commit, once everything above holds:

```powershell
git fetch origin
git switch main
git pull --ff-only
git log -1 --format='%H %s'          # the commit CI and Pages built
git tag -a v1.0.0 -m "Dragon Valley v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --repo rumukh/dragon-valley --verify-tag --title "Dragon Valley v1.0.0" --notes-file release-notes.md
```

The tag marks a commit; it does not deploy. Pages publishes `main` on every push, so the live
site follows `main` after the release too.

### Release notes outline

1. What it is, in two sentences, and the play link.
2. What v1 holds: the nine regions and their bosses, the Seven-Headed Dragon, dragons that grow with
   real mastery, the Magic Window, coins, the market and stickers, the daily goal and gift, up to
   four children, the grown-ups' area, offline play, read-aloud, Czech or international notation
   ([design.md](../design.md)).
3. For grown-ups: no accounts, ads, tracking or links out; progress stays on the device, with
   backups in the grown-ups' area.
4. Accessibility in a few lines, linking [accessibility.md](accessibility.md).
5. Known issues: the defects still open at release.
6. Credits: the Aegis SDK, the Andika font (SIL Open Font License), and the provenance of the art
   and audio ([assets.md](../assets.md)).
