/**
 * A save stuck in snack time, from the learner simulation: the perfect child on day 68 of
 * `node scripts/simulate.mjs --days 68 --learners perfect` with the Leitner intervals of the
 * coming balance (`--balance` `{"leitner":{"intervals":[0,1,2,4,8,16]}}`) on content 1.1.0.
 * No dragon was hungry and the valley's basket held one due fact, `terms:product`, so snack time
 * for every dragon served the basket alone, with the minimum target of 6 problems. The first
 * answer took the fact out of the basket; the next draw then had nothing to pick from and threw
 * (`Prng.pick: cannot pick from an empty array`), so every answer was rolled back and the round
 * could only be quit (pause → Quit, `endRound{ reason: 'quit' }`), after which the next snack got
 * stuck the same way. `fixtures/stuck-snack-save.json` is the snapshot of the simulation's last
 * commit before the failing answer, made with main 4a89348's rules: the save the shell keeps.
 *
 * The current rules restore it exactly as saved; its next answer finishes the snack normally,
 * and the next snack of the basket alone is one problem long.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { dataHash, parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { contentRegistration, isoDay } from '../../src/rules/contract';
import type { ContentData, GameView } from '../../src/rules/contract';
import { itemIndex } from '../../src/rules/learning/index-cache';
import { basketItems, hungryDragons } from '../../src/rules/progression/dragons';
import { PERFECT, Player, root } from '../traces/support';

// Whole rounds are replayed here with the full content pack: give them room on a busy machine.
vi.setConfig({ testTimeout: 300_000 });

/**
 * The pack the save was made with: content 1.1.0 (archived once a later revision ships) with the
 * simulation's interval override, merged as scripts/simulate.mjs merges `--balance`.
 */
function savedPack(): ContentPack<ContentData> {
  const archived = join('content', 'history', '1.1.0.json');
  const file = existsSync(join(root, archived))
    ? archived
    : join('content', 'dragon-valley.content.json');
  const json = JSON.parse(readFileSync(join(root, file), 'utf8')) as {
    data: { balance: { leitner: { intervals: number[] } } };
  };
  json.data.balance.leitner.intervals = [0, 1, 2, 4, 8, 16];
  return requireValue(parseContentJson(JSON.stringify(json), contentRegistration, file));
}

const pack = savedPack();
const index = itemIndex(pack.data);
const save = JSON.parse(
  readFileSync(join(root, 'test', 'migration', 'fixtures', 'stuck-snack-save.json'), 'utf8'),
) as RuntimeSnapshot;

async function restored(): Promise<Player> {
  const player = new Player(PERFECT, 'stuck-snack', undefined, pack);
  const outcome = await player.host.restore(save);
  expect(outcome.ok, outcome.ok ? '' : outcome.error.code).toBe(true);
  player.turn = player.host.inspect().turn;
  return player;
}

function problemRound(view: GameView) {
  const round = view.round;
  if (round?.type !== 'problems') throw new Error('a snack is a problem round');
  return round;
}

/** Follow the Daily Adventure for a few steps: snacks, levels, the gift. */
async function playOn(player: Player, steps: number): Promise<string[]> {
  const done: string[] = [];
  for (let step = 0; step < steps; step++) {
    await player.settleStory();
    const next = player.view().hub.next;
    if (next.kind === 'snack') {
      await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: next.dragon } });
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
    } else if (next.kind === 'level') await player.playLevel(next.level);
    else if (next.kind === 'gift') await player.act({ type: 'openGift' });
    else break;
    done.push(next.kind);
  }
  return done;
}

describe('a save stuck in a snack of the basket alone', () => {
  it('restores exactly as saved: 6 problems for 1 basket fact, the first on screen', async () => {
    expect(save.content).toMatchObject({
      id: 'dragon-valley',
      revision: '1.1.0',
      hash: 'be73b39155127a02',
    });
    expect(dataHash(pack), 'content 1.1.0 with the intervals [0,1,2,4,8,16]').toBe(
      'be73b39155127a02',
    );
    const player = await restored();
    expect(player.host.hash(), 'the restored game is the saved game').toBe(dataHash(save));
    const state = player.state();
    expect(hungryDragons(state, pack.data, index), 'no dragon is hungry').toEqual([]);
    expect(basketItems(state, pack.data, index), 'one fact in the basket').toEqual([
      'terms:product',
    ]);
    expect(state.round).toMatchObject({
      activity: 'snack',
      source: { kind: 'snack', dragon: null },
      skills: [],
      target: 6,
      asked: 1,
      answered: 0,
      status: 'active',
      current: { item: 'terms:product', step: 'answer' },
    });
    await player.dispose();
  });

  it('finishes the snack with its next answer, pays for it and goes on to the next day', async () => {
    const player = await restored();
    const coins = player.state().coins;
    expect(await player.answer(), 'the answer is accepted').toBe(true);
    expect(player.failures).toEqual([]);
    const round = problemRound(player.view());
    expect(
      { status: round.status, endReason: round.endReason, ...round.progress },
      'the basket is empty: the snack is over after 1 of its 6 problems',
    ).toMatchObject({ status: 'complete', endReason: 'finished', answered: 1, correct: 1 });
    expect(player.data('round.completed')).toEqual([
      { round: 'r243', answered: 1, correct: 1, fast: 1 },
    ]);
    expect(player.state().coins, 'the right answer was paid').toBeGreaterThan(coins);
    expect(await player.act({ type: 'endRound', reason: 'done' }), 'and closed').toBe(true);
    expect(player.view().round).toBeNull();
    expect(player.view().hub.next.kind, 'nothing left to feed today').not.toBe('snack');

    const day = player.state().day!;
    expect(await player.act({ type: 'startSession', day: isoDay(day + 1) })).toBe(true);
    const played = await playOn(player, 3);
    expect(played.length, `the next day plays on: ${played.join(', ')}`).toBeGreaterThan(0);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('could always be quit, and the next snack of the basket alone is one problem long', async () => {
    const player = await restored();
    expect(await player.act({ type: 'endRound', reason: 'quit' }), 'pause → Quit').toBe(true);
    expect(player.state().round, 'quit and closed').toBeNull();
    expect(player.view().hub.next, 'the fact is still due: snack time again').toEqual({
      kind: 'snack',
      dragon: null,
    });
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    expect(problemRound(player.view()).progress.target, 'one fact, one problem').toBe(1);
    await player.playRound();
    expect(problemRound(player.view()).status).toBe('complete');
    expect(await player.act({ type: 'endRound', reason: 'done' })).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});
