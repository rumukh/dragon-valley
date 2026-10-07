/**
 * The keeper's collections, opened from the hub: Glimmer's Market (cosmetics for coins, one
 * shelf per slot), the Dragon Den (dress each dragon, one item per slot), the Sticker Album (one
 * page per region, turned with tabs) and the Magic Window (every fact as a pane of stained
 * glass). They render the view and send the two actions they need (`buy`, `equip`); everything
 * else is the rules' business. Long collections show one shelf or page at a time, so no screen
 * grows many screens tall at 200 % text.
 */
import { COSMETIC_SLOTS } from '../../rules/contract';
import type {
  CosmeticSlot,
  DragonView,
  GameView,
  MarketItem,
  WindowCell,
} from '../../rules/contract';
import { renderMagicWindow } from '../art/window';
import type { PaneState } from '../art/window';
import type { StickerFrame } from '../art/stickers';
import { REGION_EMBLEM_IDS } from '../art/icons/emblems';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { artIcon, cosmeticIconArt, stickerArt, svgElement, viewDragonArt } from '../ui/art';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { createCoinCounter } from '../ui/meters';
import { createTabs } from '../ui/tabs';
import type { Screen, ScreenEntry } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, toastStickers, topBar } from './common';

/** The common frame of a collection screen: Back, a title, the coins and the save status. */
function collection(
  app: App,
  active: ActiveKeeper,
  options: { title: string; testId: string; music: string; body: Node[] },
): {
  screen: Omit<Screen, 'focusTarget'>;
  heading: HTMLElement;
  coins: ReturnType<typeof createCoinCounter>;
} {
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.view().coins);
  const heading = h('h1', { className: 'dv-collection__title', text: options.title });
  const element = h(
    'main',
    { className: 'dv-collection', testId: options.testId },
    topBar({
      back: {
        label: app.kit.t('collection.back'),
        testId: 'collection-back',
        onPress: () => app.router.back(),
      },
      title: heading,
      tools: [coins.element, saveStatus.element],
      onError: app.kit.onError,
    }),
    ...options.body,
  );
  return {
    screen: {
      element,
      title: options.title,
      field: 'valley',
      region: null,
      music: options.music,
      dispose: () => saveStatus.dispose(),
    },
    heading,
    coins,
  };
}

// ---- Glimmer's Market -----------------------------------------------------------------------

/** The Market shelf each keeper last looked at, while the app is open. */
const marketShelves = new Map<string, CosmeticSlot>();

/**
 * The shelf (cosmetic slot) to open the Market at: the one looked at last, else the first with
 * something the keeper can buy now, else the first with anything on it.
 */
export function marketStartShelf(
  items: readonly Pick<MarketItem, 'slot' | 'owned' | 'affordable'>[],
  remembered?: CosmeticSlot,
): CosmeticSlot | undefined {
  const slots = COSMETIC_SLOTS.filter((slot) => items.some((item) => item.slot === slot));
  if (remembered !== undefined && slots.includes(remembered)) return remembered;
  const buyable = (slot: CosmeticSlot): boolean =>
    items.some((item) => item.slot === slot && !item.owned && item.affordable);
  return slots.find(buyable) ?? slots[0];
}

