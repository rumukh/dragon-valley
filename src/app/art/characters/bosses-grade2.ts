/**
 * Second-grade bosses of the Lower Valley sheet, in the same storybook style as the canonical
 * nine: Long, Broad and Sharp-Eyes (Hundred Hills) and Otesanek (Market Square).
 */
import type { Pt } from '../svg/num';
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
import { flower } from '../glyphs';
import { cloudUnion } from '../dragon/shapes';
import {
  INK,
  arm,
  bodyGrad,
  boot,
  face,
  ground,
  hand,
  sparkles,
  zzz,
  type EyeStyle,
  type BrowStyle,
  type MouthStyle,
} from './kit';
import type { BossState } from './bosses';

type P = (n: string) => string;

const st = (fill: string, k = 0.6, w = 4.5): Record<string, string | number> => ({
  fill,
  stroke: outlineOf(fill, k),
  'stroke-width': w,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

function note(x: number, y: number, s: number, fill = '#6a4ce0'): string {
  return h(
    'g',
    { class: 'dv-twinkle dv-twinkle-2' },
    h('ellipse', {
      cx: x,
      cy: y,
      rx: s * 0.42,
      ry: s * 0.32,
      fill,
      transform: `rotate(-20 ${x} ${y})`,
    }),
    h('path', {
      d:
        M(x + s * 0.36, y - s * 0.08) +
        L(x + s * 0.36, y - s * 1.2) +
        Q(x + s * 0.7, y - s, x + s * 0.9, y - s * 0.7),
      fill: 'none',
      stroke: fill,
      'stroke-width': s * 0.14,
      'stroke-linecap': 'round',
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Long, Broad and Sharp-Eyes (Dlouhy, Siroky a Bystrozraky): three cheerful brothers who love a
// challenge. Answer well and they dance together.

interface Brother {
  cx: number;
  legH: number;
  bodyW: number;
  bodyH: number;
  headR: number;
  skin: string;
  tunic: string;
  trousers: string;
  boots: string;
  /** Round, barrel-shaped body instead of a tall tunic. */
  round?: boolean;
}

interface Pose {
  armL: Pt[];
  armR: Pt[];
  /** Raised foot: lift of the left boot in px (dance). */
  kick?: number;
  tilt?: number;
  lift?: number;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  look?: number;
}

interface BrotherParts {
  back: string;
  head: string;
  front: string;
}

function brother(
  b: Brother,
  pose: Pose,
  g: string,
  hair: (cx: number, cy: number) => string,
  extra = '',
): string {
  const hip = 470 - b.legH;
  const top = hip - b.bodyH;
  const hr = b.headR;
  const hcy = top - hr * 0.78;
  const legW = Math.max(26, b.bodyW * 0.2);
  const gap = b.round ? b.bodyW * 0.22 : b.bodyW * 0.22;
  const kick = pose.kick ?? 0;
  const legs =
    arm(
      [
        { x: b.cx - gap, y: hip - 8 },
        { x: b.cx - gap - kick * 0.5, y: hip + b.legH * 0.5 - kick * 0.3 },
        { x: b.cx - gap - kick * 0.2, y: 452 - kick },
      ],
      legW,
      b.trousers,
    ) +
    arm(
      [
        { x: b.cx + gap, y: hip - 8 },
        { x: b.cx + gap, y: hip + b.legH * 0.5 },
        { x: b.cx + gap, y: 452 },
      ],
      legW,
      b.trousers,
    ) +
    boot(b.cx - gap - kick * 0.2, 470 - kick, legW * 1.7, b.boots, -1) +
    boot(b.cx + gap, 470, legW * 1.7, b.boots, 1);
  const bodyD = b.round
    ? M(b.cx, top) +
      C(b.cx + b.bodyW * 0.62, top, b.cx + b.bodyW * 0.56, hip + 10, b.cx, hip + 10) +
      C(b.cx - b.bodyW * 0.56, hip + 10, b.cx - b.bodyW * 0.62, top, b.cx, top) +
      'Z'
    : M(b.cx - b.bodyW * 0.36, top) +
      L(b.cx + b.bodyW * 0.36, top) +
      Q(b.cx + b.bodyW * 0.5, top + 8, b.cx + b.bodyW * 0.5, top + 30) +
      L(b.cx + b.bodyW * 0.56, hip + 8) +
      Q(b.cx, hip + 20, b.cx - b.bodyW * 0.56, hip + 8) +
      L(b.cx - b.bodyW * 0.5, top + 30) +
      Q(b.cx - b.bodyW * 0.5, top + 8, b.cx - b.bodyW * 0.36, top) +
      'Z';
  const beltY = b.round ? top + b.bodyH * 0.58 : hip - b.bodyH * 0.22;
  const beltW = b.round ? b.bodyW * 0.98 : b.bodyW * 1.02;
  const body =
    h('defs', null, bodyGrad(g, b.tunic, b.cx, (top + hip) / 2, Math.max(b.bodyW, b.bodyH) * 0.6)) +
    h('path', {
      d: bodyD,
      fill: `url(#${g})`,
      stroke: outlineOf(b.tunic, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: roundRectD(b.cx - beltW / 2, beltY - 9, beltW, 18, 8),
      ...st('#7a4f2a', 0.55, 3.5),
    }) +
    h('path', { d: roundRectD(b.cx - 13, beltY - 12, 26, 24, 6), ...st('#ffd23f', 0.55, 3) }) +
    h('path', {
      d: M(b.cx - 14, top + 4) + L(b.cx, top + 26) + L(b.cx + 14, top + 4),
      ...st(lighten(b.tunic, 0.4), 0.55, 3),
    }) +
    extra;
  const head =
    h('ellipse', { cx: b.cx, cy: top + 2, rx: hr * 0.42, ry: 10, fill: darken(b.skin, 0.12) }) +
    h('ellipse', {
      cx: b.cx - hr * 0.98,
      cy: hcy + 4,
      rx: hr * 0.2,
      ry: hr * 0.28,
      ...st(b.skin),
    }) +
    h('ellipse', {
      cx: b.cx + hr * 0.98,
      cy: hcy + 4,
      rx: hr * 0.2,
      ry: hr * 0.28,
      ...st(b.skin),
    }) +
    h('circle', { cx: b.cx, cy: hcy, r: hr, ...st(b.skin) }) +
    hair(b.cx, hcy) +
    face({
      cx: b.cx,
      cy: hcy - hr * 0.02,
      dx: hr * 0.4,
      r: hr * 0.17,
      eyes: pose.eyes,
      brows: pose.brows,
      mouth: pose.mouth,
      my: hcy + hr * 0.5,
      mw: hr * 0.8,
      skin: b.skin,
      blush: 0.5,
      look: pose.look,
    }) +
    h('ellipse', {
      cx: b.cx,
      cy: hcy + hr * 0.22,
      rx: hr * 0.16,
      ry: hr * 0.13,
      ...st(darken(b.skin, 0.08), 0.6, 3),
    });
  const armT = Math.max(24, b.bodyW * 0.17);
  const arms =
    arm(pose.armL, armT, b.tunic) +
    arm(pose.armR, armT, b.tunic) +
    hand(pose.armL[2]!.x, pose.armL[2]!.y, armT * 0.62, b.skin, 180) +
    hand(pose.armR[2]!.x, pose.armR[2]!.y, armT * 0.62, b.skin, 0);
  const parts: BrotherParts = { back: legs + body, head, front: arms };
  const tilt = pose.tilt ?? 0;
  const lift = pose.lift ?? 0;
  return h(
    'g',
    { transform: `translate(0 ${-lift}) rotate(${tilt} ${b.cx} 470)` },
    parts.back,
    parts.head,
    parts.front,
  );
}

function shoulders(b: Brother): { l: Pt; r: Pt; top: number; hip: number } {
  const hip = 470 - b.legH;
  const top = hip - b.bodyH;
  const dx = b.round ? b.bodyW * 0.4 : b.bodyW * 0.44;
  return { l: { x: b.cx - dx, y: top + 26 }, r: { x: b.cx + dx, y: top + 26 }, top, hip };
}

const LONG: Brother = {
  cx: 112,
  legH: 160,
  bodyW: 76,
  bodyH: 170,
  headR: 40,
  skin: '#f2c9a8',
  tunic: '#3fa37a',
  trousers: '#4a5fa8',
  boots: '#7a4f2a',
};
const BROAD: Brother = {
  cx: 392,
  legH: 62,
  bodyW: 176,
  bodyH: 196,
  headR: 46,
  skin: '#e8b48a',
  tunic: '#f08a3a',
  trousers: '#7a5a9e',
  boots: '#6b4a2e',
  round: true,
};
const SHARP: Brother = {
  cx: 252,
  legH: 96,
  bodyW: 92,
  bodyH: 118,
  headR: 46,
  skin: '#f6d5b8',
  tunic: '#6a7be0',
  trousers: '#3f4a7a',
  boots: '#8a5a2e',
};

function longPose(state: BossState): Pose {
  const s = shoulders(LONG);
  const x = LONG.cx;
  if (state === 'start')
    return {
      armL: [s.l, { x: x - 30, y: s.top + 96 }, { x: x + 22, y: s.top + 74 }],
      armR: [s.r, { x: x + 30, y: s.top + 100 }, { x: x - 18, y: s.top + 80 }],
      eyes: 'open',
      brows: 'raised',
      mouth: 'flat',
    };
  if (state === 'warming')
    return {
      armL: [s.l, { x: x - 40, y: s.top + 100 }, { x: x - 30, y: s.top + 160 }],
      armR: [s.r, { x: x + 70, y: s.top - 10 }, { x: x + 56, y: s.top - 90 }],
      eyes: 'open',
      brows: 'soft',
      mouth: 'smile',
    };
  return {
    armL: [s.l, { x: x - 66, y: s.top - 10 }, { x: x - 54, y: s.top - 84 }],
    armR: [s.r, { x: x + 66, y: s.top - 10 }, { x: x + 54, y: s.top - 84 }],
    kick: 46,
    tilt: -5,
    eyes: 'happy',
    brows: 'soft',
    mouth: 'laugh',
  };
}

function broadPose(state: BossState): Pose {
  const s = shoulders(BROAD);
  const x = BROAD.cx;
  if (state === 'start')
    return {
      armL: [s.l, { x: x - 110, y: s.top + 90 }, { x: x - 78, y: s.top + 128 }],
      armR: [s.r, { x: x + 110, y: s.top + 90 }, { x: x + 78, y: s.top + 128 }],
      eyes: 'open',
      brows: 'raised',
      mouth: 'pout',
      look: -1,
    };
  if (state === 'warming')
    return {
      armL: [s.l, { x: x - 104, y: s.top + 96 }, { x: x - 30, y: s.top + 110 }],
      armR: [s.r, { x: x + 100, y: s.top + 20 }, { x: x + 92, y: s.top - 54 }],
      eyes: 'open',
      brows: 'soft',
      mouth: 'grin',
    };
  return {
    armL: [s.l, { x: x - 100, y: s.top - 4 }, { x: x - 92, y: s.top - 80 }],
    armR: [s.r, { x: x + 96, y: s.top - 4 }, { x: x + 80, y: s.top - 80 }],
    lift: 14,
    tilt: 4,
    eyes: 'happy',
    brows: 'soft',
    mouth: 'laugh',
  };
}

function sharpPose(state: BossState): Pose {
  const s = shoulders(SHARP);
  const x = SHARP.cx;
  const hcy = s.top - SHARP.headR * 0.78;
  if (state === 'start')
    return {
      armL: [s.l, { x: x - 58, y: s.top + 60 }, { x: x - 44, y: s.top + 100 }],
      armR: [s.r, { x: x + 64, y: s.top - 10 }, { x: x + 30, y: hcy - 30 }],
      eyes: 'squint',
      brows: 'raised',
      mouth: 'flat',
      look: -1,
    };
  if (state === 'warming')
    return {
      armL: [s.l, { x: x - 70, y: s.top + 6 }, { x: x - 120, y: s.top - 6 }],
      armR: [s.r, { x: x + 56, y: s.top + 60 }, { x: x + 40, y: s.top + 100 }],
      eyes: 'open',
      brows: 'soft',
      mouth: 'smile',
      look: -1,
    };
  return {
    armL: [s.l, { x: x - 70, y: s.top - 6 }, { x: x - 60, y: s.top - 76 }],
    armR: [s.r, { x: x + 70, y: s.top - 6 }, { x: x + 60, y: s.top - 76 }],
    kick: 34,
    lift: 8,
    tilt: 3,
    eyes: 'happy',
    brows: 'soft',
    mouth: 'laugh',
  };
}

export function longBroadSharpEyes(state: BossState, p: P): string {
  const won = state === 'won';
  // Long: a tall felt cap with a feather, so his stretch reads at a glance.
  const longHair = (cx: number, cy: number): string =>
    h('path', {
      d:
        M(cx - 40, cy - 14) +
        C(cx - 36, cy - 60, cx - 8, cy - 112, cx + 26, cy - 118) +
        Q(cx + 30, cy - 100, cx + 18, cy - 86) +
        C(cx + 34, cy - 62, cx + 42, cy - 34, cx + 40, cy - 14) +
        Q(cx, cy - 28, cx - 40, cy - 14) +
        'Z',
      ...st('#e0533a', 0.55),
    }) +
    h('path', {
      d: M(cx - 38, cy - 22) + Q(cx, cy - 36, cx + 38, cy - 22),
      fill: 'none',
      stroke: '#ffd23f',
      'stroke-width': 7,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d:
        M(cx + 30, cy - 30) +
        C(cx + 64, cy - 60, cx + 70, cy - 96, cx + 52, cy - 110) +
        C(cx + 50, cy - 80, cx + 40, cy - 54, cx + 30, cy - 30) +
        'Z',
      ...st('#5cc4a8', 0.55, 3),
    });
  // Broad: a round bowl haircut.
  const broadHair = (cx: number, cy: number): string =>
    h('path', {
      d:
        M(cx - 48, cy - 2) +
        C(cx - 52, cy - 58, cx + 52, cy - 58, cx + 48, cy - 2) +
        Q(cx + 30, cy - 20, cx + 14, cy - 18) +
        Q(cx, cy - 28, cx - 14, cy - 18) +
        Q(cx - 30, cy - 20, cx - 48, cy - 2) +
        'Z',
      ...st('#8a5a2e', 0.5),
    });
  // Sharp-Eyes: curly hair and a sunny headband with a star; his far-seeing eyes twinkle.
  const sharpHair = (cx: number, cy: number): string =>
    cloudUnion(
      [
        { x: cx - 34, y: cy - 30, r: 18 },
        { x: cx - 10, y: cy - 44, r: 21 },
        { x: cx + 18, y: cy - 42, r: 20 },
        { x: cx + 38, y: cy - 24, r: 16 },
      ],
      '#3f2a1e',
      '#22140c',
      4,
    ) +
    h('path', {
      d: M(cx - 46, cy - 18) + Q(cx, cy - 40, cx + 46, cy - 18),
      fill: 'none',
      stroke: '#ffd23f',
      'stroke-width': 10,
      'stroke-linecap': 'round',
    }) +
    flower(cx + 30, cy - 27, 8, 5, '#fff3b0', '#e0533a', INK, 1.5);
  const broadBelly = h('path', {
    d: M(BROAD.cx - 34, 330) + Q(BROAD.cx, 352, BROAD.cx + 34, 330),
    fill: 'none',
    stroke: darken(BROAD.tunic, 0.25),
    'stroke-width': 4,
    'stroke-linecap': 'round',
    opacity: 0.5,
  });
  const twinkle =
    state !== 'start'
      ? sparkles(
          [
            [SHARP.cx - 46, 168, 9],
            [SHARP.cx + 50, 166, 9],
          ],
          '#fff3b0',
        )
      : '';
  return (
    ground(256, 236) +
    // the trio is wider than one boss, so it is drawn a little smaller to fit the frame
    h(
      'g',
      { transform: 'translate(256 474) scale(0.84) translate(-256 -474)' },
      brother(LONG, longPose(state), p('long'), longHair) +
        brother(BROAD, broadPose(state), p('broad'), broadHair, broadBelly) +
        brother(SHARP, sharpPose(state), p('sharp'), sharpHair) +
        twinkle,
    ) +
    (won
      ? sparkles([
          [256, 46, 15],
          [470, 120, 12],
          [40, 230, 11],
        ]) +
        note(196, 70, 30) +
        note(330, 92, 26, '#e0533a')
      : state === 'warming'
        ? note(330, 120, 24)
        : '')
  );
}

// ---------------------------------------------------------------------------------------------
// Otesanek: a hungry little log-baby from the market. Share the right amounts and he eats his
// fill, pats his round tummy and falls fast asleep.

function bowl(x: number, y: number, s: number, full: boolean): string {
  return (
    (full
      ? h('path', {
          d: M(x - 40 * s, y) + Q(x, y - 34 * s, x + 40 * s, y) + 'Z',
          ...st('#fff1d6', 0.5, 3),
        }) +
        h('circle', { cx: x - 10 * s, cy: y - 12 * s, r: 5 * s, fill: '#ff8fa8' }) +
        h('circle', { cx: x + 12 * s, cy: y - 10 * s, r: 5 * s, fill: '#6a4ce0', opacity: 0.8 })
      : '') +
    h('path', {
      d:
        M(x - 46 * s, y) +
        L(x + 46 * s, y) +
        Q(x + 42 * s, y + 38 * s, x, y + 40 * s) +
        Q(x - 42 * s, y + 38 * s, x - 46 * s, y) +
        'Z',
      ...st('#c98a4a', 0.55, 4),
    }) +
    h('path', {
      d: M(x - 30 * s, y + 14 * s) + Q(x, y + 22 * s, x + 30 * s, y + 14 * s),
      fill: 'none',
      stroke: '#e0533a',
      'stroke-width': 4 * s,
      'stroke-linecap': 'round',
    })
  );
}

function spoon(x: number, y: number, rot: number): string {
  return h(
    'g',
    { transform: `translate(${x} ${y}) rotate(${rot})` },
    h('path', { d: roundRectD(-4, -4, 8, 70, 4), ...st('#d9a45a', 0.55, 3) }),
    h('ellipse', { cx: 0, cy: -16, rx: 13, ry: 17, ...st('#d9a45a', 0.55, 3) }),
  );
}

export function otesanek(state: BossState, p: P): string {
  const bark = '#a8713f';
  const wood = '#e9c48a';
  const g = p('log');
  const asleep = state === 'won';
  const hungry = state === 'start';
  const logD =
    M(256, 128) +
    C(340, 128, 362, 190, 366, 260) +
    C(372, 350, 392, 420, 380, 456) +
    Q(256, 482, 132, 456) +
    C(120, 420, 140, 350, 146, 260) +
    C(150, 190, 172, 128, 256, 128) +
    'Z';
  const barkLines =
    M(170, 220) +
    Q(162, 300, 172, 380) +
    M(342, 220) +
    Q(352, 300, 342, 380) +
    M(152, 400) +
    Q(160, 430, 170, 452) +
    M(360, 400) +
    Q(354, 430, 344, 452);
  const feet =
    h('ellipse', { cx: 196, cy: 462, rx: 46, ry: 22, ...st(lighten(bark, 0.1)) }) +
    h('ellipse', { cx: 316, cy: 462, rx: 46, ry: 22, ...st(lighten(bark, 0.1)) }) +
    [184, 198, 212, 304, 318, 332]
      .map((x) => h('circle', { cx: x, cy: 452, r: 4, fill: darken(bark, 0.15), opacity: 0.6 }))
      .join('');
  const tummyR = asleep ? 1.08 : 1;
  const body =
    h('defs', null, bodyGrad(g, bark, 256, 300, 200)) +
    feet +
    h('path', {
      d: logD,
      fill: `url(#${g})`,
      stroke: outlineOf(bark, 0.5),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: barkLines,
      fill: 'none',
      stroke: darken(bark, 0.25),
      'stroke-width': 4,
      'stroke-linecap': 'round',
      opacity: 0.55,
    }) +
    // round heartwood tummy with growth rings
    h('ellipse', { cx: 256, cy: 382, rx: 82 * tummyR, ry: 66 * tummyR, ...st(wood, 0.5) }) +
    [0.7, 0.42, 0.16]
      .map((k) =>
        h('ellipse', {
          cx: 256,
          cy: 384,
          rx: 82 * tummyR * k,
          ry: 66 * tummyR * k,
          fill: 'none',
          stroke: darken(wood, 0.22),
          'stroke-width': 3,
          opacity: 0.6,
        }),
      )
      .join('') +
    // polka-dot bib
    h('path', {
      d: M(196, 296) + Q(256, 286, 316, 296) + Q(318, 334, 256, 344) + Q(194, 334, 196, 296) + 'Z',
      ...st('#ffffff', 0.45, 3.5),
    }) +
    [
      [222, 308],
      [256, 316],
      [290, 308],
      [240, 330],
      [272, 330],
    ]
      .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 4.5, fill: '#e0533a' }))
      .join('') +
    // knot hole and a little side twig
    h('ellipse', { cx: 168, cy: 316, rx: 9, ry: 13, ...st(darken(bark, 0.2), 0.5, 3) }) +
    h('path', {
      d: M(360, 200) + Q(386, 190, 398, 168),
      fill: 'none',
      stroke: bark,
      'stroke-width': 9,
      'stroke-linecap': 'round',
    }) +
    h('ellipse', {
      cx: 402,
      cy: 160,
      rx: 14,
      ry: 8,
      transform: 'rotate(-40 402 160)',
      ...st('#7fc95a', 0.5, 3),
    });
  // twig sprouts and leaves on top of his head, like baby curls
  const sprouts =
    h('path', {
      d:
        M(232, 136) +
        Q(220, 100, 196, 92) +
        M(256, 130) +
        Q(258, 92, 252, 70) +
        M(280, 136) +
        Q(294, 104, 318, 98),
      fill: 'none',
      stroke: darken(bark, 0.1),
      'stroke-width': 8,
      'stroke-linecap': 'round',
    }) +
    [
      [190, 88, -30],
      [250, 64, 10],
      [324, 94, 30],
      [270, 92, 50],
    ]
      .map(([x, y, a]) =>
        h('ellipse', {
          cx: x!,
          cy: y!,
          rx: 17,
          ry: 9,
          transform: `rotate(${a} ${x} ${y})`,
          ...st('#7fc95a', 0.5, 3),
        }),
      )
      .join('') +
    // the cut top of the log
    h('ellipse', { cx: 256, cy: 140, rx: 50, ry: 12, ...st(wood, 0.5, 3) }) +
    h('ellipse', {
      cx: 256,
      cy: 140,
      rx: 26,
      ry: 6,
      fill: 'none',
      stroke: darken(wood, 0.22),
      'stroke-width': 2.5,
    });
  const faceArt = face({
    cx: 256,
    cy: 212,
    dx: 44,
    r: 15,
    eyes: asleep ? 'closed' : hungry ? 'wide' : 'happy',
    brows: hungry ? 'worried' : 'soft',
    mouth: asleep ? 'snore' : hungry ? 'o' : 'grin',
    my: 258,
    mw: hungry ? 104 : 84,
    skin: bark,
    blush: 0.65,
    browColor: darken(bark, 0.45),
  });
  let arms = '';
  let props = '';
  const armFill = lighten(bark, 0.08);
  const handFill = lighten(bark, 0.2);
  if (hungry) {
    // holds out an empty bowl; his tummy rumbles
    arms =
      arm(
        [
          { x: 150, y: 290 },
          { x: 108, y: 330 },
          { x: 96, y: 262 },
        ],
        34,
        armFill,
      ) +
      hand(96, 254, 20, handFill, -90) +
      arm(
        [
          { x: 362, y: 290 },
          { x: 404, y: 330 },
          { x: 412, y: 262 },
        ],
        34,
        armFill,
      ) +
      hand(412, 254, 20, handFill, -90);
    props =
      bowl(96, 226, 0.8, false) +
      h('path', {
        d:
          M(166, 400) +
          Q(152, 412, 166, 424) +
          M(346, 400) +
          Q(360, 412, 346, 424) +
          M(152, 380) +
          Q(136, 400, 152, 420),
        fill: 'none',
        stroke: '#6a4ce0',
        'stroke-width': 4,
        'stroke-linecap': 'round',
        opacity: 0.7,
      });
  } else if (state === 'warming') {
    // a full bowl of porridge in one arm, a spoon to his mouth
    arms =
      arm(
        [
          { x: 150, y: 290 },
          { x: 112, y: 370 },
          { x: 196, y: 400 },
        ],
        34,
        armFill,
      ) +
      hand(200, 400, 20, handFill, 0) +
      arm(
        [
          { x: 362, y: 290 },
          { x: 406, y: 300 },
          { x: 330, y: 256 },
        ],
        34,
        armFill,
      ) +
      hand(326, 254, 20, handFill, 180);
    props =
      bowl(176, 382, 0.85, true) +
      spoon(318, 258, 40) +
      h('path', {
        d: M(150, 330) + Q(140, 314, 150, 300) + M(176, 326) + Q(166, 308, 176, 292),
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 4,
        'stroke-linecap': 'round',
        opacity: 0.85,
      });
  } else {
    // full and fast asleep, paws on his round tummy, the empty bowl and spoon beside him
    arms =
      arm(
        [
          { x: 150, y: 290 },
          { x: 140, y: 370 },
          { x: 214, y: 374 },
        ],
        34,
        armFill,
      ) +
      hand(218, 374, 20, handFill, 0) +
      arm(
        [
          { x: 362, y: 290 },
          { x: 372, y: 370 },
          { x: 298, y: 374 },
        ],
        34,
        armFill,
      ) +
      hand(294, 374, 20, handFill, 180);
    props = bowl(452, 440, 0.6, false) + spoon(420, 452, 70) + zzz(352, 96, 32);
  }
  return (
    ground(256, 200) +
    (asleep ? props : '') +
    h(
      'g',
      { transform: asleep ? 'rotate(-5 256 470)' : '' },
      body,
      sprouts,
      faceArt,
      arms,
      asleep ? '' : props,
    )
  );
}
