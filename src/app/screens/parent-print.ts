/**
 * The grown-ups' Print tab: flashcards of the keeper's hardest facts or of one times table, and
 * certificates for what the keeper achieved (print/content.ts decides what exists). Each opens
 * the print preview (screens/print.ts) with a laid-out job; a layout that cannot fit is reported
 * here instead of printing clipped cards.
 */
import { OPERATOR_SYMBOLS, TABLE_MAX, TABLE_MIN } from '../../rules/contract';
import type { Grade, Notation } from '../../rules/contract';
import type { MessageKey } from '../i18n/messages';
import { possessive } from '../i18n/messages';
import type { Keeper } from '../persistence/family';
import { gradeOf, isYoungGrade } from '../game/grade';
import {
  addTableFacts,
  addTensFacts,
  earnedCertificates,
  gradeLastBoss,
  hardestFacts,
  longDay,
  tableFacts,
} from '../print/content';
import type { Certificate } from '../print/content';
import { certificateJob, flashcardJob } from '../print/documents';
import type { CertificateText } from '../print/documents';
import { bossArt, dragonArt, SEVEN_HEADS, sevenHeadedArt } from '../ui/art';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { App } from '../shell/app';
import type { KeeperGame } from './keeper-data';
import { fileSlug, localDay } from './common';
import type { PrintRequest } from './print';

type Segmented = <T extends string>(
  label: string,
  values: readonly T[],
  current: T,
  text: (value: T) => string,
  testId: (value: T) => string,
  choose: (value: T) => void | Promise<void>,
) => HTMLElement;

export interface PrintTabOptions {
  /** The times table chosen for table flashcards. */
  readonly table: number;
  chooseTable(table: number): Promise<void>;
  readonly segmented: Segmented;
}

const GRADE_CERTIFICATE: Readonly<Record<Grade, { heading: MessageKey; body: MessageKey }>> = {
  1: { heading: 'print.certificate.grade1Heading', body: 'print.certificate.grade1' },
  2: { heading: 'print.certificate.grade2Heading', body: 'print.certificate.grade2' },
  3: { heading: 'print.certificate.finaleHeading', body: 'print.certificate.finale' },
};

const TABLES = Array.from({ length: TABLE_MAX - TABLE_MIN + 1 }, (_, index) => TABLE_MIN + index);

