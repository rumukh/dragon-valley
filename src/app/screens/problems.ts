/**
 * Problem rounds: Feeding Time (the core), the Boss Challenge, snack time and the placement
 * check, all on the rules' `ProblemRoundView`.
 *
 * One problem at a time in the child's notation, answered with choice tiles or the keypad (with
 * remainder mode), as the view resolves. A right answer throws a fruit into the dragon's mouth
 * (an egg glows warmer instead); on a boss level a sparkle tickles the boss and its mood meter
 * fills. A miss is never punished: orange "?", "Almost! Let's look…", the right fact and its
 * picture, and the child goes on when ready. A re-asked fact shows its picture first; a hint
 * shows it on request. Response time excludes pauses. Every answer goes through the command
 * controller (stale-view guard, strict save); Escape or Pause pauses the game.
 */
import type {
  AnswerValue,
  Feedback,
  GameView,
  Problem,
  ProblemRoundView,
  ProblemView,
} from '../../rules/contract';
import { getDragonAnchors } from '../art/dragon';
import { CommandRejectedError } from '../controller/commands';
import { createResponseTimer } from '../game/timer';
import { answerKindOf, bossPose, featuredDragon } from '../game/view';
import type { BossPose } from '../game/view';
import type { MessageKey } from '../i18n/messages';
import { modelFor } from '../math/model';
import { formatSolved } from '../math/notation';
import { speakProblem, speakSolved } from '../speech/verbalizer';
import { artIcon, bossArt, outfitOf, viewDragonArt } from '../ui/art';
import { candyButton } from '../ui/button';
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
import { prefersReducedMotion, wait } from '../ui/motion';
import { createTiles } from '../ui/tiles';
import type { TilesView } from '../ui/tiles';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { answerId, answerLabel, answerSpoken, problemElement } from './problem-view';
import { backdrop } from './scene';
import { speakerButton } from './speech';

const FRUITS = ['apple', 'pear', 'plum', 'cherries', 'berries'] as const;
const CORRECT_PAUSE_MS = 1100;

function problemRound(view: GameView): ProblemRoundView | null {
  return view.round?.type === 'problems' ? view.round : null;
}

