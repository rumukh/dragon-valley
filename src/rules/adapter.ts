/**
 * The Dragon Valley runtime adapter: state, actions, content, commands, jobs and view, registered
 * with `@aegis/runtime`. It implements sessions and days (daily goal, quests, gift), story beats
 * (including the first-egg choice), level runs of problem rounds and minigame boards, the
 * placement check, snack time, the Lightning Arena, grading, Leitner moves, the mix, re-ask
 * jobs, coins, eggs, dragon growth, stickers, the market, outfits, rule settings, state
 * validation and the full view.
 *
 * Level runs skip activities whose generators are not implemented yet.
 */
import { createRuntimeHost, failure, requireValue, schema, success } from '@aegis/runtime';
import type {
  CheckpointWriter,
  ContentPack,
  JsonValue,
  Outcome,
  RuntimeAdapter,
  RuntimeHost,
} from '@aegis/runtime';
import { restoreCosmetics, restoreMinigame, restoreNarrative } from '@aegis/narrative';
import type { MinigameDefinition, NarrativeGraph } from '@aegis/narrative';
import {
  ACTION_TURNS,
  ADAPTER_ID,
  EVENTS,
  EVENT_PHASES,
  JOB_RULES,
  RANDOM_STREAMS,
  STATE_VERSION,
  contentId,
  contentRegistration,
  dayNumber,
  gameActionSchema,
  initialProfileState,
  isItemId,
  isoDay,
  itemIdSchema,
  profileStateSchema,
  skillItemIndex,
} from './contract';
import type { ContentData, GameAction, GameView, ProfileState } from './contract';
import { checkDailyGoal, claimProblem, claimQuest, startDay } from './economy/daily';
import {
  availableCosmetics,
  awardStickers,
  cosmeticCatalog,
  grantItem,
  openGift,
} from './economy/rewards';
import { MINIGAMES } from './minigames/boards';
import { arenaProblem, startArena } from './progression/arena';
import { applyGrowth } from './progression/dragons';
import { isPlayable } from './progression/levels';
import { applyMinigameMove, moveProblem } from './progression/minigame-rounds';
import { placementProblem, startPlacement } from './progression/placement';
import { activeProblemRound, gradeAnswer, roundDone, serveNext } from './progression/problems';
import { canPlay, closeRound, completeRound, startRunActivity } from './progression/rounds';
import { snackProblem, startSnack } from './progression/snack';
import { chooseInBeat, findBeat, storyChoiceProblem, triggerBeats } from './story/beats';
import { projectView } from './view';
import type { Ctx, Read, ReadState } from './types';

type Reject = {
  readonly ok: false;
  readonly error: {
    code: string;
    messageKey: string;
    diagnostics: readonly { code: string; message: string }[];
  };
};
const reject = (code: string, message: string): Reject => failure(code, message);

function problemOnScreen(state: ReadState): boolean {
  const round = state.round;
  return (
    round !== null && round.type === 'problems' && round.status === 'active' && !!round.current
  );
}

