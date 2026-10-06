import { M, L, Q, C, roundStarD } from '../svg/path';
import { h, svgDoc, ids as scoped } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
import { KEEPER_AVATARS } from '../../../rules/contract/ids';
import { cloudUnion } from '../dragon/shapes';

export { KEEPER_AVATARS };

type HairStyle = 'curly' | 'afro' | 'bob' | 'wavy' | 'twists' | 'beanie' | 'swoop' | 'curls-band';

interface Keeper {
  skin: string;
  hair: string;
  style: HairStyle;
  top: string;
  bg: string;
  extras: Array<
    'freckles' | 'glasses' | 'star-pin' | 'stripes' | 'hood' | 'bandage' | 'overalls' | 'dimples'
  >;
  mouth: 'grin' | 'smile' | 'open';
}

/** Eight diverse, gender-neutral keepers: varied skin tones, hair textures and outfits. */
const KEEPERS: Record<string, Keeper> = {
  'keeper-1': {
    skin: '#ffe0c7',
    hair: '#d9692c',
    style: 'curly',
    top: '#2fb4a6',
    bg: '#dff3e5',
    extras: ['freckles', 'hood'],
    mouth: 'grin',
  },
  'keeper-2': {
    skin: '#6b4128',
    hair: '#22181f',
    style: 'afro',
    top: '#ffc53d',
    bg: '#fff3d1',
    extras: ['glasses'],
    mouth: 'smile',
  },
  'keeper-3': {
    skin: '#f2cfa8',
    hair: '#2a2140',
    style: 'bob',
    top: '#e8423f',
    bg: '#fde3d6',
    extras: ['star-pin'],
    mouth: 'open',
  },
  'keeper-4': {
    skin: '#c98e5e',
    hair: '#4a2c1a',
    style: 'wavy',
    top: '#3aa65b',
    bg: '#eef2d6',
    extras: ['stripes'],
    mouth: 'smile',
  },
  'keeper-5': {
    skin: '#8a5734',
    hair: '#2b1d17',
    style: 'twists',
    top: '#f26a2e',
    bg: '#ffecd6',
    extras: ['hood'],
    mouth: 'grin',
  },
  'keeper-6': {
    skin: '#fbe3cf',
    hair: '#f2c55c',
    style: 'beanie',
    top: '#5b6cf0',
    bg: '#dbebfc',
    extras: ['freckles'],
    mouth: 'open',
  },
  'keeper-7': {
    skin: '#b07a4f',
    hair: '#1f1a2e',
    style: 'swoop',
    top: '#a8326c',
    bg: '#fbe1ee',
    extras: ['bandage'],
    mouth: 'grin',
  },
  'keeper-8': {
    skin: '#e4b48a',
    hair: '#9a6233',
    style: 'curls-band',
    top: '#8b5cf6',
    bg: '#ece4ff',
    extras: ['overalls', 'dimples'],
    mouth: 'smile',
  },
};

const INK = '#2a2140';
const HX = 60;
const HY = 58;
const HRX = 29;
const HRY = 31;

function backHair(k: Keeper): string {
  const fill = k.hair;
  const line = outlineOf(k.hair, 0.4);
  const st = { fill, stroke: line, 'stroke-width': 3, 'stroke-linejoin': 'round' as const };
  switch (k.style) {
    case 'afro':
      return cloudUnion(
        [
          { x: 60, y: 44, r: 30 },
          { x: 36, y: 52, r: 18 },
          { x: 84, y: 52, r: 18 },
          { x: 44, y: 30, r: 16 },
          { x: 76, y: 30, r: 16 },
          { x: 60, y: 22, r: 16 },
        ],
        fill,
        line,
        3,
      );
    case 'bob':
      return h('path', {
        d:
          M(28, 82) +
          C(22, 48, 32, 22, 60, 22) +
          C(88, 22, 98, 48, 92, 82) +
          Q(76, 88, 60, 86) +
          Q(44, 88, 28, 82) +
          'Z',
        ...st,
      });
    case 'wavy':
      return h('path', {
        d:
          M(30, 84) +
          C(20, 60, 26, 24, 60, 24) +
          C(94, 24, 100, 60, 90, 84) +
          Q(84, 80, 82, 86) +
          Q(76, 80, 70, 84) +
          L(50, 84) +
          Q(44, 80, 38, 86) +
          Q(36, 80, 30, 84) +
          'Z',
        ...st,
      });
    case 'curls-band':
    case 'curly':
      return cloudUnion(
        [
          { x: 34, y: 56, r: 12 },
          { x: 86, y: 56, r: 12 },
          { x: 34, y: 70, r: 10 },
          { x: 86, y: 70, r: 10 },
        ],
        fill,
        line,
        3,
      );
    default:
      return '';
  }
}

