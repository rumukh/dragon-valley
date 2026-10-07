/**
 * Printables (docs/design.md §7.5): flashcards of the hardest facts or of one times table, and
 * certificates.
 *
 * `layoutPrint` from `@aegis/narrative` turns a document into physical A4 geometry: cells in
 * millimetres, the text checked against each cell (it throws rather than clip anything) and, for
 * the double-sided flashcards, back pages whose cells mirror the fronts for a long-edge flip. The
 * shell draws that geometry itself for the preview and the printer (print/sheets.ts: the Andika
 * font and pictures on certificates), and `renderPrintHtml` gives the same layout as a plain,
 * script-free HTML file a grown-up can save and print elsewhere.
 */
import { layoutPrint, renderPrintHtml } from '@aegis/narrative';
import type { PrintDocument, PrintItem, PrintLayout, PrintOptions } from '@aegis/narrative';
import type { FactText } from '../math/facts';

/** Ten cards on one A4 sheet, printed on both sides and flipped on the long edge. */
export const FLASHCARD_OPTIONS: Readonly<PrintOptions> = {
  paper: 'A4',
  columns: 2,
  rows: 5,
  marginMm: 10,
  gutterMm: 4,
  fontPt: 28,
  duplex: 'long-edge',
};

/** One certificate per A4 page: the picture and heading in the top cell, the words below. */
export const CERTIFICATE_OPTIONS: Readonly<PrintOptions> = {
  paper: 'A4',
  columns: 1,
  rows: 2,
  marginMm: 15,
  gutterMm: 0,
  fontPt: 26,
  duplex: 'none',
};

export type PrintKind = 'flashcards' | 'certificate';

/** A laid-out printable, ready for the preview, the printer or a file. */
export interface PrintJob {
  readonly kind: PrintKind;
  /** The document as written: its paragraphs, which the shell's own drawing wraps itself. */
  readonly document: PrintDocument;
  readonly layout: PrintLayout;
  /** File name without extension, for "Save as a file". */
  readonly fileName: string;
}

/** A card per fact: the question on the front; the answer and the whole fact on the back. */
export function flashcardDocument(title: string, facts: readonly FactText[]): PrintDocument {
  return {
    title,
    items: facts.map((fact): PrintItem => ({
      id: `card-${fact.item}`,
      contentId: fact.item,
      kind: 'card',
      front: [fact.question],
      back: [fact.answer, fact.sentence],
    })),
  };
}

export interface CertificateText {
  /** Stable identity, e.g. `certificate:dragon:sunny`. */
  readonly id: string;
  /** The heading under the picture. */
  readonly heading: string;
  /** Paragraphs below: the child's name, the deed, the date. */
  readonly body: readonly string[];
}

export function certificateDocument(title: string, certificate: CertificateText): PrintDocument {
  return {
    title,
    items: [
      {
        id: 'heading',
        contentId: certificate.id,
        kind: 'card',
        front: [certificate.heading],
        back: null,
      },
      {
        id: 'body',
        contentId: certificate.id,
        kind: 'card',
        front: [...certificate.body],
        back: null,
      },
    ],
  };
}

function job(
  kind: PrintKind,
  document: PrintDocument,
  options: PrintOptions,
  fileName: string,
): PrintJob {
  const approved = [...new Set(document.items.map((item) => item.contentId))];
  return { kind, document, layout: layoutPrint(document, options, approved), fileName };
}

/**
 * Flashcards for `facts` (at least one). Throws the toolkit's error if a card's text could not
 * fit, which the grown-ups' area reports instead of printing clipped cards.
 */
export function flashcardJob(
  title: string,
  facts: readonly FactText[],
  fileName: string,
): PrintJob {
  return job('flashcards', flashcardDocument(title, facts), { ...FLASHCARD_OPTIONS }, fileName);
}

export function certificateJob(
  title: string,
  certificate: CertificateText,
  fileName: string,
): PrintJob {
  return job(
    'certificate',
    certificateDocument(title, certificate),
    { ...CERTIFICATE_OPTIONS },
    fileName,
  );
}

/** The job as a standalone, script-free HTML document (`renderPrintHtml`). */
export function printFile(job: PrintJob, lang: string): string {
  return renderPrintHtml(job.layout).replace('<html>', `<html lang="${lang}">`);
}
