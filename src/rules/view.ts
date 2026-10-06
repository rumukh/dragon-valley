/**
 * The view projection: everything the shell renders, computed from state and content on every
 * commit. Pure and deterministic; no text, only catalog keys and structured problems.
 */
import { projectMinigame } from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import {
  DRAGON_STAGES,
  MASTERY_LEVELS,
  TABLE_MAX,
  allDivFactIds,
  allMulFactIds,
  isMinigameKind,
  isoDay,
  parseItemId,
  weekday,
} from './contract';
import type {
  AlbumView,
  DailyView,
  DragonExpression,
  DragonView,
  GameView,
  HubView,
  MarketView,
  MasteryLevel,
  NextStep,
  ParentView,
  ProblemView,
  RoundView,
  RunView,
  Screen,
  WindowCell,
  WindowView,
} from './contract';
import { atLeast, isDue, masteryLevel } from './learning/items';
import { MINIGAMES, boardView } from './minigames/boards';
import { arenaProblem } from './progression/arena';
import { dragonFacts, dueItems, hungryDragons, itemsOf, shareAt } from './progression/dragons';
import {
  isComplete,
  levelStatus,
  levelsInMapOrder,
  nextLevel,
  percentOf,
  regionOpen,
} from './progression/levels';
import { canPlay } from './progression/rounds';
import { availableCosmetics } from './economy/rewards';
import { storyView } from './story/beats';
import type { Data, Read, ReadState } from './types';

function screenOf(state: ReadState): Screen {
  if (state.story.pending !== null) return 'story';
  if (state.round?.status === 'active') return 'round';
  if (state.round?.status === 'complete') return 'results';
  return 'hub';
}

/**
 * The Daily Adventure's next step (docs/design.md §4.2): a pending story beat, the placement
 * check while it is pending, snack time for hungry dragons at the start of the day, the next
 * glowing level until one is done today, then once a minigame replay if the day had none, the gift
 * once the goal is reached, more levels, else free play.
 */
function nextStep(
  state: ReadState,
  data: Data,
  hungry: readonly string[],
  index: ReadonlyMap<string, readonly string[]>,
): NextStep {
  if (state.story.pending !== null) return { kind: 'story', beat: state.story.pending };
  if (state.onboarding.placement === 'pending' && data.placement.steps.length > 0) {
    return { kind: 'placement' };
  }
  const daily = state.daily !== null && state.daily.day === state.day ? state.daily : null;
  if (hungry.length > 0 && daily !== null && daily.answers === 0) {
    return { kind: 'snack', dragon: null };
  }
  const levelsToday = daily?.levels ?? 0;
  const level = nextLevel(state, data);
  if (level !== null && levelsToday === 0) return { kind: 'level', level };
  if (daily !== null && levelsToday > 0 && (daily.minigames ?? 0) === 0) {
    const replay = minigameReplay(state, data, index);
    if (replay !== null) return { kind: 'minigame', ...replay };
  }
  if (daily?.gift === 'ready') return { kind: 'gift' };
  if (level !== null) return { kind: 'level', level };
  return { kind: 'free-play' };
}

/** A minigame activity of the furthest completed level, to replay for variety. */
function minigameReplay(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): { level: string; activity: number } | null {
  const completed = levelsInMapOrder(data).filter((level) => isComplete(state, level.id));
  for (const level of completed.reverse()) {
    const activity = level.activities.findIndex(
      (a, i) => isMinigameKind(a.kind) && canPlay(data, level, i, index),
    );
    if (activity !== -1) return { level: level.id, activity };
  }
  return null;
}

