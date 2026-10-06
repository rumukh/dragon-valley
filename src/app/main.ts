/**
 * Placeholder boot for the browser shell (owned by S3 from here on).
 *
 * It proves the toolchain end to end: the bundle imports all four SDK packages through their
 * public exports, applies the child-safe presentation preset and renders a friendly screen with
 * no network access beyond same-origin static files.
 */
import { createPrng } from '@aegis/core';
import { requireValue, schema } from '@aegis/runtime';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import {
  CHILD_SAFE_CSS,
  applyPresentationPreferences,
  assertChildSafeView,
  createMessages,
} from '@aegis/browser/ui';
import type { PresentationPreferences } from '@aegis/browser/ui';
import './style.css';

const catalog = {
  title: 'Dragon Valley',
  subtitle: 'A Times-Table Adventure',
  'greeting.1': 'Hello, Keeper! The dragon eggs are getting warm.',
  'greeting.2': 'Welcome, Keeper! Glimmer is polishing the Magic Window.',
  'greeting.3': 'Hi, Keeper! Something is wiggling inside an egg.',
  building: 'The valley is still being built. Come back soon!',
  ready: 'Ready',
} as const;

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

/** Lines for children stay within the narrative child profile's sentence length. */
function checkChildLine(line: string): string {
  for (const sentence of line.split(/[.!?]+/)) {
    if (tokenizeWords(sentence).length > CHILD_PROFILE.maxWordsPerSentence) {
      throw new Error(`Sentence is too long for the child profile: "${sentence.trim()}"`);
    }
  }
  return line;
}

function localDay(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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

function boot(): void {
  const app = document.querySelector<HTMLElement>('#app');
  const baseMeta = document.querySelector<HTMLMetaElement>('meta[name="dv-base"]')?.content;
  if (!app || baseMeta === undefined) throw new Error('The page shell is incomplete.');
  const base = requireValue(basePath.parse(baseMeta, 'dv-base'));
  const message = createMessages(catalog);

  const style = document.createElement('style');
  style.textContent = CHILD_SAFE_CSS;
  document.head.append(style);
  applyPresentationPreferences(document.documentElement, preferences);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.dataset['reducedMotion'] = 'true';
  }

  // A seeded daily pick: the same greeting all day, a different one tomorrow.
  const greeting = createPrng(localDay(new Date())).pick([
    'greeting.1',
    'greeting.2',
    'greeting.3',
  ]);

  const main = element('main', 'aegis-child placeholder');
  main.dataset['testid'] = 'placeholder';
  const egg = element('div', 'placeholder-egg');
  egg.setAttribute('aria-hidden', 'true');
  const status = element('p', 'placeholder-status', message('ready'));
  status.dataset['testid'] = 'boot-status';
  status.dataset['state'] = 'ready';
  status.setAttribute('role', 'status');
  main.append(
    egg,
    element('h1', 'placeholder-title', message('title')),
    element('p', 'placeholder-subtitle', message('subtitle')),
    element('p', 'placeholder-greeting', checkChildLine(message(greeting))),
    element('p', 'placeholder-note', checkChildLine(message('building'))),
    status,
  );
  assertChildSafeView(main, new URL(base, location.origin).href);
  app.replaceChildren(main);
  app.removeAttribute('aria-busy');
}

boot();
