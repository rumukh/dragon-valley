/**
 * Screen-reader announcements through two persistent live regions (polite and assertive) that
 * live outside the replaceable screen, so a screen change never drops a pending message.
 * Repeating the same words is announced again: the region is emptied first.
 */
import { h } from './dom';

export interface Announcer {
  readonly element: HTMLElement;
  announce(text: string, priority?: 'polite' | 'assertive'): void;
  clear(): void;
}

export function createAnnouncer(): Announcer {
  const polite = h('div', {
    className: 'dv-visually-hidden',
    testId: 'announcer-polite',
    attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  const assertive = h('div', {
    className: 'dv-visually-hidden',
    testId: 'announcer-assertive',
    attributes: { 'aria-live': 'assertive', 'aria-atomic': 'true' },
  });
  const element = h('div', { className: 'dv-announcer' }, polite, assertive);
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  return {
    element,
    announce(text, priority = 'polite') {
      const region = priority === 'assertive' ? assertive : polite;
      clearTimeout(timers.get(region));
      region.textContent = '';
      timers.set(
        region,
        setTimeout(() => {
          region.textContent = text;
        }, 40),
      );
    },
    clear() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      polite.textContent = '';
      assertive.textContent = '';
    },
  };
}
