/**
 * Long collections, one part at a time: where the Sticker Album opens, which Market shelf shows
 * first, and how the tabs turn around the ends.
 */
import { describe, expect, it } from 'vitest';
import { albumStartPage, marketStartShelf } from '../../../src/app/screens/collections';
import { stepTab } from '../../../src/app/ui/tabs';

describe('the Sticker Album', () => {
  const pages = [
    { region: 'sunny-meadow' },
    { region: 'whispering-woods' },
    { region: 'fire-mountain' },
  ];

  it('opens at the furthest open region, where new stickers come from', () => {
    const regions = [
      { id: 'sunny-meadow', unlocked: true },
      { id: 'whispering-woods', unlocked: true },
      { id: 'fire-mountain', unlocked: false },
    ];
    expect(albumStartPage(pages, regions)).toBe('whispering-woods');
    expect(
      albumStartPage(
        pages,
        regions.map((r) => ({ ...r, unlocked: false })),
      ),
    ).toBe('sunny-meadow');
    expect(albumStartPage([], regions)).toBeUndefined();
  });

  it('opens again at the page looked at last, while it exists', () => {
    const regions = [{ id: 'sunny-meadow', unlocked: true }];
    expect(albumStartPage(pages, regions, 'fire-mountain')).toBe('fire-mountain');
    expect(albumStartPage(pages, regions, 'dragon-castle')).toBe('sunny-meadow');
  });
});

describe("Glimmer's Market", () => {
  const item = (
    slot: 'head' | 'neck' | 'eyes' | 'wings' | 'nest',
    owned: boolean,
    affordable: boolean,
  ) => ({
    slot,
    owned,
    affordable,
  });

  it('opens at the first shelf with something to buy now, in slot order', () => {
    const items = [item('nest', false, true), item('head', true, true), item('eyes', false, false)];
    expect(marketStartShelf(items)).toBe('nest');
    expect(marketStartShelf([item('eyes', false, false), item('neck', true, false)])).toBe('neck');
    expect(marketStartShelf([])).toBeUndefined();
  });

  it('opens again at the shelf looked at last, while it has anything', () => {
    const items = [item('nest', false, true), item('head', true, true)];
    expect(marketStartShelf(items, 'head')).toBe('head');
    expect(marketStartShelf(items, 'wings')).toBe('nest');
  });
});

describe('tabs', () => {
  it('turn around the ends', () => {
    const ids = ['a', 'b', 'c'];
    expect(stepTab(ids, 'a', 1)).toBe('b');
    expect(stepTab(ids, 'c', 1)).toBe('a');
    expect(stepTab(ids, 'a', -1)).toBe('c');
    expect(stepTab(ids, 'missing', 1)).toBe('b');
  });
});
