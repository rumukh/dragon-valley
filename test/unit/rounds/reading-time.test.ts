/**
 * Reading time for word problems (docs/design.md §6.2: time the arithmetic, not the reading).
 * A story answered whole is allowed `words × perWordMs + wholeStoryMs` on top of the response
 * limits; the number after an operation step (the story was read for the operation)
 * `words × perWordMs × rereadPercent / 100`. Without a template's `words` count or the balance's
 * `response.word` there is no allowance, so content 1.1.0 keeps the plain limits. Limits are the
 * shipped balance's (choice: fast 2.5 s, ok 6 s; keypad: ok 8 s and 0.7 s per extra digit); every
 * allowance is worked out here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import { readingAllowanceMs, responseBucket } from '../../../src/rules/learning/items';
import { storyAllowance } from '../../../src/rules/progression/problems';
import { storyWordCount } from '../../../src/rules/contract';
import type { ContentData, Problem, ProblemRoundView } from '../../../src/rules/contract';
import { Player, loadPack, oracle, root } from '../../traces/support';

const catalog: Record<string, string> = JSON.parse(
  readFileSync(join(root, 'content', 'catalogs', 'en.content.json'), 'utf8'),
);
const TIMING = { perWordMs: 1000, wholeStoryMs: 4000, rereadPercent: 25 };
const balance = loadPack().data.balance;
/** Content 1.1.0 as shipped, with neither field. */
const v110 = (): ContentPack<ContentData> => loadPack(join('content', 'history', '1.1.0.json'));

/** A copy of the pack with or without every story's word count and the reading time. */
function packWith(options: { words: boolean; timing: boolean }): ContentPack<ContentData> {
  const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
  for (const t of pack.data.wordTemplates) {
    if (options.words) t.words = storyWordCount(catalog[t.textKey]!);
    else delete t.words;
  }
  if (options.timing) pack.data.balance.response.word = { ...TIMING };
  else delete pack.data.balance.response.word;
  return pack;
}

describe('the reading allowance', () => {
  it('gives a story answered whole its words and a moment to take it in', () => {
    expect(readingAllowanceMs(20, TIMING, false), '20 words: 20 s + 4 s').toBe(24_000);
    expect(readingAllowanceMs(14, TIMING, false)).toBe(18_000);
  });

  it('gives the number after an operation step only a glance back at the story', () => {
    expect(readingAllowanceMs(20, TIMING, true), 'a quarter of 20 s').toBe(5_000);
    expect(readingAllowanceMs(7, { ...TIMING, rereadPercent: 33 }, true), 'rounded down').toBe(
      2_310,
    );
  });

  it('gives none without the word count or the reading time', () => {
    expect(readingAllowanceMs(undefined, TIMING, false)).toBe(0);
    expect(readingAllowanceMs(undefined, TIMING, true)).toBe(0);
    expect(readingAllowanceMs(20, undefined, false)).toBe(0);
    expect(readingAllowanceMs(20, undefined, true)).toBe(0);
  });

  it('moves both response limits, on top of the keypad time per digit', () => {
    const at = (ms: number, input: 'choice' | 'keypad', allowance?: number) =>
      responseBucket(true, ms, input, 2, balance, allowance);
    expect([at(7_500, 'choice', 5_000), at(7_501, 'choice', 5_000)]).toEqual(['fast', 'ok']);
    expect([at(11_000, 'choice', 5_000), at(11_001, 'choice', 5_000)]).toEqual(['ok', 'slow']);
    expect(at(11_000, 'choice'), 'without the allowance').toBe('slow');
    // Keypad, a two-digit answer: 8 s + 0.7 s + 5 s.
    expect([at(13_700, 'keypad', 5_000), at(13_701, 'keypad', 5_000)]).toEqual(['ok', 'slow']);
    expect(responseBucket(false, 1, 'choice', 1, balance, 5_000), 'a miss is a miss').toBe('miss');
  });
});

describe("a story's allowance", () => {
  const story = (template: string, operation: 'mul' | null) =>
    ({ kind: 'word', template, vars: {}, operation }) as unknown as Problem;
  const nests = 'word.equal-groups.nests'; // 14 words
  const bags = 'word.two-step.bags';
  const bagWords = storyWordCount(catalog[bags]!);

  it('comes from its template, whole or after the operation step', () => {
    const data = packWith({ words: true, timing: true }).data;
    expect(storyAllowance(data, story(nests, 'mul')), 'a quarter of 14 s').toBe(3_500);
    expect(storyAllowance(data, story(bags, null))).toBe(bagWords * 1000 + 4000);
  });

  it('is none for other problems, unknown stories, or without either field', () => {
    const data = packWith({ words: true, timing: true }).data;
    const fact = { kind: 'equation' } as unknown as Problem;
    expect(storyAllowance(data, fact)).toBe(0);
    expect(storyAllowance(data, story('word.missing', null))).toBe(0);
    expect(storyAllowance(packWith({ words: false, timing: true }).data, story(bags, null))).toBe(
      0,
    );
    expect(storyAllowance(packWith({ words: true, timing: false }).data, story(bags, null))).toBe(
      0,
    );
    expect(storyAllowance(v110().data, story(bags, null)), 'content 1.1.0').toBe(0);
  });
});

