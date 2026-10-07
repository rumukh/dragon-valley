// @vitest-environment happy-dom
/**
 * The announcer (DV-QA-16): messages that come close together are queued, each written after
 * the one before has had its moment, so no message is lost; the same words are heard again; a
 * screen change clears what is still waiting.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOUNCE_DELAY_MS,
  ANNOUNCE_HOLD_MS,
  createAnnouncer,
} from '../../../../src/app/ui/announcer';

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  vi.useFakeTimers();
  const announcer = createAnnouncer();
  const polite = announcer.element.querySelector('[aria-live="polite"]')!;
  const assertive = announcer.element.querySelector('[aria-live="assertive"]')!;
  return { announcer, polite, assertive };
}

describe('the announcer', () => {
  it('writes two close messages one after the other, so both are heard', () => {
    const { announcer, polite } = setup();
    const written: string[] = [];
    announcer.announce('You got 11 coins!');
    announcer.announce('The dragons saw what you know!');
    for (let step = 0; step < 20; step++) {
      vi.advanceTimersByTime(10);
      const text = polite.textContent ?? '';
      if (text !== '' && written.at(-1) !== text) written.push(text);
    }
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS + ANNOUNCE_HOLD_MS + ANNOUNCE_DELAY_MS);
    if (written.at(-1) !== polite.textContent) written.push(polite.textContent ?? '');
    expect(written).toEqual(['You got 11 coins!', 'The dragons saw what you know!']);
  });

  it('empties the region first, so the same words are heard again', () => {
    const { announcer, polite } = setup();
    announcer.announce('Settings saved.');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(polite.textContent).toBe('Settings saved.');
    vi.advanceTimersByTime(ANNOUNCE_HOLD_MS);
    announcer.announce('Settings saved.');
    expect(polite.textContent, 'emptied before it is written again').toBe('');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(polite.textContent).toBe('Settings saved.');
  });

  it('keeps polite and assertive messages apart', () => {
    const { announcer, polite, assertive } = setup();
    announcer.announce('Saved.');
    announcer.announce('Not saved.', 'assertive');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(polite.textContent).toBe('Saved.');
    expect(assertive.textContent).toBe('Not saved.');
  });

  it('drops what is still waiting when the screen changes', () => {
    const { announcer, polite } = setup();
    announcer.announce('One');
    announcer.announce('Two');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    announcer.clear();
    expect(polite.textContent).toBe('');
    vi.advanceTimersByTime(ANNOUNCE_HOLD_MS * 4);
    expect(polite.textContent, 'nothing left from the old screen').toBe('');
    announcer.announce('Three');
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
    expect(polite.textContent).toBe('Three');
  });
});
