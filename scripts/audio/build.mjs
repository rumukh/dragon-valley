/**
 * Regenerate the audio pack from its recipes.
 *
 *   node scripts/audio/build.mjs                 render everything, write WAVs, manifest, provenance
 *   node scripts/audio/build.mjs --only a,b      render and write only these WAVs (fast iteration;
 *                                                manifest and provenance are left untouched)
 *
 * Output is deterministic: running it again, on any platform, rewrites identical bytes.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  AUDIO_DIR,
  buildManifest,
  buildProvenance,
  loadManifestSource,
  MANIFEST_PATH,
  PROVENANCE_PATH,
  REPO_ROOT,
  renderAll,
  stableJson,
} from './lib/pipeline.mjs';
import { packProblems } from './lib/quality.mjs';

const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : undefined;

const started = process.hrtime.bigint();
const entries = renderAll({ only });
for (const entry of entries) {
  const path = join(REPO_ROOT, entry.src);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, entry.wav);
}

if (!only) {
  const expected = new Set(entries.map((e) => e.src));
  for (const folder of ['sfx', 'music']) {
    const dir = join(AUDIO_DIR, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const src = `assets/audio/${folder}/${name}`;
      if (name.endsWith('.wav') && !expected.has(src)) {
        rmSync(join(dir, name));
        console.log(`removed stale ${src}`);
      }
    }
  }
  const source = loadManifestSource();
  writeFileSync(MANIFEST_PATH, stableJson(buildManifest(entries, source)));
  writeFileSync(PROVENANCE_PATH, stableJson(buildProvenance(entries, source)));
}

const seconds = Number(process.hrtime.bigint() - started) / 1e9;
let bytes = 0;
for (const e of entries) {
  bytes += e.wav.length;
  const m = e.measured;
  console.log(
    `${e.recipe.id.padEnd(16)} ${(m.samples / m.sampleRate).toFixed(2).padStart(6)} s  ` +
      `${String(m.loudnessLufs).padStart(7)} LUFS  ${String(m.truePeakDbtp).padStart(6)} dBTP  ${e.sha256.slice(0, 12)}`,
  );
}
console.log(`${entries.length} sounds, ${bytes} bytes, rendered in ${seconds.toFixed(1)} s`);
if (!only) {
  const problems = packProblems(entries, loadManifestSource());
  for (const p of problems) console.log(`warning: ${p}`);
}