function frontHair(k: Keeper): string {
  const fill = k.hair;
  const line = outlineOf(k.hair, 0.4);
  const st = { fill, stroke: line, 'stroke-width': 3, 'stroke-linejoin': 'round' as const };
  const shine = (d: string): string =>
    h('path', {
      d,
      fill: 'none',
      stroke: lighten(k.hair, 0.45),
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.7,
    });
  switch (k.style) {
    case 'curly':
    case 'curls-band': {
      const top = cloudUnion(
        [
          { x: 38, y: 44, r: 11 },
          { x: 48, y: 34, r: 12 },
          { x: 61, y: 30, r: 13 },
          { x: 74, y: 34, r: 12 },
          { x: 83, y: 44, r: 11 },
          { x: 54, y: 42, r: 9 },
          { x: 68, y: 42, r: 9 },
        ],
        fill,
        line,
        3,
      );
      const band =
        k.style === 'curls-band'
          ? h('path', {
              d: M(33, 47) + Q(60, 30, 87, 47),
              fill: 'none',
              stroke: '#ffd23f',
              'stroke-width': 6,
              'stroke-linecap': 'round',
            }) +
            h('path', {
              d: M(33, 47) + Q(60, 30, 87, 47),
              fill: 'none',
              stroke: outlineOf('#ffd23f', 0.5),
              'stroke-width': 1.5,
              'stroke-dasharray': '2 6',
              'stroke-linecap': 'round',
            })
          : '';
      return top + band + shine(M(52, 30) + Q(58, 26, 64, 27));
    }
    case 'afro':
      return (
        h('path', {
          d:
            M(34, 50) +
            Q(46, 36, 60, 38) +
            Q(74, 36, 86, 50) +
            Q(80, 30, 60, 28) +
            Q(40, 30, 34, 50) +
            'Z',
          fill,
        }) + shine(M(48, 22) + Q(56, 16, 66, 18))
      );
    case 'bob':
      return (
        h('path', {
          d:
            M(31, 54) +
            C(30, 34, 42, 26, 60, 26) +
            C(78, 26, 90, 34, 89, 54) +
            Q(84, 46, 80, 50) +
            L(76, 46) +
            L(70, 50) +
            L(64, 46) +
            L(58, 50) +
            L(52, 46) +
            L(46, 50) +
            L(40, 46) +
            Q(36, 50, 31, 54) +
            'Z',
          ...st,
        }) + shine(M(44, 32) + Q(52, 28, 60, 29))
      );
    case 'wavy':
      return (
        h('path', {
          d:
            M(31, 56) +
            C(30, 36, 42, 26, 62, 27) +
            C(80, 28, 90, 38, 89, 54) +
            C(80, 44, 72, 38, 62, 40) +
            C(56, 46, 46, 42, 42, 48) +
            C(38, 52, 34, 52, 31, 56) +
            'Z',
          ...st,
        }) + shine(M(64, 31) + Q(74, 32, 80, 38))
      );
    case 'twists': {
      const pts: Array<[number, number, number, number]> = [
        [36, 46, 30, 36],
        [42, 38, 38, 26],
        [51, 33, 49, 20],
        [60, 31, 60, 18],
        [69, 33, 71, 20],
        [78, 38, 82, 26],
        [84, 46, 90, 36],
      ];
      const twist = pts.map(([x1, y1, x2, y2]) => M(x1, y1) + L(x2, y2)).join('');
      return (
        h('path', { d: twist, stroke: line, 'stroke-width': 13, 'stroke-linecap': 'round' }) +
        h('path', { d: twist, stroke: fill, 'stroke-width': 9, 'stroke-linecap': 'round' }) +
        h('path', {
          d:
            M(33, 52) +
            C(34, 36, 46, 30, 60, 30) +
            C(74, 30, 86, 36, 87, 52) +
            Q(74, 42, 60, 42) +
            Q(46, 42, 33, 52) +
            'Z',
          ...st,
        })
      );
    }
    case 'beanie': {
      const hat = '#2d8ce6';
      return (
        h('path', {
          d: M(34, 50) + L(38, 58) + L(42, 50) + L(46, 56) + L(50, 50) + Z0(),
          fill,
          stroke: outlineOf(fill, 0.4),
          'stroke-width': 2.5,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: M(86, 50) + L(82, 58) + L(78, 50) + L(74, 56) + L(70, 50) + Z0(),
          fill,
          stroke: outlineOf(fill, 0.4),
          'stroke-width': 2.5,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: M(29, 48) + C(28, 24, 44, 14, 60, 14) + C(76, 14, 92, 24, 91, 48) + 'Z',
          fill: hat,
          stroke: outlineOf(hat, 0.5),
          'stroke-width': 3,
        }) +
        h('path', {
          d: M(30, 30) + Q(60, 18, 90, 30),
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': 5,
          opacity: 0.6,
        }) +
        h('rect', {
          x: 26,
          y: 42,
          width: 68,
          height: 12,
          rx: 6,
          fill: darken(hat, 0.15),
          stroke: outlineOf(hat, 0.5),
          'stroke-width': 3,
        }) +
        cloudUnion(
          [
            { x: 60, y: 12, r: 8 },
            { x: 54, y: 15, r: 5 },
            { x: 66, y: 15, r: 5 },
          ],
          '#fff3d6',
          outlineOf(hat, 0.5),
          2.5,
        )
      );
    }
    case 'swoop':
      return (
        h('path', {
          d:
            M(31, 54) +
            C(29, 32, 44, 24, 62, 25) +
            C(82, 26, 92, 38, 89, 56) +
            C(86, 46, 80, 42, 74, 42) +
            C(66, 44, 58, 36, 50, 40) +
            C(42, 44, 38, 46, 31, 54) +
            'Z',
          ...st,
        }) + shine(M(56, 30) + Q(66, 28, 74, 32))
      );
    default:
      return '';
  }
}

