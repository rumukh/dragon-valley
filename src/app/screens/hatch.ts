/**
 * The hatch celebration: the game's biggest reward moment, shown on its own before the rest of
 * a round's results. One egg at a time fills the screen and plays S4's hatch sequence (wobble,
 * cracks, pop, hatchling); the hatch sounds are started so the fanfare lands on the pop, confetti
 * bursts from the egg and the new dragon's name card appears. "Hooray!" moves on to the next egg,
 * then to the results.
 */
import type { DragonView } from '../../rules/contract';
import { CANVAS, HATCH_DURATION_MS } from '../art/dragon';
import { possessive } from '../i18n/messages';
import { hatchArt } from '../ui/art';
import { candyButton } from '../ui/button';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import { centerOf } from '../ui/fly';
import { prefersReducedMotion, wait } from '../ui/motion';
import type { App } from '../shell/app';

/**
 * The hatch sounds (wobble, crack, fanfare; each next one starts 0.7 s after the one before) are
 * started this long after the egg appears, so the fanfare sounds when the shell pops.
 */
export const HATCH_SOUND_DELAY_MS = 550;
/** When the shell pops and the hatchling appears in S4's sequence (56 % of its length). */
export const HATCH_REVEAL_MS = Math.round(HATCH_DURATION_MS * 0.56);

/**
 * The part of the rig's 512-unit canvas the hatch uses: the egg, its burst and the hatchling stand
 * in the lower middle (measured: x 119-392, y 212-531), so the celebration crops to them and shows
 * them big. Pieces flying out of it stay visible (the art does not clip).
 */
const HATCH_VIEW_BOX = [110, 200, 292, 320]
  .map((value) => Math.round((value * CANVAS) / 512))
  .join(' ');

export interface HatchCelebration {
  readonly element: HTMLElement;
  /** What gets focus while an egg hatches (the caption). */
  readonly focusTarget: HTMLElement;
  /** Hatches every dragon in turn; resolves after the last "Hooray!" (or on dispose). */
  play(): Promise<void>;
  dispose(): void;
}

export function hatchCelebration(app: App, dragons: readonly DragonView[]): HatchCelebration {
  const t = app.kit.t;
  const text = app.text;
  let disposed = false;
  let soundTimer: ReturnType<typeof setTimeout> | undefined;
  let proceed: (() => void) | undefined;

  const caption = h('p', {
    className: 'dv-hatch-stage__caption',
    testId: 'hatch-caption',
    attributes: { tabindex: '-1', 'aria-live': 'polite' },
  });
  const art = h('div', {
    className: 'dv-hatch-stage__art',
    testId: 'hatch-art',
    attributes: { role: 'img' },
  });
  const name = h('h1', { className: 'dv-hatch-stage__name', testId: 'hatch-name' });
  const line = h('p', { className: 'dv-hatch-stage__line' });
  const card = h('div', { className: 'dv-hatch-stage__card' }, name, line);
  const next = candyButton({
    label: t('hatch.continue'),
    icon: 'forward',
    variant: 'sun',
    size: 'big',
    testId: 'hatch-continue',
    onPress: () => proceed?.(),
    onError: app.kit.onError,
  });
  const element = h(
    'section',
    {
      className: 'dv-hatch-stage',
      testId: 'hatch-celebration',
      dataset: { revealed: 'false' },
      attributes: { 'aria-label': t('hatch.heading') },
    },
    caption,
    art,
    card,
    next,
  );

  const hatchOne = async (dragon: DragonView): Promise<void> => {
    const dragonName = text(dragon.nameKey);
    element.dataset['revealed'] = 'false';
    element.dataset['dragon'] = dragon.id;
    caption.textContent = t('hatch.watch');
    art.setAttribute('aria-label', t('hatch.hatching', { owner: possessive(dragonName) }));
    // Inserting the art starts its sequence; a new egg replays it.
    const egg = hatchArt(dragon.rig, 'dv-hatch-stage__dragon');
    egg.setAttribute('viewBox', HATCH_VIEW_BOX);
    art.replaceChildren(egg);
    const reduced = prefersReducedMotion();
    soundTimer = setTimeout(
      () => app.kit.cue('dragon.hatched'),
      reduced ? 0 : HATCH_SOUND_DELAY_MS,
    );
    await wait(reduced ? 300 : HATCH_REVEAL_MS);
    if (disposed) return;
    element.dataset['revealed'] = 'true';
    caption.textContent = '';
    art.setAttribute('aria-label', t('hatch.hatched', { name: dragonName }));
    name.textContent = t('hatch.title', { name: dragonName });
    line.textContent =
      dragon.table === null
        ? t('hatch.special', { name: dragonName })
        : t('hatch.table', { name: dragonName, table: dragon.table });
    const shown = art.querySelector('svg');
    void confetti(app.kit.fx, shown ? { origin: centerOf(shown) } : {});
    app.kit.announcer.announce(`${name.textContent} ${line.textContent}`);
    next.focus();
    await new Promise<void>((resolve) => {
      proceed = resolve;
    });
    proceed = undefined;
  };

  return {
    element,
    focusTarget: caption,
    async play() {
      for (const dragon of dragons) {
        if (disposed) return;
        await hatchOne(dragon);
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(soundTimer);
      proceed?.();
    },
  };
}
