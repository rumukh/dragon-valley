# Content history

Every content-pack revision merged to `main` was deployed to the live site, so children's saves pin
it. When the next revision replaces it, `npm run content:bump -- <next revision>` archives it here
as `<revision>.json`, byte for byte as deployed. An archived pack is never edited again.

| File         | Revision | What                                         | Live from main |
| ------------ | -------- | -------------------------------------------- | -------------- |
| `1.0.0.json` | 1.0.0    | the Region 1 slice                           | `373a5d2`      |
| `1.1.0.json` | 1.1.0    | v1: the nine regions                         | `78c4943`      |
| (live)       | 1.2.0    | the balance from the learner simulations     | `57855d3`      |

The live pack is `content/dragon-valley.content.json`; it is archived here when the next revision
replaces it.

## How an old save moves on

A save pins the exact pack it was played with (pack ID, revision and content hash), and the
runtime restores it only with that pack. For a save that pins an older revision, the shell fetches
`content/history/<revision>.json` from the build (`src/app/content/history.ts`) and restores the
save with it. Then, at a safe boundary (the hub, never mid-round), it moves the save to the live
pack (`host.stageContent` + `host.activateContent(pack, 'boundary')`, in
`src/app/persistence/game-session.ts`), and the rules carry the child's progress forward
(docs/contract.md). A pack that cannot be fetched, or that does not match the save, leaves the save
untouched for recovery.

## Rules

- Every content change merged to `main` gets a new revision (patch for balance or text, minor for
  new levels or regions): `npm run content:bump -- <revision>` archives the deployed pack here and
  sets the new revision ([docs/content.md](../../docs/content.md) §1). A revision is never reused
  for different content. A change to the catalogs alone needs none (saves pin the pack, not its
  strings), unless it changes a story's word count (`words` is in the pack).
- `REVISIONS` in `test/unit/contract/content.test.ts` pins every revision's content hash. The test
  checks that every revision before the live one is archived here and that no archived pack has
  changed.
- Every archived pack stays valid under the current content schema, so the schema only grows
  compatibly (new union variants, new optional fields).
- Every catalog key an archived pack uses stays in `content/catalogs/en.content.json`: a restored
  save shows those strings until it moves to the live pack.
- Archived packs are shipped with the site and the offline install, so any copy can migrate saves.
- `scripts/validate-content.mjs` and `test/unit/contract/content.test.ts` enforce all of the above.
