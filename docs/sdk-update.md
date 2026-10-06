# Updating the Aegis SDK

Dragon Valley consumes the Aegis SDK (`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`,
`@aegis/browser`) as a **complete, pinned set of local tarballs**, the standalone route documented
in aegis-engine `docs/api/standalone-consumers.md` and ADR-0012. Nothing is fetched from a registry,
nothing is imported from an engine checkout, and the engine repository is never modified from here.

## Current pin

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Engine commit  | `5949a7fa1a34bf66a054220585a0d05699c61d70` (aegis-engine `main`)    |
| SDK version    | `0.0.0-local.r5949a7fa1a34.d2c83c1814069db10`                       |
| Source digest  | `2c83c1814069db10a5cd009793fcc36898b06492b1302232005db9294302708d`  |
| Packed with    | Node v24.18.0, npm 11.16.0, TypeScript 5.9.3 (Windows)              |
| Consumer check | `npm run test:consumer` passed (all 12 checks, both reference labs) |

| Tarball (`vendor/aegis/<version>/`)                               | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `aegis-core-0.0.0-local.r5949a7fa1a34.d2c83c1814069db10.tgz`      | `e27f8c31a9c29a24165bfa6c89fafdfc720b19d5c82d730e48f1c98ff01c1faf` |
| `aegis-runtime-0.0.0-local.r5949a7fa1a34.d2c83c1814069db10.tgz`   | `6994cd7fb6181383f594f280f0d02645e1e834ca6962ed89727d342ccb3155e9` |
| `aegis-narrative-0.0.0-local.r5949a7fa1a34.d2c83c1814069db10.tgz` | `82042bb0719fd7191621d15d3d681c6c36e542d97f6be3655c4777122be56efd` |
| `aegis-browser-0.0.0-local.r5949a7fa1a34.d2c83c1814069db10.tgz`   | `755263410d8b794fb06299052be3bf8f4673ae7cafcf36857693f8729fcd6a42` |

`vendor/aegis/<version>/artifacts.json` is the packer's own manifest (tarball names, SHA-256, npm
integrity, the full source inventory and tool versions). `test/tooling/vendor-sdk.test.ts` checks
every tarball against both that manifest and the literal pin above, checks that `package.json`,
`package-lock.json` and `node_modules` all name exactly this set, and fails on any extra file.

## Procedure

Run these commands in PowerShell on the development machine. Paths use backslashes; the npm
commands are identical on Linux and macOS.

### 1. Produce and check a new artifact set (in the aegis-engine checkout)

Never edit or commit anything in the engine checkout. Its outputs go to its ignored `out\`.

```powershell
cd C:\Users\rmukhamedov\dev\aegis-engine
git pull --ff-only
git status --short                       # must print nothing: packing refuses dirty SDK inputs
$rev = git rev-parse HEAD                 # the full 40-character commit
$short = $rev.Substring(0, 7)
npm ci
npm run build
npm run pack:sdk -- --revision $rev --out out\sdk-$short
npm run test:consumer -- --artifacts out\sdk-$short
```

`pack:sdk` refuses an existing output directory; choose a fresh `--out` for every attempt.
`test:consumer` must exit 0. Keep its JSON output for the pull request description. If either
command fails, stop: report the failure to the coordinator, who files an aegis-engine issue. Do not
patch tarballs or work around a defect inside this repository.

### 2. Replace the vendored set (in this repository)

```powershell
cd <dragon-valley worktree>
$v = (Get-Content C:\Users\rmukhamedov\dev\aegis-engine\out\sdk-$short\artifacts.json -Raw | ConvertFrom-Json).version
git rm -r --quiet vendor\aegis
New-Item -ItemType Directory vendor\aegis\$v | Out-Null
Copy-Item C:\Users\rmukhamedov\dev\aegis-engine\out\sdk-$short\* vendor\aegis\$v\
```

Copy **all four** tarballs and `artifacts.json`, nothing else. Only one version directory may exist.

### 3. Install all four tarballs in one npm invocation

```powershell
$d = "./vendor/aegis/$v"
npm install --save-exact "$d/aegis-core-$v.tgz" "$d/aegis-runtime-$v.tgz" "$d/aegis-narrative-$v.tgz" "$d/aegis-browser-$v.tgz"
npm run lockfile:fix
```

A single invocation lets npm resolve each package's exact sibling versions to the vendored files.
Installing one tarball at a time would let a sibling dependency resolve elsewhere. `lockfile:fix`
rewrites any corporate-feed URLs that npm wrote back into `package-lock.json` (see below).

### 4. Re-pin the vendor test

Edit `PINNED` in `test/tooling/vendor-sdk.test.ts`: `revision`, `version` and the four `sha256`
values, copied from the `pack:sdk` output. Update the "Current pin" tables in this document.

### 5. Prove it

```powershell
npm ci                 # the lockfile installs and node_modules is exactly the new set
npm run verify         # build, typecheck, lint, format, content, tests, lockfile
npm run test:e2e       # browser smoke through the system Edge/Chrome channel
```

Then read the engine changes between the old and new commits (`git log <old>..<new>` in the
engine checkout), especially `packages/runtime` snapshot and schema behaviour, `docs/api/*` and
`docs/adr/*`:

- A change to the runtime snapshot format, `ContentPack` hashing, PRNG or `dataHash` can invalidate
  saved games and every pinned golden hash. Golden hashes are re-pinned only with an explanation in
  the commit message (docs/testing.md), and saves need an explicit migration (docs/contract.md).
- Browser save, checkpoint and offline changes can affect stored saves and installed packs.

### 6. Commit and open a pull request

One commit, for example `Update Aegis SDK to <short>`, containing `vendor/aegis/**`,
`package.json`, `package-lock.json`, the vendor test pin and this document. Put the `pack:sdk`
summary (version, tarball SHA-256 values) and the `test:consumer` result in the PR description.
The coordinator reviews and merges.

## Why the lockfile keeps public registry URLs

The development machine can reach npm only through the corporate proxy pinned in `.npmrc`
(`https://packagefeedproxy.microsoft.io/npm/`). Do not remove or change it. npm writes the proxy's
internal feed URLs into `package-lock.json`, and GitHub runners cannot fetch those. The committed
lockfile therefore keeps canonical `https://registry.npmjs.org/` URLs: CI fetches them directly
(the workflows set `NPM_CONFIG_REGISTRY` at job level), and behind the proxy npm's default
`replace-registry-host=npmjs` rewrites them back. After **any** `npm install` or `npm update`, run
`npm run lockfile:fix`. `test/tooling/lockfile-registry.test.ts` fails the gate if you forget.
The script is ported from aegis-engine (MIT) with attribution in its header.

## Toolchain notes

- Node 24 and npm 11 (`engines` in `package.json`). TypeScript is pinned to `^5`, not 7.x.
- esbuild is pinned to `0.27.7`, matching the engine. Its postinstall is approved in
  `allowScripts`.
- Playwright never downloads browsers on the development machine. Locally it drives the installed
  Microsoft Edge (`channel: 'msedge'`, the default) or Chrome (`DV_BROWSER_CHANNEL=chrome`). CI
  installs Chromium, WebKit and Firefox itself.
