/**
 * A story beat: a scene, old Glimmer (or the boss) and one short line at a time, read aloud on
 * request or automatically, with big buttons to go on. The first-egg beat offers its choices as
 * three eggs. Skippable beats can be skipped whole. The last line of a beat ends the beat in the
 * rules, so it arrives as an event; the screen shows it before moving on.
 *
 * The finale shows the Seven-Headed Dragon with every head cured; from the beat's second line
 * the Magic Window is whole again in the castle hall's niche, and the last line ends in confetti.
 */
import { FINALE_DRAGON_ID } from '../../rules/contract';
import type { DragonExpression, GameEvent } from '../../rules/contract';
import { taken } from '../controller/commands';
import { candyButton } from '../ui/button';
import { bossArt, dragonArt, SEVEN_HEADS, sevenHeadedArt, wholeWindowArt } from '../ui/art';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import {
  backdrop,
  beatFigure,
  hallBackdrop,
  lineExpression,
  nodeText,
  sceneBackground,
} from './scene';
import { speakerButton } from './speech';

/** The finale's backdrop: the castle hall with the Magic Window whole in its niche. */
function wholeWindowHall(reveal: boolean): HTMLElement {
  const window = wholeWindowArt('dv-hall__window');
  // The art's own root class would size it like the collection's window card.
  window.classList.remove('dv-window');
  window.setAttribute('data-testid', 'hall-window');
  if (reveal) window.dataset['reveal'] = 'true';
  return hallBackdrop(window);
}

type StoryAdvanced = Extract<GameEvent, { type: 'story.advanced' }>;