describe('answers to stories, timed in a real round', () => {
  /**
   * The ok limit of the answer on screen with the reading time this test expects: the plain
   * limit (choice 6 s; keypad 8 s and 0.7 s per extra digit) plus the story's allowance.
   */
  function okLimit(view: ProblemRoundView, reading: boolean): number {
    const p = view.problem!;
    const expected = oracle(p.problem, 'answer');
    const digits = expected.kind === 'number' ? String(expected.value).length : 1;
    const plain = p.input === 'keypad' ? 8000 + (digits - 1) * 700 : 6000;
    if (!reading || p.problem.kind !== 'word') return plain;
    const words = storyWordCount(catalog[p.problem.template]!);
    const allowance =
      p.problem.operation === null
        ? words * 1000 + 4000
        : (words * 1000 * 25 - ((words * 1000 * 25) % 100)) / 100;
    return plain + allowance;
  }

  /** The buckets of the stories of `level`, each answered `offset` ms after its ok limit. */
  async function buckets(
    pack: ContentPack<ContentData>,
    level: string,
    offset: number,
    reading = true,
  ): Promise<{ whole: boolean; bucket: string }[]> {
    const player = new Player(
      {
        right: () => true,
        elapsedMs: (_n, view) =>
          view.problem!.step === 'operation' ? 1000 : okLimit(view, reading) + offset,
        clumsy: false,
      },
      `reading-${level}`,
      undefined,
      pack,
    );
    const shapes: boolean[] = [];
    player.host.subscribeCommits(({ view }) => {
      const p = view.round?.type === 'problems' ? view.round.problem : null;
      if (p?.problem.kind === 'word' && p.step === 'answer' && shapes.length < p.index) {
        shapes.push(p.problem.operation === null);
      }
    });
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('sunny');
    const region = level.split('.')[0]!;
    await player.act({ type: 'setSetting', setting: { key: 'unlockAhead', value: [region] } });
    await player.act({ type: 'startLevel', level });
    await player.settleStory();
    await player.playRound();
    expect(player.failures).toEqual([]);
    const graded = player.data('answer.correct') as { item: string; bucket: string }[];
    await player.dispose();
    const stories = graded.filter((g) => g.item.startsWith('word:'));
    expect(stories.length, `${level} asked stories`).toBeGreaterThan(0);
    return stories.map((g, i) => ({ whole: shapes[i] ?? false, bucket: g.bucket }));
  }

  it('counts a two-step story answered within its reading time as ok, not slow', async () => {
    const pack = packWith({ words: true, timing: true });
    const inside = await buckets(pack, 'riddle-ruins.5', 0);
    expect(
      inside.every((s) => s.whole),
      'two-step stories are answered whole',
    ).toBe(true);
    expect(inside.map((s) => s.bucket)).toEqual(inside.map(() => 'ok'));
    const outside = await buckets(pack, 'riddle-ruins.5', 1);
    expect(outside.map((s) => s.bucket)).toEqual(outside.map(() => 'slow'));
  });

  it('gives the number after the operation step only the reread share', async () => {
    const pack = packWith({ words: true, timing: true });
    // Giants' Peaks 6 mixes stories that ask for their operation first with a two-step story.
    const inside = await buckets(pack, 'giants-peaks.6', 0);
    expect(
      inside.some((s) => !s.whole),
      'stories asked for their operation first',
    ).toBe(true);
    expect(inside.map((s) => s.bucket)).toEqual(inside.map(() => 'ok'));
    const outside = await buckets(pack, 'giants-peaks.6', 1);
    expect(outside.map((s) => s.bucket)).toEqual(outside.map(() => 'slow'));
  });

  it('keeps the plain limits for content without the fields', async () => {
    for (const pack of [
      v110(),
      packWith({ words: true, timing: false }),
      packWith({ words: false, timing: true }),
    ]) {
      const plain = await buckets(pack, 'riddle-ruins.5', 0, false);
      expect(plain.map((s) => s.bucket)).toEqual(plain.map(() => 'ok'));
      const read = await buckets(pack, 'riddle-ruins.5', 0);
      expect(
        read.map((s) => s.bucket),
        'the reading time is not given',
      ).toEqual(read.map(() => 'slow'));
    }
  });
});
