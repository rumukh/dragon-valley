// @ts-check
/**
 * Content validation gate (stub until the domain contract lands).
 *
 *   node scripts/validate-content.mjs
 *
 * Today it proves that every JSON file under content/ is UTF-8 without a byte-order mark and
 * parses. The contract PR replaces this with full content-pack validation (schema, references,
 * unlock reachability, catalogs, history packs and curriculum coverage).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, repositoryRoot } from './lib/tools.mjs';
import { listFiles } from './lib/site.mjs';

/** @param {string} root */
export function validateContentTree(root = repositoryRoot) {
  const directory = join(root, 'content');
  if (!existsSync(directory)) return { files: 0, problems: [] };
  const problems = [];
  const files = listFiles(directory).filter((path) => path.endsWith('.json'));
  for (const path of files) {
    const bytes = readFileSync(join(directory, ...path.split('/')));
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      problems.push(`content/${path}: remove the UTF-8 byte-order mark`);
      continue;
    }
    try {
      JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      problems.push(`content/${path}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return { files: files.length, problems };
}

if (isMain(import.meta.url)) {
  const { files, problems } = validateContentTree();
  for (const problem of problems) console.error(problem);
  console.log(`content: ${files} JSON file(s), ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}
