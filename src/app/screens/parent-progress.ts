/**
 * The grown-ups' Progress tab: what a keeper knows and how practice went, from the game view
 * (`parent/progress.ts` shapes it). A summary, the Magic Window as two plain grids with their
 * axes (S4's `renderMasteryGrid`), the times tables (facts mastered, right and quick answers), the
 * hardest facts, the last 60 days as bars (with the practised days' numbers as a list), and every
 * skill begun. Calm and plain: no sounds, no animation, nothing to press but the details.
 */
import { renderMasteryGrid } from '../art/window';
import type { GameView, MasteryLevel, Notation } from '../../rules/contract';
import { plural } from '../i18n/messages';
import type { MessageKey, Translate } from '../i18n/messages';
import {
  divisionPanes,
  itemLabel,
  multiplicationPanes,
  paneCounts,
  practisedSkills,
  TREND_DAYS,
  trendChart,
  unansweredTables,
} from '../parent/progress';
import { svgElement } from '../ui/art';
import { h } from '../ui/dom';
import type { App } from '../shell/app';

const SVG = 'http://www.w3.org/2000/svg';
const LEVELS_HIGH_FIRST: readonly MasteryLevel[] = ['gold', 'silver', 'bronze', 'dim'];
const LEVEL_NAMES: Readonly<Record<MasteryLevel, MessageKey>> = {
  gold: 'parent.progress.level.gold',
  silver: 'parent.progress.level.silver',
  bronze: 'parent.progress.level.bronze',
  dim: 'parent.progress.level.dim',
};

function svgNode<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Readonly<Record<string, string | number>>,
  ...children: Node[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.append(...children);
  return node;
}

function percent(t: Translate, value: number): string {
  return t('parent.progress.percent', { value });
}

/** A day `YYYY-MM-DD` as "7 Oct", the same in every time zone. */
export function shortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** A row of numbers: a name and its values, or a note instead of values. */
interface StatRow {
  readonly name: string;
  readonly values?: readonly string[];
  readonly note?: string;
}

/**
 * Rows of numbers as a list rather than a table, so they reflow on a phone at any text size:
 * each row is a name and its labelled values ("Right answers: 92 %"), one to a line.
 */
function statList(
  label: string,
  labels: readonly string[],
  rows: readonly StatRow[],
  testId: string,
): HTMLElement {
  return h(
    'ul',
    { className: 'dv-stats', testId, attributes: { 'aria-label': label } },
    ...rows.map((row) =>
      h(
        'li',
        { className: 'dv-stats__row' },
        h('span', { className: 'dv-stats__name', text: row.name }),
        row.values
          ? h(
              'dl',
              { className: 'dv-stats__values' },
              ...row.values.map((value, index) =>
                h(
                  'div',
                  { className: 'dv-stats__value' },
                  h('dt', { text: labels[index] ?? '' }),
                  h('dd', { text: value }),
                ),
              ),
            )
          : null,
        row.note ? h('span', { className: 'dv-stats__note', text: row.note }) : null,
      ),
    ),
  );
}

/** One grid of the Magic Window with its axes: rows down the side, columns along the top. */
function windowGrid(
  t: Translate,
  op: 'mul' | 'div',
  view: GameView,
  keeperId: string,
): HTMLElement {
  const cells = op === 'mul' ? view.window.cells : view.window.division;
  const panes = op === 'mul' ? multiplicationPanes(view.window) : divisionPanes(view.window);
  const counts = paneCounts(cells);
  const rows = panes.length;
  const art = svgElement(
    renderMasteryGrid({ op, cells: panes, idPrefix: `dv-progress-${op}-${keeperId}` }),
  );
  art.classList.add('dv-progress-grid__art');
  art.setAttribute('aria-hidden', 'true');
  const firstRow = op === 'mul' ? 0 : 1;
  const label = t(op === 'mul' ? 'parent.progress.mulGrid' : 'parent.progress.divGrid', {
    gold: counts.levels.gold,
    silver: counts.levels.silver,
    bronze: counts.levels.bronze,
    dim: counts.levels.dim,
  });
  const grid = h(
    'div',
    {
      className: 'dv-progress-grid',
      testId: `progress-grid-${op}`,
      attributes: { role: 'img', 'aria-label': label },
    },
    h('span', { className: 'dv-progress-grid__corner', attributes: { 'aria-hidden': 'true' } }),
    h(
      'div',
      { className: 'dv-progress-grid__top', attributes: { 'aria-hidden': 'true' } },
      ...Array.from({ length: 11 }, (_, column) => h('span', { text: String(column) })),
    ),
    h(
      'div',
      { className: 'dv-progress-grid__side', attributes: { 'aria-hidden': 'true' } },
      ...Array.from({ length: rows }, (_, row) => h('span', { text: String(row + firstRow) })),
    ),
    art,
  );
  grid.style.setProperty('--rows', String(rows));
  return h(
    'figure',
    { className: 'dv-progress-grid__figure' },
    h('figcaption', {
      text: t(op === 'mul' ? 'parent.progress.mulCaption' : 'parent.progress.divCaption'),
    }),
    grid,
    h('p', {
      className: 'dv-note',
      text: t('parent.progress.lit', { lit: counts.lit, total: counts.total }),
    }),
  );
}