function Z0(): string {
  return 'Z';
}

function face(k: Keeper): string {
  const skinLine = outlineOf(k.skin, 0.45);
  const eyes = [-1, 1]
    .map(
      (s) =>
        h('ellipse', { cx: HX + s * 11, cy: HY + 2, rx: 3.8, ry: 4.6, fill: INK }) +
        h('circle', { cx: HX + s * 11 + 1.3, cy: HY + 0.2, r: 1.5, fill: '#ffffff' }),
    )
    .join('');
  const brows = h('path', {
    d:
      M(HX - 15, HY - 7) +
      Q(HX - 11, HY - 10, HX - 7, HY - 8) +
      M(HX + 7, HY - 8) +
      Q(HX + 11, HY - 10, HX + 15, HY - 7),
    fill: 'none',
    stroke: darken(k.hair, 0.1),
    'stroke-width': 2.4,
    'stroke-linecap': 'round',
  });
  const nose = h('path', {
    d: M(HX - 1.5, HY + 8) + Q(HX, HY + 10, HX + 1.8, HY + 8),
    fill: 'none',
    stroke: skinLine,
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  let mouth: string;
  if (k.mouth === 'grin') {
    const d =
      M(HX - 9, HY + 14) +
      Q(HX, HY + 16, HX + 9, HY + 14) +
      Q(HX + 8, HY + 23, HX, HY + 23) +
      Q(HX - 8, HY + 23, HX - 9, HY + 14) +
      'Z';
    mouth =
      h('path', {
        d,
        fill: '#7a2e3e',
        stroke: INK,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      }) +
      h('path', {
        d: M(HX - 7, HY + 15.5) + L(HX + 7, HY + 15.5),
        stroke: '#ffffff',
        'stroke-width': 2.6,
        'stroke-linecap': 'round',
      }) +
      h('ellipse', { cx: HX, cy: HY + 21, rx: 3.5, ry: 1.6, fill: '#ff8fa8' });
  } else if (k.mouth === 'open') {
    mouth =
      h('path', {
        d: M(HX - 6, HY + 15) + Q(HX, HY + 25, HX + 6, HY + 15) + 'Z',
        fill: '#7a2e3e',
        stroke: INK,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      }) + h('ellipse', { cx: HX, cy: HY + 19.5, rx: 2.6, ry: 1.4, fill: '#ff8fa8' });
  } else {
    mouth = h('path', {
      d: M(HX - 8, HY + 15) + Q(HX, HY + 22, HX + 8, HY + 15),
      fill: 'none',
      stroke: INK,
      'stroke-width': 2.6,
      'stroke-linecap': 'round',
    });
  }
  const blush = [-1, 1]
    .map((s) =>
      h('ellipse', { cx: HX + s * 17, cy: HY + 12, rx: 5, ry: 3, fill: '#ff7a8a', opacity: 0.35 }),
    )
    .join('');
  let extras = '';
  if (k.extras.includes('freckles')) {
    extras += [-1, 1]
      .map((s) =>
        [
          [14, 8],
          [18, 6],
          [16, 11],
        ]
          .map(([dx, dy]) =>
            h('circle', {
              cx: HX + s * dx!,
              cy: HY + dy!,
              r: 1.1,
              fill: darken(k.skin, 0.35),
              opacity: 0.8,
            }),
          )
          .join(''),
      )
      .join('');
  }
  if (k.extras.includes('dimples'))
    extras += [-1, 1]
      .map((s) =>
        h('path', {
          d: M(HX + s * 11, HY + 15) + Q(HX + s * 12, HY + 17, HX + s * 11, HY + 19),
          fill: 'none',
          stroke: skinLine,
          'stroke-width': 1.6,
          'stroke-linecap': 'round',
        }),
      )
      .join('');
  if (k.extras.includes('bandage'))
    extras += h(
      'g',
      { transform: `rotate(-24 ${HX + 19} ${HY + 4})` },
      h('rect', {
        x: HX + 13,
        y: HY + 1.5,
        width: 13,
        height: 5.5,
        rx: 2.5,
        fill: '#ffd9b0',
        stroke: '#c48a5a',
        'stroke-width': 1.4,
      }),
      h('path', {
        d: M(HX + 18, HY + 3) + L(HX + 18, HY + 5.5) + M(HX + 21, HY + 3) + L(HX + 21, HY + 5.5),
        stroke: '#c48a5a',
        'stroke-width': 1,
      }),
    );
  if (k.extras.includes('glasses')) {
    extras += [-1, 1]
      .map((s) =>
        h('circle', {
          cx: HX + s * 11,
          cy: HY + 2,
          r: 7.5,
          fill: '#e8f6ff',
          'fill-opacity': 0.25,
          stroke: '#2c5fb8',
          'stroke-width': 2.4,
        }),
      )
      .join('');
    extras += h('path', {
      d:
        M(HX - 3.5, HY + 1) +
        Q(HX, HY - 1.5, HX + 3.5, HY + 1) +
        M(HX - 18.5, HY + 1) +
        L(HX - 26, HY - 1) +
        M(HX + 18.5, HY + 1) +
        L(HX + 26, HY - 1),
      fill: 'none',
      stroke: '#2c5fb8',
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
    });
  }
  return blush + eyes + brows + nose + mouth + extras;
}

function torso(k: Keeper): string {
  const line = outlineOf(k.top, 0.5);
  const d = M(18, 124) + C(18, 100, 34, 90, 60, 90) + C(86, 90, 102, 100, 102, 124) + 'Z';
  let out = h('path', {
    d,
    fill: k.top,
    stroke: line,
    'stroke-width': 3,
    'stroke-linejoin': 'round',
  });
  if (k.extras.includes('hood'))
    out +=
      h('path', {
        d: M(36, 96) + Q(60, 112, 84, 96) + Q(78, 90, 60, 91) + Q(42, 90, 36, 96) + 'Z',
        fill: darken(k.top, 0.15),
        stroke: line,
        'stroke-width': 2.5,
      }) +
      h('path', {
        d: M(54, 104) + L(52, 116) + M(66, 104) + L(68, 116),
        stroke: '#ffffff',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
      });
  if (k.extras.includes('stripes'))
    out += h('path', {
      d: M(26, 108) + Q(60, 100, 94, 108) + M(22, 118) + Q(60, 110, 98, 118),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 4,
      opacity: 0.85,
    });
  if (k.extras.includes('overalls'))
    out +=
      h('path', {
        d: M(40, 124) + L(42, 102) + L(78, 102) + L(80, 124) + 'Z',
        fill: darken(k.top, 0.05),
        stroke: line,
        'stroke-width': 2.5,
      }) +
      h('path', {
        d: M(44, 102) + L(36, 92) + M(76, 102) + L(84, 92),
        stroke: darken(k.top, 0.05),
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }) +
      [44, 76]
        .map((x) =>
          h('circle', {
            cx: x,
            cy: 104,
            r: 2.6,
            fill: '#ffd23f',
            stroke: INK,
            'stroke-width': 1.2,
          }),
        )
        .join('');
  if (k.extras.includes('star-pin'))
    out += h('path', {
      d: roundStarD(80, 104, 5, 6.5, 3.2, -90, 0.2),
      fill: '#ffd23f',
      stroke: INK,
      'stroke-width': 1.6,
    });
  const collar = h('path', {
    d: M(48, 92) + Q(60, 102, 72, 92),
    fill: 'none',
    stroke: line,
    'stroke-width': 2.5,
    'stroke-linecap': 'round',
  });
  return out + collar;
}

export interface AvatarOptions {
  size?: number;
  idPrefix?: string;
  title?: string;
  /** Draw the round badge background and ring (default true). */
  frame?: boolean;
}

/** Keeper avatar portrait as a round badge (viewBox 120 x 120). */
export function renderAvatar(id: string, opts: AvatarOptions = {}): string {
  const k = KEEPERS[id];
  if (!k) throw new Error(`Unknown keeper avatar: ${id}`);
  const prefix = opts.idPrefix ?? `dv-${id}`;
  const sc = scoped(prefix);
  const clip = sc.id('clip');
  const frame = opts.frame ?? true;
  const skinLine = outlineOf(k.skin, 0.45);
  const dots = [
    [24, 30],
    [96, 26],
    [18, 74],
    [102, 70],
    [30, 98],
  ]
    .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 2.5, fill: '#ffffff', opacity: 0.7 }))
    .join('');
  const neck = h('path', {
    d: M(52, 80) + L(52, 94) + Q(60, 98, 68, 94) + L(68, 80) + 'Z',
    fill: darken(k.skin, 0.08),
    stroke: skinLine,
    'stroke-width': 2.5,
  });
  const ears = [-1, 1]
    .map((s) =>
      h('ellipse', {
        cx: HX + s * (HRX + 1),
        cy: HY + 4,
        rx: 5,
        ry: 7,
        fill: k.skin,
        stroke: skinLine,
        'stroke-width': 2.5,
      }),
    )
    .join('');
  const head = h('ellipse', {
    cx: HX,
    cy: HY,
    rx: HRX,
    ry: HRY,
    fill: k.skin,
    stroke: skinLine,
    'stroke-width': 3,
  });
  const portrait = backHair(k) + torso(k) + neck + ears + head + face(k) + frontHair(k);
  const body = frame
    ? h('defs', null, h('clipPath', { id: clip }, h('circle', { cx: 60, cy: 60, r: 56 }))) +
      h('circle', { cx: 60, cy: 60, r: 56, fill: k.bg }) +
      h('g', { 'clip-path': `url(#${clip})` }, dots, portrait) +
      h('circle', { cx: 60, cy: 60, r: 56, fill: 'none', stroke: '#ffffff', 'stroke-width': 4 }) +
      h('circle', { cx: 60, cy: 60, r: 58, fill: 'none', stroke: INK, 'stroke-width': 3 })
    : portrait;
  return svgDoc(
    {
      viewBox: [0, 0, 120, 120],
      width: opts.size,
      height: opts.size,
      className: 'dv-avatar',
      title: opts.title,
      idPrefix: prefix,
      data: { avatar: id },
    },
    body,
  );
}
