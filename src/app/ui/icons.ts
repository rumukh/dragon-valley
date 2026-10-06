/**
 * Interface icons. Glyphs that S4's icon set provides (`renderIcon`, drawn in `currentColor`)
 * come from there, so the interface and the art share one hand; the few glyphs it lacks are
 * drawn here on the same principles (round caps and joins, about a tenth of the grid in
 * stroke width). Icons are decorative: the control around them carries the words.
 */
import { artIcon } from './art';
import { svg } from './dom';

type Shape = { d: string; fill?: boolean };

/** Our names for S4's glyphs. */
const ART_GLYPHS = {
  check: 'check',
  question: 'question',
  back: 'back',
  forward: 'next',
  lock: 'lock',
  speaker: 'speaker',
  settings: 'settings',
  home: 'home',
  close: 'close',
  grownups: 'parent',
  hint: 'hint',
  print: 'print',
} as const;

/** Glyphs S4's set does not have yet, on a 24-unit grid. */
const LOCAL_GLYPHS = {
  pause: [{ d: 'M8.5 5.5v13M15.5 5.5v13' }],
  play: [{ d: 'M8 5.5v13l10-6.5z', fill: true }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  pencil: [
    {
      d: 'M5 19l1.1-4.2L15.6 5.3a1.6 1.6 0 0 1 2.3 0l.8.8a1.6 1.6 0 0 1 0 2.3L9.2 17.9z',
    },
  ],
  download: [{ d: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14' }],
  upload: [{ d: 'M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 20h14' }],
  trash: [{ d: 'M5 7h14M9.5 7V5h5v2M7 7l1 12.5h8L17 7' }],
  warning: [
    { d: 'M12 4.5L21 19.5H3z' },
    { d: 'M12 10v4.2' },
    { d: 'M12 16.4a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2z', fill: true },
  ],
  retry: [{ d: 'M18.5 12.5a6.5 6.5 0 1 1-1.9-4.6M17.5 3.8v4.5H13' }],
  backspace: [
    { d: 'M9.2 6H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9.2L3.5 12z' },
    { d: 'M11.5 9.5l5 5M16.5 9.5l-5 5' },
  ],
  shield: [
    { d: 'M12 3.5l7 2.8v5.4c0 4.4-3 7.4-7 8.8-4-1.4-7-4.4-7-8.8V6.3z' },
    { d: 'M8.8 12l2.2 2.2 4.2-4.4' },
  ],
  sparkle: [{ d: 'M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z', fill: true }],
  book: [
    { d: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z' },
    { d: 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19' },
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ART_GLYPHS | keyof typeof LOCAL_GLYPHS;

export function icon(name: IconName, className = 'dv-icon'): SVGSVGElement {
  if (name in ART_GLYPHS) {
    return artIcon(ART_GLYPHS[name as keyof typeof ART_GLYPHS], { className });
  }
  const node = svg('svg', {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
    class: className,
  });
  for (const shape of LOCAL_GLYPHS[name as keyof typeof LOCAL_GLYPHS] as Shape[]) {
    node.appendChild(
      svg('path', {
        d: shape.d,
        fill: shape.fill ? 'currentColor' : 'none',
        stroke: 'currentColor',
        'stroke-width': shape.fill ? 0 : 2.4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  }
  return node;
}

/** S4's gold coin (full color). */
export function coinIcon(className = 'dv-coin'): SVGSVGElement {
  return artIcon('coin', { className });
}
