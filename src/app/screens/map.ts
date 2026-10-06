/**
 * The valley map, the region road and the level card: how the child chooses where to play.
 *
 * The map is S4's `valley-map` picture with the regions as labelled buttons (the SDK's
 * `createHotspotList`, placed over the picture; a tap anywhere inside a region works too, through
 * `logicalPoint` and `hitHotspot`). Places the content does not have yet sleep under a lock. A
 * region opens its stretch of road with one button per level (locked, open, the glowing next
 * one, or its stars) and the boss at the end. A level card lists the level's activities and
 * starts or continues it.
 */
import { createHotspotList, hitHotspot, logicalPoint } from '@aegis/browser/ui';
import type { Hotspot } from '@aegis/browser/ui';
import type { LevelCard, RegionView } from '../../rules/contract';
import { taken } from '../controller/commands';
import { findLevel, findRegion } from '../game/view';
import { levelPositions, loadValleyMap } from '../game/map';
import type { MapPoint, ValleyMap } from '../game/map';
import type { MessageKey } from '../i18n/messages';
import { PALETTE } from '../art/palette';
import type { RegionAccent } from '../art/palette';
import { artIcon, bossArt } from '../ui/art';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { createCoinCounter, createStars } from '../ui/meters';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { backdrop, backgroundUrl } from './scene';

/** A picture for each kind of activity on the level card (S4 item icons). */
const ACTIVITY_ICONS: Readonly<Record<string, string>> = {
  feeding: 'apple',
  boss: 'star-filled',
  'memory-match': 'chest-closed',
  'egg-grid': 'egg',
  'number-trail': 'node-open',
  'fact-family': 'egg',
  'sharing-feast': 'berries',
  'compare-stones': 'badge-almost',
  'riddle-scrolls': 'chest-open',
  'golem-orders': 'coin',
};