function hubView(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): HubView {
  const glowing = nextLevel(state, data);
  const hungry = hungryDragons(state, data, index);
  return {
    regions: [...data.regions]
      .sort((a, b) => a.order - b.order)
      .map((region) => {
        const boss =
          region.boss === null ? undefined : data.bosses.find((b) => b.id === region.boss);
        return {
          id: region.id,
          titleKey: region.titleKey,
          order: region.order,
          background: region.background,
          unlocked: regionOpen(state, data, region.id),
          boss: boss
            ? {
                id: boss.id,
                nameKey: boss.nameKey,
                mood: boss.mood,
                defeated: state.bosses[boss.id] !== undefined,
                heads: boss.heads ?? 1,
              }
            : null,
          levels: data.levels
            .filter((level) => level.region === region.id)
            .sort((a, b) => a.order - b.order)
            .map((level) => ({
              id: level.id,
              titleKey: level.titleKey,
              order: level.order,
              kind: level.kind,
              status: levelStatus(state, data, level),
              stars: state.levels[level.id]?.stars ?? 0,
              placed: state.levels[level.id]?.placed ?? false,
              glowing: level.id === glowing,
            })),
        };
      }),
    next: nextStep(state, data, hungry, index),
    hungry,
    arena: {
      available: arenaProblem(state, data, index) === null,
      best: state.arena.best,
    },
  };
}

function runView(state: ReadState, data: Data): RunView | null {
  const run = state.run;
  const level = run === null ? undefined : data.levels.find((l) => l.id === run.level);
  if (!run || !level) return null;
  const done = run.next >= level.activities.length;
  const progress = state.levels[level.id];
  return {
    level: run.level,
    next: run.next,
    activities: level.activities.map((activity, index) => ({
      index,
      kind: activity.kind,
      done: run.results.some((r) => r.activity === index && r.completed),
    })),
    result:
      done && progress
        ? {
            stars: progress.stars,
            accuracy: progress.bestAccuracy,
            firstTime: progress.plays === 1,
          }
        : null,
  };
}

function roundDragon(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
  item: string | null,
): string | null {
  const owned = data.dragons.filter((d) => state.dragons[d.id] !== undefined);
  if (owned.length === 0) return null;
  const feeding =
    item === null ? undefined : owned.find((d) => itemsOf(d.skills, index).includes(item));
  return (feeding ?? owned[0]!).id;
}

function roundView(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): RoundView | null {
  const round = state.round;
  if (round === null) return null;
  if (round.type === 'minigame') {
    const projected = projectMinigame(
      round.definition as MinigameDefinition,
      round.state as MinigameState,
      MINIGAMES,
    );
    return {
      id: round.id,
      type: 'minigame',
      activity: round.activity,
      source: round.source,
      status: round.status,
      endReason: round.endReason,
      board: round.completed,
      boards: round.boards,
      minigame: {
        definition: round.definition.id,
        status: projected.status,
        revision: projected.revision,
        view: projected.view,
      },
      current: boardView(round.definition, round.state, projected.view),
      coins: round.coins,
    };
  }
  const item = round.current?.item ?? round.feedback?.item ?? null;
  const dragon = roundDragon(state, data, index, item);
  const sleepy = state.daily !== null && state.daily.correct >= state.daily.goal;
  const expression: DragonExpression =
    round.feedback === null
      ? sleepy
        ? 'sleepy'
        : 'idle'
      : round.feedback.correct
        ? round.streak > 0 && round.streak % data.balance.coins.streakEvery === 0
          ? 'proud'
          : 'eating'
        : 'curious';
  return {
    id: round.id,
    type: 'problems',
    activity: round.activity,
    source: round.source,
    input: round.input,
    status: round.status,
    endReason: round.endReason,
    progress: {
      answered: round.answered,
      target: round.target,
      correct: round.correct,
      streak: round.streak,
      meter: round.meter,
    },
    // Read state is deep-readonly; the runtime clones the returned view, so sharing is safe.
    problem: round.current as ProblemView | null,
    feedback: round.feedback,
    coins: round.coins,
    dragon: dragon === null ? null : { id: dragon, expression },
    placement:
      round.placement === null
        ? null
        : {
            step: Math.min(round.placement.step, data.placement.steps.length),
            steps: data.placement.steps.length,
            placed: [...round.placement.placed],
          },
  };
}

