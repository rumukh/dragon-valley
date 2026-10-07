/**
 * The print preview, opened from the grown-ups' Print tab: the pages of a printable as they will
 * come out of the printer (print/sheets.ts), how to print them, and two ways out - the browser's
 * own print dialog (only the pages are printed; the screen around them is hidden by the print
 * styles) or the same layout saved as a plain HTML file (`renderPrintHtml`) to print elsewhere.
 */
import { plural } from '../i18n/messages';
import type { PrintJob } from '../print/documents';
import { printFile } from '../print/documents';
import { renderSheets } from '../print/sheets';
import type { SheetOptions } from '../print/sheets';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { downloadText, topBar } from './common';

export interface PrintRequest {
  readonly job: PrintJob;
  /** The screen's heading, e.g. "Flashcards: the hardest facts". */
  readonly title: string;
  /** How to print it: paper, sides, scale. */
  readonly guidance: string;
  readonly art?: SheetOptions['art'];
}

/** "Sheet 2, back" for double-sided jobs, "Page 2" for single-sided ones. */
export function pageNumber(index: number, duplex: boolean): number {
  return duplex ? Math.floor(index / 2) + 1 : index + 1;
}

export function printScreen(app: App, request: PrintRequest): ScreenEntry {
  return {
    key: `print:${request.job.fileName}`,
    build() {
      const t = app.kit.t;
      const { job } = request;
      const duplex = job.layout.duplex !== 'none';
      const heading = h('h1', { className: 'dv-print__title', text: request.title });
      const sheets = renderSheets(job, {
        pageLabel: (index, side) =>
          duplex
            ? t(side === 'front' ? 'print.sheetFront' : 'print.sheetBack', {
                number: pageNumber(index, true),
              })
            : t('print.page', { number: pageNumber(index, false) }),
        ...(request.art ? { art: request.art } : {}),
      });
      const pages = job.layout.pages.length;
      const element = h(
        'main',
        { className: 'dv-print', testId: 'screen-print', dataset: { kind: job.kind } },
        topBar({
          back: {
            label: t('print.back'),
            testId: 'print-back',
            onPress: () => app.router.back(),
          },
          title: heading,
          onError: app.kit.onError,
        }),
        h(
          'section',
          { className: 'dv-card dv-print__intro' },
          h('p', { testId: 'print-guidance', text: request.guidance }),
          h('p', {
            className: 'dv-note',
            testId: 'print-count',
            text: duplex
              ? plural(t, pages / 2, 'print.countSheets.one', 'print.countSheets.other')
              : plural(t, pages, 'print.countPages.one', 'print.countPages.other'),
          }),
          h(
            'div',
            { className: 'dv-row' },
            candyButton({
              label: t('print.print'),
              icon: 'print',
              variant: 'sun',
              testId: 'print-now',
              onPress: () => window.print(),
              onError: app.kit.onError,
            }),
            candyButton({
              label: t('print.file'),
              icon: 'download',
              variant: 'paper',
              testId: 'print-file',
              onPress: () =>
                downloadText(`${job.fileName}.html`, printFile(job, 'en'), 'text/html'),
              onError: app.kit.onError,
            }),
          ),
        ),
        sheets,
      );
      // Only the pages are printed while this screen is shown (the print styles hide the rest).
      document.documentElement.dataset['printing'] = job.kind;
      return {
        element,
        title: request.title,
        field: 'desk',
        region: null,
        dispose() {
          delete document.documentElement.dataset['printing'];
        },
      };
    },
  };
}