interface Camera {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Percent position of a map point inside a camera rectangle. */
function place(element: HTMLElement, point: MapPoint, camera: Camera): void {
  element.style.left = `${((point.x - camera.x) / camera.width) * 100}%`;
  element.style.top = `${((point.y - camera.y) / camera.height) * 100}%`;
}

/** A picture of the map seen through a camera rectangle (the whole map, or one region). */
function mapPicture(map: ValleyMap, camera: Camera, className: string): HTMLElement {
  const image = h('img', {
    className: `${className}__image`,
    attributes: {
      src: backgroundUrl('valley-map'),
      alt: '',
      decoding: 'async',
      draggable: 'false',
    },
  });
  image.style.width = `${(map.logical.width / camera.width) * 100}%`;
  image.style.left = `${(-camera.x / camera.width) * 100}%`;
  image.style.top = `${(-camera.y / camera.height) * 100}%`;
  const frame = h('div', { className }, image);
  frame.style.setProperty('--aspect', `${camera.width} / ${camera.height}`);
  return frame;
}

export function mapScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `map:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const map = await loadValleyMap(app.env.baseUrl);
      const view = active.game.host.getView();
      const saveStatus = createSaveStatus(app, active);
      const coins = createCoinCounter(app.kit, view.coins);
      const camera: Camera = { x: 0, y: 0, ...map.logical };
      const picture = mapPicture(map, camera, 'dv-map');
      const regions = new Map(view.hub.regions.map((region) => [region.id, region]));
      const open = (region: RegionView | undefined): boolean => region?.unlocked === true;
      const playable: Hotspot[] = map.hotspots
        .filter((spot) => open(regions.get(spot.id)))
        .map((spot) => ({ ...spot, labelKey: regions.get(spot.id)!.titleKey }));
      const activate = (id: string): Promise<void> =>
        app.router.push(app.screens.region(keeperId, id));
      const list = createHotspotList({
        document,
        hotspots: playable,
        label: t('map.places'),
        message: (key) => app.text(key),
        activate,
        onError: app.kit.onError,
      });
      list.classList.add('dv-map__places');
      list.querySelectorAll('button').forEach((button, index) => {
        const spot = playable[index]!;
        button.classList.add('dv-map__place');
        button.dataset['testid'] = `map-region-${spot.id}`;
        button.prepend(artIcon(`emblem-${spot.id}`, { className: 'dv-map__emblem' }));
        place(button, { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2 }, camera);
      });
      const asleep = map.hotspots
        .filter((spot) => !open(regions.get(spot.id)))
        .map((spot) => {
          const pin = h(
            'span',
            { className: 'dv-map__asleep', attributes: { 'aria-hidden': 'true' } },
            artIcon('lock'),
          );
          place(pin, { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2 }, camera);
          return pin;
        });
      picture.append(...asleep, list);
      picture.addEventListener('click', (event) => {
        if (event.target instanceof HTMLButtonElement) return;
        const image = picture.querySelector('img');
        if (!image) return;
        const hit = hitHotspot(
          logicalPoint(
            { x: event.clientX, y: event.clientY },
            picture.getBoundingClientRect(),
            map.logical,
          ),
          playable,
        );
        if (hit) void activate(hit).catch(app.kit.onError);
      });
      const heading = h('h1', { className: 'dv-map__title', text: t('map.heading') });
      const element = h(
        'main',
        { className: 'dv-map-screen', testId: 'screen-map' },
        topBar({
          back: { label: t('map.back'), testId: 'map-back', onPress: () => app.router.back() },
          title: heading,
          tools: [coins.element, saveStatus.element],
          onError: app.kit.onError,
        }),
        picture,
        h('p', { className: 'dv-note', text: t('map.asleep') }),
      );
      return {
        element,
        title: t('map.heading'),
        field: 'valley',
        region: null,
        music: 'map',
        focusTarget: () => list.querySelector('button') ?? heading,
        dispose: () => saveStatus.dispose(),
      };
    },
  };
}

function nodeIcon(level: LevelCard): string {
  if (level.status === 'locked') return 'node-locked';
  if (level.status === 'completed') return `node-stars-${Math.max(1, Math.min(3, level.stars))}`;
  return level.glowing ? 'node-current' : 'node-open';
}

export function regionScreen(app: App, keeperId: string, regionId: string): ScreenEntry {
  return {
    key: `region:${keeperId}:${regionId}`,
    async build() {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      const map = await loadValleyMap(app.env.baseUrl);
      const view = active.game.host.getView();
      const region = findRegion(view, regionId);
      const layout = map.regions[regionId];
      const spot = map.hotspots.find((candidate) => candidate.id === regionId);
      if (!region || !layout || !spot) throw new Error(`Unknown region ${regionId}.`);
      const accent = (PALETTE.regions as Record<string, RegionAccent | undefined>)[regionId]
        ?.accent;
      const margin = Math.round(spot.width * 0.06);
      const width = Math.min(map.logical.width, spot.width + margin * 2);
      const height = Math.min(map.logical.height, spot.height + margin * 2);
      // The camera frames the region with a margin, kept inside the picture.
      const camera: Camera = {
        x: Math.min(Math.max(0, spot.x - margin), map.logical.width - width),
        y: Math.min(Math.max(0, spot.y - margin), map.logical.height - height),
        width,
        height,
      };
      const picture = mapPicture(map, camera, 'dv-road');
      const lessons = region.levels.filter((level) => level.kind === 'lesson');
      const bosses = region.levels.filter((level) => level.kind === 'boss');
      const positions = levelPositions(layout, lessons.length);
      const saveStatus = createSaveStatus(app, active);
      const coins = createCoinCounter(app.kit, view.coins);

      const nodeButton = (
        level: LevelCard,
        point: MapPoint,
        number: number | null,
      ): HTMLElement => {
        const title = text(level.titleKey);
        const label =
          level.status === 'locked'
            ? t('road.locked', { title })
            : level.status === 'completed'
              ? t('road.stars', { title, count: level.stars })
              : level.glowing
                ? t('road.next', { title })
                : t('road.open', { title });
        const button = h(
          'button',
          {
            className: `dv-road__node${level.kind === 'boss' ? ' dv-road__node--boss' : ''}`,
            testId: `level-${level.id}`,
            dataset: { status: level.status, glowing: String(level.glowing) },
            attributes: {
              type: 'button',
              'aria-label': number === null ? label : `${number}. ${label}`,
            },
          },
          level.kind === 'boss' && region.boss
            ? // A small boss on the road stands still; it comes alive on its own level.
              bossArt(
                region.boss.id,
                region.boss.defeated ? 'won' : 'start',
                'dv-road__boss',
                false,
              )
            : artIcon(nodeIcon(level), accent ? { accent } : {}),
          number === null
            ? null
            : h('span', { className: 'dv-road__number', text: String(number) }),
        );
        button.disabled = level.status === 'locked';
        button.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          void app.router.push(app.screens.level(keeperId, level.id)).catch(app.kit.onError);
        });
        place(button, point, camera);
        return button;
      };

      const nodes = [
        ...lessons.map((level, index) => nodeButton(level, positions[index]!, index + 1)),
        ...bosses.map((level) => nodeButton(level, layout.boss, null)),
      ];
      const road = h(
        'nav',
        { className: 'dv-road__nodes', attributes: { 'aria-label': t('road.levels') } },
        ...nodes,
      );
      picture.append(road);
      const heading = h('h1', { className: 'dv-map__title', text: text(region.titleKey) });
      const element = h(
        'main',
        {
          className: 'dv-map-screen dv-region',
          testId: 'screen-region',
          dataset: { region: regionId },
        },
        topBar({
          back: { label: t('road.back'), testId: 'region-back', onPress: () => app.router.back() },
          title: heading,
          tools: [coins.element, saveStatus.element],
          onError: app.kit.onError,
        }),
        picture,
      );
      return {
        element,
        title: text(region.titleKey),
        field: 'valley',
        region: regionId,
        music: 'map',
        focusTarget: () =>
          road.querySelector<HTMLElement>('[data-glowing="true"]') ??
          road.querySelector<HTMLElement>('button:not(:disabled)') ??
          heading,
        dispose: () => saveStatus.dispose(),
      };
    },
  };
}

export function levelScreen(app: App, keeperId: string, levelId: string): ScreenEntry {
  return {
    key: `level:${keeperId}:${levelId}`,
    async build() {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      const view = active.game.host.getView();
      const found = findLevel(view, levelId);
      const content = app.game.content.data.levels.find((level) => level.id === levelId);
      if (!found || !content) throw new Error(`Unknown level ${levelId}.`);
      const { level, region } = found;
      const run = view.run;
      const resume = run !== null && run.level === levelId && run.result === null ? run.next : null;
      const heading = h('h1', { className: 'dv-level__title', text: text(level.titleKey) });
      const activities = h(
        'ol',
        { className: 'dv-level__activities', testId: 'level-activities' },
        ...content.activities.map((activity, index) => {
          const done = run?.level === levelId && run.activities[index]?.done === true;
          return h(
            'li',
            { className: 'dv-level__activity', dataset: { done: String(done) } },
            artIcon(ACTIVITY_ICONS[activity.kind] ?? 'star-filled', {
              className: 'dv-level__icon',
            }),
            h('span', { text: t(`activity.${activity.kind}` as MessageKey) }),
            done ? icon('check', 'dv-icon dv-level__done') : null,
          );
        }),
      );
      const stars = createStars(
        level.stars,
        t('results.stars', { count: level.stars }),
        'level-stars',
      );
      const play = candyButton({
        label:
          resume !== null
            ? t('level.continue')
            : level.status === 'completed'
              ? t('level.again')
              : t('level.play'),
        icon: 'play',
        variant: 'sun',
        size: 'big',
        testId: 'level-play',
        onPress: async () => {
          await taken(
            active.commands.captureSend()(
              resume !== null
                ? { type: 'startActivity', activity: { kind: 'level', index: resume } }
                : { type: 'startLevel', level: levelId },
            ),
          );
          await app.continueGame(keeperId);
        },
        onError: app.kit.onError,
      });
      play.disabled = level.status === 'locked';
      const figure =
        level.kind === 'boss' && region.boss
          ? h(
              'div',
              { className: 'dv-level__boss', attributes: { 'aria-hidden': 'true' } },
              bossArt(region.boss.id, region.boss.defeated ? 'won' : 'start'),
            )
          : null;
      const element = h(
        'main',
        { className: 'dv-level', testId: 'screen-level', dataset: { level: levelId } },
        backdrop(
          app.game.content.data.regions.find((r) => r.id === region.id)?.background ??
            'sunny-meadow',
        ),
        topBar({
          back: { label: t('level.back'), testId: 'level-back', onPress: () => app.router.back() },
          title: h('span', { text: text(region.titleKey) }),
          onError: app.kit.onError,
        }),
        h(
          'section',
          { className: 'dv-card dv-level__card' },
          figure,
          heading,
          stars.element,
          level.kind === 'boss' && region.boss
            ? h('p', { text: t('level.boss', { name: text(region.boss.nameKey) }) })
            : null,
          activities,
          play,
        ),
      );
      return {
        element,
        title: text(level.titleKey),
        field: 'valley',
        region: region.id,
        music: 'map',
        focusTarget: () => (play.disabled ? heading : play),
      };
    },
  };
}
