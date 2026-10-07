/**
 * Goodbye, with the Dragon Diary (docs/design.md §2.1): when a keeper leaves the valley after a
 * day that brought something, or when the grown-ups' time limit says it is time to rest, the
 * featured dragon waves and the diary tells what today brought - facts that began to shine,
 * dragons that hatched or grew, stickers earned - made from the view (game/diary.ts), never from
 * written text. It can be read aloud. "See you soon!" leads to the keepers; Back to the valley.
 */
import { BLANK, num, op, parseItemId } from '../../rules/contract';
import type { DragonStage, Problem } from '../../rules/contract';
import { diaryOf, isEmptyDiary } from '../game/diary';
import type { Diary } from '../game/diary';
import { featuredDragon, weekdayIndex } from '../game/view';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { factText } from '../math/facts';
import { speakSolved } from '../speech/verbalizer';
import { stickerArt, viewDragonArt } from '../ui/art';
import type { StickerFrame } from '../art/stickers';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { topBar } from './common';
import { backdrop } from './scene';
import { speakerButton } from './speech';

/** Facts listed by name; the rest are counted. */
export const DIARY_FACTS = 6;

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const GREW: Readonly<Record<Exclude<DragonStage, 'egg'>, MessageKey>> = {
  hatchling: 'results.grew.hatchling',
  youngling: 'results.grew.youngling',
  adult: 'results.grew.adult',
  crowned: 'results.grew.crowned',
};

/** A fact as the problem it answers, for reading it aloud. */
function factProblem(item: string): { problem: Problem; answer: number } | null {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'mul') {
    return {
      problem: { kind: 'equation', left: op('mul', num(parsed.a), num(parsed.b)), right: BLANK },
      answer: parsed.product,
    };
  }
  if (parsed?.kind === 'div') {
    return {
      problem: {
        kind: 'equation',
        left: op('div', num(parsed.dividend), num(parsed.divisor)),
        right: BLANK,
      },
      answer: parsed.quotient,
    };
  }
  return null;
}

/** True when leaving the valley now has a diary to show. */
export function hasDiary(active: ActiveKeeper): boolean {
  return !isEmptyDiary(diaryOf(active.game.view(), active.day.current()));
}

export function goodbyeScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `goodbye:${keeperId}`,
    async build(context) {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      const view = active.game.view();
      const data = active.game.content().data;
      const notation = active.preferences.current().notation;
      const diary: Diary = diaryOf(view, active.day.current());
      const heading = h('h1', {
        className: 'dv-goodbye__title',
        testId: 'goodbye-heading',
        text: t('goodbye.heading', { name: active.keeper.name }),
      });

      // What is read aloud: the same lines, with facts in words.
      const spoken: string[] = [];
      const parts: Node[] = [];
      if (diary.facts.length > 0) {
        const shown = diary.facts.slice(0, DIARY_FACTS);
        spoken.push(t('diary.learned'));
        parts.push(
          h('p', { className: 'dv-diary__lead', text: t('diary.learned') }),
          h(
            'ul',
            { className: 'dv-diary__facts', testId: 'diary-facts' },
            ...shown.map((item) => {
              const fact = factText(item, notation);
              const words = factProblem(item);
              if (words) {
                spoken.push(speakSolved(words.problem, { kind: 'number', value: words.answer }));
              }
              return h('li', { text: fact?.sentence ?? item });
            }),
          ),
        );
        const more = diary.facts.length - shown.length;
        if (more > 0) {
          const line = plural(t, more, 'diary.more.one', 'diary.more.other');
          spoken.push(line);
          parts.push(h('p', { className: 'dv-diary__more', text: line }));
        }
      }
      if (diary.dragons.length > 0) {
        parts.push(
          h(
            'ul',
            { className: 'dv-diary__list', testId: 'diary-dragons' },
            ...diary.dragons.map((change) => {
              const dragon = view.dragons.find((candidate) => candidate.id === change.id);
              const content = data.dragons.find((candidate) => candidate.id === change.id);
              const name = content ? text(content.nameKey) : change.id;
              const key = change.stage === 'egg' ? null : GREW[change.stage];
              const line = key ? t(key, { name }) : name;
              spoken.push(line);
              return h(
                'li',
                { dataset: { dragon: change.id, stage: change.stage } },
                dragon
                  ? viewDragonArt(dragon, {
                      expression: 'happy',
                      animated: false,
                      className: 'dv-dragon-art dv-diary__art',
                    })
                  : null,
                h('span', { text: line }),
              );
            }),
          ),
        );
      }
      if (diary.stickers.length > 0) {
        const stickers = new Map(
          view.album.pages.flatMap((page) => page.stickers).map((sticker) => [sticker.id, sticker]),
        );
        parts.push(
          h(
            'ul',
            { className: 'dv-diary__list', testId: 'diary-stickers' },
            ...diary.stickers.map((id) => {
              const sticker = stickers.get(id);
              const line = t('results.sticker', { name: sticker ? text(sticker.nameKey) : id });
              spoken.push(line);
              return h(
                'li',
                { dataset: { sticker: id } },
                sticker
                  ? stickerArt(
                      {
                        frame: sticker.frame as StickerFrame,
                        color: sticker.color,
                        icon: sticker.icon,
                      },
                      'dv-sticker-art dv-diary__art',
                    )
                  : null,
                h('span', { text: line }),
              );
            }),
          ),
        );
      }
      if (parts.length === 0) {
        spoken.push(t('diary.empty'));
        parts.push(h('p', { className: 'dv-diary__lead', text: t('diary.empty') }));
      }
      const day = view.day;
      const card = h(
        'section',
        {
          className: 'dv-card dv-diary',
          testId: 'diary',
          attributes: { 'aria-labelledby': 'dv-diary-heading' },
        },
        h(
          'div',
          { className: 'dv-diary__header' },
          h('h2', {
            className: 'dv-diary__heading',
            text: t('diary.heading'),
            attributes: { id: 'dv-diary-heading' },
          }),
          day
            ? h('p', {
                className: 'dv-diary__day',
                text: t(`day.${WEEKDAYS[weekdayIndex(day)]!}` as MessageKey),
              })
            : null,
          ...speakerButton(app, active, () => spoken.join(' '), 'diary-read'),
        ),
        ...parts,
      );

      const featured = featuredDragon(view);
      const done = candyButton({
        label: t('goodbye.done'),
        icon: 'home',
        variant: 'sun',
        size: 'big',
        testId: 'goodbye-done',
        onPress: () => app.router.reset(app.screens.keepers()),
        onError: app.kit.onError,
      });
      const element = h(
        'main',
        { className: 'dv-goodbye', testId: 'screen-goodbye' },
        backdrop('valley-map'),
        topBar({
          back: context.canGoBack
            ? { label: t('goodbye.back'), testId: 'goodbye-back', onPress: () => app.router.back() }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        h(
          'div',
          { className: 'dv-goodbye__layout' },
          featured
            ? h(
                'div',
                { className: 'dv-goodbye__dragon', attributes: { 'aria-hidden': 'true' } },
                viewDragonArt(featured, { expression: 'happy', framing: 'fit' }),
              )
            : null,
          card,
        ),
        h('div', { className: 'dv-goodbye__actions' }, done),
      );
      return {
        element,
        title: t('goodbye.heading', { name: active.keeper.name }),
        field: 'valley',
        region: null,
        music: 'hub',
        focusTarget: () => heading,
        mounted() {
          if (active.preferences.current().autoRead) app.speak(spoken.join(' '));
        },
      };
    },
  };
}
