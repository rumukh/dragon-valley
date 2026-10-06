/**
 * Placeholder boot for the browser shell (owned by S3 from here on).
 *
 * It proves the toolchain end to end: the bundle imports all four SDK packages through their
 * public exports, loads and validates the content pack, runs the rules (the walking-skeleton
 * adapter) in the browser for a first session, applies the child-safe presentation preset and
 * renders a friendly screen, with no network access beyond same-origin static files.
 * Nothing is saved yet: persistence, profiles and every real screen are S3's app-shell work.
 */
import { createPrng } from '@aegis/core';
import { parseContentJson, requireValue, schema } from '@aegis/runtime';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import {
  CHILD_SAFE_CSS,
  applyPresentationPreferences,
  assertChildSafeView,
  createMessages,
} from '@aegis/browser/ui';
import type { PresentationPreferences } from '@aegis/browser/ui';
import { createGameHost } from '../rules/adapter';
import { PROFILE_IDS, contentRegistration, profileSeed } from '../rules/contract';
import './style.css';

const preferences: PresentationPreferences = {
  locale: 'en',
  textScale: 1,
  reducedMotion: false,
  comfort: false,
  hideSpoilers: false,
  volumes: { narration: 1, music: 0.5, effects: 0.7 },
};

const basePath = schema.string({
  minLength: 1,
  maxLength: 200,
  pattern: /^\/(?:[A-Za-z0-9_-]+\/)*$/,
});
const catalogSchema = schema.record(schema.string({ minLength: 1, maxLength: 2000 }));

/** Lines for children stay within the narrative child profile's sentence length. */
function checkChildLine(line: string): string {
  for (const sentence of line.split(/[.!?]+/)) {
    if (tokenizeWords(sentence).length > CHILD_PROFILE.maxWordsPerSentence) {
      throw new Error(`Sentence is too long for the child profile: "${sentence.trim()}"`);
    }
  }
  return line;
}

/** The child's local calendar date, the only way time enters the rules. */
function localDay(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} is unavailable (${response.status}).`);
  return response.text();
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function boot(app: HTMLElement): Promise<void> {
  const baseMeta = document.querySelector<HTMLMetaElement>('meta[name="dv-base"]')?.content;
  const base = requireValue(basePath.parse(baseMeta, 'dv-base'));
  const style = document.createElement('style');
  style.textContent = CHILD_SAFE_CSS;
  document.head.append(style);
  applyPresentationPreferences(document.documentElement, preferences);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.dataset['reducedMotion'] = 'true';
  }

  const [packText, catalogText] = await Promise.all([
    fetchText('./content/dragon-valley.content.json'),
    fetchText('./content/catalogs/en.ui.json'),
  ]);
  const content = requireValue(
    parseContentJson(packText, contentRegistration, 'dragon-valley.content.json'),
  );
  const message = createMessages(requireValue(catalogSchema.parse(JSON.parse(catalogText))));

  // The rules run here exactly as headless tests run them: a first session for profile 1.
  const day = localDay(new Date());
  const host = createGameHost(content, profileSeed(PROFILE_IDS[0]));
  requireValue(await host.dispatch({ type: 'startSession', day }));
  const view = host.getView();

  // A seeded daily pick: the same greeting all day, a different one tomorrow.
  const greeting = createPrng(day).pick(['app.greeting.1', 'app.greeting.2', 'app.greeting.3']);

  const main = element('main', 'aegis-child placeholder');
  main.dataset['testid'] = 'placeholder';
  const egg = element('div', 'placeholder-egg');
  egg.setAttribute('aria-hidden', 'true');
  const status = element('p', 'placeholder-status', message('app.ready'));
  status.dataset['testid'] = 'boot-status';
  status.dataset['state'] = 'ready';
  status.dataset['contentRevision'] = content.revision;
  status.dataset['screen'] = view.screen;
  status.dataset['day'] = view.day ?? '';
  status.setAttribute('role', 'status');
  main.append(
    egg,
    element('h1', 'placeholder-title', message('app.title')),
    element('p', 'placeholder-subtitle', message('app.subtitle')),
    element('p', 'placeholder-greeting', checkChildLine(message(greeting))),
    element('p', 'placeholder-note', checkChildLine(message('app.building'))),
    element(
      'p',
      'placeholder-note',
      message('app.summary', { levels: String(content.data.levels.length) }),
    ),
    status,
  );
  assertChildSafeView(main, new URL(base, location.origin).href);
  app.replaceChildren(main);
  app.removeAttribute('aria-busy');
  await host.dispose();
}

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  boot(app).catch((error: unknown) => {
    const notice = element('p', 'placeholder-note', 'Dragon Valley could not start.');
    notice.setAttribute('role', 'alert');
    app.replaceChildren(notice);
    app.removeAttribute('aria-busy');
    throw error;
  });
}
