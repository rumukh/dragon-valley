/**
 * The static build: a nested-base site whose offline resource graph is complete, digest-exact,
 * accepted by the SDK's own validator, and free of Node built-ins, three.js and the renderer.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browserBoundary, buildSite, isForbiddenModule } from '../../scripts/build.mjs';
import { verifySite } from '../../scripts/lib/site.mjs';

let directory: string;
let site: Awaited<ReturnType<typeof buildSite>>;
const BASE = '/dragon-valley/';

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'dv-build-test-'));
  site = await buildSite({ outDir: join(directory, 'site'), base: BASE });
});

afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

const report = (): {
  base: string;
  revision: string;
  inputs: { app: string[]; worker: string[] };
} => JSON.parse(readFileSync(join(site.directory, 'build-report.json'), 'utf8'));
const graph = (): { resources: { src: string; kind: string }[] } =>
  JSON.parse(readFileSync(join(site.directory, 'resource-graph.json'), 'utf8'));

describe('scripts/build.mjs', () => {
  it('emits a verified offline resource graph for the nested Pages base', () => {
    const verified = verifySite(site.directory);
    expect(verified.base).toBe(BASE);
    expect(verified.revision).toMatch(/^[0-9a-f]{24}$/);
    const sources = graph().resources.map((resource) => resource.src);
    for (const member of ['index.html', 'app.js', 'app.css', 'licenses.txt']) {
      expect(sources, `${member} is installable offline`).toContain(BASE + member);
    }
    expect(sources, 'the worker is not a member of the graph it serves').not.toContain(
      BASE + 'sw.js',
    );
    expect(sources.every((src) => src.startsWith(BASE))).toBe(true);
  });

  it('bundles all four SDK packages from the installed tarballs, never from engine sources', () => {
    const inputs = report().inputs.app;
    for (const name of ['core', 'runtime', 'narrative', 'browser']) {
      expect(
        inputs.some((path) => path.startsWith(`node_modules/@aegis/${name}/dist/`)),
        `@aegis/${name} reaches the app bundle`,
      ).toBe(true);
    }
    expect(
      inputs.filter((path) => path.startsWith('../') || path.includes('aegis-engine')),
    ).toEqual([]);
  });

  it('bundles the worker from the public offline worker export and pins this revision', () => {
    expect(report().inputs.worker).toContain('node_modules/@aegis/browser/dist/offline/worker.js');
    expect(readFileSync(join(site.directory, 'sw.js'), 'utf8')).toContain(report().revision);
  });

  it('builds reproducibly: the same tree yields the same offline revision', async () => {
    const again = await buildSite({ outDir: join(directory, 'again'), base: BASE });
    expect(again.revision).toBe(site.revision);
  });

  it('classifies Node built-ins, three.js and the 3D renderer as forbidden', () => {
    for (const specifier of [
      'fs',
      'node:fs',
      'node:crypto',
      'path',
      'three',
      'three/addons/controls/OrbitControls.js',
      '@aegis/render-three',
    ]) {
      expect(isForbiddenModule(specifier), specifier).toBe(true);
    }
    for (const specifier of ['@aegis/runtime', '@aegis/browser/offline/worker', './main']) {
      expect(isForbiddenModule(specifier), specifier).toBe(false);
    }
  });

  it('fails a bundle that imports a Node built-in', async () => {
    await expect(
      build({
        stdin: { contents: "import { readFileSync } from 'node:fs'; console.log(readFileSync);" },
        bundle: true,
        write: false,
        platform: 'browser',
        logLevel: 'silent',
        plugins: [browserBoundary],
      }),
    ).rejects.toThrow(/Forbidden module in a browser bundle: "node:fs"/);
  });

  it('rejects a site whose bytes drift from its resource graph, even at the same length', () => {
    const copy = join(directory, 'tampered');
    cpSync(site.directory, copy, { recursive: true });
    const original = readFileSync(join(copy, 'app.js'), 'utf8');
    const tampered = (original.startsWith('/') ? ' ' : '/') + original.slice(1);
    expect(tampered.length, 'the tamper keeps the byte count').toBe(original.length);
    expect(tampered).not.toBe(original);
    writeFileSync(join(copy, 'app.js'), tampered);
    expect(() => verifySite(copy)).toThrow(/app\.js/);
  });

  it('rejects an undeclared extra file in the site', () => {
    const copy = join(directory, 'extra');
    cpSync(site.directory, copy, { recursive: true });
    mkdirSync(join(copy, 'content'), { recursive: true });
    writeFileSync(join(copy, 'content', 'surprise.json'), '{}\n');
    expect(() => verifySite(copy)).toThrow(/surprise\.json/);
  });

  it('refuses to overwrite a build without --clean and to clean a foreign directory', async () => {
    await expect(buildSite({ outDir: site.directory, base: BASE })).rejects.toThrow(/Pass --clean/);
    const foreign = join(directory, 'foreign');
    mkdirSync(foreign);
    writeFileSync(join(foreign, 'keep.txt'), 'not a build\n');
    await expect(buildSite({ outDir: foreign, base: BASE, clean: true })).rejects.toThrow(
      /not a previous Dragon Valley build/,
    );
    expect(readFileSync(join(foreign, 'keep.txt'), 'utf8')).toBe('not a build\n');
  });

  it('rejects a base path that is not an absolute directory', async () => {
    for (const base of ['dragon-valley/', '/dragon-valley', '/../', 'https://example.com/']) {
      await expect(buildSite({ outDir: join(directory, 'bad'), base }), base).rejects.toThrow(
        /Base must be/,
      );
    }
  });
});
