/**
 * No round can be left stuck (the hotfix for the snack the learner simulation found deadlocked;
 * the save itself is test/migration/stuck-snack-save.test.ts). Every draw returns `null` on an
 * empty pool instead of throwing; a snack of the valley's basket alone is never longer than the
 * basket (a fact and its twin count once: a right answer reviews both); and a problem round with
 * nothing left to serve finishes like any finished round. The property test plays rounds of every
 * kind from random states of a child 68 days into the valley, emptying the basket under the
 * round's feet now and then, and requires each round to serve a problem or end.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createPrng } from '@aegis/core';
import { success } from '@aegis/runtime';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { ACTION_TURNS, initialProfileState, isMinigameKind } from '../../../src/rules/contract';
import type { GameAction, ItemState, ProfileState } from '../../../src/rules/contract';
import { dragonValleyAdapter } from '../../../src/rules/adapter';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { isDue } from '../../../src/rules/learning/items';
import {
  pickArena,
  pickMixed,
  pickPlacement,
  pickSnack,
} from '../../../src/rules/learning/selection';
import { basketItems, dragonFacts, hungryDragons } from '../../../src/rules/progression/dragons';
import { distinctFacts, startSnack } from '../../../src/rules/progression/snack';
import type { Ctx } from '../../../src/rules/types';
import { PERFECT, Player, loadPack, root } from '../../traces/support';
import type { Adapter, Style } from '../../traces/support';

// Rounds are played through the adapter with the full content pack: room on a busy machine.
vi.setConfig({ testTimeout: 300_000 });

const pack = loadPack();
const data = pack.data;
const index = itemIndex(data);
const DAY = 20_000;
/** Where a runtime snapshot keeps the profile state. */
const STATE = 'aegis.runtime.state';

/** A fact answered right twice, due `overdue` days ago. */
const due = (overdue = 1): ItemState => ({
  box: 2,
  due: DAY - overdue,
  seen: 2,
  correct: 2,
  recent: ['ok', 'ok'],
  lastDay: DAY - overdue - 1,
});

/** Bubbles (×2) hatched and Ember (×6) still an egg, on a fresh day. */
function state(items: Record<string, ItemState>): ProfileState {
  const s: ProfileState = { ...initialProfileState({ dailyGoal: 30, arena: true }), day: DAY };
  const outfit = { head: null, neck: null, eyes: null, wings: null, nest: null };
  s.items = items;
  s.onboarding = { ...s.onboarding, firstEgg: 'bubbles', placement: 'skipped' };
  s.dragons = {
    bubbles: { stage: 'hatchling', obtainedDay: DAY - 9, stageDay: DAY - 9, outfit },
    ember: { stage: 'egg', obtainedDay: DAY - 2, stageDay: DAY - 2, outfit },
  };
  s.daily = {
    day: DAY,
    answers: 0,
    correct: 0,
    fast: 0,
    levels: 0,
    minigames: 0,
    goal: 30,
    quests: [],
    gift: 'locked',
  };
  return s;
}

/** The game in `player` with its profile state replaced by `s` (a save edited by hand). */
async function withState(player: Player, s: ProfileState): Promise<void> {
  const snapshot = player.host.snapshot();
  const edited = {
    ...snapshot,
    world: { ...snapshot.world, resources: { ...snapshot.world.resources, [STATE]: s } },
  } as RuntimeSnapshot;
  const outcome = await player.host.restore(edited);
  expect(outcome.ok, outcome.ok ? '' : JSON.stringify(outcome.error)).toBe(true);
  player.turn = player.host.inspect().turn;
}

/** The problem round on screen. */
function problemRound(player: Player) {
  const round = player.view().round;
  if (round?.type !== 'problems') throw new Error('a problem round');
  return round;
}

/** The target of a snack for `dragon` started on `s` (a hand-made context, no runtime). */
function snackSize(s: ProfileState, dragon: string | null): number | null | undefined {
  const streams = new Map<string, ReturnType<typeof createPrng>>();
  const ctx = {
    state: s,
    content: { data },
    emit: () => {},
    enterPhase: () => {},
    random: (name: string) => {
      if (!streams.has(name)) streams.set(name, createPrng(`never-stuck:${name}`));
      return streams.get(name)!;
    },
  } as unknown as Ctx;
  startSnack(ctx, index, dragon);
  return s.round?.type === 'problems' ? s.round.target : undefined;
}