export function problemRoundScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const text = app.text;
  const host = active.game.host;
  const keeperId = active.keeper.id;
  const data = app.game.content.data;
  const first = problemRound(host.getView())!;
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
  const notation = (): ReturnType<typeof active.preferences.current>['notation'] =>
    active.preferences.current().notation;

  // ---- chrome -------------------------------------------------------------------------------
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, host.getView().coins);
  const heading = h('h1', {
    className: 'dv-round__title',
    text: t(`activity.${activity}` as MessageKey),
  });
  let progress: MeterView;
  if (boss && first.progress.meter) {
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
  const story = h('p', { className: 'dv-round__story', testId: 'round-story' });
  const problemSlot = h('div', { className: 'dv-round__problem' });
  const speakerSlot = h('div', { className: 'dv-round__speaker' });
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

  let tiles: TilesView | undefined;
  let keypad: KeypadView | undefined;
  let shown: ProblemView | null = null;
  let chosenTile: string | undefined;
  let dispatch = active.commands.capture();
  let busy = false;
  let pausedByDialog = false;
  let disposed = false;
  let pose: BossPose = bossPose(first.progress.meter, false);
  const timer = createResponseTimer();

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
    bossSlot.replaceChildren(bossArt(boss.id, pose));
    bossSlot.dataset['pose'] = pose;
    bossSlot.setAttribute(
      'aria-label',
      t(`boss.pose.${pose}` as MessageKey, { name: text(boss.nameKey) }),
    );
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
    return words ? `${words} ${speakProblem(problem.problem)}` : speakProblem(problem.problem);
  };

  const hintButton = (problem: ProblemView): HTMLElement[] => {
    if (problem.hinted || problem.reask || !modelFor(problem.problem)) return [];
    return [
      candyButton({
        label: t('round.hint'),
        icon: 'hint',
        variant: 'paper',
        size: 'small',
        testId: 'round-hint',
        onPress: async () => {
          await active.commands.capture()({ type: 'hint' });
          hintSlot.replaceChildren();
          showModel(problem.problem);
          app.kit.announcer.announce(t('round.hintShown'));
        },
        onError: app.kit.onError,
      }),
    ];
  };

  const submit = async (value: AnswerValue, source: Element): Promise<void> => {
    if (busy || !shown) return;
    busy = true;
    setInputDisabled(true);
    const asked = shown;
    const before = host.getView();
    try {
      await dispatch(
        placement
          ? { type: 'placementAnswer', value, elapsedMs: timer.elapsed() }
          : { type: 'answer', value, elapsedMs: timer.elapsed() },
      );
    } catch (error) {
      busy = false;
      dispatch = active.commands.capture();
      setInputDisabled(false);
      if (error instanceof CommandRejectedError && error.error.code === 'checkpoint-blocked') {
        setFeedback('info', h('span', { text: t('round.saveBlocked') }));
        return;
      }
      throw error;
    }
    const after = host.getView();
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

  const onCorrect = async (
    asked: ProblemView,
    result: Feedback,
    before: GameView,
    after: GameView,
    source: Element,
  ): Promise<void> => {
    const fact =
      asked.step === 'operation'
        ? t('round.operationRight', { operation: answerSpoken(result.expected, t) })
        : t('round.correct', { fact: formatSolved(asked.problem, result.given, notation()) });
    setFeedback('correct', h('span', { text: fact }));
    hintSlot.replaceChildren();
    if (chosenTile) tiles?.setState(chosenTile, 'correct');
    const round = problemRound(after)!;
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
      app.kit.cue('fx.boss-laugh');
      if (next !== pose) {
        pose = next;
        paintBoss();
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

  const onMiss = (asked: ProblemView, result: Feedback, after: GameView): void => {
    const round = problemRound(after)!;
    updateProgress(round);
    hintSlot.replaceChildren();
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
    if (asked.step !== 'operation') showModel(asked.problem);
    if (active.preferences.current().autoRead && asked.step !== 'operation') {
      app.speak(`${t('round.miss')} ${speakSolved(asked.problem, result.expected)}`);
    }
    next.focus();
  };

  const updateProgress = (round: ProblemRoundView): void => {
    if (boss && round.progress.meter) progress.update(round.progress.meter.value);
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
    story.textContent = words;
    story.hidden = words === '';
    const spoken = spokenProblem(problem);
    problemSlot.replaceChildren(problemElement(problem.problem, notation(), spoken));
    speakerSlot.replaceChildren(...speakerButton(app, active, () => spokenProblem(problem)));
    note.textContent = problem.reask ? t('round.reask') : '';
    if (problem.reask || problem.hinted) showModel(problem.problem);
    else modelSlot.replaceChildren();
    hintSlot.replaceChildren(...hintButton(problem));

    const kind = answerKindOf(problem.problem, problem.step);
    if (problem.input === 'choice' && problem.choices) {
      prompt.textContent = t(kind === 'operation' ? 'round.chooseOperation' : 'round.choose');
      const choices = problem.choices;
      tiles = createTiles(app.kit, {
        label: t('round.choices'),
        digitSelect: kind === 'number',
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
    dispatch = active.commands.capture();
    timer.start();
    if (pausedByDialog || document.visibilityState === 'hidden') timer.pause();
  };

  /** Show the next problem, or leave for the results when the round is over. */
  const advance = async (): Promise<void> => {
    const view = host.getView();
    const round = problemRound(view);
    if (view.screen !== 'round' || !round || round.status !== 'active' || !round.problem) {
      await app.continueGame(keeperId);
      return;
    }
    showProblem(round.problem);
    if (active.preferences.current().autoRead) app.speak(spokenProblem(round.problem));
    (tiles ?? keypad)?.element.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  };

  // ---- pause ----------------------------------------------------------------------------------
  const pause = async (): Promise<void> => {
    if (pausedByDialog) return;
    pausedByDialog = true;
    timer.pause();
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
    if (document.visibilityState !== 'hidden') timer.resume();
    if (choice === 'quit') {
      await active.commands.capture()({ type: 'endRound', reason: 'quit' });
      await app.continueGame(keeperId);
    }
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') timer.pause();
    else if (!pausedByDialog) timer.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribeVoices = app.speech.subscribe(() => {
    if (shown)
      speakerSlot.replaceChildren(...speakerButton(app, active, () => spokenProblem(shown!)));
  });

  // ---- first paint ----------------------------------------------------------------------------
  paintDragon(host.getView());
  paintBoss();
  updateProgress(first);
  if (first.problem) showProblem(first.problem);

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
      h('div', { className: 'dv-round__cast' }, dragonSlot, ...(boss ? [bossSlot] : [])),
      h(
        'div',
        { className: 'dv-round__board' },
        h(
          'div',
          { className: 'dv-card dv-problem-card' },
          story,
          h('div', { className: 'dv-problem-card__line' }, problemSlot, speakerSlot),
          note,
          hintSlot,
        ),
        feedback,
        modelSlot,
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
    focusTarget: () => answerSlot.querySelector<HTMLElement>('button:not(:disabled)') ?? heading,
    onEscape() {
      void pause().catch(app.kit.onError);
      return true;
    },
    mounted() {
      if (shown && active.preferences.current().autoRead) app.speak(spokenProblem(shown));
    },
    dispose() {
      disposed = true;
      releaseInput();
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribeVoices();
      saveStatus.dispose();
    },
  };
}
