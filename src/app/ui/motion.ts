/**
 * Motion policy for scripted animation. CSS animations follow the same policy in base.css.
 *
 * Decorative motion stops when the child's "reduce motion" setting is on (data-reduced-motion
 * on <html>, applied from preferences) or the system asks for reduced motion. Only transform
 * and opacity are animated, so motion never reflows the page.
 */
export function prefersReducedMotion(root: HTMLElement = document.documentElement): boolean {
  if (root.dataset['reducedMotion'] === 'true') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Web Animations, or nothing when motion is reduced or unsupported. */
export function animate(
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  if (prefersReducedMotion() || typeof element.animate !== 'function') return null;
  return element.animate(keyframes, options);
}

/** Resolve when an animation ends or is cancelled; immediately when there is none. */
export function finished(animation: Animation | null): Promise<void> {
  if (!animation) return Promise.resolve();
  return animation.finished.then(
    () => undefined,
    () => undefined,
  );
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Exponential ease-out (expo): fast start, long gentle settle. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
