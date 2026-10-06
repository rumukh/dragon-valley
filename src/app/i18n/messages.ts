/**
 * Typed access to the shell's message catalog, `content/catalogs/en.ui.json` (owned by S3;
 * docs/contract.md §7.4), through the SDK's `createMessages`, which refuses missing keys and
 * missing placeholder values instead of inventing English fallbacks.
 *
 * The English catalog is bundled, so every key is a compile-time type and the first screen
 * needs no extra request. A translation adds `cs.ui.json` with the same keys. Child-facing
 * lines keep to ten words per sentence (test/unit/app/catalog.test.ts); keys under `parent.`,
 * `recovery.` and `startup.` are for grown-ups.
 */
import { createMessages } from '@aegis/browser/ui';
import en from '../../../content/catalogs/en.ui.json';

export const EN_UI = en;
export type MessageKey = keyof typeof en;
export type Catalog = Readonly<Record<MessageKey, string>>;
export type MessageValues = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, values?: MessageValues) => string;

export function createTranslator(catalog: Catalog = en): Translate {
  const message = createMessages(catalog);
  return (key, values) => {
    if (!values) return message(key);
    const strings: Record<string, string> = {};
    for (const [name, value] of Object.entries(values)) strings[name] = String(value);
    return message(key, strings);
  };
}

/** Placeholder names a message expects, in order of appearance. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]!);
}

/** Whether a key built at runtime (for example `error.<code>`) is in the catalog. */
export function hasMessage(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

/**
 * A message about a count, from its singular or plural key: "You got 1 coin!", "You got 5
 * coins!". The count is passed to the message as `{count}`.
 */
export function plural(
  t: Translate,
  count: number,
  one: MessageKey,
  other: MessageKey,
  values: MessageValues = {},
): string {
  return t(count === 1 ? one : other, { ...values, count });
}
