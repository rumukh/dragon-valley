/**
 * The preview rules that stand in for the real adapter: a warm-up round with kind misses,
 * coins and warmth per correct answer, stars at the end, and strict content validation.
 */
import { createRuntimeHost, requireValue } from '@aegis/runtime';
import { describe, expect, it } from 'vitest';
import { PREVIEW_CONTENT, previewAdapter, starsFor } from '../../../src/app/preview/adapter';
import type { PreviewAction } from '../../../src/app/preview/adapter';

function host() {
  return createRuntimeHost({
    adapter: previewAdapter,
    content: PREVIEW_CONTENT,
    seed: 'preview-test',
  });
}

const number = (value: number): PreviewAction => ({
  type: 'answer',
  value: { kind: 'number', value },
  elapsedMs: 1200,
});

describe('preview rules', () => {
  it('start a session once per day', async () => {
    const game = host();
    const events: string[] = [];
    game.subscribeCommits((commit) => events.push(...commit.events.map((event) => event.type)));
    requireValue(await game.dispatch({ type: 'startSession', day: '2026-10-06' }));
    requireValue(await game.dispatch({ type: 'startSession', day: '2026-10-06' }));
    requireValue(await game.dispatch({ type: 'startSession', day: '2026-10-07' }));
    expect(game.getView().sessions).toBe(2);
    expect(events).toEqual(['session.started', 'session.started', 'session.started']);
    expect(game.getStatus().turn).toBe(0);
  });

  it('play a round: a miss shows a model and keeps the problem, a hit pays and moves on', async () => {
    const game = host();
    const events: string[] = [];
    game.subscribeCommits((commit) => events.push(...commit.events.map((event) => event.type)));
    requireValue(await game.dispatch({ type: 'startRound' }));
    expect(game.getView().round).toMatchObject({
      index: 0,
      total: 4,
      input: 'choice',
      choices: [6, 8, 10],
    });

    requireValue(await game.dispatch(number(6)));
    expect(game.getView().round).toMatchObject({
      index: 0,
      last: 'miss',
      streak: 0,
      model: { kind: 'array', rows: 2, columns: 4 },
    });
    expect(game.getView().coins).toBe(0);

    requireValue(await game.dispatch(number(8)));
    expect(game.getView()).toMatchObject({ coins: 1, warmth: 25 });
    expect(game.getView().round).toMatchObject({
      index: 1,
      last: 'correct',
      streak: 1,
      model: null,
    });
    expect(game.getView().round?.solved?.answer).toEqual({ kind: 'number', value: 8 });

    requireValue(await game.dispatch(number(15)));
    requireValue(await game.dispatch(number(60)));
    expect(game.getView().round).toMatchObject({ input: 'keypad', answerKind: 'remainder' });
    requireValue(
      await game.dispatch({
        type: 'answer',
        value: { kind: 'remainder', quotient: 4, remainder: 3 },
        elapsedMs: 4000,
      }),
    );
    expect(game.getView().round).toMatchObject({
      finished: true,
      stars: 2,
      correct: 4,
      coinsEarned: 4,
    });
    expect(game.getView()).toMatchObject({ coins: 4, warmth: 100 });
    expect(game.getStatus().turn).toBe(5);
    expect(events).toEqual([
      'round.started',
      'answer.incorrect',
      'answer.correct',
      'coins.earned',
      'answer.correct',
      'coins.earned',
      'answer.correct',
      'coins.earned',
      'answer.correct',
      'coins.earned',
      'round.completed',
    ]);

    const late = await game.dispatch(number(1));
    expect(late.ok).toBe(false);
    requireValue(await game.dispatch({ type: 'endRound' }));
    expect(game.getView().round).toBeNull();
  });

  it('show equal groups and leftovers after a remainder miss', async () => {
    const game = host();
    requireValue(await game.dispatch({ type: 'startRound' }));
    for (const value of [8, 15, 60]) requireValue(await game.dispatch(number(value)));
    requireValue(
      await game.dispatch({
        type: 'answer',
        value: { kind: 'remainder', quotient: 3, remainder: 8 },
        elapsedMs: 900,
      }),
    );
    expect(game.getView().round?.model).toEqual({ kind: 'groups', total: 23, size: 5 });
  });

  it('refuse answers outside a round and a second round while one is running', async () => {
    const game = host();
    expect((await game.dispatch(number(8))).ok).toBe(false);
    requireValue(await game.dispatch({ type: 'startRound' }));
    expect((await game.dispatch({ type: 'startRound' })).ok).toBe(false);
    expect(game.getStatus().turn).toBe(0);
  });

  it('give stars by accuracy, and always at least one for finishing', () => {
    expect(starsFor(4, 0)).toBe(3);
    expect(starsFor(4, 1)).toBe(2);
    expect(starsFor(4, 2)).toBe(1);
    expect(starsFor(19, 1)).toBe(3);
    expect(starsFor(0, 0)).toBe(1);
  });

  it('refuse content whose choices omit the answer', () => {
    const bad = structuredClone(PREVIEW_CONTENT);
    (bad.data.problems[0] as unknown as { choices: number[] }).choices = [6, 7, 10];
    expect(host().stageContent({ ...bad, revision: 'bad-1' }).ok).toBe(false);
  });
});
