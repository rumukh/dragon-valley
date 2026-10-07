/**
 * Problem rounds: Feeding Time (the core), the Boss Challenge, snack time and the placement
 * check, all on the rules' `ProblemRoundView`.
 *
 * One problem at a time in the child's notation, answered with choice tiles or the keypad (with
 * remainder mode), as the view resolves. A right answer throws a fruit into the dragon's mouth
 * (an egg glows warmer instead); on a boss level a sparkle tickles the boss and its mood meter
 * fills, and the Seven-Headed Dragon is won over head by head. A miss is never punished: orange
 * "?", "Almost! Let's look…", the right fact and its picture, and the child goes on when ready. A
 * re-asked fact shows its picture first; a hint shows it on request. Response time excludes
 * pauses. Every answer goes through the command controller (stale-view guard, strict save);
 * Escape or Pause pauses the game.
 */
import { FINALE_DRAGON_ID } from '../../rules/contract';
import type {
  AnswerValue,
  Feedback,
  GameView,
  Problem,
  ProblemRoundView,
  ProblemView,
} from '../../rules/contract';
import { getDragonAnchors } from '../art/dragon';
import { CommandRejectedError, taken } from '../controller/commands';
import { createResponseTimer } from '../game/timer';
import { answerKindOf, bossPose, curedHeads, featuredDragon, stepChoices } from '../game/view';
import type { BossPose } from '../game/view';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { modelFor } from '../math/model';
import { formatSolved } from '../math/notation';
import { speakProblem, speakSolved } from '../speech/verbalizer';
import { artIcon, bossArt, outfitOf, sevenHeadedArt, viewDragonArt } from '../ui/art';
import { candyButton } from '../ui/button';
import { confetti } from '../ui/confetti';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { centerOf, flyAlongArc, svgPointToPage } from '../ui/fly';
import type { PagePoint } from '../ui/fly';
import { icon } from '../ui/icons';
import { createKeypad } from '../ui/keypad';
import type { KeypadView } from '../ui/keypad';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { MeterView } from '../ui/meters';
import { arrayModel, groupsModel } from '../ui/models';
import { animate, EASE_OUT, prefersReducedMotion, wait } from '../ui/motion';
import { createTiles } from '../ui/tiles';
import type { TilesView } from '../ui/tiles';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import {
  answerId,
  answerLabel,
  answerSpoken,
  problemElement,
  revealComparison,
} from './problem-view';
import { backdrop } from './scene';
import { speakerButton } from './speech';

const FRUITS = ['apple', 'pear', 'plum', 'cherries', 'berries'] as const;
/** The Lightning Arena is a one-minute race (docs/design.md §5.11); the shell keeps the time. */
export const ARENA_SECONDS = 60;
const ARENA_MISS_MS = 1500;
const CORRECT_PAUSE_MS = 1100;
/** How long a right sign stays marked before the story asks for the number. */
const OPERATION_PAUSE_MS = 900;

function problemRound(view: GameView): ProblemRoundView | null {
  return view.round?.type === 'problems' ? view.round : null;
}