function dragonViews(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): DragonView[] {
  const sleepy = state.daily !== null && state.daily.correct >= state.daily.goal;
  return data.dragons
    .filter((dragon) => state.dragons[dragon.id] !== undefined)
    .map((dragon) => {
      const owned = state.dragons[dragon.id]!;
      const items = itemsOf(dragon.skills, index);
      const due = dueItems(state, dragonFacts(dragon, index));
      const stageIndex = DRAGON_STAGES.indexOf(owned.stage);
      const rule = data.balance.growth[stageIndex];
      const hungry = owned.stage !== 'egg' && due >= data.balance.hungry.minDue;
      return {
        id: dragon.id,
        nameKey: dragon.nameKey,
        kind: dragon.kind,
        table: dragon.table,
        rig: dragon.rig,
        stage: owned.stage,
        expression:
          owned.stage === 'egg' ? 'idle' : sleepy ? 'sleepy' : hungry ? 'curious' : 'happy',
        mastery: {
          seen: shareAt(state, data, items, 'seen'),
          bronze: shareAt(state, data, items, 'bronze'),
          silver: shareAt(state, data, items, 'silver'),
          gold: shareAt(state, data, items, 'gold'),
          items: items.length,
        },
        hungry,
        dueItems: due,
        outfit: { ...owned.outfit },
        next: rule
          ? {
              stage: rule.stage,
              share: rule.share,
              mastery: rule.mastery,
              have: items.filter((item) => atLeast(state.items[item], rule.mastery, data.balance))
                .length,
              // The share rounded up: shareAt rounds down, so this many reach `share` percent.
              need:
                (rule.share * items.length + 99 - ((rule.share * items.length + 99) % 100)) / 100,
            }
          : null,
      };
    });
}

function cell(state: ReadState, data: Data, item: string, row: number, column: number): WindowCell {
  const record = state.items[item];
  const level = masteryLevel(record, data.balance);
  return {
    item,
    row,
    column,
    level,
    needsPolish: level !== 'dim' && isDue(record, state.day ?? 0),
  };
}

/** The window's panes are fixed: computed once, not on every commit. */
const MUL_PANES = allMulFactIds().map((item) => {
  const parsed = parseItemId(item);
  return {
    item,
    row: parsed?.kind === 'mul' ? parsed.a : 0,
    column: parsed?.kind === 'mul' ? parsed.b : 0,
  };
});
const DIV_PANES = allDivFactIds().map((item) => {
  const parsed = parseItemId(item);
  return {
    item,
    row: parsed?.kind === 'div' ? parsed.divisor : 0,
    column: parsed?.kind === 'div' ? parsed.quotient : 0,
  };
});
/** Every multiplication fact of each times table 0..10, in either factor. */
const TABLE_FACTS = Array.from({ length: TABLE_MAX + 1 }, (_, table) =>
  MUL_PANES.filter((pane) => pane.row === table || pane.column === table).map((pane) => pane.item),
);

function windowView(state: ReadState, data: Data): WindowView {
  const cells = MUL_PANES.map((pane) => cell(state, data, pane.item, pane.row, pane.column));
  const division = DIV_PANES.map((pane) => cell(state, data, pane.item, pane.row, pane.column));
  const counts = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<
    MasteryLevel,
    number
  >;
  for (const c of cells) counts[c.level] += 1;
  return { size: 11, cells, division, counts };
}

function marketView(state: ReadState, data: Data): MarketView {
  const available = availableCosmetics(state, data);
  return {
    items: data.cosmetics.map((c) => ({
      id: c.id,
      slot: c.slot,
      assetId: c.assetId,
      nameKey: c.nameKey,
      price: c.price,
      owned: state.cosmetics.owned.includes(c.id),
      affordable: state.coins >= c.price,
      available: available.includes(c.id),
    })),
  };
}

function albumView(state: ReadState, data: Data): AlbumView {
  const pages = [...data.regions]
    .sort((a, b) => a.order - b.order)
    .map((region) => ({
      region: region.id,
      stickers: data.stickers
        .filter((s) => s.page === region.id)
        .map((s) => ({
          id: s.id,
          nameKey: s.nameKey,
          icon: s.icon,
          color: s.color,
          frame: s.frame,
          earned: state.stickers[s.id] !== undefined,
          day: state.stickers[s.id] ? isoDay(state.stickers[s.id]!.day) : null,
        })),
    }));
  return { pages, earned: Object.keys(state.stickers).length, total: data.stickers.length };
}

