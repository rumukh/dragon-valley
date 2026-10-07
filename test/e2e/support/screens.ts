/**
 * Screens for human review and the per-screen checks that go with them.
 *
 * At every stop of a walk (support/tour.ts) the page is shown at the three review sizes:
 * tablet landscape 1180 × 820, desktop 1440 × 900 and phone portrait 390 × 844. At each size it
 * is photographed (full page, animations settled) and its layout is checked (support/layout.ts);
 * axe runs at the tablet and phone sizes (desktop shares the tablet's landscape layout).
 *
 * Screenshots are evidence for people, not pixel gates (fonts differ by OS). They are written to
 * `out/qa-screens/<project>/<size>/<stop>.png` with a contact sheet per walk
 * (`out/qa-screens/<project>/<walk>.html`); CI uploads the folder as `qa-screens-<engine>`.
 */
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from './fixtures';
import { expectAccessible } from './a11y';
import { knownLayout } from './known-issues';
import { layoutProblems } from './layout';
import type { Stop } from './tour';

export interface Viewport {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly axe: boolean;
}

export const VIEWPORTS: readonly Viewport[] = [
  { id: 'tablet', label: 'tablet landscape', width: 1180, height: 820, axe: true },
  { id: 'desktop', label: 'desktop', width: 1440, height: 900, axe: false },
  { id: 'phone', label: 'phone portrait', width: 390, height: 844, axe: true },
];

/** The tablet and desktop windows at 200 % browser zoom: half as many CSS pixels. */
export const ZOOMED: readonly Viewport[] = [
  { id: 'tablet-zoom-200', label: 'tablet at 200% zoom', width: 590, height: 410, axe: false },
  { id: 'desktop-zoom-200', label: 'desktop at 200% zoom', width: 720, height: 450, axe: false },
];

export function screensRoot(testInfo: TestInfo): string {
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  return join(root, 'out', 'qa-screens', testInfo.project.name);
}

/** Fonts loaded and two frames painted (or half a second, if frames are not being painted). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))]);
    await Promise.race([
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  });
}

export interface CheckOptions {
  readonly screenshots: boolean;
  readonly axe: boolean;
  readonly layout: boolean;
  /** The sizes to check at; the three review sizes by default. */
  readonly viewports?: readonly Viewport[];
  /** A sub-folder for this set of screenshots (for example `text-200`). */
  readonly set?: string;
}

/** Photograph and check the current page at every size; ends at the first size. */
export async function checkStop(
  page: Page,
  testInfo: TestInfo,
  stop: Stop,
  options: CheckOptions,
): Promise<void> {
  const viewports = options.viewports ?? VIEWPORTS;
  for (const viewport of [...viewports.slice(1), viewports[0]!]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settle(page);
    const where = `${options.set ? `${options.set}/` : ''}${stop.name} (${viewport.label})`;
    if (options.screenshots) {
      const folder = options.set ? join(screensRoot(testInfo), options.set) : screensRoot(testInfo);
      const path = join(folder, viewport.id, `${stop.name}.png`);
      mkdirSync(dirname(path), { recursive: true });
      await photograph(page, testInfo, path, where);
    }
    if (options.layout) {
      const problems = knownLayout(testInfo, where, await layoutProblems(page));
      expect.soft(problems, `layout problems on ${where}`).toEqual([]);
    }
    if (options.axe && viewport.axe) await expectAccessible(page, testInfo, where);
  }
}

/**
 * The tallest page photographed whole, in CSS px. An engine cannot take a screenshot past some
 * height (WebKit stops at 32 767 device px, which its 2× desktop profile reaches at 16 384 CSS px),
 * and no person reviews one that long: a taller page is photographed from the top, and its true
 * height is recorded as a finding (a `tall page` annotation, listed in the job summary) instead of
 * failing the walk.
 */
export const MAX_SHOT_HEIGHT = 16_000;
/** The tallest screenshot in device pixels, under WebKit's limit. */
const MAX_SHOT_PIXELS = 32_000;

/** The height in CSS px a screenshot is cut at, for a device pixel ratio. */
export function shotCap(devicePixelRatio: number): number {
  return Math.min(MAX_SHOT_HEIGHT, Math.floor(MAX_SHOT_PIXELS / devicePixelRatio));
}

/** A full-page screenshot, cut at `shotCap`; returns the page's true height in CSS px. */
export async function photograph(
  page: Page,
  testInfo: TestInfo,
  path: string,
  where: string,
): Promise<number> {
  const { width, height, ratio } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    ratio: devicePixelRatio,
  }));
  const cap = shotCap(ratio);
  const shot = { path, fullPage: true, animations: 'disabled', caret: 'hide' } as const;
  if (height <= cap) {
    await page.screenshot(shot);
    return height;
  }
  testInfo.annotations.push({
    type: 'tall page',
    description: `${where} is ${height} px tall; its screenshot keeps the top ${cap} px`,
  });
  await page.screenshot({ ...shot, clip: { x: 0, y: 0, width, height: cap } });
  return height;
}

/** A contact sheet (plain HTML, relative image paths, nothing external) for one walk. */
export function writeContactSheet(
  testInfo: TestInfo,
  walk: string,
  stops: readonly Stop[],
  options: { readonly set?: string; readonly viewports?: readonly Viewport[] } = {},
): void {
  const viewports = options.viewports ?? VIEWPORTS;
  const root = screensRoot(testInfo);
  const prefix = options.set ? `${options.set}/` : '';
  mkdirSync(root, { recursive: true });
  const escape = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = stops
    .map(
      (stop) =>
        `<tr><th>${escape(stop.name)}<br><small>${escape(stop.description)}</small></th>` +
        viewports
          .map(
            (viewport) =>
              `<td><img loading="lazy" src="${prefix}${viewport.id}/${stop.name}.png" alt="${escape(stop.description)} (${viewport.label})"></td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Dragon Valley screens: ${escape(walk)} (${escape(testInfo.project.name)})</title>
<style>body{font-family:system-ui,sans-serif;margin:16px}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;vertical-align:top}th{text-align:left;width:14em}img{max-width:420px;max-height:640px}</style>
</head><body><h1>${escape(walk)}: ${escape(testInfo.project.name)}</h1>
<table><thead><tr><th>Stop</th>${viewports.map((v) => `<th>${v.label} ${v.width}×${v.height}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></body></html>
`;
  writeFileSync(join(root, `${walk}.html`), html);
  writeFileSync(
    join(root, `${walk}.json`),
    JSON.stringify({ walk, set: options.set ?? null, viewports, stops }, null, 2) + '\n',
  );
}