export function problemRoundScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const text = app.text;
  const host = active.game.host;
  const keeperId = active.keeper.id;
  const data = active.game.content().data;
  const first = problemRound(active.game.view())!;
  const activity = first.activity;
  const placement = activity === 'placement';
  const levelId = first.source.kind === 'level' ? first.source.level : null;
  const level = levelId ? data.levels.find((candidate) => candidate.id === levelId) : undefined;
  const region = level
    ? data.regions.find((candidate) => candidate.id === level.region)
    : undefined;
  const boss =
    activity === 'boss' && level?.boss
      ? data.bosses.find((candidate) => candidate.id === level.boss)
      : undefined;
  const heads = boss?.heads ?? 1;
  // The Seven-Headed Dragon is drawn head by head; other bosses show their pose.
  const byHead = boss?.id === FINALE_DRAGON_ID && heads > 1;
  const notation = (): ReturnType<typeof active.preferences.current>['notation'] =>
    active.preferences.current().notation;

  // ---- chrome -------------------------------------------------------------------------------
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.view().coins);
  const heading = h('h1', {
    className: 'dv-round__title',
    text: t(`activity.${activity}` as MessageKey),
  });
  const arena = activity === 'arena';
  let progress: MeterView;
  if (arena) {
    progress = createMeter({
      label: t('arena.time'),
      max: ARENA_SECONDS,
      value: ARENA_SECONDS,
      valueText: (value) => plural(t, value, 'arena.seconds.one', 'arena.seconds.other'),
      testId: 'arena-time',
    });
  } else if (first.placement) {
    progress = createMeter({
      label: t('activity.placement'),
      max: first.placement.steps,
      value: first.placement.step,
      valueText: (value, max) =>
        t('placement.step', { current: Math.min(value + 1, max), total: max }),
      testId: 'placement-progress',
      compact: true,
    });
  } else if (boss && first.progress.meter) {
    progress = createMeter({
      label: t(`boss.meter.${boss.mood}` as MessageKey),
      max: first.progress.meter.target,
      value: first.progress.meter.value,
      valueText: (value, max) => t('boss.meterValue', { value, max }),
      testId: 'boss-meter',
    });
  } else {
    const target = first.progress.target ?? 0;
    progress = createMeter({
      label: t(`activity.${activity}` as MessageKey),
      max: target,
      value: first.progress.answered,
      valueText: (value, max) =>
        t('round.progress', { current: Math.min(value + 1, max), total: max }),
      testId: 'round-progress',
      compact: true,
    });
  }
  const streak = h('p', { className: 'dv-round__streak', testId: 'streak' });

  // ---- stage ----------------------------------------------------------------------------------
  const dragonSlot = h('div', {
    className: 'dv-round__dragon',
    testId: 'round-dragon',
    attributes: { role: 'img' },
  });
  const bossSlot = h('div', {
    className: 'dv-round__boss',
    testId: 'round-boss',
    attributes: { role: 'img' },
  });
  const headsLine = byHead ? h('p', { className: 'dv-heads', testId: 'boss-heads' }) : null;
  const story = h('p', { className: 'dv-round__story', testId: 'round-story' });
  // A story is a scroll that unrolls (Riddle Scrolls), with the speaker on it.
  const scroll = h('div', { className: 'dv-scroll', testId: 'round-scroll' }, story);
  const problemSlot = h('div', { className: 'dv-round__problem' });
  const speakerSlot = h('div', { className: 'dv-round__speaker' });
  const tools = h('div', { className: 'dv-problem-card__tools' });
  const note = h('p', { className: 'dv-round__note', testId: 'round-note' });
  const modelSlot = h('div', { className: 'dv-round__model' });
  const hintSlot = h('div', { className: 'dv-round__hint' });
  const prompt = h('p', { className: 'dv-round__prompt', testId: 'round-prompt' });
  const answerSlot = h('div', { className: 'dv-round__answer' });
  const feedback = h('div', {
    className: 'dv-feedback',
    testId: 'feedback',
    dataset: { kind: 'none' },
    attributes: { role: 'status' },
  });

  tools.append(speakerSlot, hintSlot);

  let tiles: TilesView | undefined;
  let keypad: KeypadView | undefined;
  let shown: ProblemView | null = null;
  let chosenTile: string | undefined;
  let send = active.commands.captureSend();
  let busy = false;
  let pausedByDialog = false;
  let disposed = false;
  let pose: BossPose = bossPose(first.progress.meter, false);
  let cured = byHead ? curedHeads(first.progress.meter, heads) : 0;
  const timer = createResponseTimer();
  // The Arena's one-minute race, paused like everything else.
  const race = createResponseTimer();
  let raceTimer: ReturnType<typeof setInterval> | undefined;
  let timeUp = false;
  let raceEnded = false;
  // The grown-ups' time limit ends a round gently, between problems.
  let restTime = false;

  const releaseInput = (): void => {
    tiles?.dispose();
    keypad?.dispose();
    tiles = undefined;
    keypad = undefined;
  };
  const setInputDisabled = (disabled: boolean): void => {
    tiles?.setDisabled(disabled);
    keypad?.setDisabled(disabled);
  };

  const currentDragon = (view: GameView) => {
    const round = problemRound(view);
    const id = round?.dragon?.id;
    return view.dragons.find((dragon) => dragon.id === id) ?? featuredDragon(view);
  };

  const paintDragon = (view: GameView): SVGSVGElement | null => {
    const dragon = currentDragon(view);
    if (!dragon) {
      dragonSlot.replaceChildren();
      return null;
    }
    const expression = problemRound(view)?.dragon?.expression ?? dragon.expression;
    const art = viewDragonArt(dragon, {
      expression,
      framing: dragon.stage === 'egg' ? 'fit' : 'stage',
    });
    dragonSlot.replaceChildren(art);
    dragonSlot.dataset['dragon'] = dragon.id;
    dragonSlot.dataset['stage'] = dragon.stage;
    dragonSlot.dataset['expression'] = expression;
    dragonSlot.setAttribute(
      'aria-label',
      t(`expression.${expression}` as MessageKey, { name: text(dragon.nameKey) }),
    );
    return art;
  };

  const paintBoss = (): void => {
    if (!boss) return;
    const name = text(boss.nameKey);
    bossSlot.dataset['pose'] = pose;
    if (!byHead) {
      bossSlot.replaceChildren(bossArt(boss.id, pose));
      bossSlot.setAttribute('aria-label', t(`boss.pose.${pose}` as MessageKey, { name }));
      return;
    }
    bossSlot.replaceChildren(sevenHeadedArt(cured, { className: 'dv-boss-art' }));
    bossSlot.dataset['cured'] = String(cured);
    bossSlot.setAttribute(
      'aria-label',
      cured >= heads
        ? t('boss.pose.won', { name })
        : t('boss.headsLabel', { name, count: cured, total: heads }),
    );
    headsLine?.replaceChildren(
      h(
        'span',
        { className: 'dv-heads__pips', attributes: { 'aria-hidden': 'true' } },
        ...Array.from({ length: heads }, (_, index) =>
          h('span', { className: 'dv-heads__pip', dataset: { cured: String(index < cured) } }),
        ),
      ),
      h('span', { text: t('boss.heads', { count: cured, total: heads }) }),
    );
  };

  /** Heads just cured give a little hop and a shower of confetti. */
  const celebrateHeads = (from: number, to: number): void => {
    const art = bossSlot.querySelector('svg');
    for (let head = from + 1; head <= to; head++) {
      const group = art?.querySelector(`.dv-seven-head[data-head="${head}"]`);
      if (group) {
        animate(
          group,
          [{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
          { duration: 700, easing: EASE_OUT },
        );
      }
    }
    if (art) void confetti(app.kit.fx, { pieces: 18, origin: centerOf(art) });
  };

  /** Where a thrown fruit lands: the dragon's mouth, or the middle of an egg. */
  const mouthPoint = (view: GameView): PagePoint | undefined => {
    const art = dragonSlot.querySelector('svg');
    const dragon = currentDragon(view);
    if (!art || !dragon) return undefined;
    if (dragon.stage === 'egg') return centerOf(art);
    const anchors = getDragonAnchors({
      dragon: dragon.rig,
      stage: dragon.stage,
      framing: 'stage',
      outfit: outfitOf(dragon.outfit),
    });
    return svgPointToPage(art as SVGSVGElement, anchors.mouth.x, anchors.mouth.y) ?? centerOf(art);
  };

  const showModel = (problem: Problem): void => {
    const model = modelFor(problem);
    if (!model) {
      modelSlot.replaceChildren();
      return;
    }
    modelSlot.replaceChildren(
      model.kind === 'array'
        ? arrayModel(
            model.rows,
            model.columns,
            t('model.array', { rows: model.rows, columns: model.columns }),
          )
        : groupsModel(model.total, model.size, t('model.groups', { size: model.size })),
    );
  };

  const setFeedback = (kind: 'none' | 'correct' | 'miss' | 'info', ...children: Node[]): void => {
    feedback.dataset['kind'] = kind;
    const badge =
      kind === 'correct'
        ? artIcon('badge-correct')
        : kind === 'miss'
          ? artIcon('badge-almost')
          : null;
    feedback.replaceChildren(...(badge ? [badge] : []), ...children);
  };

  const storyText = (problem: Problem): string => {
    if (problem.kind !== 'word') return '';
    const values: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(problem.vars)) {
      values[name] = typeof value === 'number' ? value : text(value);
    }
    return text(problem.template, values);
  };

  const spokenProblem = (problem: ProblemView): string => {
    const words = storyText(problem.problem);
    const question = speakProblem(problem.problem, problem.step);
    return words ? `${words} ${question}` : question;
  };

  const hintButton = (problem: ProblemView): HTMLElement[] => {
    if (problem.hinted || problem.reask || !modelFor(problem.problem)) return [];
    return [
      candyButton({
        label: t('round.hint'),
        icon: 'hint',
        variant: 'paper',
        size: 'small',
        keepsFocus: true,
        testId: 'round-hint',
        onPress: async () => {
          await taken(active.commands.captureSend()({ type: 'hint' }));
          hintSlot.replaceChildren();
          showModel(problem.problem);
          app.kit.announcer.announce(t('round.hintShown'));
          // The button is gone: the answer keeps the keyboard.
          answerFocus()?.focus();
        },
        onError: app.kit.onError,
      }),
    ];
  };

  /** An answer the game took but could not save yet: its feedback waits for Retry. */
  let held: { asked: ProblemView; before: GameView; source: Element } | null = null;

  const submit = async (value: AnswerValue, source: Element): Promise<void> => {
    if (busy || !shown) return;
    busy = true;
    setInputDisabled(true);
    const asked = shown;
    const before = active.game.view();
    try {
      // Feedback comes as soon as the answer is saved, or once it is taken if saving is slow.
      await send(
        placement
          ? { type: 'placementAnswer', value, elapsedMs: timer.elapsed() }
          : { type: 'answer', value, elapsedMs: timer.elapsed() },
      );
    } catch (error) {
      busy = false;
      send = active.commands.captureSend();
      setInputDisabled(false);
      if (error instanceof CommandRejectedError && error.accepted) {
        // Taken but not saved: no praise for what is not stored. The save says "Not saved"
        // and offers Retry; once it is saved, this answer gets its feedback.
        held = { asked, before, source };
        return;
      }
      if (error instanceof CommandRejectedError && error.error.code === 'checkpoint-blocked') {
        setFeedback('info', h('span', { text: t('round.saveBlocked') }));
        return;
      }
      throw error;
    }
    await showOutcome(asked, before, source);
  };

  /** The feedback of an answer the game has taken: praise or a kind look at the right fact. */
  const showOutcome = async (
    asked: ProblemView,
    before: GameView,
    source: Element,
  ): Promise<void> => {
    busy = true;
    setInputDisabled(true);
    const after = active.game.view();
    const round = problemRound(after);
    const result = round?.feedback;
    if (!round || !result || result.index !== asked.index) {
      // The game moved on without feedback for this problem (it ended); show what is next.
      busy = false;
      await advance();
      return;
    }
    if (result.correct) await onCorrect(asked, result, before, after, source);
    else onMiss(asked, result, after);
  };

  // Retry stored a held answer: now it gets its feedback.
  const unsubscribeSaved = active.game.subscribeIndicator((indicator) => {
    if (indicator.kind !== 'saved' || !held || disposed) return;
    const { asked, before, source } = held;
    held = null;
    void showOutcome(asked, before, source).catch(app.kit.onError);
  });

  const onCorrect = async (
    asked: ProblemView,
    result: Feedback,
    before: GameView,
    after: GameView,
    source: Element,
  ): Promise<void> => {
    if (asked.step === 'operation') {
      // The right sign is a step on the way, not an answer: no fruit yet, just a happy chirp.
      setFeedback(
        'correct',
        h('span', {
          text: t('round.operationRight', { operation: answerSpoken(result.expected, t) }),
        }),
      );
      if (chosenTile) tiles?.setState(chosenTile, 'correct');
      app.kit.cue('fx.dragon-happy');
      await wait(prefersReducedMotion() ? 500 : OPERATION_PAUSE_MS);
      if (disposed) return;
      busy = false;
      await advance();
      return;
    }
    const fact = t('round.correct', {
      fact: formatSolved(asked.problem, result.given, notation()),
    });
    const round = problemRound(after)!;
    const nowCured = byHead ? curedHeads(round.progress.meter, heads) : cured;
    setFeedback(
      'correct',
      h('span', { text: fact }),
      ...(nowCured > cured
        ? [
            h('span', {
              className: 'dv-feedback__extra',
              testId: 'feedback-head',
              text: t('boss.headCured'),
            }),
          ]
        : []),
    );
    hintSlot.replaceChildren();
    revealStones(asked.problem, result.given);
    if (chosenTile) tiles?.setState(chosenTile, 'correct');
    updateProgress(round);
    const gained = after.coins - before.coins;
    const from = centerOf(source);
    const flights: Promise<void>[] = [];
    if (boss) {
      const target = bossSlot.querySelector('svg');
      if (target) {
        flights.push(
          flyAlongArc(
            app.kit.fx,
            icon('sparkle', 'dv-icon dv-flyer__sparkle'),
            from,
            centerOf(target),
          ),
        );
      }
    } else {
      const target = mouthPoint(before);
      if (target) {
        const fruit = artIcon(FRUITS[(asked.index - 1) % FRUITS.length]!);
        flights.push(flyAlongArc(app.kit.fx, fruit, from, target));
      }
    }
    void coins.gain(gained, source);
    await Promise.all(flights);
    if (disposed) return;
    if (boss) {
      const next = bossPose(round.progress.meter, round.status === 'complete');
      const before = cured;
      app.kit.cue(nowCured > before ? 'fx.dragon-happy' : 'fx.boss-laugh');
      if (next !== pose || nowCured !== before) {
        pose = next;
        cured = nowCured;
        paintBoss();
        if (cured > before) celebrateHeads(before, cured);
      }
    } else if (currentDragon(after)?.stage !== 'egg') {
      app.kit.cue('fx.dragon-eating');
    }
    paintDragon(after);
    await wait(prefersReducedMotion() ? 500 : CORRECT_PAUSE_MS - 650);
    if (disposed) return;
    busy = false;
    await advance();
  };

  /** A comparison shows its stones' values and the right sign once answered. */
  const revealStones = (problem: Problem, answer: AnswerValue): void => {
    const line = problemSlot.querySelector<HTMLElement>('.dv-stones');
    if (problem.kind === 'compare' && line) revealComparison(line, problem, answer, notation());
  };

  const onMiss = (asked: ProblemView, result: Feedback, after: GameView): void => {
    const round = problemRound(after)!;
    updateProgress(round);
    hintSlot.replaceChildren();
    revealStones(asked.problem, result.expected);
    if (chosenTile) {
      tiles?.setState(chosenTile, 'miss');
      tiles?.block(chosenTile);
    }
    const expectedTile = answerId(result.expected);
    tiles?.setState(expectedTile, 'correct');
    paintDragon(after);
    const solved =
      asked.step === 'operation'
        ? t('round.operationIs', { operation: answerSpoken(result.expected, t) })
        : formatSolved(asked.problem, result.expected, notation());
    const next = candyButton({
      label: t('round.gotIt'),
      icon: 'forward',
      variant: 'sun',
      testId: 'feedback-next',
      onPress: async () => {
        busy = false;
        await advance();
      },
      onError: app.kit.onError,
    });
    setFeedback(
      'miss',
      h('span', { className: 'dv-feedback__lead', text: t('round.miss') }),
      h('span', { className: 'dv-feedback__fact', testId: 'feedback-fact', text: solved }),
      next,
    );
    if (asked.step === 'operation') {
      // Show the story's sum with its sign in place, and its picture.
      problemSlot.replaceChildren(
        problemElement(asked.problem, notation(), speakProblem(asked.problem, 'answer'), 'answer'),
      );
    }
    showModel(asked.problem);
    if (arena) {
      next.hidden = true;
      setTimeout(() => {
        if (disposed) return;
        busy = false;
        void advance().catch(app.kit.onError);
      }, ARENA_MISS_MS);
      return;
    }
    if (active.preferences.current().autoRead) {
      app.speak(
        asked.step === 'operation'
          ? `${t('round.miss')} ${solved}`
          : `${t('round.miss')} ${speakSolved(asked.problem, result.expected)}`,
      );
    }
    next.focus();
  };

  const updateProgress = (round: ProblemRoundView): void => {
    if (arena) {
      // The race clock updates itself.
    } else if (round.placement) progress.update(round.placement.step);
    else if (boss && round.progress.meter) progress.update(round.progress.meter.value);
    else progress.update(round.progress.answered);
    streak.textContent =
      round.progress.streak >= 3 ? t('round.streak', { count: round.progress.streak }) : '';
  };

  const showProblem = (problem: ProblemView): void => {
    shown = problem;
    releaseInput();
    chosenTile = undefined;
    setFeedback('none');
    const words = storyText(problem.problem);
    const newStory = words !== '' && words !== story.textContent;
    story.textContent = words;
    story.hidden = words === '';
    scroll.hidden = words === '';
    if (words === '') tools.prepend(speakerSlot);
    else scroll.append(speakerSlot);
    if (newStory) {
      animate(
        scroll,
        [
          { transform: 'scaleY(0.2)', opacity: 0 },
          { transform: 'scaleY(1)', opacity: 1 },
        ],
        { duration: 450, easing: EASE_OUT },
      );
    }
    const spoken = spokenProblem(problem);
    problemSlot.replaceChildren(problemElement(problem.problem, notation(), spoken, problem.step));
    speakerSlot.replaceChildren(...speakerButton(app, active, () => spokenProblem(problem)));
    note.textContent = problem.reask ? t('round.reask') : '';
    if (problem.reask || problem.hinted) showModel(problem.problem);
    else modelSlot.replaceChildren();
    hintSlot.replaceChildren(...hintButton(problem));

    const kind = answerKindOf(problem.problem, problem.step);
    const choices = stepChoices(problem);
    if (choices) {
      prompt.textContent = t(kind === 'operation' ? 'round.chooseOperation' : 'round.choose');
      tiles = createTiles(app.kit, {
        label: t('round.choices'),
        digitSelect: kind === 'number',
        signs: kind === 'operation' || kind === 'relation',
        choices: choices.map((answer) => ({
          id: answerId(answer),
          label: answerLabel(answer, notation(), t),
          ariaLabel: answerSpoken(answer, t),
        })),
        onChoose: async (choice) => {
          const answer = choices.find((candidate) => answerId(candidate) === choice.id);
          if (!answer) return;
          chosenTile = choice.id;
          const tile =
            answerSlot.querySelector(`[data-testid="choice-${choice.id}"]`) ?? answerSlot;
          await submit(answer, tile);
        },
      });
      answerSlot.replaceChildren(tiles.element);
    } else {
      prompt.textContent = t(kind === 'remainder' ? 'round.typeRemainder' : 'round.type');
      keypad = createKeypad(app.kit, {
        mode: kind === 'remainder' ? 'remainder' : 'number',
        maxDigits: 6,
        remainderSymbol: notation() === 'czech' ? 'r' : 'R',
        onSubmit: async (answer) => {
          const ok = answerSlot.querySelector('[data-testid="keypad-ok"]') ?? answerSlot;
          await submit(
            answer.kind === 'number'
              ? { kind: 'number', value: answer.value }
              : { kind: 'remainder', quotient: answer.quotient, remainder: answer.remainder },
            ok,
          );
        },
      });
      answerSlot.replaceChildren(keypad.element);
    }
    send = active.commands.captureSend();
    timer.start();
    if (pausedByDialog || document.visibilityState === 'hidden') timer.pause();
  };

  /** The race is over: end the round on time (once), then show the results. */
  const endRace = async (): Promise<void> => {
    if (raceEnded) return;
    raceEnded = true;
    clearInterval(raceTimer);
    releaseInput();
    const round = problemRound(active.game.view());
    if (round?.status === 'active') {
      await active.commands.capture()({ type: 'endRound', reason: 'time-up' });
    }
    await app.continueGame(keeperId);
  };

  const tickRace = (): void => {
    const left = Math.max(0, ARENA_SECONDS - Math.floor(race.elapsed() / 1000));
    progress.update(left);
    if (left > 0 || timeUp) return;
    timeUp = true;
    if (!busy) void endRace().catch(app.kit.onError);
  };

  /**
   * Where focus goes for an answer: the first choice tile, or the keypad itself (not one of its
   * keys, so Enter on the keyboard submits instead of pressing the focused key).
   */
  const answerFocus = (): HTMLElement | null => {
    if (keypad) {
      keypad.element.tabIndex = -1;
      return keypad.element;
    }
    return tiles?.element.querySelector<HTMLElement>('button:not(:disabled)') ?? null;
  };

  const endForRest = async (): Promise<void> => {
    clearInterval(restTimer);
    releaseInput();
    if (problemRound(active.game.view())?.status === 'active') {
      await active.commands.capture()({ type: 'endRound', reason: 'time-limit' });
    }
    await app.continueGame(keeperId);
  };
  const checkRest = (): void => {
    if (restTime || arena || !active.timeIsUp()) return;
    restTime = true;
    if (!busy) void endForRest().catch(app.kit.onError);
  };
  const restTimer = setInterval(checkRest, 5000);

  /** Show the next problem, or leave for the results when the round is over. */
  const advance = async (): Promise<void> => {
    if (timeUp) {
      await endRace();
      return;
    }
    checkRest();
    if (restTime) {
      await endForRest();
      return;
    }
    const view = active.game.view();
    const round = problemRound(view);
    if (view.screen !== 'round' || !round || round.status !== 'active' || !round.problem) {
      await app.continueGame(keeperId);
      return;
    }
    showProblem(round.problem);
    if (active.preferences.current().autoRead) app.speak(spokenProblem(round.problem));
    answerFocus()?.focus();
  };

  // ---- pause ----------------------------------------------------------------------------------
  const pause = async (): Promise<void> => {
    if (pausedByDialog) return;
    pausedByDialog = true;
    timer.pause();
    race.pause();
    host.pause('user');
    app.audio.pause();
    app.stopSpeaking();
    const choice = await openModal<'resume' | 'quit'>(app.kit, {
      label: t('pause.heading'),
      testId: 'pause-dialog',
      dismissValue: 'resume',
      build(body, close) {
        body.append(
          h('p', { text: t('pause.body') }),
          h(
            'div',
            { className: 'dv-dialog__actions' },
            candyButton({
              label: t('pause.quit'),
              variant: 'paper',
              testId: 'pause-quit',
              onPress: () => close('quit'),
              onError: app.kit.onError,
            }),
            candyButton({
              label: t('pause.resume'),
              icon: 'play',
              variant: 'sun',
              testId: 'pause-resume',
              onPress: () => close('resume'),
              onError: app.kit.onError,
            }),
          ),
        );
      },
    }).result;
    pausedByDialog = false;
    app.audio.resume();
    await active.commands.resume('user');
    if (document.visibilityState !== 'hidden') {
      timer.resume();
      race.resume();
    }
    if (choice === 'quit') {
      await active.commands.capture()({ type: 'endRound', reason: 'quit' });
      await app.continueGame(keeperId);
    }
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      timer.pause();
      race.pause();
    } else if (!pausedByDialog) {
      timer.resume();
      race.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribeVoices = app.speech.subscribe(() => {
    if (shown)
      speakerSlot.replaceChildren(...speakerButton(app, active, () => spokenProblem(shown!)));
  });

  // ---- first paint ----------------------------------------------------------------------------
  paintDragon(active.game.view());
  paintBoss();
  updateProgress(first);
  if (first.problem) showProblem(first.problem);
  if (arena) {
    race.start();
    raceTimer = setInterval(tickRace, 250);
  }

  const pauseButton = candyButton({
    label: t('round.pause'),
    icon: 'pause',
    iconOnly: true,
    variant: 'paper',
    size: 'small',
    testId: 'round-pause',
    onPress: pause,
    onError: app.kit.onError,
  });

  const element = h(
    'main',
    {
      className: `dv-round${boss ? ' dv-round--boss' : ''}`,
      testId: 'screen-round',
      dataset: { activity, placement: String(placement) },
    },
    backdrop(region?.background ?? 'sunny-meadow'),
    topBar({
      title: h('div', { className: 'dv-round__header' }, heading, progress.element),
      tools: [streak, coins.element, saveStatus.element, pauseButton],
      onError: app.kit.onError,
    }),
    h(
      'section',
      { className: 'dv-round__play' },
      // The picture behind a problem stands with the dragon, so the problem, its feedback and
      // the answers keep their places on one screen.
      h(
        'div',
        { className: 'dv-round__cast' },
        dragonSlot,
        ...(boss
          ? [
              h(
                'div',
                { className: 'dv-round__boss-figure' },
                bossSlot,
                ...(headsLine ? [headsLine] : []),
              ),
            ]
          : []),
        modelSlot,
      ),
      h(
        'div',
        { className: 'dv-round__board' },
        h('div', { className: 'dv-card dv-problem-card' }, scroll, problemSlot, note, tools),
        feedback,
      ),
      h('div', { className: 'dv-round__input' }, prompt, answerSlot),
    ),
  );

  return {
    element,
    title: t(`activity.${activity}` as MessageKey),
    field: 'valley',
    region: region?.id ?? null,
    music: boss ? 'boss' : 'round',
    focusTarget: () => answerFocus() ?? heading,
    onEscape() {
      void pause().catch(app.kit.onError);
      return true;
    },
    mounted() {
      if (shown && active.preferences.current().autoRead) app.speak(spokenProblem(shown));
    },
    dispose() {
      disposed = true;
      clearInterval(raceTimer);
      clearInterval(restTimer);
      releaseInput();
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribeVoices();
      unsubscribeSaved();
      saveStatus.dispose();
    },
  };
}