export function printContent(
  app: App,
  keeper: Keeper,
  game: KeeperGame,
  options: PrintTabOptions,
): HTMLElement[] {
  const t = app.kit.t;
  const text = app.text;
  const { view, content, notation } = game;
  const data = content.data;
  const slug = fileSlug(keeper.name);
  const signs = OPERATOR_SYMBOLS[notation as Notation];
  const status = h('p', {
    className: 'dv-note',
    testId: 'print-status',
    attributes: { role: 'status' },
  });

  const open = async (build: () => PrintRequest): Promise<void> => {
    let request: PrintRequest;
    try {
      request = build();
    } catch {
      // layoutPrint refuses text that would not fit: say so instead of printing it clipped.
      status.textContent = t('parent.print.failed');
      return;
    }
    status.textContent = '';
    await app.router.push(app.screens.print(request));
  };

  const cardsGuidance = t('parent.print.cardsGuidance');
  const hardest = hardestFacts(view, notation);
  const young = isYoungGrade(gradeOf(view));
  const addTableButton = young
    ? candyButton({
        label: t('parent.print.addTableButton', { table: options.table }),
        icon: 'print',
        variant: 'sun',
        testId: 'print-add-table',
        onPress: () =>
          open(() => {
            const title = t('parent.print.addTableTitle', {
              table: options.table,
              add: signs.add,
              sub: signs.sub,
            });
            return {
              job: flashcardJob(
                title,
                addTableFacts(options.table, notation),
                `${slug}-adding-${options.table}`,
              ),
              title,
              guidance: cardsGuidance,
            };
          }),
        onError: app.kit.onError,
      })
    : null;
  // 2nd grade adds and takes away whole tens within 100: the same number, as tens.
  const tensTableButton =
    gradeOf(view) === 2
      ? candyButton({
          label: t('parent.print.tensTableButton', { tens: options.table * 10 }),
          icon: 'print',
          variant: 'sun',
          testId: 'print-tens-table',
          onPress: () =>
            open(() => {
              const title = t('parent.print.tensTableTitle', {
                tens: options.table * 10,
                add: signs.add,
                sub: signs.sub,
              });
              return {
                job: flashcardJob(
                  title,
                  addTensFacts(options.table, notation),
                  `${slug}-adding-${options.table * 10}`,
                ),
                title,
                guidance: cardsGuidance,
              };
            }),
          onError: app.kit.onError,
        })
      : null;
  const flashcards = h(
    'div',
    { className: 'dv-print-tab__group' },
    h('h3', { text: t('parent.print.cardsHeading') }),
    h('p', { text: t('parent.print.cardsIntro') }),
    hardest.length > 0
      ? candyButton({
          label: t('parent.print.hardest', { count: hardest.length }),
          icon: 'print',
          variant: 'sun',
          testId: 'print-hardest',
          onPress: () =>
            open(() => ({
              job: flashcardJob(
                t('parent.print.hardestTitle', { owner: possessive(keeper.name) }),
                hardest,
                `${slug}-hardest-facts`,
              ),
              title: t('parent.print.hardestTitle', { owner: possessive(keeper.name) }),
              guidance: cardsGuidance,
            })),
          onError: app.kit.onError,
        })
      : h('p', { className: 'dv-note', text: t('parent.print.noHardest') }),
    h(
      'div',
      { className: 'dv-field' },
      h('span', {
        className: 'dv-field__label',
        text: t(young ? 'parent.print.number' : 'parent.print.table'),
      }),
      options.segmented(
        t(young ? 'parent.print.number' : 'parent.print.table'),
        TABLES.map(String),
        String(options.table),
        (value) => value,
        (value) => `print-table-${value}`,
        (value) => options.chooseTable(Number(value)),
      ),
    ),
    ...(addTableButton ? [addTableButton] : []),
    ...(tensTableButton ? [tensTableButton] : []),
    candyButton({
      label: t('parent.print.tableButton', { table: options.table }),
      icon: 'print',
      variant: 'paper',
      testId: 'print-table',
      onPress: () =>
        open(() => {
          const title = t('parent.print.tableTitle', {
            table: options.table,
            mul: signs.mul,
            div: signs.div,
          });
          return {
            job: flashcardJob(
              title,
              tableFacts(options.table, notation),
              `${slug}-table-${options.table}`,
            ),
            title,
            guidance: cardsGuidance,
          };
        }),
      onError: app.kit.onError,
    }),
  );

  const date = longDay(view.day ?? localDay());
  const dragonName = (id: string): string => {
    const dragon = data.dragons.find((candidate) => candidate.id === id);
    return dragon ? text(dragon.nameKey) : id;
  };
  const bossName = (id: string): string => {
    const boss = data.bosses.find((candidate) => candidate.id === id);
    return boss ? text(boss.nameKey) : id;
  };
  const regionName = (id: string): string => {
    const region = view.hub.regions.find((candidate) => candidate.id === id);
    return region ? text(region.titleKey) : id;
  };

  /** The words of a certificate, and the button's name for it. */
  const words = (certificate: Certificate): CertificateText & { readonly name: string } => {
    switch (certificate.kind) {
      case 'dragon': {
        const dragon = view.dragons.find((candidate) => candidate.id === certificate.dragon);
        const name = dragonName(certificate.dragon);
        return {
          id: certificate.id,
          name,
          heading: t('print.certificate.dragonHeading', { dragon: name }),
          body: [
            keeper.name,
            dragon?.table !== null && dragon?.table !== undefined
              ? t('print.certificate.dragonTable', { dragon: name, table: dragon.table })
              : t('print.certificate.dragonSpecial', { dragon: name }),
            date,
          ],
        };
      }
      case 'region': {
        const name = regionName(certificate.region);
        return {
          id: certificate.id,
          name,
          heading: name,
          body: [
            keeper.name,
            t('print.certificate.region', { boss: bossName(certificate.boss), region: name }),
            date,
          ],
        };
      }
      case 'grade': {
        const keys = GRADE_CERTIFICATE[certificate.grade];
        return {
          id: certificate.id,
          name: t(keys.heading),
          heading: t(keys.heading),
          body: [keeper.name, t(keys.body), date],
        };
      }
      case 'finale':
        return {
          id: certificate.id,
          name: t('print.certificate.finaleHeading'),
          heading: t('print.certificate.finaleHeading'),
          body: [keeper.name, t('print.certificate.finale'), date],
        };
    }
  };

  const art = (certificate: Certificate): Node => {
    switch (certificate.kind) {
      case 'dragon': {
        const dragon = data.dragons.find((candidate) => candidate.id === certificate.dragon);
        return dragonArt(
          {
            dragon: dragon?.rig ?? certificate.dragon,
            stage: 'crowned',
            expression: 'proud',
            framing: 'fit',
            animated: false,
          },
          'dv-dragon-art',
        );
      }
      case 'region':
        return bossArt(certificate.boss, 'won', 'dv-boss-art', false);
      case 'grade': {
        // The grade's last boss, smiling: G5 may later give grades their own emblem.
        const boss = gradeLastBoss(data, certificate.grade);
        return boss
          ? bossArt(boss, 'won', 'dv-boss-art', false)
          : sevenHeadedArt(SEVEN_HEADS, { animated: false });
      }
      case 'finale':
        return sevenHeadedArt(SEVEN_HEADS, { animated: false });
    }
  };

  const certificates = earnedCertificates(view, data);
  const certificateList = h(
    'div',
    { className: 'dv-print-tab__group' },
    h('h3', { text: t('parent.print.certificatesHeading') }),
    certificates.length === 0
      ? h('p', {
          className: 'dv-note',
          testId: 'print-no-certificates',
          text: t('parent.print.noCertificates', { name: keeper.name }),
        })
      : h(
          'ul',
          { className: 'dv-parent__list', testId: 'print-certificates' },
          ...certificates.map((certificate) => {
            const certificateWords = words(certificate);
            return h(
              'li',
              { className: 'dv-parent__row' },
              h('span', { text: certificateWords.name }),
              candyButton({
                label: t('parent.print.certificate', { name: certificateWords.name }),
                icon: 'print',
                variant: 'paper',
                size: 'small',
                testId: `print-${certificate.id.replace(/:/g, '-')}`,
                onPress: () =>
                  open(() => ({
                    job: certificateJob(
                      t('parent.print.certificateTitle', { name: certificateWords.name }),
                      certificateWords,
                      `${slug}-${certificate.id.replace(/:/g, '-')}`,
                    ),
                    title: t('parent.print.certificateTitle', { name: certificateWords.name }),
                    guidance: t('parent.print.certificateGuidance'),
                    art: (cell) => (cell.id === 'heading' ? art(certificate) : null),
                  })),
                onError: app.kit.onError,
              }),
            );
          }),
        ),
  );

  return [
    h(
      'div',
      { className: 'dv-print-tab', testId: 'parent-print' },
      h('p', { text: t('parent.print.intro') }),
      flashcards,
      certificateList,
      status,
    ),
  ];
}
