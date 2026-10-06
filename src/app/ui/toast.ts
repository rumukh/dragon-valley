/**
 * Toasts: short messages at the top of the screen that also reach screen readers. They never
 * steal focus and disappear on their own; a warning stays until the next one replaces it.
 */
import { h } from './dom';
import { icon } from './icons';
import type { IconName } from './icons';
import type { Announcer } from './announcer';

export type ToastTone = 'info' | 'success' | 'warning';

export interface Toaster {
  readonly element: HTMLElement;
  show(message: string, options?: { tone?: ToastTone; durationMs?: number }): void;
  clear(): void;
}

const ICON_BY_TONE: Record<ToastTone, IconName> = {
  info: 'sparkle',
  success: 'check',
  warning: 'warning',
};

export function createToaster(announcer: Announcer, maxVisible = 3): Toaster {
  const element = h('div', { className: 'dv-toasts', testId: 'toasts' });
  const remove = (toast: HTMLElement): void => {
    toast.dataset['leaving'] = 'true';
    setTimeout(() => toast.remove(), 220);
  };
  return {
    element,
    show(message, options = {}) {
      const tone = options.tone ?? 'info';
      const toast = h(
        'div',
        { className: 'dv-toast', testId: 'toast', dataset: { tone } },
        icon(ICON_BY_TONE[tone]),
        h('span', { text: message }),
      );
      element.append(toast);
      while (element.childElementCount > maxVisible) element.firstElementChild?.remove();
      announcer.announce(message, tone === 'warning' ? 'assertive' : 'polite');
      const duration = options.durationMs ?? (tone === 'warning' ? 6000 : 3200);
      setTimeout(() => remove(toast), duration);
    },
    clear() {
      element.replaceChildren();
    },
  };
}
