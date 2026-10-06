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
  pause: 'pause',
  play: 'play',
  plus: 'plus',
  pencil: 'pencil',
  download: 'download',
  upload: 'upload',
  trash: 'trash',
  warning: 'warning',
  retry: 'retry',
  backspace: 'backspace',
  shield: 'shield',
} as const;

/** Glyphs S4's set does not have, on a 24-unit grid (minus, sparkle, book, map, gift, bag, window). */
const LOCAL_GLYPHS = {
  minus: [{ d: 'M5 12h14' }],
  sparkle: [{ d: 'M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z', fill: true }],
  book: [
    { d: 'M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z' },
    { d: 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19' },
  ],
  map: [{ d: 'M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z' }, { d: 'M9 4.5v13M15 6.5v13' }],
  gift: [
    { d: 'M4.5 10.5h15v9h-15zM3.5 7.5h17v3h-17zM12 7.5v12' },
    {
      d: 'M12 7.5c-2-3.5-5.5-3-4.5-.5.6 1.4 4.5.5 4.5.5zM12 7.5c2-3.5 5.5-3 4.5-.5-.6 1.4-4.5.5-4.5.5z',
    },
  ],
  bag: [{ d: 'M5.5 8h13l-1 12h-11z' }, { d: 'M9 8V6.5a3 3 0 0 1 6 0V8' }],
  window: [{ d: 'M5.5 20V10a6.5 6.5 0 0 1 13 0v10z' }, { d: 'M12 3.5V20M5.5 13h13' }],
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
