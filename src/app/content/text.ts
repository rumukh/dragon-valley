/**
 * Content strings: `content/catalogs/en.content.json` (level titles, dragon and boss names,
 * story lines, word problems, sticker and cosmetic names), read through the SDK's
 * `createMessages`, which refuses missing keys and missing placeholder values. Keys come from
 * the view as data, so they are plain strings here; boot checks that every key the pack uses
 * exists before any screen renders one.
 */
import { createMessages } from '@aegis/browser/ui';
import { collectCatalogKeys } from '../../rules/contract';
import type { ContentData } from '../../rules/contract';

export interface ContentText {
  /** The line for `key`, with `{placeholders}` filled from `values`. Throws for unknown keys. */
  (key: string, values?: Readonly<Record<string, string | number>>): string;
  has(key: string): boolean;
}

export type ContentCatalog = Readonly<Record<string, string>>;

/** A flat map of non-empty strings, or a thrown error naming what is wrong. */
export function parseContentCatalog(input: unknown): ContentCatalog {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('The content catalog must be an object.');
  }
  const catalog: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value === '') {
      throw new Error(`The content catalog entry ${key} must be text.`);
    }
    catalog[key] = value;
  }
  return catalog;
}

/** Keys the pack refers to that the catalog lacks (empty when they all exist). */
export function missingContentKeys(data: ContentData, catalog: ContentCatalog): string[] {
  return [
    ...new Set(
      collectCatalogKeys(data)
        .map(({ key }) => key)
        .filter((key) => !(key in catalog)),
    ),
  ];
}

export function createContentText(catalog: ContentCatalog): ContentText {
  const message = createMessages(catalog);
  const text = ((key: string, values?: Readonly<Record<string, string | number>>): string => {
    if (!values) return message(key);
    const strings: Record<string, string> = {};
    for (const [name, value] of Object.entries(values)) strings[name] = String(value);
    return message(key, strings);
  }) as ContentText;
  text.has = (key) => Object.prototype.hasOwnProperty.call(catalog, key);
  return text;
}