export function marketScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `market:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      const shelf = h('ul', { className: 'dv-shelf', testId: 'market-items' });
      const note = h('p', { className: 'dv-note', testId: 'market-note' });
      const available = (): MarketItem[] =>
        active.game.view().market.items.filter((entry) => entry.available);
      let shown = marketStartShelf(available(), marketShelves.get(keeperId));
      const slots = COSMETIC_SLOTS.filter((slot) =>
        available().some((entry) => entry.slot === slot),
      );
      const shelfTitle = h('h2', { className: 'dv-shelf__title', testId: 'market-shelf' });
      // One shelf at a time: every item at once makes a page many screens tall at 200 % text.
      // A shelf's tab shows one of its things; its name is the tab's label and the title.
      const tabs =
        shown !== undefined && slots.length > 1
          ? createTabs(app.kit, {
              label: t('market.shelves'),
              tabs: slots.map((slot) => {
                const sample = available().find((entry) => entry.slot === slot)!;
                return {
                  id: slot,
                  name: t(`slot.${slot}` as MessageKey),
                  art: () => cosmeticIconArt(sample.assetId, 'dv-cosmetic-art dv-tabs__emblem'),
                };
              }),
              current: shown,
              testIdPrefix: 'market',
              iconOnly: true,
              onChange: (slot) => {
                shown = slot;
                marketShelves.set(keeperId, slot);
                paint();
              },
            })
          : null;
      const frame = collection(app, active, {
        title: t('market.heading'),
        testId: 'screen-market',
        music: 'market',
        body: [
          h(
            'section',
            { className: 'dv-card dv-collection__card' },
            note,
            tabs?.element ?? null,
            shelfTitle,
            shelf,
          ),
        ],
      });
      const item = (entry: MarketItem): HTMLElement => {
        const name = text(entry.nameKey);
        const action = entry.owned
          ? h(
              'span',
              { className: 'dv-shelf__owned' },
              icon('check'),
              h('span', { text: t('market.owned') }),
            )
          : candyButton({
              label: entry.affordable
                ? t('market.buy', { price: entry.price })
                : plural(
                    t,
                    entry.price - active.game.view().coins,
                    'market.need.one',
                    'market.need.other',
                  ),
              variant: entry.affordable ? 'sun' : 'paper',
              size: 'small',
              testId: `market-buy-${entry.id}`,
              onPress: async () => {
                await active.commands.capture()({ type: 'buy', item: entry.id });
                app.kit.toasts.show(t('market.bought', { item: name }));
                toastStickers(app, active);
                paint();
              },
              onError: app.kit.onError,
            });
        if (action instanceof HTMLButtonElement) action.disabled = !entry.affordable;
        return h(
          'li',
          {
            className: 'dv-shelf__item',
            dataset: { owned: String(entry.owned), slot: entry.slot },
          },
          cosmeticIconArt(entry.assetId, 'dv-cosmetic-art dv-shelf__art'),
          h('span', { className: 'dv-shelf__name', text: name }),
          h(
            'span',
            { className: 'dv-shelf__price' },
            artIcon('coin', { className: 'dv-shelf__coin' }),
            h('span', { text: String(entry.price) }),
          ),
          action,
        );
      };
      const paint = (): void => {
        const view = active.game.view();
        frame.coins.set(view.coins);
        const items = available();
        note.textContent = items.length === 0 ? t('market.empty') : t('market.intro');
        shelfTitle.textContent = shown === undefined ? '' : t(`slot.${shown}` as MessageKey);
        shelfTitle.hidden = shown === undefined;
        shelf.replaceChildren(
          ...items.filter((entry) => shown === undefined || entry.slot === shown).map(item),
        );
      };
      paint();
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}

// ---- Dragon Den -----------------------------------------------------------------------------

export function denScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `den:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      let chosen: string | null = active.game.view().dragons[0]?.id ?? null;
      const picker = h('div', {
        className: 'dv-den__dragons',
        attributes: { role: 'group', 'aria-label': t('den.pick') },
      });
      const preview = h('div', { className: 'dv-den__preview', testId: 'den-preview' });
      const slots = h('div', { className: 'dv-den__slots' });
      const frame = collection(app, active, {
        title: t('den.heading'),
        testId: 'screen-den',
        music: 'market',
        body: [
          h(
            'section',
            { className: 'dv-card dv-den' },
            picker,
            h('div', { className: 'dv-den__stage' }, preview, slots),
          ),
        ],
      });

      const owned = (view: GameView, slot: CosmeticSlot): MarketItem[] =>
        view.market.items.filter((entry) => entry.owned && entry.slot === slot);

      const paint = (): void => {
        const view = active.game.view();
        frame.coins.set(view.coins);
        const dragon: DragonView | undefined =
          view.dragons.find((candidate) => candidate.id === chosen) ?? view.dragons[0];
        picker.replaceChildren(
          ...view.dragons.map((candidate) => {
            const button = h(
              'button',
              {
                className: 'dv-den__dragon',
                testId: `den-dragon-${candidate.id}`,
                attributes: {
                  type: 'button',
                  'aria-pressed': String(candidate.id === dragon?.id),
                  'aria-label': text(candidate.nameKey),
                },
              },
              viewDragonArt(candidate, {
                animated: false,
                className: 'dv-dragon-art dv-dragon-art--small',
              }),
            );
            button.addEventListener('click', () => {
              chosen = candidate.id;
              app.kit.cue('ui.tap');
              paint();
            });
            return button;
          }),
        );
        if (!dragon) {
          preview.replaceChildren(h('p', { text: t('hub.noDragons') }));
          slots.replaceChildren();
          return;
        }
        preview.replaceChildren(
          viewDragonArt(dragon, { framing: 'stage', expression: 'happy' }),
          h('p', { className: 'dv-den__name', text: text(dragon.nameKey) }),
        );
        // Eggs can only sit in a decorated nest; every slot fits every hatched dragon.
        const usable = dragon.stage === 'egg' ? (['nest'] as const) : COSMETIC_SLOTS;
        slots.replaceChildren(
          ...usable.map((slot) => {
            const items = owned(view, slot);
            const worn = dragon.outfit[slot];
            const choice = (id: string | null, label: string, art: Node | null): HTMLElement => {
              const button = h(
                'button',
                {
                  className: 'dv-den__item',
                  testId: `den-${slot}-${id ?? 'none'}`,
                  attributes: {
                    type: 'button',
                    'aria-pressed': String(worn === id),
                    'aria-label': label,
                  },
                },
                art,
                h('span', { text: label }),
              );
              button.addEventListener('click', () => {
                if (worn === id) return;
                void active.commands
                  .capture()({ type: 'equip', dragon: dragon.id, slot, item: id })
                  .then(() => {
                    toastStickers(app, active);
                    paint();
                  }, app.kit.onError);
              });
              return button;
            };
            return h(
              'fieldset',
              { className: 'dv-den__slot' },
              h('legend', { text: t(`slot.${slot}` as MessageKey) }),
              choice(null, t('den.none'), null),
              ...items.map((entry) =>
                choice(
                  entry.id,
                  text(entry.nameKey),
                  cosmeticIconArt(entry.assetId, 'dv-cosmetic-art dv-den__art'),
                ),
              ),
              ...(items.length === 0
                ? [h('p', { className: 'dv-den__empty', text: t('den.nothing') })]
                : []),
            );
          }),
        );
      };
      paint();
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}

