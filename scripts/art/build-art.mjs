// @ts-check
/**
 * Generates the committed art artifacts from the TypeScript sources:
 *   assets/art/catalog.json            (src/app/art/catalog.ts)
 *   src/app/art/dragon/animations.css  (src/app/art/dragon/animations.ts)
 *   assets/backgrounds/*.svg + map-hotspots.json (src/app/art/backgrounds, when present)
 *
 *   node scripts/art/build-art.mjs           write everything
 *   node scripts/art/build-art.mjs --check   fail if any committed artifact is stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { ROOT, loadArt } from './lib.mjs';

const check = process.argv.includes('--check');
const art = await loadArt();

/** @type {Array<[string, string]>} */
const outputs = [
  ['assets/art/catalog.json', `${JSON.stringify(art.buildCatalog(), null, 2)}\n`],
  ['src/app/art/dragon/animations.css', art.ANIMATIONS_CSS],
];

if (typeof art.renderBackgrounds === 'function') {
  for (const [id, svg] of Object.entries(art.renderBackgrounds()))
    outputs.push([`assets/backgrounds/${id}.svg`, /** @type {string} */ (svg)]);
  outputs.push([
    'assets/backgrounds/map-hotspots.json',
    `${JSON.stringify(art.MAP_HOTSPOTS, null, 2)}\n`,
  ]);
}

let stale = 0;
for (const [rel, content] of outputs) {
  const path = join(ROOT, rel);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === content) continue;
  if (check) {
    console.error(`stale: ${rel} (run npm run art:build)`);
    stale++;
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`wrote ${relative(ROOT, path)}`);
  }
}
if (stale > 0) process.exit(1);
console.log(check ? 'art artifacts are up to date' : 'art build done');
