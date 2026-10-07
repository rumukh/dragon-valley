/**
 * The valley map, the region road and the level card: how the child chooses where to play.
 *
 * The map is S4's `valley-map` picture with the regions as labelled buttons (the SDK's
 * `createHotspotList`, placed over the picture; a tap anywhere inside a region works too, through
 * `logicalPoint` and `hitHotspot`). When the map is too narrow for the names (a phone, or big
 * text), the same buttons line up beside it on a wide window, else under it, and the picture keeps
 * each region's emblem as a pin (screens.css, "Valley map"). Places the content does not have yet
 * sleep under a lock. A region opens its stretch of road with one button per level (locked, open,
 * the glowing next one, or its stars) and the boss at the end, and beside it the levels' names
 * with their stars. A level card lists the level's activities and starts or continues it.
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

/**
 * Below this many text sizes of width the map is too narrow for its places' names (a phone, or
 * big text): the buttons then line up under the picture, which keeps the emblems as pins. They
 * also do when any two names on the picture would touch.
 */
const COMPACT_MAP_EMS = 36;

/**
 * When the names leave the picture they stand beside it on a window this much wider than tall
 * with room for them (this many text sizes), so the map and every name fit without scrolling;
 * otherwise they line up under it.
 */
const BESIDE_ASPECT = 1.55;
const BESIDE_EMS = 40;

/** True when any two of the buttons overlap. */
function crowded(list: HTMLElement): boolean {
  const boxes = [...list.querySelectorAll('button')].map((button) =>
    button.getBoundingClientRect(),
  );
  return boxes.some((a, index) =>
    boxes
      .slice(index + 1)
      .some(
        (b) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
      ),
  );
}

