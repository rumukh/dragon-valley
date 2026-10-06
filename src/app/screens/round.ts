/**
 * The warm-up round: a rehearsal of Feeding Time on the preview rules. One problem at a time
 * in the child's notation, choice tiles or the keypad (with the remainder mode), the read-aloud
 * button, kind feedback (green check "Yes!" or orange "?" "Almost! Let's look…" with a picture
 * model), coins flying to the purse, and stars and confetti at the end.
 *
 * Feedback follows live commit events (`answer.correct`, `answer.incorrect`,
 * `round.completed`), never a redraw of the same state, and every answer goes through the
 * command controller (stale-view guard, strict save). Escape or Pause pauses the game.
 */
import { CommandRejectedError } from '../controller/commands';
import { formatSolved, problemTokens } from '../math/notation';
import type { Notation } from '../math/notation';
import type { Problem } from '../../rules/contract';
import type { PreviewAnswer, PreviewRoundView } from '../preview/adapter';
import { speakProblem } from '../speech/verbalizer';
import { candyButton } from '../ui/button';
import { artIcon, dragonArt } from '../ui/art';
import { confetti } from '../ui/confetti';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { createKeypad } from '../ui/keypad';
import type { KeypadView } from '../ui/keypad';
import { createCoinCounter, createMeter, createStars } from '../ui/meters';
import { arrayModel, groupsModel } from '../ui/models';
import { prefersReducedMotion } from '../ui/motion';
import { createTiles } from '../ui/tiles';
import type { TilesView } from '../ui/tiles';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { HUB_EGG } from './hub';

export function problemElement(problem: Problem, notation: Notation, spoken: string): HTMLElement {
  const line = h('p', {
    className: 'dv-problem',
    testId: 'problem',
    attributes: { 'aria-label': spoken },
  });
  const tokens = problemTokens(problem, notation);
  // Each side of "=" stays on one line; a long problem wraps only at the equals sign.
  let part = h('span', { className: 'dv-problem__part' });
  const parts = [part];
  let length = 0;
  for (const token of tokens) {
    if (token.kind === 'sign' && token.text === '=') {
      part = h('span', { className: 'dv-problem__part' });
      parts.push(part);
    }
    length += token.kind === 'blank' ? 2 : token.text.length + 1;
    const highlighted = token.kind === 'number' && token.highlight === true;
    part.append(
      token.kind === 'blank'
        ? h('span', { className: 'dv-problem__blank', text: '?' })
        : h('span', {
            className: highlighted
              ? 'dv-problem__number dv-problem__number--asked'
              : `dv-problem__${token.kind}`,
            text: token.text,
          }),
    );
  }
  line.dataset['size'] = length > 14 ? 's' : length > 10 ? 'm' : 'l';
  line.append(...parts);
  return line;
}