function legend(t: Translate): HTMLElement {
  return h(
    'ul',
    { className: 'dv-window__legend dv-progress__legend' },
    ...LEVELS_HIGH_FIRST.map((level) =>
      h(
        'li',
        { dataset: { level } },
        h('span', { className: 'dv-window__swatch', attributes: { 'aria-hidden': 'true' } }),
        h('span', { text: t(LEVEL_NAMES[level]) }),
      ),
    ),
  );
}

/** What the chart shows, in words: how many of the last days had practice, and how much. */
function trendSummary(t: Translate, answers: readonly number[], name: string): string {
  if (answers.length === 0) return t('parent.progress.trendNone', { name, span: TREND_DAYS });
  const least = Math.min(...answers);
  const most = Math.max(...answers);
  return [
    plural(t, answers.length, 'parent.progress.trendDays.one', 'parent.progress.trendDays.other', {
      name,
      span: TREND_DAYS,
    }),
    answers.length === 1
      ? null
      : least === most
        ? plural(t, most, 'parent.progress.trendEach.one', 'parent.progress.trendEach.other')
        : t('parent.progress.trendRange', { least, most }),
  ]
    .filter((sentence) => sentence !== null)
    .join(' ');
}

function trend(t: Translate, view: GameView, today: string, name: string): HTMLElement {
  const days = view.parent.trend;
  if (days.length === 0) {
    return h('p', { className: 'dv-note', text: t('parent.progress.noDays') });
  }
  const chart = trendChart(days, today, 600, 150);
  const top = 8;
  const height = chart.height + top + 2;
  const picture = svgNode(
    'svg',
    {
      viewBox: `0 0 ${chart.width} ${height}`,
      class: 'dv-trend__art',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    svgNode('line', {
      x1: 0,
      x2: chart.width,
      y1: top + chart.height,
      y2: top + chart.height,
      class: 'dv-trend__axis',
    }),
    ...chart.bars.flatMap((bar) => [
      svgNode('rect', {
        x: bar.x,
        y: top + chart.height - bar.height,
        width: bar.width,
        height: bar.height,
        class: 'dv-trend__answers',
      }),
      svgNode('rect', {
        x: bar.x,
        y: top + chart.height - bar.correctHeight,
        width: bar.width,
        height: bar.correctHeight,
        class: 'dv-trend__correct',
      }),
    ]),
  );
  return h(
    'div',
    { className: 'dv-trend', testId: 'progress-trend' },
    h(
      'figure',
      { className: 'dv-trend__figure' },
      h('figcaption', {
        testId: 'progress-trend-summary',
        text: trendSummary(
          t,
          chart.bars.map((bar) => bar.answers),
          name,
        ),
      }),
      picture,
      // The dates follow the text size, so they stay readable however narrow the chart is.
      h(
        'div',
        { className: 'dv-trend__days', attributes: { 'aria-hidden': 'true' } },
        h('span', { text: shortDay(chart.first) }),
        h('span', { text: shortDay(chart.last) }),
      ),
    ),
    h(
      'p',
      { className: 'dv-note' },
      h('span', {
        className: 'dv-trend__key dv-trend__key--answers',
        attributes: { 'aria-hidden': 'true' },
      }),
      h('span', { text: t('parent.progress.keyAnswers') }),
      h('span', {
        className: 'dv-trend__key dv-trend__key--correct',
        attributes: { 'aria-hidden': 'true' },
      }),
      h('span', { text: t('parent.progress.keyCorrect') }),
    ),
    h(
      'details',
      { className: 'dv-details' },
      h('summary', { text: t('parent.progress.trendTable') }),
      statList(
        t('parent.progress.trendHeading'),
        [t('parent.progress.answers'), t('parent.progress.right'), t('parent.progress.quick')],
        [...days].reverse().map((day) => ({
          name: shortDay(day.day),
          values: [String(day.answers), String(day.correct), String(day.fast)],
        })),
        'progress-trend-table',
      ),
    ),
  );
}

/** The Progress tab's content for one keeper's game view. */
export function progressContent(
  app: App,
  keeper: { readonly id: string; readonly name: string },
  view: GameView,
  notation: Notation,
): HTMLElement[] {
  const t = app.kit.t;
  const parent = view.parent;
  if (view.day === null || parent.answers === 0) {
    return [
      h('p', {
        className: 'dv-note',
        testId: 'progress-empty',
        text: t('parent.progress.notYet', { name: keeper.name }),
      }),
    ];
  }
  const skills = practisedSkills(parent.skills);
  const unanswered = unansweredTables(view);
  const lit = paneCounts([...view.window.cells, ...view.window.division]);
  const crowned = view.dragons.filter((dragon) => dragon.stage === 'crowned').length;
  return [
    h('p', {
      testId: 'progress-summary',
      text: [
        plural(t, parent.daysPracticed, 'parent.progress.days.one', 'parent.progress.days.other', {
          name: keeper.name,
        }),
        plural(t, parent.answers, 'parent.progress.answers.one', 'parent.progress.answers.other'),
        t('parent.progress.panes', { lit: lit.lit, total: lit.total }),
      ].join(' '),
    }),
    h('p', {
      className: 'dv-note',
      text: t('parent.progress.dragons', {
        hatched: view.dragons.filter((dragon) => dragon.stage !== 'egg').length,
        crowned,
      }),
    }),
    h('h3', { text: t('parent.progress.windowHeading') }),
    h('p', { className: 'dv-note', text: t('parent.progress.windowIntro') }),
    h(
      'div',
      { className: 'dv-progress__grids' },
      windowGrid(t, 'mul', view, keeper.id),
      windowGrid(t, 'div', view, keeper.id),
    ),
    legend(t),
    h('h3', { text: t('parent.progress.tablesHeading') }),
    statList(
      t('parent.progress.tablesHeading'),
      [t('parent.progress.mastered'), t('parent.progress.right'), t('parent.progress.quick')],
      parent.tables.map((row) => {
        const name = t('parent.progress.tableName', { table: row.table });
        return unanswered.has(row.table)
          ? { name, note: t('parent.progress.notPractised') }
          : {
              name,
              values: [
                t('parent.progress.of', { value: row.mastered, total: row.items }),
                percent(t, row.accuracy),
                percent(t, row.fastShare),
              ],
            };
      }),
      'progress-tables',
    ),
    h('p', { className: 'dv-note', text: t('parent.progress.tablesNote') }),
    h('h3', { text: t('parent.progress.hardestHeading') }),
    parent.hardest.length === 0
      ? h('p', { className: 'dv-note', text: t('parent.progress.noHardest') })
      : h(
          'ol',
          { className: 'dv-progress__hardest', testId: 'progress-hardest' },
          ...parent.hardest.map((entry) =>
            h(
              'li',
              { dataset: { item: entry.item } },
              h('span', {
                className: 'dv-progress__fact',
                text: itemLabel(entry.item, notation, t),
              }),
              h('span', {
                className: 'dv-note',
                text: t('parent.progress.rightShare', { value: entry.accuracy }),
              }),
            ),
          ),
        ),
    h('h3', { text: t('parent.progress.trendHeading') }),
    trend(t, view, view.day, keeper.name),
    h('h3', { text: t('parent.progress.skillsHeading') }),
    skills.length === 0
      ? h('p', { className: 'dv-note', text: t('parent.progress.noSkills') })
      : h(
          'details',
          { className: 'dv-details' },
          h('summary', {
            text: plural(
              t,
              skills.length,
              'parent.progress.skillsShow.one',
              'parent.progress.skillsShow.other',
            ),
          }),
          statList(
            t('parent.progress.skillsHeading'),
            [t('parent.progress.mastered'), t('parent.progress.right')],
            skills.map((skill) => ({
              name: app.text.has(skill.titleKey) ? app.text(skill.titleKey) : skill.skill,
              values: [
                t('parent.progress.of', { value: skill.mastered, total: skill.items }),
                percent(t, skill.accuracy),
              ],
            })),
            'progress-skills',
          ),
        ),
  ];
}
