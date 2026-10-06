// @ts-check
/**
 * Shared helpers for the art pipeline scripts: bundle the TypeScript art modules with esbuild
 * (the same toolchain the app build uses) and screenshot HTML pages with the installed Edge.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Bundles src/app/art/index.ts into out/art-build and imports it.
 * @returns {Promise<any>}
 */
export async function loadArt() {
  const outfile = join(ROOT, 'out', 'art-build', 'art.mjs');
  await build({
    entryPoints: [join(ROOT, 'src', 'app', 'art', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outfile,
    logLevel: 'warning',
  });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
}

const EDGE_CANDIDATES = [
  process.env['DV_EDGE'] ?? '',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export function findBrowser() {
  return EDGE_CANDIDATES.find((p) => p && existsSync(p));
}

/**
 * Screenshots a local HTML file with a headless Chromium browser.
 * @param {string} htmlPath
 * @param {string} pngPath
 * @param {number} width
 * @param {number} height
 */
export function screenshot(htmlPath, pngPath, width, height) {
  const browser = findBrowser();
  if (!browser) throw new Error('No Edge/Chromium found; set DV_EDGE to a browser executable.');
  const html = resolve(htmlPath);
  const png = resolve(pngPath);
  mkdirSync(dirname(png), { recursive: true });
  rmSync(png, { force: true });
  const profile = join(ROOT, 'out', 'edge-profile');
  const run = () =>
    spawnSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${profile}`,
        '--force-device-scale-factor=1',
        `--screenshot=${png}`,
        `--window-size=${width},${height}`,
        pathToFileURL(html).href,
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
  let result = run();
  if (result.status !== 0 || !existsSync(png)) result = run();
  if (result.status !== 0 || !existsSync(png)) {
    throw new Error(`Screenshot failed for ${html}: ${result.stderr || result.stdout}`);
  }
}