export function roundScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `round:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const host = active.game.host;
      if (!host.getView().round) await active.commands.capture()({ type: 'startRound' });
      const preferences = (): ReturnType<typeof active.preferences.current> =>
        active.preferences.current();

      const saveStatus = createSaveStatus(app, active);
      const coins = createCoinCounter(app.kit, host.getView().coins);
      const first = host.getView().round!;
      const progress = createMeter({
        label: t('round.heading'),
        max: first.total,
        value: first.index,
        valueText: (value, max) =>
          t('round.progress', { current: Math.min(value + 1, max), total: max }),
        testId: 'round-progress',
      });
      const egg = h('div', { className: 'dv-round__egg dv-reactor', testId: 'round-egg' });
      const problemSlot = h('div', { className: 'dv-round__problem' });
      const speakerSlot = h('div', { className: 'dv-round__speaker' });
      const prompt = h('p', { className: 'dv-round__prompt', testId: 'round-prompt' });
      const answerSlot = h('div', { className: 'dv-round__answer' });
      const feedback = h('div', {
        className: 'dv-feedback',
        testId: 'feedback',
        dataset: { kind: 'none' },
        attributes: { role: 'status' },
      });
      const modelSlot = h('div', { className: 'dv-round__model' });
      const play = h(
        'section',
        { className: 'dv-round__play' },
        h(
          'div',
          { className: 'dv-round__left' },
          egg,
          h('div', { className: 'dv-card dv-problem-card' }, problemSlot, speakerSlot),
          feedback,
          modelSlot,
        ),
        h('div', { className: 'dv-round__right' }, prompt, answerSlot),
      );
      const results = h('section', { className: 'dv-results', testId: 'round-results' });
      results.hidden = true;

      let tiles: TilesView | undefined;
      let keypad: KeypadView | undefined;
      let dispatch = active.commands.capture();
      let shownAt = performance.now();
      let current: PreviewRoundView = first;
      let advanceTimer: ReturnType<typeof setTimeout> | undefined;
      let chosenTile: string | undefined;

      const paintEgg = (warmth: number, max: number): void => {
        egg.replaceChildren(
          dragonArt({
            dragon: HUB_EGG,
            stage: 'egg',
            warmth: max ? warmth / max : 0,
            framing: 'fit',
          }),
        );
      };
      const react = (mood: 'happy' | 'curious'): void => {
        egg.dataset['react'] = 'none';
        requestAnimationFrame(() => {
          egg.dataset['react'] = mood;
        });
      };
      const setFeedback = (kind: 'none' | 'correct' | 'miss' | 'info', text = ''): void => {
        feedback.dataset['kind'] = kind;
        const badge =
          kind === 'correct'
            ? artIcon('badge-correct')
            : kind === 'miss'
              ? artIcon('badge-almost')
              : null;
        feedback.replaceChildren(...(badge ? [badge] : []), h('span', { text }));
      };
      const releaseInput = (): void => {
        tiles?.dispose();
        keypad?.dispose();
        tiles = undefined;
        keypad = undefined;
      };

      const speakerButton = (problem: Problem): HTMLElement | null => {
        const prefs = preferences();
        if (!prefs.readAloud || !app.speech.available()) return null;
        return candyButton({
          label: t('speech.read'),
          icon: 'speaker',
          iconOnly: true,
          variant: 'paper',
          testId: 'read-aloud',
          onPress: () => {
            app.speak(speakProblem(problem));
          },
          onError: app.kit.onError,
        });
      };

      const submit = async (value: PreviewAnswer): Promise<void> => {
        const elapsedMs = Math.min(3_600_000, Math.max(0, Math.round(performance.now() - shownAt)));
        try {
          await dispatch({ type: 'answer', value, elapsedMs });
        } catch (error) {
          if (error instanceof CommandRejectedError && error.error.code === 'checkpoint-blocked') {
            setFeedback('info', t('round.saveBlocked'));
            dispatch = active.commands.capture();
            tiles?.setDisabled(false);
            keypad?.setDisabled(false);
            return;
          }
          throw error;
        }
      };

      const showProblem = (round: PreviewRoundView): void => {
        current = round;
        releaseInput();
        chosenTile = undefined;
        const notation = preferences().notation;
        const spoken = speakProblem(round.problem);
        problemSlot.replaceChildren(problemElement(round.problem, notation, spoken));
        speakerSlot.replaceChildren(
          ...[speakerButton(round.problem)].filter((node) => node !== null),
        );
        modelSlot.replaceChildren();
        progress.update(round.index);
        if (round.input === 'choice') {
          prompt.textContent = t('round.choose');
          tiles = createTiles(app.kit, {
            label: t('round.choices'),
            digitSelect: true,
            choices: round.choices.map((value) => ({ id: String(value), label: String(value) })),
            onChoose: async (choice) => {
              chosenTile = choice.id;
              tiles?.setDisabled(true);
              await submit({ kind: 'number', value: Number(choice.label) });
            },
          });
          answerSlot.replaceChildren(tiles.element);
        } else {
          prompt.textContent = t(
            round.answerKind === 'remainder' ? 'round.typeRemainder' : 'round.type',
          );
          keypad = createKeypad(app.kit, {
            mode: round.answerKind,
            maxDigits: 3,
            remainderSymbol: notation === 'czech' ? 'r' : 'R',
            onSubmit: async (answer) => {
              keypad?.setDisabled(true);
              await submit(
                answer.kind === 'number'
                  ? { kind: 'number', value: answer.value }
                  : { kind: 'remainder', quotient: answer.quotient, remainder: answer.remainder },
              );
            },
          });
          answerSlot.replaceChildren(keypad.element);
        }
        dispatch = active.commands.capture();
        shownAt = performance.now();
        if (preferences().autoRead) app.speak(spoken);
      };

      const showResults = (round: PreviewRoundView): void => {
        releaseInput();
        play.hidden = true;
        results.hidden = false;
        progress.update(round.total);
        const stars = createStars(round.stars, t('round.stars', { count: round.stars }));
        const finish = candyButton({
          label: t('round.finish'),
          icon: 'home',
          variant: 'sun',
          size: 'big',
          testId: 'round-finish',
          onPress: async () => {
            await active.commands.capture()({ type: 'endRound' });
            await app.router.back();
          },
          onError: app.kit.onError,
        });
        const heading = h('h2', { text: t('round.done') });
        const view = host.getView();
        const trophy = h(
          'div',
          { className: 'dv-results__egg dv-reactor', dataset: { react: 'happy' } },
          dragonArt({
            dragon: HUB_EGG,
            stage: 'egg',
            warmth: view.maxWarmth ? view.warmth / view.maxWarmth : 0,
            framing: 'fit',
          }),
        );
        results.replaceChildren(
          trophy,
          heading,
          stars.element,
          h('p', {
            className: 'dv-results__coins',
            text: t('round.coins', { count: round.coinsEarned }),
          }),
          finish,
        );
        heading.tabIndex = -1;
        heading.focus();
        app.kit.announcer.announce(
          `${t('round.done')} ${t('round.stars', { count: round.stars })}`,
        );
        app.audio.setMusic('results');
        void stars.reveal();
        void confetti(app.kit.fx);
      };

      const onCorrect = (round: PreviewRoundView): void => {
        const solved = round.solved;
        const fact = solved
          ? formatSolved(solved.problem, solved.answer, preferences().notation)
          : '';
        setFeedback('correct', t('round.correct', { fact }));
        if (chosenTile) tiles?.setState(chosenTile, 'correct');
        modelSlot.replaceChildren();
        react('happy');
        const source = answerSlot.querySelector('[data-state="correct"]') ?? problemSlot;
        void coins.gain(round.coinsEarned - current.coinsEarned, source);
        clearTimeout(advanceTimer);
        advanceTimer = setTimeout(
          () => {
            setFeedback('none');
            if (round.finished) showResults(round);
            else showProblem(round);
          },
          prefersReducedMotion() ? 500 : 1100,
        );
        paintEgg(host.getView().warmth, host.getView().maxWarmth);
      };

      const onMiss = (round: PreviewRoundView): void => {
        current = round;
        setFeedback('miss', t('round.miss'));
        if (chosenTile) {
          tiles?.setState(chosenTile, 'miss');
          tiles?.block(chosenTile);
        }
        react('curious');
        const model = round.model;
        if (model?.kind === 'array') {
          modelSlot.replaceChildren(
            arrayModel(
              model.rows,
              model.columns,
              t('round.modelArray', { rows: model.rows, columns: model.columns }),
            ),
          );
        } else if (model?.kind === 'groups') {
          modelSlot.replaceChildren(
            groupsModel(model.total, model.size, t('round.modelGroups', { size: model.size })),
          );
        }
        dispatch = active.commands.capture();
        shownAt = performance.now();
        tiles?.setDisabled(false);
        keypad?.reset();
        keypad?.setDisabled(false);
      };

      const unsubscribeCommits = host.subscribeCommits((commit) => {
        const round = commit.view.round;
        if (!round) return;
        const types = commit.events.map((event) => event.type);
        if (types.includes('answer.correct')) onCorrect(round);
        else if (types.includes('answer.incorrect')) onMiss(round);
      });
      const unsubscribeRestore = host.subscribe((view, reason) => {
        if (reason !== 'restore' || !view.round) return;
        clearTimeout(advanceTimer);
        setFeedback('none');
        if (view.round.finished) showResults(view.round);
        else showProblem(view.round);
      });
      const unsubscribeVoices = app.speech.subscribe(() => {
        speakerSlot.replaceChildren(
          ...[speakerButton(current.problem)].filter((node) => node !== null),
        );
      });

      let pausedDialog = false;
      const pause = async (): Promise<void> => {
        if (pausedDialog) return;
        pausedDialog = true;
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
        pausedDialog = false;
        app.audio.resume();
        await active.commands.resume('user');
        if (choice === 'quit') await app.router.back();
      };

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
        { className: 'dv-round', testId: 'screen-round' },
        topBar({
          title: h(
            'div',
            { className: 'dv-round__title' },
            h('h1', { className: 'dv-visually-hidden', text: t('round.heading') }),
            progress.element,
          ),
          tools: [pauseButton, coins.element, saveStatus.element],
          onError: app.kit.onError,
        }),
        play,
        results,
      );
      paintEgg(host.getView().warmth, host.getView().maxWarmth);
      if (first.finished) showResults(first);
      else showProblem(first);

      return {
        element,
        title: t('round.heading'),
        field: 'valley',
        region: 'sunny-meadow',
        music: 'round',
        focusTarget: () => answerSlot.querySelector<HTMLElement>('button') ?? null,
        onEscape() {
          void pause().catch(app.kit.onError);
          return true;
        },
        dispose() {
          clearTimeout(advanceTimer);
          releaseInput();
          unsubscribeCommits();
          unsubscribeRestore();
          unsubscribeVoices();
          saveStatus.dispose();
        },
      };
    },
  };
}
