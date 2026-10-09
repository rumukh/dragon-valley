/**
 * A finished grade's certificate for the child (docs/design.md §12.5): every boss of the 1st or
 * 2nd class won over. A big, short line read aloud, the grade's last boss smiling, and a word that
 * a grown-up can print it (the Print tab has the paper one). The hub links here for each finished
 * grade (`finishedGrades`), so it never shows for a pack without that grade's regions.
 */
import type { Grade } from '../../rules/contract';
import type { MessageKey } from '../i18n/messages';
import { finishedGrades, gradeLastBoss } from '../print/content';
import { bossArt, sevenHeadedArt, SEVEN_HEADS } from '../ui/art';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { collection } from './collections';

const HEADINGS: Readonly<Record<Grade, MessageKey>> = {
  1: 'gradeDone.heading1',
  2: 'gradeDone.heading2',
  3: 'gradeDone.heading3',
};

export function gradeDoneScreen(app: App, keeperId: string, grade: Grade): ScreenEntry {
  return {
    key: `grade-done:${keeperId}:${grade}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const view = active.game.view();
      const data = active.game.content().data;
      const done = finishedGrades(view, data).includes(grade);
      const boss = gradeLastBoss(data, grade);
      const frame = collection(app, active, {
        title: t('gradeDone.title'),
        testId: 'screen-grade-done',
        music: 'album',
        body: [
          h(
            'section',
            {
              className: 'dv-card dv-grade-done',
              testId: 'grade-done',
              dataset: { grade: String(grade), done: String(done) },
            },
            boss
              ? bossArt(boss, 'won', 'dv-boss-art', false)
              : sevenHeadedArt(SEVEN_HEADS, { animated: false }),
            h('p', {
              className: 'dv-grade-done__line',
              testId: 'grade-done-line',
              text: t(done ? HEADINGS[grade] : 'gradeDone.notYet'),
            }),
            h('p', { className: 'dv-note', text: t('gradeDone.print') }),
            candyButton({
              label: t('gradeDone.home'),
              icon: 'home',
              size: 'big',
              testId: 'grade-done-home',
              onPress: () => app.router.back(),
              onError: app.kit.onError,
            }),
          ),
        ],
      });
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}