function legality(action: GameAction, read: Read): Reject | null {
  const state: ReadState = read.state;
  const data = read.content.data;
  const round = state.round;
  const activeRound = round !== null && round.status === 'active';
  const pendingBlocking =
    state.story.pending !== null && findBeat(data, state.story.pending)?.skippable === false;
  if (action.type !== 'startSession' && state.day === null) {
    return reject('no-session', 'Start a session first.');
  }
  switch (action.type) {
    case 'startSession':
      return dayNumber(action.day) === null ? reject('invalid-day', 'Not a calendar date.') : null;
    case 'startLevel':
      if (pendingBlocking) return reject('story-pending', 'Finish the story first.');
      if (activeRound) return reject('round-active', 'Finish or leave the current round first.');
      if (!data.levels.some((l) => l.id === action.level))
        return reject('unknown-level', 'No such level.');
      return isPlayable(state, data, action.level)
        ? null
        : reject('locked-level', 'This level is still locked.');
    case 'startActivity': {
      if (pendingBlocking) return reject('story-pending', 'Finish the story first.');
      if (activeRound) return reject('round-active', 'Finish or leave the current round first.');
      const request = action.activity;
      const index = skillItemIndex(data);
      if (request.kind === 'placement') {
        const problem = placementProblem(data, index);
        return problem === null ? null : reject('locked-activity', problem);
      }
      if (request.kind === 'snack') {
        const problem = snackProblem(state, data, index, request.dragon);
        return problem === null ? null : reject(problem.code, problem.message);
      }
      if (request.kind === 'arena') {
        const problem = arenaProblem(state, data, index);
        return problem === null ? null : reject('arena-locked', problem);
      }
      const run = state.run;
      const level = run === null ? undefined : data.levels.find((l) => l.id === run.level);
      if (!run || !level) return reject('no-level', 'Start a level first.');
      if (request.index > run.next || request.index >= level.activities.length) {
        return reject('locked-activity', 'Play the activities in order.');
      }
      return canPlay(data, level, request.index, index)
        ? null
        : reject('not-implemented', 'This activity is coming with the rules work.');
    }
    case 'answer':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to answer.');
      return round?.type === 'problems' && round.activity === 'placement'
        ? reject('wrong-action', 'Use placementAnswer.')
        : null;
    case 'placementAnswer':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to answer.');
      return round?.type === 'problems' && round.activity === 'placement'
        ? null
        : reject('wrong-action', 'Use answer.');
    case 'hint':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to hint.');
      return round?.type === 'problems' && round.current?.hinted
        ? reject('already-hinted', 'The hint is already shown.')
        : null;
    case 'minigameMove': {
      const problem = moveProblem(state, action.revision, action.move);
      return problem === null ? null : reject(problem.code, problem.message);
    }
    case 'endRound':
      if (round === null) return reject('no-round', 'There is no round.');
      if (action.reason === 'done')
        return activeRound ? reject('round-active', 'The round is still going.') : null;
      if (!activeRound) return reject('round-finished', 'The round has already finished.');
      // Only the Lightning Arena is timed; any round may end on the parent's time limit or a quit.
      return action.reason === 'time-up' && round.activity !== 'arena'
        ? reject('not-timed', 'Only the Arena ends on time.')
        : null;
    case 'buy': {
      const item = data.cosmetics.find((c) => c.id === action.item);
      if (!item || !availableCosmetics(state, data).includes(item.id))
        return reject('unknown-item', 'Not in the market.');
      if (state.cosmetics.owned.includes(item.id)) return reject('owned', 'Already owned.');
      return state.coins >= item.price
        ? null
        : reject('insufficient-coins', 'Not enough coins yet.');
    }
    case 'equip': {
      if (!state.dragons[action.dragon]) return reject('unknown-dragon', 'No such dragon.');
      if (action.item === null) return null;
      const item = data.cosmetics.find((c) => c.id === action.item);
      if (!item || !state.cosmetics.owned.includes(item.id))
        return reject('not-owned', 'Not owned.');
      return item.slot === action.slot ? null : reject('wrong-slot', 'It does not fit there.');
    }
    case 'claimQuest': {
      const problem = claimProblem(state, data, action.quest);
      return problem === null ? null : reject(problem.code, problem.message);
    }
    case 'openGift':
      return state.daily?.gift === 'ready'
        ? null
        : reject('gift-not-ready', 'The gift is not ready yet.');
    case 'storyChoice': {
      const problem = storyChoiceProblem(
        state,
        data,
        action.beat,
        action.node,
        action.revision,
        action.choice,
      );
      return problem === null ? null : reject('story-choice', problem);
    }
    case 'setSetting': {
      const { setting } = action;
      if (setting.key === 'dailyGoal') {
        const { goalMin, goalMax } = data.balance.daily;
        return setting.value >= goalMin && setting.value <= goalMax
          ? null
          : reject('invalid-setting', 'Daily goal out of range.');
      }
      if (setting.key === 'unlockAhead') {
        return setting.value.every((id) => data.regions.some((r) => r.id === id))
          ? null
          : reject('invalid-setting', 'Unknown region.');
      }
      return null;
    }
  }
}

