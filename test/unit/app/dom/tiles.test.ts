// @vitest-environment happy-dom
/**
 * Choice tiles: one tab stop with arrow keys between tiles, typed digits that pick the matching
 * tile, Enter to choose, and a missed tile taken out of play while keeping its "?" badge.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiles, matchTyped, typeAhead } from '../../../../src/app/ui/tiles';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => {
  vi.useRealTimers();
  kit?.dispose();
});

const choices = [12, 15, 21].map((value) => ({ id: String(value), label: String(value) }));

describe('typed digits', () => {
  it('match a label exactly or wait for more digits', () => {
    const labels = choices.map((choice) => choice.label);
    expect(matchTyped('1', labels)).toEqual({ index: null, partial: true });
    expect(matchTyped('15', labels)).toEqual({ index: 1, partial: false });
    expect(matchTyped('3', labels)).toEqual({ index: null, partial: false });
    expect(typeAhead('1', '5', labels)).toEqual({ typed: '15', index: 1 });
    expect(typeAhead('15', '2', labels)).toEqual({ typed: '2', index: null });
    expect(typeAhead('2', '1', labels)).toEqual({ typed: '21', index: 2 });
    expect(typeAhead('', '9', labels)).toEqual({ typed: '', index: null });
    expect(typeAhead('', '1', ['1', '10'])).toEqual({ typed: '1', index: 0 });
  });
});

describe('choice tiles', () => {
  it('pick a tile from typed digits, then choose it with Enter', async () => {
    kit = testKit();
    const onChoose = vi.fn();
    const tiles = createTiles(kit, { label: 'Answers', choices, digitSelect: true, onChoose });
    document.body.append(tiles.element);
    press('1');
    press('5');
    const fifteen = tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-15"]')!;
    expect(fifteen.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(fifteen);
    press('Enter');
    await settle();
    expect(onChoose).toHaveBeenCalledWith(choices[1]);
    tiles.dispose();
  });

  it('forget typed digits after a pause', () => {
    vi.useFakeTimers();
    kit = testKit();
    const tiles = createTiles(kit, {
      label: 'Answers',
      choices,
      digitSelect: true,
      onChoose: vi.fn(),
    });
    document.body.append(tiles.element);
    press('2');
    vi.advanceTimersByTime(2000);
    press('1');
    const twelve = tiles.element.querySelector('[data-testid="choice-12"]')!;
    const twentyOne = tiles.element.querySelector('[data-testid="choice-21"]')!;
    expect(twentyOne.getAttribute('aria-pressed')).toBe('false');
    expect(twelve.getAttribute('aria-pressed')).toBe('false');
    tiles.dispose();
  });

  it('move focus with the arrows, one tab stop for the group, skipping a missed tile', () => {
    kit = testKit();
    const tiles = createTiles(kit, { label: 'Answers', choices, onChoose: vi.fn() });
    document.body.append(tiles.element);
    const buttons = [...tiles.element.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    buttons[0]!.focus();
    press('ArrowRight', buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);
    tiles.setState('21', 'miss');
    tiles.block('21');
    press('ArrowRight', buttons[1]);
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[2]!.disabled).toBe(true);
    expect(buttons[2]!.dataset['state']).toBe('miss');
    expect(buttons[2]!.querySelector('.dv-badge svg')).not.toBeNull();
    press('End', buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);
    tiles.dispose();
  });

  it('choose only once while the answer is being checked', async () => {
    kit = testKit();
    let release: () => void = () => undefined;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const tiles = createTiles(kit, { label: 'Answers', choices, onChoose });
    document.body.append(tiles.element);
    const twelve = tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-12"]')!;
    twelve.click();
    twelve.click();
    tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-15"]')!.click();
    await settle();
    expect(onChoose).toHaveBeenCalledTimes(1);
    release();
    await settle();
    tiles.setState('12', 'correct');
    expect(twelve.dataset['state']).toBe('correct');
    tiles.dispose();
  });
});
