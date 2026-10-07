/**
 * Draws a print job (print/documents.ts) as pages. Each page is an A4 box and each cell is placed
 * in percent of the page from `layoutPrint`'s geometry, so one drawing serves both the scaled
 * preview on screen and the printer. Text is sized in page-width units (`cqw`), which at actual
 * size is exactly the layout's point size; it is the document's paragraphs, wrapped by the
 * browser in the reading font: narrower than the monospace text `layoutPrint` checked, so it fits
 * wherever the check passed.
 *
 * Geometry is set through CSS custom properties (the strict style policy allows the CSSOM), and
 * the text is plain text nodes: nothing here parses markup.
 */
import type { PrintLayout } from '@aegis/narrative';
import { h } from '../ui/dom';
import type { PrintJob } from './documents';

export type PrintCell = PrintLayout['pages'][number]['items'][number];

export interface SheetOptions {
  /** Accessible name of each page, e.g. "Page 1, front". */
  pageLabel(index: number, side: 'front' | 'back'): string;
  /** A picture for a cell (a certificate's dragon or boss), placed before its text. */
  art?(cell: PrintCell, side: 'front' | 'back'): Node | null;
}

/** Points per millimetre. */
const PT_PER_MM = 72 / 25.4;

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100_000) / 1000}%`;
}

export function renderSheets(job: PrintJob, options: SheetOptions): HTMLElement {
  const { layout } = job;
  const paragraphs = new Map(job.document.items.map((item) => [item.id, item]));
  const sheets = h('div', {
    className: `dv-sheets dv-sheets--${job.kind}`,
    testId: 'print-sheets',
  });
  sheets.style.setProperty('--paper-width', `${layout.widthMm}mm`);
  sheets.style.setProperty('--paper-height', `${layout.heightMm}mm`);
  sheets.style.setProperty('--paper-ratio', `${layout.widthMm} / ${layout.heightMm}`);
  sheets.style.setProperty('--paper-pt', String(layout.widthMm * PT_PER_MM));
  sheets.style.setProperty('--font-pt', String(layout.fontPt));
  layout.pages.forEach((page, pageIndex) => {
    const sheet = h('article', {
      className: 'dv-sheet',
      testId: 'print-sheet',
      dataset: { side: page.side },
      attributes: { 'aria-label': options.pageLabel(pageIndex, page.side) },
    });
    for (const item of page.items) {
      const source = paragraphs.get(item.id);
      const lines = (page.side === 'front' ? source?.front : source?.back) ?? item.lines;
      const cell = h('section', {
        className: 'dv-sheet__cell',
        dataset: { content: item.contentId, item: item.id, side: page.side },
      });
      cell.style.setProperty('--x', percent(item.xMm, layout.widthMm));
      cell.style.setProperty('--y', percent(item.yMm, layout.heightMm));
      cell.style.setProperty('--w', percent(item.widthMm, layout.widthMm));
      cell.style.setProperty('--h', percent(item.heightMm, layout.heightMm));
      const art = options.art?.(item, page.side) ?? null;
      if (art) cell.append(h('div', { className: 'dv-sheet__art' }, art));
      for (const line of lines) cell.append(h('p', { className: 'dv-sheet__line', text: line }));
      sheet.append(cell);
    }
    sheets.append(sheet);
  });
  return sheets;
}
