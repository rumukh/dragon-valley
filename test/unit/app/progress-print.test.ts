/**
 * The grown-ups' Progress tab and printables, shaped from game views: the Magic Window as two
 * grids, the practised days as bars, items in words, and what there is to print (flashcards of
 * the hardest facts and of any table, certificates) laid out on A4 by the narrative toolkit.
 */
import { renderPrintHtml } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import type { ContentData, GameView, WindowCell } from '../../../src/rules/contract';
import { createTranslator } from '../../../src/app/i18n/messages';
import { factText } from '../../../src/app/math/facts';
import {
  divisionPanes,
  itemLabel,
  multiplicationPanes,
  paneCounts,
  practisedSkills,
  trendChart,
} from '../../../src/app/parent/progress';
import {
  earnedCertificates,
  hardestFacts,
  longDay,
  tableFacts,
} from '../../../src/app/print/content';
import {
  certificateJob,
  FLASHCARD_OPTIONS,
  flashcardJob,
  printFile,
} from '../../../src/app/print/documents';
import { pageNumber } from '../../../src/app/screens/print';

const t = createTranslator();

function cell(item: string, row: number, column: number, level: WindowCell['level']): WindowCell {
  return { item, row, column, level, needsPolish: false };
}

describe('the Magic Window as grids', () => {
  const window = {
    size: 11,
    cells: [
      cell('mul:0x0', 0, 0, 'gold'),
      { ...cell('mul:7x8', 7, 8, 'silver'), needsPolish: true },
      cell('mul:10x10', 10, 10, 'bronze'),
    ],
    division: [cell('div:56:8', 8, 7, 'gold'), cell('div:0:1', 1, 0, 'bronze')],
    counts: { dim: 0, bronze: 1, silver: 1, gold: 1 },
  } as GameView['window'];

  it('places multiplication by factors and division by divisor and result', () => {
    const mul = multiplicationPanes(window);
    expect(mul).toHaveLength(11);
    expect(mul.every((row) => row.length === 11)).toBe(true);
    expect(mul[0]![0]).toBe('gold');
    expect(mul[7]![8]).toEqual({ level: 'silver', needsPolish: true });
    expect(mul[10]![10]).toBe('bronze');
    expect(mul[3]![4], 'a fact the view does not list is dark').toBe('dim');
    const div = divisionPanes(window);
    expect(div).toHaveLength(10);
    expect(div[7]![7], 'divisor 8 is the eighth row').toBe('gold');
    expect(div[0]![0]).toBe('bronze');
  });

  it('counts lit panes and panes to polish', () => {
    const counts = paneCounts(window.cells);
    expect(counts.levels).toEqual({ dim: 0, bronze: 1, silver: 1, gold: 1 });
    expect(counts).toMatchObject({ lit: 3, total: 3, polish: 1 });
  });
});

describe('the practised days as bars', () => {
  const trend = [
    { day: '2026-10-05', answers: 40, correct: 30, fast: 10 },
    { day: '2026-10-06', answers: 20, correct: 20, fast: 20 },
  ];

  it('scales the busiest day to the full height, one even slot per day', () => {
    const chart = trendChart(trend, 600, 150);
    expect(chart.most).toBe(40);
    expect(chart.bars.map((bar) => bar.height)).toEqual([150, 75]);
    expect(chart.bars[0]).toMatchObject({
      correctHeight: 112.5,
      fastHeight: 37.5,
      x: 45,
      width: 210,
    });
    expect(chart.bars[1]!.x).toBe(345);
  });

  it('draws nothing tall for days without answers', () => {
    const chart = trendChart([{ day: '2026-10-07', answers: 0, correct: 0, fast: 0 }], 600, 150);
    expect(chart.bars[0]!.height).toBe(0);
  });
});

describe('practised items in words', () => {
  it('writes small-table facts in the keeper notation', () => {
    expect(itemLabel('mul:7x8', 'czech', t)).toBe('7 · 8 = 56');
    expect(itemLabel('div:56:7', 'international', t)).toBe('56 ÷ 7 = 8');
  });

  it('names skill buckets for grown-ups', () => {
    expect(itemLabel('rem:d7', 'czech', t)).toBe('Division with remainder by 7');
    expect(itemLabel('tens:d4', 'czech', t)).toBe('Dividing tens by 4');
    expect(itemLabel('pow10:x100', 'czech', t)).toBe('Multiplying by 100');
    expect(itemLabel('order:no-brackets', 'czech', t)).toBe('Order of operations without brackets');
    expect(itemLabel('word:times-as-many', 'czech', t)).toBe('Word problems: times as many');
    expect(itemLabel('terms:quotient', 'czech', t)).toBe('Math words: quotient');
    expect(itemLabel('future:thing', 'czech', t), 'an unknown bucket shows its ID').toBe(
      'future:thing',
    );
  });

  it('lists only skills that were begun', () => {
    const skills = [
      { skill: 'a', titleKey: 'skill.a', accuracy: 0, mastered: 0, items: 10 },
      { skill: 'b', titleKey: 'skill.b', accuracy: 50, mastered: 0, items: 10 },
      { skill: 'c', titleKey: 'skill.c', accuracy: 0, mastered: 2, items: 10 },
    ];
    expect(practisedSkills(skills).map((skill) => skill.skill)).toEqual(['b', 'c']);
  });
});

