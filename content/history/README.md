# Content history

Every content-pack revision that has been **shipped** (played by a child on a deployed build) is
archived here as `<revision>.json`, byte-for-byte as shipped, and never edited again.

A save pins the exact pack it was played with (pack ID, revision and content hash). To upgrade a
save, the shell restores it with its archived pack, then activates the current pack at a safe
boundary (`host.stageContent` + `host.activateContent(pack, 'boundary')`, docs/contract.md).

Rules:

- Archive a revision when it ships; bump `revision` in `content/dragon-valley.content.json` for any
  later change. A revision string is never reused for different content.
- Every archived pack must stay valid under the current content schema. The schema therefore only
  grows compatibly (new union variants, new optional fields).
- Archived packs are shipped with the site so an installed or offline copy can migrate saves.
- `test/unit/contract/content.test.ts` enforces all of the above; update its list of shipped
  revisions when you archive one.

Nothing has shipped yet: the release-v1 work archives `1.0.0.json`.