export function storyScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const text = app.text;
  const data = active.game.content().data;
  const view = active.game.view();
  const story = view.story!;
  const beat = data.story.beats.find((candidate) => candidate.id === story.beat);
  const figure = beatFigure(data, beat);
  const nodeIndex = beat?.graph.nodes.findIndex((node) => node.id === story.node) ?? -1;
  const scene = sceneBackground(story.scene);
  // The finale's first line belongs to the cured dragon; the window is whole from the second.
  const wholeWindow = figure.kind === 'finale' && scene === 'castle-hall' && nodeIndex >= 1;
  const dragons = new Map(data.dragons.map((dragon) => [dragon.id, dragon]));
  const eggChoices = story.choices.length > 1 && story.choices.every((c) => dragons.has(c.id));

  const line = h('p', { className: 'dv-story__line', testId: 'story-line' });
  const speaker = h('div', { className: 'dv-story__speaker' });
  const actions = h('div', { className: 'dv-story__actions' });
  const portrait = h('div', {
    className: 'dv-story__figure',
    attributes: { 'aria-hidden': 'true' },
  });
  const glimmer = (expression: DragonExpression): SVGSVGElement =>
    dragonArt({ dragon: 'glimmer', stage: 'adult', expression, framing: 'fit' });
  portrait.append(
    figure.kind === 'boss'
      ? bossArt(figure.id, figure.pose)
      : figure.kind === 'finale'
        ? sevenHeadedArt(SEVEN_HEADS)
        : glimmer(lineExpression(story.text, story.finished)),
  );
  portrait.dataset['figure'] =
    figure.kind === 'boss' ? figure.id : figure.kind === 'finale' ? FINALE_DRAGON_ID : 'glimmer';
  portrait.dataset['expression'] =
    figure.kind === 'boss'
      ? figure.pose
      : figure.kind === 'finale'
        ? 'happy'
        : lineExpression(story.text, story.finished);

  let spoken = '';
  const say = (key: string): void => {
    spoken = text(key);
    line.textContent = spoken;
    speaker.replaceChildren(...speakerButton(app, active, () => spoken));
  };
  const autoRead = (): void => {
    if (active.preferences.current().autoRead) app.speak(spoken);
  };

  // The next line follows the committed view at once; the save goes on behind it.
  const send = active.commands.captureSend();
  let busy = false;
  const choose = async (choice: string | null): Promise<void> => {
    if (busy) return;
    busy = true;
    for (const button of actions.querySelectorAll('button')) button.disabled = true;
    app.stopSpeaking();
    await taken(
      send({
        type: 'storyChoice',
        beat: story.beat,
        node: story.node,
        revision: story.revision,
        choice,
      }),
    );
    const ended = active.events
      .take(['story.advanced'])
      .filter((event): event is StoryAdvanced => event.type === 'story.advanced')
      .find((event) => event.data.beat === story.beat && event.data.finished);
    const last =
      ended && ended.data.node !== story.node ? nodeText(data, story.beat, ended.data.node) : null;
    if (last && choice !== null) {
      showLast(last, choice);
      return;
    }
    await app.continueGame(active.keeper.id);
  };

  /** The beat's closing line, with the chosen egg when there was one. */
  const showLast = (key: string, choice: string): void => {
    const egg = eggChoices ? dragons.get(choice) : undefined;
    if (egg) {
      portrait.replaceChildren(
        dragonArt({ dragon: egg.rig, stage: 'egg', warmth: 0.6, framing: 'fit' }),
      );
      delete portrait.dataset['expression'];
    } else if (figure.kind === 'glimmer') {
      const expression = lineExpression(key, true);
      portrait.replaceChildren(glimmer(expression));
      portrait.dataset['expression'] = expression;
    } else if (figure.kind === 'finale') {
      app.kit.cue('fx.dragon-happy');
      void confetti(app.kit.fx);
    }
    say(key);
    autoRead();
    const next = candyButton({
      label: t('story.next'),
      icon: 'forward',
      variant: 'sun',
      size: 'big',
      testId: 'story-next',
      onPress: () => app.continueGame(active.keeper.id),
      onError: app.kit.onError,
    });
    actions.replaceChildren(next);
    next.focus();
  };

  if (eggChoices) {
    const eggs = story.choices.map((choice) => {
      const dragon = dragons.get(choice.id)!;
      const button = h(
        'button',
        {
          className: 'dv-egg-choice',
          testId: `story-choice-${choice.id}`,
          attributes: { type: 'button' },
        },
        dragonArt({ dragon: dragon.rig, stage: 'egg', warmth: 0.35, framing: 'fit' }),
        h('span', { className: 'dv-egg-choice__label', text: text(choice.text) }),
      );
      button.disabled = !choice.enabled;
      button.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void choose(choice.id).catch(app.kit.onError);
      });
      return button;
    });
    actions.append(
      h('div', { className: 'dv-egg-choices', attributes: { role: 'group' } }, ...eggs),
    );
  } else {
    for (const choice of story.choices) {
      actions.append(
        candyButton({
          label: text(choice.text),
          icon: 'forward',
          variant: 'sun',
          size: 'big',
          testId: story.choices.length === 1 ? 'story-next' : `story-choice-${choice.id}`,
          onPress: () => choose(choice.id),
          onError: app.kit.onError,
        }),
      );
    }
  }
  if (story.skippable) {
    actions.append(
      candyButton({
        label: t('story.skip'),
        variant: 'paper',
        size: 'small',
        testId: 'story-skip',
        onPress: () => choose(null),
        onError: app.kit.onError,
      }),
    );
  }

  say(story.text);
  const heading = h('h1', { className: 'dv-visually-hidden', text: t('story.heading') });
  const element = h(
    'main',
    { className: 'dv-story', testId: 'screen-story', dataset: { beat: story.beat } },
    wholeWindow ? wholeWindowHall(nodeIndex === 1) : backdrop(scene),
    heading,
    h(
      'section',
      { className: 'dv-story__stage' },
      portrait,
      h(
        'div',
        { className: 'dv-card dv-story__card' },
        h('div', { className: 'dv-story__text' }, line, speaker),
        actions,
      ),
    ),
  );
  return {
    element,
    title: t('story.heading'),
    field: 'valley',
    region: null,
    music: 'hub',
    focusTarget: () => actions.querySelector<HTMLElement>('button:not(:disabled)') ?? heading,
    mounted: autoRead,
  };
}