describe('what there is to print', () => {
  const view = {
    day: '2026-10-07',
    parent: {
      hardest: [
        { item: 'mul:7x8', accuracy: 40, box: 1 },
        { item: 'rem:d7', accuracy: 50, box: 1 },
        { item: 'div:63:9', accuracy: 60, box: 2 },
      ],
    },
    dragons: [
      { id: 'bubbles', stage: 'crowned' },
      { id: 'sunny', stage: 'adult' },
    ],
    hub: {
      regions: [
        { id: 'whispering-woods', order: 2, boss: { id: 'forest-witch', defeated: true } },
        { id: 'sunny-meadow', order: 1, boss: { id: 'bridge-troll', defeated: true } },
        { id: 'fire-mountain', order: 3, boss: { id: 'krakonos', defeated: false } },
        { id: 'dragon-castle', order: 9, boss: { id: 'seven-headed', defeated: true } },
      ],
    },
  } as unknown as GameView;
  const data = {
    bosses: [
      { id: 'bridge-troll' },
      { id: 'forest-witch' },
      { id: 'krakonos' },
      { id: 'seven-headed', finale: true },
    ],
  } as unknown as ContentData;

  it('makes cards of the hardest facts only, never of skill buckets', () => {
    expect(hardestFacts(view, 'czech').map((fact) => fact.question)).toEqual(['7 · 8', '63 : 9']);
  });

  it('makes a table of ten products and ten divisions, without dividing by zero', () => {
    const seven = tableFacts(7, 'czech');
    expect(seven).toHaveLength(20);
    expect(seven[0]).toMatchObject({ question: '1 · 7', answer: '7', sentence: '1 · 7 = 7' });
    expect(seven[19]).toMatchObject({ question: '70 : 7', answer: '10' });
    expect(tableFacts(0, 'international').map((fact) => fact.question)).toHaveLength(10);
    expect(() => tableFacts(11, 'czech')).toThrow(RangeError);
  });

  it('lists certificates: crowned dragons, then regions in map order, the finale last', () => {
    expect(earnedCertificates(view, data).map((certificate) => certificate.id)).toEqual([
      'certificate:dragon:bubbles',
      'certificate:region:sunny-meadow',
      'certificate:region:whispering-woods',
      'certificate:finale:seven-headed',
    ]);
  });

  it('writes dates in words, the same in every time zone', () => {
    expect(longDay('2026-10-07')).toBe('7 October 2026');
  });
});

describe('print layouts', () => {
  it('fits every card of every table on A4, ten to a sheet, mirrored for a long-edge flip', () => {
    for (let table = 0; table <= 10; table++) {
      for (const notation of ['czech', 'international'] as const) {
        const job = flashcardJob('Cards', tableFacts(table, notation), `table-${table}`);
        const cards = table === 0 ? 10 : 20;
        expect(job.layout.pages).toHaveLength((cards / 10) * 2);
        expect(job.layout.duplex).toBe('long-edge');
        const [front, back] = job.layout.pages;
        expect(front!.side).toBe('front');
        expect(back!.side).toBe('back');
        // The first card's back sits under it when the sheet is flipped on its long edge.
        expect(back!.items[0]!.xMm).toBe(front!.items[1]!.xMm);
        expect(back!.items[0]!.id).toBe(front!.items[0]!.id);
      }
    }
    expect(FLASHCARD_OPTIONS).toMatchObject({ columns: 2, rows: 5, paper: 'A4' });
  });

  it('keeps the document paragraphs for the shell drawing and refuses text that cannot fit', () => {
    const fact = factText('mul:7x8', 'czech')!;
    const job = flashcardJob('Cards', [fact], 'one');
    expect(job.document.items[0]).toMatchObject({ front: ['7 · 8'], back: ['56', '7 · 8 = 56'] });
    const long = { ...fact, question: 'x'.repeat(40) };
    expect(() => flashcardJob('Cards', [long], 'long')).toThrow();
  });

  it('lays a certificate out on one side of one page', () => {
    const job = certificateJob(
      'Certificate: Bubbles',
      {
        id: 'certificate:dragon:bubbles',
        heading: 'Bubbles wears a crown!',
        body: ['Ema', 'helped Bubbles learn the whole 2 times table.', '7 October 2026'],
      },
      'ema-bubbles',
    );
    expect(job.layout.pages).toHaveLength(1);
    expect(job.layout.duplex).toBe('none');
    expect(job.layout.pages[0]!.items.map((item) => item.id)).toEqual(['heading', 'body']);
  });

  it('saves the same layout as a plain, script-free file', () => {
    const job = flashcardJob('Cards', tableFacts(2, 'czech'), 'table-2');
    const file = printFile(job, 'en');
    expect(file).toBe(renderPrintHtml(job.layout).replace('<html>', '<html lang="en">'));
    expect(file).toContain('<html lang="en">');
    expect(file).not.toMatch(/<script|<link|https?:/i);
  });

  it('numbers double-sided sheets and single pages', () => {
    expect([0, 1, 2, 3].map((index) => pageNumber(index, true))).toEqual([1, 1, 2, 2]);
    expect([0, 1, 2].map((index) => pageNumber(index, false))).toEqual([1, 2, 3]);
  });
});