interface Camera {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a point of the map falls inside a camera rectangle, as percentages (`--x`, `--y`). The
 * stylesheet places each kind of button from them so that it always stays inside the picture's
 * frame, at any screen size, text size or zoom (screens.css, "Valley map").
 */
function place(element: HTMLElement, point: MapPoint, camera: Camera): void {
  element.style.setProperty('--x', `${((point.x - camera.x) / camera.width) * 100}%`);
  element.style.setProperty('--y', `${((point.y - camera.y) / camera.height) * 100}%`);
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
  // The same, as one number: the picture's width for the height the window leaves it.
  frame.style.setProperty('--ratio', String(camera.width / camera.height));
  return frame;
}

export function mapScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `map:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const map = await loadValleyMap(app.env.baseUrl);
      const view = active.game.view();
      const saveStatus = createSaveStatus(app, active);
      const coins = createCoinCounter(app.kit, view.coins);
      const camera: Camera = { x: 0, y: 0, ...map.logical };
      const picture = mapPicture(map, camera, 'dv-map');
      const regions = new Map(view.hub.regions.map((region) => [region.id, region]));
      const open = (region: RegionView | undefined): boolean => region?.unlocked === true;
      // In the valley's order, which is also the reading order of the buttons.
      const playable: Hotspot[] = map.hotspots
        .filter((spot) => open(regions.get(spot.id)))
        .sort((a, b) => regions.get(a.id)!.order - regions.get(b.id)!.order)
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
      // Shown only while the names line up under the map; a tap on a pin is a tap in its region.
      const pins = playable.map((spot) => {
        const pin = h(
          'span',
          { className: 'dv-map__pin', attributes: { 'aria-hidden': 'true' } },
          artIcon(`emblem-${spot.id}`, { className: 'dv-map__emblem' }),
        );
        place(pin, { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2 }, camera);
        return pin;
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
      picture.append(...asleep, ...pins, list);
      const area = h('div', { className: 'dv-map-area', testId: 'map-area' }, picture);
      // One set of buttons: over the picture while the names fit; beside it (a wide window) or
      // under it when they do not.
      const fit = (): void => {
        const host = area.parentElement;
        if (!host || area.clientWidth === 0) return;
        const size = parseFloat(getComputedStyle(picture).fontSize) || 16;
        // Try the names on a hidden stand-in of the picture at the size it has with the names on
        // it, so the real buttons (and the focus) stay put while the browser measures: if it is
        // too narrow, or any two names would touch, the names leave the picture. (A browser may
        // not restyle the real picture until the next frame, so it cannot be measured here.)
        const ghost = picture.cloneNode(false) as HTMLElement;
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.visibility = 'hidden';
        const probe = list.cloneNode(true) as HTMLElement;
        probe
          .querySelectorAll('[data-testid]')
          .forEach((node) => node.removeAttribute('data-testid'));
        ghost.append(probe);
        host.insertBefore(ghost, area);
        const compact = ghost.clientWidth < COMPACT_MAP_EMS * size || crowded(probe);
        ghost.remove();
        const wide =
          innerWidth >= BESIDE_ASPECT * innerHeight && area.clientWidth >= BESIDE_EMS * size;
        area.dataset['compact'] = String(compact);
        area.dataset['names'] = compact ? (wide ? 'beside' : 'under') : 'over';
        const home = compact ? area : picture;
        if (list.parentElement !== home) {
          const focused = list.contains(document.activeElement) ? document.activeElement : null;
          home.append(list);
          if (focused instanceof HTMLElement && document.activeElement !== focused) focused.focus();
        }
      };
      // The layout changes the picture's size, so it waits for the next frame rather than
      // resizing what the observer is reporting on.
      let pending = 0;
      const resizes = new ResizeObserver(() => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(fit);
      });
      resizes.observe(area);
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
        area,
        h('p', { className: 'dv-note', text: t('map.asleep') }),
      );
      return {
        element,
        title: t('map.heading'),
        field: 'valley',
        region: null,
        music: 'map',
        focusTarget: () => list.querySelector('button') ?? heading,
        mounted: fit,
        dispose: () => {
          cancelAnimationFrame(pending);
          resizes.disconnect();
          saveStatus.dispose();
        },
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
      const view = active.game.view();
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

      const openLevel = (level: LevelCard): void => {
        app.kit.cue('ui.tap');
        void app.router.push(app.screens.level(keeperId, level.id)).catch(app.kit.onError);
      };

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
        button.addEventListener('click', () => openLevel(level));
        place(button, point, camera);
        return button;
      };

      // Beside the road, each level's name and stars, in the road's order. A tap on a name opens
      // its level like its marker; the markers already carry the names for a screen reader and
      // the keyboard, so the list is only for the eyes (and the fingers).
      const row = (level: LevelCard, number: number | null): HTMLElement => {
        const button = h(
          'button',
          {
            className: 'dv-road__row',
            testId: `level-row-${level.id}`,
            dataset: { status: level.status, glowing: String(level.glowing) },
            attributes: { type: 'button', tabindex: '-1' },
          },
          number === null && region.boss
            ? bossArt(
                region.boss.id,
                region.boss.defeated ? 'won' : 'start',
                'dv-road__face',
                false,
              )
            : h('span', { className: 'dv-road__badge', text: String(number ?? '') }),
          h('span', { className: 'dv-road__name', text: text(level.titleKey) }),
          level.status === 'locked'
            ? icon('lock', 'dv-icon dv-road__lock')
            : h(
                'span',
                { className: 'dv-road__stars' },
                ...[0, 1, 2].map((index) =>
                  artIcon(index < level.stars ? 'star-filled' : 'star-empty'),
                ),
              ),
        );
        button.disabled = level.status === 'locked';
        button.addEventListener('click', () => openLevel(level));
        return h('li', {}, button);
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
      const names = h(
        'ol',
        { className: 'dv-road__list', attributes: { 'aria-hidden': 'true' } },
        ...lessons.map((level, index) => row(level, index + 1)),
        ...bosses.map((level) => row(level, null)),
      );
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
        h('div', { className: 'dv-region__body' }, picture, names),
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
      const view = active.game.view();
      const found = findLevel(view, levelId);
      const content = active.game.content().data.levels.find((level) => level.id === levelId);
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
          active.game.content().data.regions.find((r) => r.id === region.id)?.background ??
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
