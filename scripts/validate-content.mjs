// @ts-check
/**
 * Content validation gate:
 *
 *   node scripts/validate-content.mjs [--strict-coverage] [--strict-art]
 *
 * 1. content/dragon-valley.content.json against the contract's registration (schema, references,
 *    unlock reachability, skill pools, activity options, balance sanity).
 * 2. Every catalog key the pack uses exists in content/catalogs/en.content.json; every catalog is
 *    a flat string map; word-problem placeholders match their template variables.
 * 3. Story lines keep to the child profile's sentence length (@aegis/narrative CHILD_PROFILE).
 * 4. Every shipped pack in content/history/ is valid under the current schema and named by its
 *    revision; the current revision is not reused for different content.
 * 5. Art references (backgrounds, rigs, cosmetics, sticker icons and frames) are checked against
 *    assets/art/catalog.json once the art pipeline publishes it: reported, or with --strict-art
 *    failing the gate.
 * 6. Curriculum coverage (objectives without a lesson or a boss) is reported; with
 *    --strict-coverage it fails the gate (turned on when the full v1 content lands).
 *
 * The TypeScript contract is bundled with esbuild into a temporary module, as the engine's
 * scripts do, so this runs on plain Node with no TypeScript loader.
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain, repositoryRoot } from './lib/tools.mjs';

/** @param {string} root */
async function loadContract(root) {
  const directory = mkdtempSync(join(tmpdir(), 'dv-contract-'));
  try {
    const file = join(directory, 'contract.mjs');
    await build({
      absWorkingDir: root,
      stdin: {
        contents: `export * from './src/rules/contract/index.ts';
export { parseContentJson } from '@aegis/runtime';
export { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';`,
        resolveDir: root,
        loader: 'ts',
      },
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      logLevel: 'warning',
    });
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** @param {string} path */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Every ID the art catalog publishes: each `id` field at any depth (dragons, characters,
 * cosmetics, avatars, regions, and later bosses, stickers and backgrounds) plus every string listed
 * under `icons` (items, fruits, map nodes, glyphs, emblems). A plain array of IDs also works.
 * @param {unknown} catalog
 * @returns {string[]}
 */
export function artCatalogIds(catalog) {
  /** @type {Set<string>} */
  const ids = new Set();
  /** @param {unknown} node @param {boolean} listed */
  const visit = (node, listed) => {
    if (typeof node === 'string') {
      if (listed) ids.add(node);
    } else if (Array.isArray(node)) {
      for (const entry of node) visit(entry, listed);
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'id' && typeof value === 'string') ids.add(value);
        else if (typeof value === 'object') visit(value, listed || key === 'icons');
      }
    }
  };
  visit(catalog, Array.isArray(catalog));
  return [...ids].sort();
}

/**
 * @param {{ root?: string; strictCoverage?: boolean; strictArt?: boolean }} [options]
 */
export async function validateContentTree(options = {}) {
  const root = options.root ?? repositoryRoot;
  const contract = await loadContract(root);
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const contentDir = join(root, 'content');
  const packFile = join(contentDir, 'dragon-valley.content.json');
  const outcome = contract.parseContentJson(
    readFileSync(packFile, 'utf8'),
    contract.contentRegistration,
    'dragon-valley.content.json',
  );
  if (!outcome.ok) {
    for (const d of outcome.error.diagnostics) {
      errors.push(
        `${d.file ?? 'content'} ${d.recordId ?? ''} ${d.path ?? ''}: [${d.code}] ${d.message}`,
      );
    }
    return { errors, warnings, summary: null };
  }
  const pack = outcome.value;
  const data = pack.data;

  // Catalogs.
  const catalogDir = join(contentDir, 'catalogs');
  /** @type {Record<string, Record<string, string>>} */
  const catalogs = {};
  for (const name of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const value = readJson(join(catalogDir, name));
    const bad = Object.entries(value).filter(
      ([, text]) => typeof text !== 'string' || text.length === 0,
    );
    if (bad.length)
      errors.push(
        `catalogs/${name}: non-string or empty entries: ${bad.map(([k]) => k).join(', ')}`,
      );
    catalogs[name] = value;
  }
  const english = catalogs['en.content.json'] ?? {};
  for (const { key, where } of contract.collectCatalogKeys(data)) {
    if (english[key] === undefined)
      errors.push(`catalogs/en.content.json: missing "${key}" (${where})`);
  }
  for (const template of data.wordTemplates) {
    const text = english[template.textKey];
    if (text === undefined) continue;
    const placeholders = [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((m) => m[1]);
    for (const name of placeholders) {
      if (!(name in template.vars))
        errors.push(`${template.textKey}: placeholder {${name}} is not a template variable`);
    }
  }
  for (const beat of data.story.beats) {
    for (const key of beat.graph.catalogs.text) {
      const text = english[key];
      if (text === undefined) continue;
      for (const sentence of text.split(/[.!?]+/)) {
        const words = contract.tokenizeWords(sentence).length;
        if (words > contract.CHILD_PROFILE.maxWordsPerSentence) {
          errors.push(
            `${key}: "${sentence.trim()}" has ${words} words (max ${contract.CHILD_PROFILE.maxWordsPerSentence})`,
          );
        }
      }
    }
  }

  // History.
  const historyDir = join(contentDir, 'history');
  const shipped = existsSync(historyDir)
    ? readdirSync(historyDir).filter((n) => n.endsWith('.json'))
    : [];
  for (const name of shipped) {
    const archived = contract.parseContentJson(
      readFileSync(join(historyDir, name), 'utf8'),
      contract.contentRegistration,
      name,
    );
    if (!archived.ok) errors.push(`history/${name}: no longer valid under the current schema`);
    else if (`${archived.value.revision}.json` !== name)
      errors.push(`history/${name}: file name must be its revision`);
    else if (
      archived.value.revision === pack.revision &&
      JSON.stringify(archived.value) !== JSON.stringify(pack)
    ) {
      errors.push(
        `revision ${pack.revision} was shipped with different content: bump the revision`,
      );
    }
  }

  // Art catalog. Report-only until art and content have converged; --strict-art makes it a gate.
  const artFile = join(root, 'assets', 'art', 'catalog.json');
  if (existsSync(artFile)) {
    const ids = artCatalogIds(readJson(artFile));
    for (const d of contract.checkArtCatalog(data, ids)) {
      if (options.strictArt) errors.push(d.message);
      else warnings.push(d.message);
    }
  } else {
    warnings.push('assets/art/catalog.json not published yet: art references not checked');
  }

  // Curriculum coverage.
  const gaps = contract.curriculumGaps(data);
  for (const gap of gaps) {
    const message = `curriculum: ${gap.objective} has no ${gap.missing.join(' and no ')} level`;
    if (options.strictCoverage) errors.push(message);
    else warnings.push(message);
  }

  return {
    errors,
    warnings,
    summary: {
      revision: pack.revision,
      regions: data.regions.length,
      levels: data.levels.length,
      skills: data.skills.length,
      objectives: data.objectives.length,
      uncovered: gaps.length,
      history: shipped.length,
    },
  };
}

if (isMain(import.meta.url)) {
  const strictCoverage = process.argv.includes('--strict-coverage');
  const strictArt = process.argv.includes('--strict-art');
  const { errors, warnings, summary } = await validateContentTree({ strictCoverage, strictArt });
  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (summary) console.log(`content ${JSON.stringify(summary)}`);
  console.log(errors.length ? `${errors.length} content error(s).` : 'Content is valid.');
  process.exit(errors.length ? 1 : 0);
}
