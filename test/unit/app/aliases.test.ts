/**
 * Read-aloud aliases (src/app/speech/aliases.ts): words English voices say wrongly are replaced,
 * whole, just before speaking; a currency after a number takes its singular or plural form; and
 * every alias in the catalog is for a word the game's text really uses.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EN_UI } from '../../../src/app/i18n/messages';
import { applyAliases, speechAliases } from '../../../src/app/speech/aliases';
import { createReadAloud } from '../../../src/app/speech/read-aloud';
import type { SpeechPlatform } from '../../../src/app/speech/read-aloud';

const ALIASES = speechAliases({
  'speech.alias.Krakonoš': 'Krakonosh',
  'speech.alias.Kč.one': 'crown',
  'speech.alias.Kč.other': 'crowns',
  'story.next': 'Next',
});

/**
 * Aliases ready before the first text that needs them, with who adds that text. None now: the
 * money stories (S2a's word problems) write amounts in "Kč" since content 1.3.0.
 */
const AWAITING_FIRST_USE = new Set<string>();

describe('read-aloud aliases', () => {
  it('reads the catalog: plain aliases and singular/plural forms, nothing else', () => {
    expect(ALIASES).toEqual([
      { word: 'Krakonoš', one: 'Krakonosh', other: 'Krakonosh' },
      { word: 'Kč', one: 'crown', other: 'crowns' },
    ]);
  });

  it('replaces whole words only, keeping endings and the words around them', () => {
    expect(applyAliases('Krakonoš laughs! The clouds roll away.', ALIASES)).toBe(
      'Krakonosh laughs! The clouds roll away.',
    );
    expect(applyAliases("Krakonoš's mountain", ALIASES)).toBe("Krakonosh's mountain");
    expect(applyAliases('Krakonošek and xKč stay as they are', ALIASES)).toBe(
      'Krakonošek and xKč stay as they are',
    );
  });

  it('says a currency after a number in its singular or plural form', () => {
    expect(applyAliases('A ticket costs 1 Kč.', ALIASES)).toBe('A ticket costs 1 crown.');
    expect(applyAliases('Ema pays 25 Kč, then 10 Kč more.', ALIASES)).toBe(
      'Ema pays 25 crowns, then 10 crowns more.',
    );
    expect(applyAliases('How many Kč are left?', ALIASES)).toBe('How many crowns are left?');
  });

  it('speaks the alias and leaves the shown text alone', () => {
    const spoken: string[] = [];
    class Utterance {
      voice: unknown = null;
      lang = '';
      volume = 1;
      rate = 1;
      constructor(readonly text: string) {
        spoken.push(text);
      }
      addEventListener(): void {}
    }
    const voice = { name: 'Zira', voiceURI: 'Zira', lang: 'en-US', localService: true };
    const environment = {
      synth: {
        getVoices: () => [voice],
        speak: vi.fn(),
        cancel: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as SpeechSynthesis,
      Utterance: Utterance as unknown as typeof SpeechSynthesisUtterance,
    } satisfies SpeechPlatform;
    const reader = createReadAloud(environment, ALIASES);
    const line = 'Krakonoš, the mountain spirit, sends grey clouds.';
    expect(reader.speak(line, { voice: null })).toBe(true);
    expect(spoken).toEqual(['Krakonosh, the mountain spirit, sends grey clouds.']);
    expect(line).toContain('Krakonoš');
  });

  it("is only given for words the game's text uses", () => {
    const strings = ['en.ui.json', 'en.content.json'].flatMap((name) =>
      Object.values(
        JSON.parse(readFileSync(join('content', 'catalogs', name), 'utf8')) as Record<
          string,
          string
        >,
      ),
    );
    const aliases = speechAliases(EN_UI);
    expect(aliases.length).toBeGreaterThan(0);
    for (const { word } of aliases) {
      if (AWAITING_FIRST_USE.has(word)) continue;
      const whole = new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'u');
      expect(
        strings.some((text) => whole.test(text)),
        `"${word}" appears in some catalog string`,
      ).toBe(true);
    }
  });
});
