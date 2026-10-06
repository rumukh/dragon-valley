/**
 * Boot. Readiness is real: the boot status turns "ready" only after the content pack and its
 * strings were loaded and validated, the family record was read, the reading font loaded (or its short wait
 * ran out), and the first screen is mounted and painted. The audio manifest is read first (a
 * missing or broken one means a silent game, never a failed boot). Nothing is exposed on
 * `window`, and nothing is written to the console.
 */
import { requireValue, schema } from '@aegis/runtime';
import { applyPresentationPreferences } from '@aegis/browser/ui';
import { loadAudioMap } from './audio/manifest';
import { loadContent, loadContentText } from './content/load';
import { loadFonts } from './design/fonts';
import { applyTokens } from './design/tokens';
import { createTranslator } from './i18n/messages';
import { DEFAULT_PRESENTATION } from './persistence/preferences';
import { RecoveryRequired } from './persistence/recovery';
import { dragonValleyGame } from './game/definition';
import type { ScreenEntry } from './router/router';
import { createScreens } from './screens';
import { createApp } from './shell/app';
import type { AppEnvironment } from './shell/app';
import { afterPaint, h } from './ui/dom';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './art/dragon/animations.css';

const basePath = schema.string({
  minLength: 1,
  maxLength: 200,
  pattern: /^\/(?:[A-Za-z0-9_-]+\/)*$/,
});

function readEnvironment(): AppEnvironment {
  const base = document.querySelector<HTMLMetaElement>('meta[name="dv-base"]')?.content;
  const revision = document.querySelector<HTMLMetaElement>(
    'meta[name="dv-offline-revision"]',
  )?.content;
  if (base === undefined || !revision) throw new Error('The page shell is incomplete.');
  const valid = requireValue(basePath.parse(base, 'dv-base'));
  return { base: valid, baseUrl: new URL(valid, location.origin).href, revision };
}

/** Without a working shell there is no router; show one calm line and a retry. */
function showStartupFailure(root: HTMLElement): void {
  const t = createTranslator();
  const retry = h('button', {
    className: 'dv-button dv-button--sun',
    text: t('startup.retry'),
    testId: 'startup-retry',
    attributes: { type: 'button' },
  });
  retry.addEventListener('click', () => location.reload());
  root.replaceChildren(
    h(
      'main',
      { className: 'dv-screen dv-field-night dv-recovery', testId: 'startup-failure' },
      h(
        'div',
        { className: 'dv-card dv-recovery__card' },
        h('p', { text: t('startup.failed') }),
        retry,
      ),
    ),
  );
  root.removeAttribute('aria-busy');
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  applyTokens(document.documentElement);
  applyPresentationPreferences(document.documentElement, DEFAULT_PRESENTATION);
  let env: AppEnvironment;
  try {
    env = readEnvironment();
  } catch {
    showStartupFailure(root);
    return;
  }
  const fonts = loadFonts(env.baseUrl);
  const content = loadContent(env.baseUrl).then(async (pack) => ({
    pack,
    text: await loadContentText(env.baseUrl, pack.data),
  }));
  // Keep a rejection handled until it is settled below.
  content.catch(() => undefined);
  const audioMap = await loadAudioMap(env.baseUrl);
  const app = createApp({ env, root, audioMap });
  app.screens = createScreens(app);
  const [pack, family] = await Promise.allSettled([content, app.family.open()]);
  if (pack.status === 'fulfilled') {
    app.useContent(dragonValleyGame(pack.value.pack), pack.value.text);
    app.markContent(pack.value.pack.revision);
  }
  // A broken pack stops the game for everyone; a broken family record asks for a grown-up.
  let first: ScreenEntry;
  if (pack.status === 'rejected') first = app.screens.error(pack.reason);
  else if (family.status === 'rejected') {
    first =
      family.reason instanceof RecoveryRequired
        ? app.screens.recovery(family.reason)
        : app.screens.error(family.reason);
  } else first = app.screens.title();
  await fonts;
  await app.router.reset(first);
  await afterPaint();
  app.setBootState('ready');
}

void boot().catch(() => {
  const root = document.querySelector<HTMLElement>('#app');
  if (root) showStartupFailure(root);
});
