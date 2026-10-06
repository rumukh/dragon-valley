/**
 * Verify the committed audio pack: re-synthesize every recipe in memory and require byte-identical
 * WAVs, manifest and provenance, then run the quality gates (budget, true peak, loudness tiers,
 * durations, DC, clicks, loop seams). Exits non-zero on any problem.
 *
 *   node scripts/audio/verify.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUDIO_DIR,
  buildManifest,
  buildProvenance,
  loadManifestSource,
  MANIFEST_PATH,
  PROVENANCE_PATH,
  REPO_ROOT,
  renderAll,
  sha256,
  stableJson,
} from './lib/pipeline.mjs';
import { packProblems } from './lib/quality.mjs';

const problems = [];
const entries = renderAll();
const source = loadManifestSource();

for (const entry of entries) {
  const path = join(REPO_ROOT, entry.src);
  if (!existsSync(path)) {
    problems.push(`${entry.src} is missing (run npm run audio:build)`);
    continue;
  }
  const committed = sha256(readFileSync(path));
  if (committed !== entry.sha256)
    problems.push(
      `${entry.src}: committed sha256 ${committed} but re-synthesis gives ${entry.sha256}`,
    );
}
const expected = new Set(entries.map((e) => e.src));
for (const folder of ['sfx', 'music']) {
  const dir = join(AUDIO_DIR, folder);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir))
    if (!expected.has(`assets/audio/${folder}/${name}`))
      problems.push(`assets/audio/${folder}/${name} has no recipe`);
}
const compare = (path, value, label) => {
  if (!existsSync(path)) problems.push(`${label} is missing`);
  else if (readFileSync(path, 'utf8') !== stableJson(value))
    problems.push(`${label} differs from a fresh build (run npm run audio:build)`);
};
compare(MANIFEST_PATH, buildManifest(entries, source), 'assets/audio/manifest.json');
compare(PROVENANCE_PATH, buildProvenance(entries, source), 'assets/audio/provenance.json');
problems.push(...packProblems(entries, source));

const bytes = entries.reduce((a, e) => a + e.wav.length, 0);
if (problems.length) {
  for (const p of problems) console.error(`audio:verify: ${p}`);
  console.error(`audio:verify failed with ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(
  `audio:verify passed: ${entries.length} sounds reproduce byte-identically, ${bytes} bytes in budget.`,
);
