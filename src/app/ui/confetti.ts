/**
 * Confetti burst for big moments (a finished round, a hatch). Pieces fall through the fixed
 * effects layer with transform and opacity only, then remove themselves. Nothing happens when
 * motion is reduced: the celebration is also in words and stars.
 */
import { h } from './dom';
import { animate, EASE_OUT, finished, prefersReducedMotion } from './motion';

const COLORS = [
  '--dv-rainbow-1',
  '--dv-rainbow-2',
  '--dv-rainbow-3',
  '--dv-rainbow-4',
  '--dv-rainbow-5',
  '--dv-rainbow-6',
  '--dv-rainbow-7',
];

export function confetti(
  layer: HTMLElement,
  options: { pieces?: number; origin?: { x: number; y: number }; random?: () => number } = {},
): Promise<void> {
  if (prefersReducedMotion() || typeof Element.prototype.animate !== 'function') {
    return Promise.resolve();
  }
  const random = options.random ?? Math.random;
  const width = layer.clientWidth || window.innerWidth;
  const height = layer.clientHeight || window.innerHeight;
  const origin = options.origin ?? { x: width / 2, y: height * 0.35 };
  const count = options.pieces ?? 42;
  const runs: Promise<void>[] = [];
  for (let index = 0; index < count; index++) {
    const piece = h('span', { className: 'dv-confetti-piece' });
    piece.style.background = `var(${COLORS[index % COLORS.length]})`;
    if (index % 3 === 0) piece.style.borderRadius = '50%';
    layer.append(piece);
    const angle = random() * Math.PI * 2;
    const burst = 80 + random() * 180;
    const dx = Math.cos(angle) * burst;
    const peak = origin.y - 60 - random() * 160;
    const fall = height + 40;
    const spin = (random() - 0.5) * 1080;
    const duration = 1400 + random() * 900;
    const animation = animate(
      piece,
      [
        { transform: `translate(${origin.x}px, ${origin.y}px) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${origin.x + dx}px, ${peak}px) rotate(${spin / 2}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${origin.x + dx * 1.3}px, ${fall}px) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: EASE_OUT, fill: 'both' },
    );
    runs.push(finished(animation).then(() => piece.remove()));
  }
  return Promise.all(runs).then(() => undefined);
}
