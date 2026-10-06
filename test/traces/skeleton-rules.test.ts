/**
 * Walking-skeleton rules beyond the golden first session: the paths a code review found broken.
 * Each test names the behaviour; answers come from an independent oracle (the test computes the
 * product or quotient itself).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { DispatchOutcome } from '@aegis/runtime';
import { createGameHost } from '../../src/rules/adapter';
import { blockedRecent } from '../../src/rules/progression/rounds';
import { contentRegistration } from '../../src/rules/contract';
import type { GameAction, Problem } from '../../src/rules/contract';

const content = requireValue(
  parseContentJson(
    readFileSync(
      join(import.meta.dirname, '..', '..', 'content', 'dragon-valley.content.json'),
      'utf8',
    ),
    contentRegistration,
  ),
);

function oracle(problem: Problem): number {
  if (problem.kind !== 'equation') throw new Error('unexpected problem');
  const { left, right } = problem;
  if (left.kind === 'op' && left.left.kind === 'num' && left.right.kind === 'num') {
    return left.op === 'mul'
      ? left.left.value * left.right.value
      : left.left.value / left.right.value;
  }
  // Missing factor: ? · k = p or k · ? = p.
  if (left.kind === 'op' && right.kind === 'num') {
    const known =
      left.left.kind === 'num' ? left.left.value : (left.right as { value: number }).value;
    return right.value / known;
  }
  throw new Error('unexpected problem shape');
}

async function session() {
  const host = createGameHost(content, 'skeleton-rules');
  const events: string[] = [];
  host.subscribeCommits((commit) => events.push(...commit.events.map((e) => e.type)));
  const act = async (action: GameAction): Promise<DispatchOutcome> => host.dispatch(action);
  const ok = async (action: GameAction) => {
    const outcome = await act(action);
    if (!outcome.ok) throw new Error(`${action.type} rejected: ${outcome.error.code}`);
  };
  const choose = async (choice: string | null) => {
    const story = host.getView().story!;
    await ok({
      type: 'storyChoice',
      beat: story.beat,
      node: story.node,
      revision: story.revision,
      choice,
    });
  };
  const playRound = async () => {
    for (let guard = 0; guard < 40; guard++) {
      const round = host.getView().round;
      if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return;
      const value = oracle(round.problem.problem);
      await ok({ type: 'answer', value: { kind: 'number', value }, elapsedMs: 1500 });
    }
  };
  await ok({ type: 'startSession', day: '2026-10-06' });
  await choose(null);
  await choose('bubbles');
  return { host, events, act, ok, choose, playRound };
}

describe('walking-skeleton rules', () => {
  it('rejects ending a non-timed round on time, so no level completes unplayed', async () => {
    const { host, act, ok, choose } = await session();
    await ok({ type: 'startLevel', level: 'sunny-meadow.1' });
    await choose(null);
    const outcome = await act({ type: 'endRound', reason: 'time-up' });
    expect(outcome.ok ? 'accepted' : outcome.error.code).toBe('not-timed');
    expect(host.getView().hub.regions[0]!.levels[0]!.stars).toBe(0);
    await host.dispose();
  });

  it('keeps a quit round out of the level result and lets the child finish later', async () => {
    const { host, events, ok, choose } = await session();
    await ok({ type: 'startLevel', level: 'sunny-meadow.1' });
    await choose(null);
    await ok({ type: 'endRound', reason: 'quit' });
    expect(events).not.toContain('level.completed');
    expect(host.getView().run?.next).toBe(1);
    await host.dispose();
  });

  it("unlocks the gift when the parent lowers the goal below today's correct answers", async () => {
    const { host, events, ok, choose, playRound } = await session();
    await ok({ type: 'startLevel', level: 'sunny-meadow.1' });
    await choose(null);
    await playRound();
    await ok({ type: 'endRound', reason: 'done' });
    await ok({ type: 'startLevel', level: 'sunny-meadow.2' });
    await playRound();
    const correct = host.getView().daily!.correct;
    expect(correct, 'two levels played').toBe(18);
    expect(host.getView().daily!.gift).toBe('locked');
    await ok({ type: 'setSetting', setting: { key: 'dailyGoal', value: 15 } });
    expect(host.getView().daily!.gift).toBe('ready');
    expect(events.filter((e) => e === 'daily.goal-reached')).toHaveLength(1);
    await ok({ type: 'endRound', reason: 'done' });
    await ok({ type: 'openGift' });
    expect(events).toContain('gift.opened');
    await host.dispose();
  });

  it('does not complete a finished level again when an activity is replayed', async () => {
    const { host, events, act, ok, choose, playRound } = await session();
    await ok({ type: 'startLevel', level: 'sunny-meadow.1' });
    await choose(null);
    await playRound();
    expect(events.filter((e) => e === 'level.completed')).toHaveLength(1);
    const skipped = await act({ type: 'startActivity', activity: { kind: 'level', index: 0 } });
    expect(skipped.ok ? 'accepted' : skipped.error.code, 'the Egg Grid is not playable yet').toBe(
      'not-implemented',
    );
    await ok({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    await playRound();
    expect(events.filter((e) => e === 'level.completed')).toHaveLength(1);
    expect(host.inspect().state.levels['sunny-meadow.1']?.plays).toBe(1);
    await host.dispose();
  });

  it('blocks no recent items when noRepeatWithin is 0', () => {
    expect(blockedRecent(['a', 'b', 'c'], 0)).toEqual([]);
    expect(blockedRecent(['a', 'b', 'c'], 2)).toEqual(['b', 'c']);
  });
});
