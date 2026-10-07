/**
 * Read-aloud aliases: whole words that English voices say wrongly, given in the UI catalog as
 * `speech.alias.*` keys and applied to the text just before it is spoken. What the screen shows
 * is untouched.
 *
 * - `speech.alias.<word>`: the word is always said as its alias ("Krakonoš" as "Krakonosh").
 * - `speech.alias.<word>.one` and `speech.alias.<word>.other`: after a number the form follows
 *   it ("1 Kč" is said "1 crown", "25 Kč" "25 crowns"); anywhere else the `other` form.
 *
 * A word matches only whole: never inside a longer word, so a name's possessive ("Krakonoš's")
 * keeps its ending.
 */

export interface SpeechAlias {
  readonly word: string;
  readonly one: string;
  readonly other: string;
}

const PREFIX = 'speech.alias.';

/** The aliases a catalog defines, longest word first (so a longer word wins over its start). */
export function speechAliases(catalog: Readonly<Record<string, string>>): SpeechAlias[] {
  const forms = new Map<string, { plain?: string; one?: string; other?: string }>();
  for (const [key, value] of Object.entries(catalog)) {
    if (!key.startsWith(PREFIX)) continue;
    const rest = key.slice(PREFIX.length);
    const plural = /^(.+)\.(one|other)$/u.exec(rest);
    const word = plural ? plural[1]! : rest;
    const entry = forms.get(word) ?? {};
    if (plural) entry[plural[2] as 'one' | 'other'] = value;
    else entry.plain = value;
    forms.set(word, entry);
  }
  return [...forms]
    .map(([word, form]) => ({
      word,
      one: form.one ?? form.plain ?? form.other ?? word,
      other: form.other ?? form.plain ?? form.one ?? word,
    }))
    .sort((a, b) => b.word.length - a.word.length);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text as it should be said: every alias's word replaced by its spoken form. */
export function applyAliases(text: string, aliases: readonly SpeechAlias[]): string {
  let spoken = text;
  for (const alias of aliases) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:(\\d+)(\\s+))?${escapeRegExp(alias.word)}(?![\\p{L}\\p{N}])`,
      'gu',
    );
    spoken = spoken.replace(pattern, (_match, count?: string, space?: string) =>
      count === undefined
        ? alias.other
        : `${count}${space}${Number(count) === 1 ? alias.one : alias.other}`,
    );
  }
  return spoken;
}
