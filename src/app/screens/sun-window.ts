/**
 * The Sun Window (docs/design.md §12.5): the Magic Window's face for + and −. An 11 × 11
 * addition mosaic and a subtraction panel, one pane per fact, lit bronze, silver or gold by its
 * mastery; a known fact due again is marked to polish. Both windows are always reachable: each
 * links to the other, and the hub opens the one of the child's grade.
 */
import { TABLE_MAX, TABLE_MIN } from '../../rules/contract';
import type { WindowCell } from '../../rules/contract';
import { countLevels, sunWindowOf } from '../game/sun-window';
import type { MessageKey } from '../i18n/messages';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { collection } from './collections';

const SIZE = TABLE_MAX - TABLE_MIN + 1;

/** One panel: an 11 × 11 grid of panes, a picture with its count as the label. */
export function sunPanel(
  cells: readonly WindowCell[],
  options: { heading: string; label: string; testId: string; sign: string },
): HTMLElement {
  const grid = h('div', {
    className: 'dv-sun__grid',
    testId: options.testId,
    attributes: { role: 'img', 'aria-label': options.label },
  });
  grid.style.setProperty('--size', String(SIZE));
  grid.append(h('span', { className: 'dv-sun__corner', text: options.sign }));
  for (let column = TABLE_MIN; column <= TABLE_MAX; column++) {
    grid.append(h('span', { className: 'dv-sun__axis', text: String(column) }));
  }
  const at = new Map(cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
  for (let row = TABLE_MIN; row <= TABLE_MAX; row++) {
    grid.append(h('span', { className: 'dv-sun__axis', text: String(row) }));
    for (let column = TABLE_MIN; column <= TABLE_MAX; column++) {
      const cell = at.get(`${row}:${column}`);
      grid.append(
        h('span', {
          className: 'dv-sun__pane',
          dataset: {
            level: cell?.level ?? 'dim',
            polish: String(cell?.needsPolish ?? false),
            item: cell?.item ?? '',
          },
        }),
      );
    }
  }
  return h(
    'section',
    { className: 'dv-sun__panel' },
    h('h2', { className: 'dv-sun__heading', text: options.heading }),
    grid,
  );
}

export const litPanes = (cells: readonly WindowCell[]): number =>
  cells.filter((cell) => cell.level !== 'dim').length;

export function sunWindowScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `sun-window:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const view = active.game.view();
      const sun = sunWindowOf(view);
      const counts = countLevels([...sun.cells, ...sun.subtraction]);
      const frame = collection(app, active, {
        title: t('sun.heading'),
        testId: 'screen-sun-window',
        music: 'album',
        body: [
          h(
            'section',
            { className: 'dv-card dv-window dv-sun' },
            h(
              'div',
              { className: 'dv-sun__panels' },
              sunPanel(sun.cells, {
                heading: t('sun.addition'),
                label: t('sun.additionArt', { lit: litPanes(sun.cells), total: sun.cells.length }),
                testId: 'sun-addition',
                sign: '+',
              }),
              sunPanel(sun.subtraction, {
                heading: t('sun.subtraction'),
                label: t('sun.subtractionArt', {
                  lit: litPanes(sun.subtraction),
                  total: sun.subtraction.length,
                }),
                testId: 'sun-subtraction',
                sign: '\u2212',
              }),
            ),
            h(
              'ul',
              { className: 'dv-window__legend', testId: 'sun-counts' },
              ...(['gold', 'silver', 'bronze', 'dim'] as const).map((level) =>
                h(
                  'li',
                  { dataset: { level } },
                  h('span', {
                    className: 'dv-window__swatch',
                    attributes: { 'aria-hidden': 'true' },
                  }),
                  h('span', { text: t(`window.${level}` as MessageKey, { count: counts[level] }) }),
                ),
              ),
            ),
            candyButton({
              label: t('window.toMagic'),
              icon: 'window',
              variant: 'paper',
              size: 'small',
              testId: 'sun-to-magic',
              onPress: () => app.router.replace(app.screens.window(keeperId)),
              onError: app.kit.onError,
            }),
          ),
        ],
      });
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}