function dailyView(state: ReadState, data: Data): DailyView | null {
  const daily = state.daily;
  if (daily === null) return null;
  const monday = daily.day - weekday(daily.day);
  const practiced = new Set(state.history.map((record) => record.day));
  return {
    day: isoDay(daily.day),
    goal: daily.goal,
    correct: daily.correct,
    answers: daily.answers,
    reached: daily.correct >= daily.goal,
    quests: daily.quests.map((quest) => {
      const template = data.quests.find((q) => q.id === quest.template);
      return {
        id: quest.id,
        template: quest.template,
        titleKey: template?.titleKey ?? quest.template,
        goal: template?.goal ?? 'correct-answers',
        target: template?.target ?? 1,
        progress: quest.progress,
        done: quest.progress >= (template?.target ?? 1),
        claimed: quest.claimed,
        coins: template?.coins ?? 0,
      };
    }),
    gift: daily.gift,
    week: Array.from({ length: 7 }, (_, offset) => practiced.has(monday + offset)),
    sleepy: daily.correct >= daily.goal,
  };
}

function accuracyOf(
  state: ReadState,
  items: readonly string[],
): { accuracy: number; fastShare: number } {
  let seen = 0;
  let correct = 0;
  let fast = 0;
  let recent = 0;
  for (const item of items) {
    const record = state.items[item];
    if (!record) continue;
    seen += record.seen;
    correct += record.correct;
    fast += record.recent.filter((b) => b === 'fast').length;
    recent += record.recent.length;
  }
  return { accuracy: percentOf(correct, seen), fastShare: percentOf(fast, recent) };
}

function parentView(
  state: ReadState,
  data: Data,
  index: ReadonlyMap<string, readonly string[]>,
): ParentView {
  const tables = TABLE_FACTS.map((items, table) => {
    const { accuracy, fastShare } = accuracyOf(state, items);
    const mastered = items.filter((item) =>
      atLeast(state.items[item], 'silver', data.balance),
    ).length;
    return { table, accuracy, fastShare, mastered, items: items.length };
  });
  const skills = data.skills.map((skill) => {
    const items = index.get(skill.id) ?? [];
    return {
      skill: skill.id,
      titleKey: skill.titleKey,
      accuracy: accuracyOf(state, items).accuracy,
      mastered: items.filter((item) => atLeast(state.items[item], 'silver', data.balance)).length,
      items: items.length,
    };
  });
  const hardest = Object.entries(state.items)
    .filter(([, record]) => record.seen > 0)
    .map(([item, record]) => ({
      item,
      accuracy: percentOf(record.correct, record.seen),
      box: record.box,
    }))
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        a.box - b.box ||
        (a.item < b.item ? -1 : a.item > b.item ? 1 : 0),
    )
    .slice(0, 10);
  return {
    tables,
    skills,
    hardest,
    trend: state.history.slice(-60).map((record) => ({
      day: isoDay(record.day),
      answers: record.answers,
      correct: record.correct,
      fast: record.fast,
    })),
    daysPracticed: state.daysPracticed,
    answers: Object.values(state.items).reduce((sum, record) => sum + record.seen, 0),
  };
}

export function projectView(read: Read, index: ReadonlyMap<string, readonly string[]>): GameView {
  const state = read.state;
  const data = read.content.data;
  return {
    revision: read.revision,
    turn: read.turn,
    day: state.day === null ? null : isoDay(state.day),
    screen: screenOf(state),
    coins: state.coins,
    settings: {
      dailyGoal: state.settings.dailyGoal,
      arena: state.settings.arena,
      unlockAhead: [...state.settings.unlockAhead],
    },
    onboarding: { ...state.onboarding },
    story: storyView(state, data),
    hub: hubView(state, data, index),
    run: runView(state, data),
    round: roundView(state, data, index),
    dragons: dragonViews(state, data, index),
    window: windowView(state, data),
    market: marketView(state, data),
    album: albumView(state, data),
    daily: dailyView(state, data),
    parent: parentView(state, data, index),
  };
}