describe('every draw on an empty pool', () => {
  it('returns null instead of throwing', () => {
    const s = state({});
    const random = createPrng('empty');
    const empty = { state: s, pool: [], blocked: ['mul:2x3'], served: ['mul:2x3'], random };
    expect(pickSnack(empty), 'snack time').toBeNull();
    expect(pickSnack({ ...empty, likelyFirst: true }), 'snack time, protected').toBeNull();
    expect(pickMixed({ ...empty, data, focus: null }), 'a mixed round').toBeNull();
    expect(pickArena(empty), 'the Arena').toBeNull();
    expect(pickPlacement({ ...empty, focus: ['mul:2x3'] }), 'the placement check').toBeNull();
  });
});

describe('a snack of the basket alone', () => {
  it('counts a fact and its twin once', () => {
    expect(distinctFacts([]), 'nothing').toBe(0);
    expect(distinctFacts(['mul:6x8', 'mul:8x6']), 'twins').toBe(1);
    expect(distinctFacts(['mul:8x6', 'mul:6x8', 'mul:6x6']), 'twins in any order; a square').toBe(
      2,
    );
    expect(
      distinctFacts(['div:48:6', 'div:48:8', 'terms:product', 'compare:fact-number']),
      'no twins outside multiplication',
    ).toBe(4);
  });

  it('is as long as the basket: one problem per fact, twins once, never more than a snack', () => {
    const basket = (n: number) =>
      Object.fromEntries(
        ['compare:fact-number', 'mul:6x7', 'mul:7x9', 'mul:8x9', 'mul:3x7', 'mul:4x9', 'mul:5x7']
          .slice(0, n)
          .map((item) => [item, due()]),
      );
    expect(snackSize(state(basket(1)), null), 'one fact: one problem').toBe(1);
    expect(snackSize(state({ 'mul:6x8': due(), 'mul:8x6': due() }), null), 'twins: one').toBe(1);
    expect(snackSize(state(basket(3)), null), 'three facts').toBe(3);
    expect(snackSize(state(basket(7)), null), 'seven facts, a snack of 7').toBe(7);
    const low = state(basket(7));
    low.history = [{ day: DAY - 1, answers: 20, correct: 8, fast: 0 }];
    expect(snackSize(low, null), 'seven facts while success is low: at most 6').toBe(6);
    const lowFew = state(basket(3));
    lowFew.history = low.history;
    expect(snackSize(lowFew, null), 'three facts while success is low: 3, not 4').toBe(3);
    const hungry = state({ ...basket(1), 'mul:2x3': due() });
    expect(hungryDragons(hungry, data, index), 'Bubbles has a due fact').toEqual(['bubbles']);
    expect(snackSize(hungry, null), 'a hungry dragon: at least 6 as before').toBe(6);
  });

  it('is played to its end through the adapter, then the basket is empty', async () => {
    const s = state({ 'compare:fact-number': due(3), 'mul:6x8': due(), 'mul:8x6': due() });
    expect(hungryDragons(s, data, index), 'no dragon is hungry').toEqual([]);
    expect(basketItems(s, data, index)).toEqual(['compare:fact-number', 'mul:6x8', 'mul:8x6']);
    const player = new Player(PERFECT, 'basket-snack', undefined, pack);
    await withState(player, s);
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    expect(problemRound(player).progress.target, '3 facts, 6 · 8 and 8 · 6 once').toBe(2);
    const served: string[] = [];
    for (let guard = 0; guard < 10 && problemRound(player).status === 'active'; guard++) {
      served.push(problemRound(player).problem!.item);
      await player.answer();
    }
    expect(served[0], 'the most overdue first').toBe('compare:fact-number');
    expect(['mul:6x8', 'mul:8x6'], `then one of the twins: ${served.join(' ')}`).toContain(
      served[1],
    );
    expect(served).toHaveLength(2);
    expect(problemRound(player)).toMatchObject({ status: 'complete', endReason: 'finished' });
    expect(await player.act({ type: 'endRound', reason: 'done' }), 'closed as usual').toBe(true);
    expect(basketItems(player.state(), data, index), 'the right answer fed both twins').toEqual([]);
    expect(player.view().hub.next.kind).not.toBe('snack');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('leaves a missed twin for the next snack, one problem long', async () => {
    const s = state({ 'mul:6x8': due(), 'mul:8x6': due() });
    const missFirst: Style = { ...PERFECT, right: (n) => n > 1 };
    const player = new Player(missFirst, 'basket-snack', undefined, pack);
    await withState(player, s);
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    const missed = problemRound(player).problem!.item;
    await player.playRound();
    expect(problemRound(player).progress, 'one problem, missed').toMatchObject({
      target: 1,
      answered: 1,
      correct: 0,
    });
    await player.act({ type: 'endRound', reason: 'done' });
    const twin = missed === 'mul:6x8' ? 'mul:8x6' : 'mul:6x8';
    expect(basketItems(player.state(), data, index), 'the twin is still due').toEqual([twin]);
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    expect(problemRound(player).problem!.item).toBe(twin);
    await player.playRound();
    expect(problemRound(player).progress).toMatchObject({ target: 1, answered: 1, correct: 1 });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('a problem round with nothing left to serve', () => {
  it('finishes at once even when it starts with nothing to serve', async () => {
    // Legality never starts such a round; this adapter lets snack time start regardless.
    const lenient: Adapter = {
      ...dragonValleyAdapter,
      resolve(action, read) {
        const resolved = dragonValleyAdapter.resolve(action, read);
        return !resolved.ok && action.type === 'startActivity' && action.activity.kind === 'snack'
          ? success({ rule: action.type, payload: action, turns: ACTION_TURNS[action.type] })
          : resolved;
      },
    };
    const player = new Player(PERFECT, 'nothing', lenient, pack);
    await withState(player, state({}));
    expect(basketItems(player.state(), data, index), 'nothing is due').toEqual([]);
    expect(
      await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } }),
    ).toBe(true);
    expect(problemRound(player), 'over before its first problem').toMatchObject({
      status: 'complete',
      endReason: 'finished',
      problem: null,
      progress: { answered: 0, target: 1 },
    });
    expect(await player.act({ type: 'endRound', reason: 'done' })).toBe(true);
    await player.dispose();
  });
});

describe('rounds from random states (property)', () => {
  const save = JSON.parse(
    readFileSync(join(root, 'test', 'migration', 'fixtures', 'stuck-snack-save.json'), 'utf8'),
  ) as RuntimeSnapshot;
  /** The 68-day child of the stuck save: every dragon, level and kind of fact. */
  const veteran = (save.world.resources as Record<string, unknown>)[STATE] as ProfileState;
  const KINDS = ['basket', 'snack', 'level', 'arena', 'placement'] as const;
  const SCENARIOS = 25;
  /** Answers after which a round that is still going counts as stuck. */
  const LIMIT = 40;

  /** The veteran's day with random due facts, eggs, success and (`basketOnly`) no hungry dragon. */
  function randomState(seed: number, basketOnly: boolean): ProfileState {
    const random = createPrng(`never-stuck:state:${seed}`);
    const s = structuredClone(veteran) as ProfileState;
    const day = s.day!;
    s.round = null;
    s.run = null;
    s.story = { ...s.story, pending: null };
    for (const dragon of Object.values(s.dragons)) if (random.int(0, 4) === 0) dragon.stage = 'egg';
    for (const [id, item] of Object.entries(s.items)) {
      if (item.correct > 0 && random.int(0, 3) === 0) {
        s.items[id] = {
          ...item,
          box: random.int(0, 6),
          due: day - random.int(0, 10),
          lastDay: Math.min(item.lastDay, day - 1),
        };
      } else s.items[id] = { ...item, due: day + 1 + random.int(0, 10) };
    }
    if (basketOnly) {
      for (const dragon of data.dragons) {
        if ((s.dragons[dragon.id]?.stage ?? 'egg') === 'egg') continue;
        for (const fact of dragonFacts(dragon, index)) {
          const item = s.items[fact];
          if (item !== undefined) s.items[fact] = { ...item, due: day + 1 };
        }
      }
      const term = s.items['terms:product']!;
      s.items['terms:product'] = {
        ...term,
        due: day - 1,
        lastDay: Math.min(term.lastDay, day - 1),
      };
    }
    s.history = s.history.map((entry) => ({
      ...entry,
      correct: random.int(Math.floor(entry.answers / 3), entry.answers + 1),
    }));
    return s;
  }

  /** Mark every due fact practised today: the basket empties under the round's feet. */
  async function emptyBasket(player: Player): Promise<void> {
    const snapshot = player.host.snapshot();
    const resources = snapshot.world.resources as Record<string, unknown>;
    const s = structuredClone(resources[STATE]) as ProfileState;
    const day = s.day!;
    for (const [id, item] of Object.entries(s.items)) {
      if (isDue(item, day)) s.items[id] = { ...item, lastDay: day };
    }
    const edited = {
      ...snapshot,
      world: { ...snapshot.world, resources: { ...resources, [STATE]: s } },
    } as RuntimeSnapshot;
    const outcome = await player.host.restore(edited);
    expect(outcome.ok, outcome.ok ? '' : JSON.stringify(outcome.error)).toBe(true);
    player.turn = player.host.inspect().turn;
  }

  /** A start for `kind` on the player's state (a replayed problem activity for `level`). */
  function start(kind: (typeof KINDS)[number], seed: number): GameAction {
    if (kind === 'basket' || kind === 'snack') {
      return { type: 'startActivity', activity: { kind: 'snack', dragon: null } };
    }
    if (kind === 'arena') return { type: 'startActivity', activity: { kind: 'arena' } };
    if (kind === 'placement') return { type: 'startActivity', activity: { kind: 'placement' } };
    const problems = data.levels.flatMap((level) =>
      level.activities
        .map((activity, i) => ({ level: level.id, activity: i, kind: activity.kind }))
        .filter((a) => !isMinigameKind(a.kind)),
    );
    const picked = problems[(seed * 7) % problems.length]!;
    return { type: 'startLevel', level: picked.level, activity: picked.activity };
  }

  it('always serve a problem or end, whatever the state and however the basket empties', async () => {
    const stuck: string[] = [];
    const tally = { answers: 0, emptied: 0, quit: 0, early: 0 };
    const rounds: Record<string, number> = {};
    for (let seed = 0; seed < SCENARIOS; seed++) {
      const kind = KINDS[seed % KINDS.length]!;
      const random = createPrng(`never-stuck:play:${seed}`);
      const style: Style = {
        right: () => random.int(0, 100) < 75,
        elapsedMs: () => random.int(800, 12_000),
        clumsy: false,
      };
      const player = new Player(style, `never-stuck:${seed}`, undefined, pack);
      await withState(player, randomState(seed, kind === 'basket'));
      const label = `${seed}:${kind}`;
      const outcome = await player.host.dispatch(start(kind, seed));
      if (!outcome.ok) {
        stuck.push(`${label}: could not start (${outcome.error.code})`);
        await player.dispose();
        continue;
      }
      rounds[kind] = (rounds[kind] ?? 0) + 1;
      const quitAt = seed % 6 === 5 ? random.int(0, 5) : -1;
      const timeUpAt = kind === 'arena' ? random.int(5, 25) : -1;
      for (let answered = 0; ; answered++) {
        const round = problemRound(player);
        if (round.status !== 'active') break;
        if (answered === quitAt || answered === timeUpAt) {
          const reason = answered === quitAt ? 'quit' : 'time-up';
          if (!(await player.act({ type: 'endRound', reason }))) {
            stuck.push(`${label}: ${reason} refused after ${answered} answers`);
          }
          if (reason === 'quit') tally.quit += 1;
          break;
        }
        if (round.problem === null) {
          stuck.push(`${label}: nothing on screen after ${answered} answers`);
          break;
        }
        if (answered >= LIMIT) {
          stuck.push(`${label}: still going after ${LIMIT} answers`);
          break;
        }
        if (random.int(0, 4) === 0) {
          await emptyBasket(player);
          tally.emptied += 1;
        }
        if (!(await player.answer())) {
          stuck.push(`${label}: answer ${answered + 1} refused (${player.failures.at(-1)})`);
          break;
        }
        tally.answers += 1;
      }
      const round = player.view().round;
      if (round?.type === 'problems' && round.status === 'complete') {
        const { answered, target } = round.progress;
        if (round.endReason === 'finished' && target !== null && answered < target) tally.early++;
        if (!(await player.act({ type: 'endRound', reason: 'done' }))) {
          stuck.push(`${label}: the finished round could not be closed`);
        }
      } else if (round !== null) stuck.push(`${label}: the round did not end`);
      await player.dispose();
    }
    expect(
      stuck,
      `${SCENARIOS} rounds (${JSON.stringify(rounds)}), ${tally.answers} answers, the basket ` +
        `emptied ${tally.emptied} times, ${tally.early} finished early, ${tally.quit} quit`,
    ).toEqual([]);
    expect(
      KINDS.map((kind) => rounds[kind] ?? 0),
      'every kind of round was played',
    ).toEqual(KINDS.map(() => SCENARIOS / KINDS.length));
    expect(tally.early, 'some rounds ran out of things to serve').toBeGreaterThan(0);
  });
});