// ---- Sticker Album --------------------------------------------------------------------------

/** The album page each keeper last looked at, while the app is open. */
const albumPages = new Map<string, string>();

/**
 * The page to open the album at: the one looked at last, else the furthest open region's (where
 * new stickers come from), else the first.
 */
export function albumStartPage(
  pages: readonly { readonly region: string }[],
  regions: readonly { readonly id: string; readonly unlocked: boolean }[],
  remembered?: string,
): string | undefined {
  const has = (id: string | undefined): id is string =>
    id !== undefined && pages.some((page) => page.region === id);
  if (has(remembered)) return remembered;
  const open = regions.filter((region) => region.unlocked && has(region.id));
  return open[open.length - 1]?.id ?? pages[0]?.region;
}

export function albumScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `album:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const text = app.text;
      const active = await app.openKeeper(keeperId);
      const view = active.game.view();
      const regionTitle = (id: string): string => {
        const region = view.hub.regions.find((candidate) => candidate.id === id);
        return region ? text(region.titleKey) : id;
      };
      const pageOf = (id: string) => view.album.pages.find((page) => page.region === id);
      const earnedOn = (id: string): number =>
        pageOf(id)?.stickers.filter((sticker) => sticker.earned).length ?? 0;
      const slot = h('div', { className: 'dv-album__slot' });

      const showPage = (id: string): void => {
        const page = pageOf(id);
        if (!page) return;
        albumPages.set(keeperId, id);
        const heading = h('h2', {
          text: regionTitle(id),
          attributes: { id: `album-page-${id}` },
        });
        slot.replaceChildren(
          h(
            'section',
            {
              className: 'dv-card dv-album__page',
              testId: `album-${page.region}`,
              attributes: { 'aria-labelledby': heading.id },
            },
            heading,
            h('p', {
              className: 'dv-note',
              testId: 'album-page-count',
              text: t('album.count', { earned: earnedOn(id), total: page.stickers.length }),
            }),
            h(
              'ul',
              { className: 'dv-album__stickers' },
              ...page.stickers.map((sticker) =>
                h(
                  'li',
                  { className: 'dv-album__sticker', dataset: { earned: String(sticker.earned) } },
                  sticker.earned
                    ? stickerArt({
                        frame: sticker.frame as StickerFrame,
                        color: sticker.color,
                        icon: sticker.icon,
                      })
                    : h(
                        'span',
                        { className: 'dv-album__empty', attributes: { 'aria-hidden': 'true' } },
                        icon('question'),
                      ),
                  h('span', { className: 'dv-album__name', text: text(sticker.nameKey) }),
                  h('span', {
                    className: 'dv-visually-hidden',
                    text: sticker.earned ? t('album.earned') : t('album.notYet'),
                  }),
                ),
              ),
            ),
          ),
        );
      };

      const start = albumStartPage(view.album.pages, view.hub.regions, albumPages.get(keeperId));
      const tabs =
        start === undefined
          ? null
          : createTabs(app.kit, {
              label: t('album.pages'),
              tabs: view.album.pages.map((page) => ({
                id: page.region,
                name: t('album.tab', {
                  region: regionTitle(page.region),
                  earned: earnedOn(page.region),
                  total: page.stickers.length,
                }),
                ...((REGION_EMBLEM_IDS as readonly string[]).includes(`emblem-${page.region}`)
                  ? {
                      art: () => artIcon(`emblem-${page.region}`, { className: 'dv-tabs__emblem' }),
                    }
                  : {}),
                done: page.stickers.length > 0 && earnedOn(page.region) === page.stickers.length,
              })),
              current: start,
              testIdPrefix: 'album',
              iconOnly: true,
              arrows: { previous: t('album.previous'), next: t('album.next') },
              onChange: showPage,
            });
      if (start !== undefined) showPage(start);
      const frame = collection(app, active, {
        title: t('album.heading'),
        testId: 'screen-album',
        music: 'album',
        body: [
          h('p', {
            className: 'dv-note',
            testId: 'album-count',
            text: t('album.count', { earned: view.album.earned, total: view.album.total }),
          }),
          ...(tabs ? [tabs.element] : []),
          slot,
        ],
      });
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}

// ---- Magic Window ---------------------------------------------------------------------------

function panes(
  cells: readonly WindowCell[],
  rows: number,
  columns: number,
  rowOffset: number,
): PaneState[][] {
  const grid: PaneState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 'dim' as PaneState),
  );
  for (const cell of cells) {
    const row = grid[cell.row - rowOffset];
    if (row && cell.column >= 0 && cell.column < columns) {
      row[cell.column] = cell.needsPolish ? { level: cell.level, needsPolish: true } : cell.level;
    }
  }
  return grid;
}

export function windowScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `window:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const view = active.game.view();
      const { counts } = view.window;
      const lit = counts.bronze + counts.silver + counts.gold;
      const art = svgElement(
        renderMagicWindow({
          multiplication: panes(view.window.cells, 11, 11, 0),
          division: panes(view.window.division, 10, 11, 1),
          idPrefix: `dv-window-${keeperId}`,
          title: t('window.art', { lit, total: view.window.cells.length }),
        }),
      );
      art.classList.add('dv-window__art');
      const frame = collection(app, active, {
        title: t('window.heading'),
        testId: 'screen-window',
        music: 'album',
        body: [
          h(
            'section',
            { className: 'dv-card dv-window' },
            art,
            h(
              'ul',
              { className: 'dv-window__legend', testId: 'window-counts' },
              ...(['gold', 'silver', 'bronze', 'dim'] as const).map((level) =>
                h(
                  'li',
                  { dataset: { level } },
                  h('span', {
                    className: 'dv-window__swatch',
                    attributes: { 'aria-hidden': 'true' },
                  }),
                  h('span', { text: t(`window.${level}` as MessageKey, { count: counts[level] }) }),
                ),
              ),
            ),
          ),
        ],
      });
      return { ...frame.screen, focusTarget: () => frame.heading };
    },
  };
}