function indexOf(ctx: Ctx | Read): Map<string, string[]> {
  return skillItemIndex(ctx.content.data);
}

function startSession(ctx: Ctx, iso: string): void {
  const state = ctx.state;
  const requested = dayNumber(iso)!;
  const day = Math.max(requested, state.day ?? requested);
  const newDay = state.day === null || day > state.day;
  state.day = day;
  state.firstDay ??= day;
  state.sessions += 1;
  if (newDay) {
    state.daysPracticed += 1;
    startDay(ctx, day);
  }
  ctx.emit(EVENTS.sessionStarted, { day: isoDay(day), newDay });
  if (state.sessions === 1) triggerBeats(ctx, (trigger) => trigger.kind === 'first-session');
  awardStickers(ctx);
}

/** After an answer: serve the next problem or finish the round; then growth and stickers. */
function afterAnswer(ctx: Ctx): void {
  const index = indexOf(ctx);
  const round = activeProblemRound(ctx);
  if (round && round.current === null) {
    if (roundDone(ctx.content.data, round)) completeRound(ctx, index, 'finished');
    else serveNext(ctx, index);
  }
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

function command(
  type: GameAction['type'],
  handlers: {
    start?: (ctx: Ctx, action: GameAction) => void;
    finish?: (ctx: Ctx, action: GameAction) => void;
  },
) {
  const parse = (payload: unknown): GameAction => requireValue(gameActionSchema.parse(payload));
  return {
    id: type,
    payload: gameActionSchema,
    progress: schema.literal(null),
    start: handlers.start
      ? (ctx: Ctx, pending: { payload: unknown }) => handlers.start!(ctx, parse(pending.payload))
      : undefined,
    finish: handlers.finish
      ? (ctx: Ctx, pending: { payload: unknown }) => handlers.finish!(ctx, parse(pending.payload))
      : undefined,
  };
}

const reaskPayload = schema.object({ round: contentId, item: itemIdSchema });

function validateState(read: Read): Outcome<void> {
  const state = read.state;
  const data = read.content.data;
  const problems: string[] = [];
  const known = (list: readonly { id: string }[], id: string) =>
    list.some((entry) => entry.id === id);
  for (const item of Object.keys(state.items)) if (!isItemId(item)) problems.push(`item ${item}`);
  for (const level of Object.keys(state.levels))
    if (!known(data.levels, level)) problems.push(`level ${level}`);
  for (const boss of Object.keys(state.bosses))
    if (!known(data.bosses, boss)) problems.push(`boss ${boss}`);
  for (const sticker of Object.keys(state.stickers))
    if (!known(data.stickers, sticker)) problems.push(`sticker ${sticker}`);
  for (const region of state.settings.unlockAhead)
    if (!known(data.regions, region)) problems.push(`region ${region}`);
  for (const [id, dragon] of Object.entries(state.dragons)) {
    if (!known(data.dragons, id)) problems.push(`dragon ${id}`);
    for (const [slot, item] of Object.entries(dragon.outfit)) {
      const cosmetic = data.cosmetics.find((c) => c.id === item);
      if (
        item !== null &&
        (!cosmetic || cosmetic.slot !== slot || !state.cosmetics.owned.includes(item))
      ) {
        problems.push(`outfit ${id}.${slot}`);
      }
    }
  }
  for (const quest of state.daily?.quests ?? []) {
    if (!known(data.quests, quest.template)) problems.push(`quest ${quest.id}`);
  }
  try {
    restoreCosmetics(cosmeticCatalog(data), state.cosmetics);
  } catch {
    problems.push('cosmetics');
  }
  for (const [id, beatState] of Object.entries(state.story.beats)) {
    const beat = findBeat(data, id);
    if (!beat) {
      problems.push(`beat ${id}`);
      continue;
    }
    try {
      restoreNarrative(beat.graph as NarrativeGraph, beatState);
    } catch {
      problems.push(`beat state ${id}`);
    }
  }
  if (state.run && !known(data.levels, state.run.level)) problems.push(`run ${state.run.level}`);
  const round = state.round;
  if (round && round.skills.some((skill) => !known(data.skills, skill)))
    problems.push('round skills');
  if (round?.type === 'minigame') {
    try {
      restoreMinigame(round.definition as MinigameDefinition, round.state, MINIGAMES);
    } catch {
      problems.push('round board');
    }
  }
  if (round?.type === 'problems' && round.placement !== null) {
    if (round.placement.step > data.placement.steps.length) problems.push('placement step');
    for (const level of round.placement.placed)
      if (!known(data.levels, level)) problems.push(`placed ${level}`);
  }
  for (const job of read.jobs) {
    const payload = job.payload as { round?: unknown };
    if (job.rule !== 'reask' || state.round?.id !== payload.round) problems.push(`job ${job.id}`);
  }
  return problems.length === 0
    ? success(undefined)
    : failure(
        'incompatible-state',
        `State refers to unknown or inconsistent records: ${problems.slice(0, 5).join(', ')}.`,
      );
}

export const dragonValleyAdapter: RuntimeAdapter<ProfileState, GameAction, GameView, ContentData> =
  {
    id: ADAPTER_ID,
    stateVersion: STATE_VERSION,
    state: profileStateSchema,
    action: gameActionSchema,
    content: contentRegistration,
    randomStreams: RANDOM_STREAMS,
    eventPhases: EVENT_PHASES,
    initialize: ({ content }) =>
      initialProfileState({ dailyGoal: content.data.balance.daily.goalAnswers, arena: true }),
    resolve(action, read) {
      const problem = legality(action, read);
      if (problem) return problem;
      return success({ rule: action.type, payload: action, turns: ACTION_TURNS[action.type] });
    },
    commands: [
      command('startSession', {
        start: (ctx, action) => action.type === 'startSession' && startSession(ctx, action.day),
      }),
      command('startLevel', {
        start(ctx, action) {
          if (action.type !== 'startLevel') return;
          const index = indexOf(ctx);
          if (ctx.state.round) closeRound(ctx);
          // Playing a level instead of the placement check skips it (parents can re-run it).
          if (ctx.state.onboarding.placement === 'pending') {
            ctx.state.onboarding.placement = 'skipped';
          }
          ctx.state.run = { level: action.level, next: 0, results: [] };
          triggerBeats(
            ctx,
            (trigger) => trigger.kind === 'level-start' && trigger.level === action.level,
          );
          startRunActivity(ctx, index, 0);
        },
      }),
      command('startActivity', {
        start(ctx, action) {
          if (action.type !== 'startActivity') return;
          const index = indexOf(ctx);
          const request = action.activity;
          if (request.kind === 'level') {
            // Keep the run, even a finished one: a replayed activity belongs to it.
            ctx.state.round = null;
            startRunActivity(ctx, index, request.index);
            return;
          }
          if (ctx.state.round) closeRound(ctx);
          if (request.kind === 'placement') startPlacement(ctx, index);
          else if (request.kind === 'snack') startSnack(ctx, index, request.dragon);
          else startArena(ctx, index);
        },
      }),
      command('answer', {
        start: (ctx, action) =>
          action.type === 'answer' && gradeAnswer(ctx, action.value, action.elapsedMs),
        finish: afterAnswer,
      }),
      command('placementAnswer', {
        start: (ctx, action) =>
          action.type === 'placementAnswer' && gradeAnswer(ctx, action.value, action.elapsedMs),
        finish: afterAnswer,
      }),
      command('minigameMove', {
        start(ctx, action) {
          if (action.type !== 'minigameMove') return;
          const index = indexOf(ctx);
          const finished = applyMinigameMove(ctx, index, action.revision, action.move as JsonValue);
          if (finished) completeRound(ctx, index, 'finished');
          applyGrowth(ctx, index);
          awardStickers(ctx);
        },
      }),
      command('hint', {
        start(ctx) {
          const current = activeProblemRound(ctx)?.current;
          if (!current) return;
          current.hinted = true;
          ctx.emit(EVENTS.hintShown, { item: current.item });
        },
      }),
      command('endRound', {
        start(ctx, action) {
          if (action.type !== 'endRound') return;
          if (action.reason === 'done') closeRound(ctx);
          else completeRound(ctx, indexOf(ctx), action.reason);
          if (action.reason === 'quit') closeRound(ctx);
        },
      }),
      command('buy', {
        start(ctx, action) {
          if (action.type !== 'buy') return;
          const item = ctx.content.data.cosmetics.find((c) => c.id === action.item)!;
          ctx.state.coins -= item.price;
          grantItem(ctx, item.id, `buy:${item.id}`);
          ctx.emit(EVENTS.itemPurchased, { item: item.id, price: item.price });
          awardStickers(ctx);
        },
      }),
      command('equip', {
        start(ctx, action) {
          if (action.type !== 'equip') return;
          ctx.state.dragons[action.dragon]!.outfit[action.slot] = action.item;
          ctx.emit(EVENTS.dragonDressed, {
            dragon: action.dragon,
            slot: action.slot,
            item: action.item,
          });
        },
      }),
      command('claimQuest', {
        start(ctx, action) {
          if (action.type !== 'claimQuest') return;
          claimQuest(ctx, action.quest);
          awardStickers(ctx);
        },
      }),
      command('openGift', {
        start(ctx) {
          openGift(ctx);
          awardStickers(ctx);
        },
      }),
      command('storyChoice', {
        start(ctx, action) {
          if (action.type !== 'storyChoice') return;
          chooseInBeat(ctx, action.beat, action.node, action.revision, action.choice);
          awardStickers(ctx);
        },
      }),
      command('setSetting', {
        start(ctx, action) {
          if (action.type !== 'setSetting') return;
          const { setting } = action;
          if (setting.key === 'dailyGoal') {
            ctx.state.settings.dailyGoal = setting.value;
            if (ctx.state.daily) ctx.state.daily.goal = setting.value;
            checkDailyGoal(ctx);
          } else if (setting.key === 'arena') ctx.state.settings.arena = setting.value;
          else ctx.state.settings.unlockAhead = [...setting.value];
        },
      }),
    ],
    jobs: JOB_RULES.map((id) => ({
      id,
      payload: reaskPayload,
      run(ctx: Ctx, job) {
        const { round, item } = requireValue(reaskPayload.parse(job.payload));
        const active = activeProblemRound(ctx);
        if (active && active.id === round && !active.queue.includes(item)) active.queue.push(item);
      },
    })),
    view: (read) => projectView(read, skillItemIndex(read.content.data)),
    validate: validateState,
    canActivateContent: (read) => read.state.round === null && read.state.story.pending === null,
    activateContent() {
      // Content IDs are append-only (docs/contract.md), so v1 progress carries forward unchanged;
      // a revision that retires IDs must migrate the state here.
    },
  };

/** Create a host for one profile. */
export function createGameHost(
  content: ContentPack<ContentData>,
  seed: string,
  checkpoint?: CheckpointWriter,
): RuntimeHost<ProfileState, GameAction, GameView, ContentData> {
  return createRuntimeHost({ adapter: dragonValleyAdapter, content, seed, checkpoint });
}
