// @ts-check
/**
 * Re-pins the golden SVG digests in test/unit/art/dragon.test.ts after an intentional art change.
 * Review the gallery first (npm run art:gallery): a golden is a promise that the art looks right.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const outfile = join(ROOT, 'out', 'art-build', 'golden-cases.mjs');
await build({
  entryPoints: [join(ROOT, 'test', 'unit', 'art', 'golden-cases.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'warning',
});
const { GOLDEN_CASES } = await import(
  `${pathToFileURL(outfile).href}?v=${process.hrtime.bigint()}`
);
const lines = Object.entries(GOLDEN_CASES).map(([name, render]) => {
  const digest = createHash('sha256')
    .update(/** @type {() => string} */ (render)())
    .digest('hex');
  return `  '${name}': '${digest}',`;
});
const testPath = join(ROOT, 'test', 'unit', 'art', 'dragon.test.ts');
const source = readFileSync(testPath, 'utf8');
const block = `// goldens:start\nconst GOLDENS: Record<string, string> = {\n${lines.join('\n')}\n};\n// goldens:end`;
const next = source.replace(/\/\/ goldens:start[\s\S]*?\/\/ goldens:end/, block);
if (next === source) {
  console.log('goldens unchanged');
} else {
  writeFileSync(testPath, next);
  console.log(`re-pinned ${lines.length} goldens in ${testPath}`);
}
