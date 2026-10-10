/**
 * First-grade bosses of the Lower Valley sheet, after the Will-o'-the-Wisps, in the same storybook
 * style as the canonical nine: the House Goblin (skritek, Mushroom Hollow) and Kasparek the
 * jester (Rainbow Ford).
 */
import type { Pt } from '../svg/num';
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
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
  tears,
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

interface Pose {
  armL: Pt[];
  armR: Pt[];
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  look?: number;
  /** Lift of the left boot (a kick or a jig step). */
  kick?: number;
  tilt?: number;
  lift?: number;
}

// ---------------------------------------------------------------------------------------------
// The House Goblin (skritek): a little bearded house spirit in a floppy red cap who hides odd
// things in his sack. Answer right and he gives them back, one less each time, then dances a jig.

/** Little household things the goblin hid: a spoon, a button, a sock, a key, a thimble. */
function trinket(kind: number, x: number, y: number, s = 1, rot = 0): string {
  const t = (body: string): string =>
    h('g', { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` }, body);
  switch (kind % 5) {
    case 0: // wooden spoon
      return t(
        h('path', { d: roundRectD(-3.5, -2, 7, 40, 3.5), ...st('#d9a45a', 0.55, 3) }) +
          h('ellipse', { cx: 0, cy: -12, rx: 10, ry: 14, ...st('#d9a45a', 0.55, 3) }) +
          h('ellipse', { cx: -2, cy: -15, rx: 3.5, ry: 6, fill: '#ffffff', opacity: 0.4 }),
      );
    case 1: // big blue button
      return t(
        h('circle', { cx: 0, cy: 0, r: 15, ...st('#4a8ef0', 0.55, 3) }) +
          h('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#2e62b8', 'stroke-width': 2 }) +
          [
            [-4, -4],
            [4, -4],
            [-4, 4],
            [4, 4],
          ]
            .map(([dx, dy]) => h('circle', { cx: dx!, cy: dy!, r: 2.2, fill: '#1f3f80' }))
            .join(''),
      );
    case 2: // striped sock
      return t(
        h('path', {
          d:
            M(-8, -22) +
            L(8, -22) +
            L(8, 6) +
            Q(22, 8, 22, 18) +
            Q(20, 26, 4, 24) +
            Q(-8, 22, -8, 10) +
            'Z',
          ...st('#ff8f6b', 0.55, 3),
        }) +
          h('path', {
            d: M(-8, -12) + L(8, -12) + M(-8, -2) + L(8, -2),
            stroke: '#ffffff',
            'stroke-width': 4,
          }) +
          h('path', { d: roundRectD(-10, -26, 20, 7, 3), ...st('#fff3d6', 0.55, 2.5) }),
      );
    case 3: // golden key
      return t(
        h('circle', { cx: 0, cy: -12, r: 9, fill: 'none', stroke: '#e0a020', 'stroke-width': 6 }) +
          h('path', {
            d: M(0, -3) + L(0, 24) + M(0, 14) + L(8, 14) + M(0, 21) + L(6, 21),
            fill: 'none',
            stroke: '#e0a020',
            'stroke-width': 5,
            'stroke-linecap': 'round',
          }) +
          h('circle', { cx: -3, cy: -15, r: 2, fill: '#fff6c8' }),
      );
    default: // silver thimble
      return t(
        h('path', {
          d: M(-11, 12) + L(-9, -6) + Q(0, -18, 9, -6) + L(11, 12) + 'Z',
          ...st('#c8ccd8', 0.55, 3),
        }) +
          [-4, 1, 6]
            .map((yy) =>
              h('path', {
                d: M(-8, yy) + L(8, yy),
                stroke: '#8a90a6',
                'stroke-width': 1.6,
                'stroke-dasharray': '1.5 2.5',
              }),
            )
            .join('') +
          h('path', { d: roundRectD(-12, 9, 24, 5, 2), ...st('#aab0c2', 0.55, 2.5) }),
      );
  }
}

/** The burlap sack; `open` shows the mouth with things peeking out. */
function sack(x: number, y: number, s: number, open: boolean, g: string): string {
  const bag = '#c9a26a';
  const d =
    M(x - 44 * s, y - 50 * s) +
    C(x - 78 * s, y - 20 * s, x - 70 * s, y + 46 * s, x, y + 50 * s) +
    C(x + 70 * s, y + 46 * s, x + 78 * s, y - 20 * s, x + 44 * s, y - 50 * s) +
    Q(x, y - 40 * s, x - 44 * s, y - 50 * s) +
    'Z';
  const peek = open
    ? trinket(0, x - 18 * s, y - 62 * s, s, -20) +
      trinket(2, x + 22 * s, y - 60 * s, s * 0.9, 18) +
      h('ellipse', { cx: x, cy: y - 46 * s, rx: 42 * s, ry: 10 * s, fill: darken(bag, 0.45) })
    : h('path', {
        d: M(x - 36 * s, y - 52 * s) + Q(x, y - 70 * s, x + 36 * s, y - 52 * s),
        ...st(lighten(bag, 0.1), 0.55, 3.5),
      }) +
      h('path', {
        d: M(x - 30 * s, y - 40 * s) + Q(x, y - 30 * s, x + 30 * s, y - 40 * s),
        fill: 'none',
        stroke: '#b0442e',
        'stroke-width': 6 * s,
        'stroke-linecap': 'round',
      });
  return (
    (open ? peek : '') +
    h('defs', null, bodyGrad(g, bag, x, y, 70 * s)) +
    h('path', {
      d,
      fill: `url(#${g})`,
      stroke: outlineOf(bag, 0.55),
      'stroke-width': 4.5,
      'stroke-linejoin': 'round',
    }) +
    // patch and burlap stitches
    h('path', {
      d: roundRectD(x + 10 * s, y + 4 * s, 28 * s, 24 * s, 4),
      ...st('#8fbf5a', 0.55, 3),
      transform: `rotate(-8 ${x + 24 * s} ${y + 16 * s})`,
    }) +
    h('path', {
      d: M(x + 13 * s, y + 8 * s) + L(x + 36 * s, y + 6 * s),
      stroke: '#ffffff',
      'stroke-width': 2,
      'stroke-dasharray': '4 4',
      opacity: 0.8,
    }) +
    h('path', {
      d: M(x - 46 * s, y - 4 * s) + Q(x - 30 * s, y + 6 * s, x - 14 * s, y - 2 * s),
      fill: 'none',
      stroke: darken(bag, 0.3),
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.6,
    }) +
    (open ? '' : peek)
  );
}

function goblinPose(state: BossState): Pose {
  if (state === 'start')
    // hugs his bulging sack and puts a finger to his lips: shh, it is all hidden
    return {
      armL: [
        { x: 214, y: 316 },
        { x: 176, y: 372 },
        { x: 222, y: 400 },
      ],
      armR: [
        { x: 298, y: 316 },
        { x: 330, y: 296 },
        { x: 296, y: 254 },
      ],
      eyes: 'side',
      brows: 'raised',
      mouth: 'pout',
      look: -1,
    };
  if (state === 'warming')
    // holds out one returned thing; the sack sits open beside him
    return {
      armL: [
        { x: 214, y: 316 },
        { x: 178, y: 360 },
        { x: 150, y: 398 },
      ],
      armR: [
        { x: 298, y: 316 },
        { x: 352, y: 320 },
        { x: 392, y: 282 },
      ],
      eyes: 'open',
      brows: 'soft',
      mouth: 'smile',
      look: 1,
    };
  // a happy jig: arms up, one boot kicking
  return {
    armL: [
      { x: 214, y: 316 },
      { x: 160, y: 290 },
      { x: 140, y: 230 },
    ],
    armR: [
      { x: 298, y: 316 },
      { x: 352, y: 290 },
      { x: 372, y: 230 },
    ],
    eyes: 'happy',
    brows: 'raised',
    mouth: 'laugh',
    kick: 34,
    tilt: -6,
    lift: 10,
  };
}

export function skritek(state: BossState, p: P): string {
  const skin = '#f2c39a';
  const tunic = '#5f9e4a';
  const trousers = '#7a5a3a';
  const boots = '#8a4a2a';
  const cap = '#d9443a';
  const beard = '#efe6d8';
  const pose = goblinPose(state);
  const kick = pose.kick ?? 0;
  const cx = 256;
  const hip = 418;
  const top = 300;
  const hcy = 214;
  const hr = 74;
  const g = p('tunic');
  const legs =
    arm(
      [
        { x: cx - 26, y: hip - 6 },
        { x: cx - 30 - kick * 0.4, y: hip + 22 - kick * 0.4 },
        { x: cx - 30 - kick * 0.8, y: 454 - kick },
      ],
      28,
      trousers,
    ) +
    arm(
      [
        { x: cx + 26, y: hip - 6 },
        { x: cx + 28, y: hip + 22 },
        { x: cx + 28, y: 454 },
      ],
      28,
      trousers,
    ) +
    // pointed curly-toed slippers
    boot(cx - 30 - kick * 0.8, 470 - kick, 50, boots, -1) +
    boot(cx + 28, 470, 50, boots, 1) +
    h('path', {
      d:
        M(cx - 64 - kick * 0.8, 452 - kick) +
        Q(cx - 76 - kick * 0.8, 444 - kick, cx - 70 - kick * 0.8, 436 - kick),
      fill: 'none',
      stroke: boots,
      'stroke-width': 6,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(cx + 62, 452) + Q(cx + 74, 444, cx + 68, 436),
      fill: 'none',
      stroke: boots,
      'stroke-width': 6,
      'stroke-linecap': 'round',
    });
  const bodyD =
    M(cx - 52, top) +
    C(cx - 92, top + 40, cx - 90, hip + 10, cx - 60, hip + 14) +
    Q(cx, hip + 30, cx + 60, hip + 14) +
    C(cx + 90, hip + 10, cx + 92, top + 40, cx + 52, top) +
    Q(cx, top - 14, cx - 52, top) +
    'Z';
  const body =
    h('defs', null, bodyGrad(g, tunic, cx, 360, 100)) +
    h('path', {
      d: bodyD,
      fill: `url(#${g})`,
      stroke: outlineOf(tunic, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    // leaf-cut hem and a rope belt with a little pouch
    h('path', {
      d:
        M(cx - 72, hip) +
        Q(cx - 58, hip + 22, cx - 44, hip + 8) +
        Q(cx - 30, hip + 28, cx - 14, hip + 12) +
        Q(cx, hip + 30, cx + 14, hip + 12) +
        Q(cx + 30, hip + 28, cx + 44, hip + 8) +
        Q(cx + 58, hip + 22, cx + 72, hip),
      fill: 'none',
      stroke: darken(tunic, 0.3),
      'stroke-width': 4,
      'stroke-linecap': 'round',
      opacity: 0.6,
    }) +
    h('path', {
      d: M(cx - 82, 372) + Q(cx, 392, cx + 82, 372),
      fill: 'none',
      stroke: '#c9a26a',
      'stroke-width': 9,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(cx + 34, 384) + Q(cx + 54, 380, cx + 58, 398) + Q(cx + 48, 420, cx + 30, 410) + 'Z',
      ...st('#b07a46', 0.55, 3),
    }) +
    [0, 1, 2]
      .map((i) => h('circle', { cx: cx - 6, cy: 324 + i * 20, r: 5, ...st('#ffd23f', 0.55, 2) }))
      .join('');
  // big pointed ears, round head, bulbous nose and a bushy beard
  const ears = [-1, 1]
    .map(
      (s) =>
        h('path', {
          d:
            M(cx + s * hr * 0.86, hcy - 18) +
            Q(cx + s * (hr + 50), hcy - 46, cx + s * (hr + 40), hcy - 6) +
            Q(cx + s * (hr + 24), hcy + 26, cx + s * hr * 0.86, hcy + 22) +
            'Z',
          ...st(skin),
        }) +
        h('path', {
          d:
            M(cx + s * (hr + 4), hcy - 10) +
            Q(cx + s * (hr + 28), hcy - 24, cx + s * (hr + 26), hcy + 4),
          fill: 'none',
          stroke: '#ff9fa8',
          'stroke-width': 5,
          'stroke-linecap': 'round',
          opacity: 0.7,
        }),
    )
    .join('');
  const beardArt = cloudUnion(
    [
      { x: cx - 50, y: hcy + 50, r: 26 },
      { x: cx - 24, y: hcy + 72, r: 30 },
      { x: cx + 10, y: hcy + 80, r: 32 },
      { x: cx + 42, y: hcy + 64, r: 28 },
      { x: cx + 56, y: hcy + 42, r: 22 },
      { x: cx - 60, y: hcy + 30, r: 18 },
      { x: cx + 66, y: hcy + 24, r: 16 },
    ],
    beard,
    outlineOf(beard, 0.55),
    4.5,
  );
  const capD =
    M(cx - hr - 8, hcy - 24) +
    C(cx - hr + 4, hcy - 110, cx + 20, hcy - 146, cx + 92, hcy - 150) +
    C(cx + 136, hcy - 152, cx + 162, hcy - 112, cx + 150, hcy - 82) +
    C(cx + 120, hcy - 108, cx + 90, hcy - 100, cx + hr + 6, hcy - 26) +
    Q(cx, hcy - 52, cx - hr - 8, hcy - 24) +
    'Z';
  const capArt =
    h('path', { d: capD, ...st(cap, 0.55, 5) }) +
    h('path', {
      d: M(cx - 30, hcy - 92) + Q(cx + 20, hcy - 128, cx + 80, hcy - 134),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 7,
      'stroke-linecap': 'round',
      opacity: 0.35,
    }) +
    // a darned patch and a pompom
    h('path', {
      d: roundRectD(cx + 6, hcy - 92, 30, 26, 5),
      ...st('#ffd23f', 0.55, 3),
      transform: `rotate(-14 ${cx + 21} ${hcy - 79})`,
    }) +
    h('path', {
      d: M(cx + 12, hcy - 84) + L(cx + 32, hcy - 80) + M(cx + 10, hcy - 74) + L(cx + 30, hcy - 70),
      stroke: '#b0442e',
      'stroke-width': 2,
      'stroke-dasharray': '3 3',
    }) +
    cloudUnion(
      [
        { x: cx + 152, y: hcy - 78, r: 14 },
        { x: cx + 164, y: hcy - 66, r: 12 },
        { x: cx + 144, y: hcy - 64, r: 11 },
      ],
      '#fffaf0',
      '#c8bba6',
      3.5,
    ) +
    h('path', {
      d: M(cx - hr - 10, hcy - 26) + Q(cx, hcy - 58, cx + hr + 8, hcy - 28),
      fill: 'none',
      stroke: darken(cap, 0.25),
      'stroke-width': 12,
      'stroke-linecap': 'round',
    });
  const head =
    ears +
    h('circle', { cx, cy: hcy, r: hr, ...st(skin) }) +
    beardArt +
    face({
      cx,
      cy: hcy - 6,
      dx: 28,
      r: 12,
      eyes: pose.eyes,
      brows: pose.brows,
      mouth: pose.mouth,
      my: hcy + 40,
      mw: 44,
      skin,
      blush: 0.55,
      browColor: '#bfb3a2',
      look: pose.look,
    }) +
    h('ellipse', { cx, cy: hcy + 18, rx: 18, ry: 15, ...st(darken(skin, 0.1), 0.6, 3.5) }) +
    h('ellipse', { cx: cx - 6, cy: hcy + 12, rx: 6, ry: 4, fill: '#ffffff', opacity: 0.45 }) +
    // moustache curls over the mouth corners
    h('path', {
      d:
        M(cx - 4, hcy + 32) +
        Q(cx - 22, hcy + 24, cx - 36, hcy + 34) +
        Q(cx - 28, hcy + 42, cx - 4, hcy + 36) +
        M(cx + 4, hcy + 32) +
        Q(cx + 22, hcy + 24, cx + 36, hcy + 34) +
        Q(cx + 28, hcy + 42, cx + 4, hcy + 36),
      ...st(beard, 0.55, 3),
    }) +
    capArt;
  const arms =
    arm(pose.armL, 26, tunic) +
    arm(pose.armR, 26, tunic) +
    hand(pose.armL[2]!.x, pose.armL[2]!.y, 16, skin, 180) +
    hand(pose.armR[2]!.x, pose.armR[2]!.y, 16, skin, 0);
  let behind = '';
  let front = '';
  let air = '';
  if (state === 'start') {
    // the stuffed sack hugged tight, a key and a sock poking out of it
    front =
      trinket(3, cx - 74, 318, 0.9, -30) +
      trinket(2, cx - 18, 316, 0.9, 12) +
      sack(cx - 40, 382, 0.78, false, p('sack')) +
      // a "shh" finger in front of the lips
      h('path', {
        d: roundRectD(cx + 34, hcy + 6, 12, 40, 6),
        ...st(skin, 0.6, 3.5),
        transform: `rotate(-20 ${cx + 40} ${hcy + 26})`,
      });
    air = h(
      'g',
      { class: 'dv-question' },
      h('path', {
        d: M(392, 176) + Q(404, 168, 416, 176) + M(400, 196) + Q(416, 186, 430, 196),
        fill: 'none',
        stroke: '#6a4ce0',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
    );
  } else if (state === 'warming') {
    // the sack sits open; three things already back in a row, one more held out
    behind =
      sack(92, 420, 0.7, true, p('sack')) +
      trinket(1, 360, 448, 0.9) +
      trinket(4, 404, 450, 0.9) +
      trinket(0, 446, 448, 0.8, 70);
    front = trinket(1, 404, 262, 1.1, 0);
    air = sparkles([[430, 230, 10]]);
  } else {
    // everything is back, lined up one less each time: 4, 3, 2, 1
    const rows: Array<[number, number]> = [
      [0, 4],
      [1, 3],
      [2, 2],
      [3, 1],
    ];
    behind =
      sack(70, 440, 0.55, true, p('sack')) +
      rows
        .map(([kind, n], r) =>
          Array.from({ length: n }, (_, i) =>
            trinket(
              kind === 0 ? 1 : kind === 1 ? 0 : kind === 2 ? 4 : 2,
              360 + i * 30 + r * 2,
              360 + r * 30,
              0.62,
              kind === 1 ? 35 : 0,
            ),
          ).join(''),
        )
        .join('');
    air =
      sparkles([
        [256, 40, 15],
        [80, 150, 12],
        [462, 120, 12],
      ]) +
      note(110, 96, 30) +
      note(420, 72, 26, '#e0533a');
  }
  const tilt = pose.tilt ?? 0;
  const lift = pose.lift ?? 0;
  return (
    ground(256, 200) +
    behind +
    h(
      'g',
      { transform: `translate(0 ${-lift}) rotate(${tilt} ${cx} 470)` },
      legs,
      body,
      head,
      arms,
      front,
    ) +
    air
  );
}

// ---------------------------------------------------------------------------------------------
// Kasparek: the merry puppet jester of the Czech puppet theatre, in a red-and-yellow suit and a
// floppy cap with a bell. He keeps a straight face at first; right answers tickle him until he
// laughs out loud.

function bell(x: number, y: number, r: number): string {
  return (
    h('circle', { cx: x, cy: y, r, ...st('#ffd23f', 0.5, 3) }) +
    h('path', {
      d: M(x - r * 0.7, y + r * 0.2) + L(x + r * 0.7, y + r * 0.2),
      stroke: '#a8740a',
      'stroke-width': 2,
    }) +
    h('circle', { cx: x, cy: y + r * 0.55, r: r * 0.18, fill: '#7a5208' }) +
    h('circle', { cx: x - r * 0.35, cy: y - r * 0.35, r: r * 0.25, fill: '#ffffff', opacity: 0.6 })
  );
}

function jingle(x: number, y: number, s: number): string {
  return h('path', {
    d:
      M(x - s, y - s * 0.6) +
      Q(x - s * 1.4, y, x - s, y + s * 0.6) +
      M(x + s, y - s * 0.6) +
      Q(x + s * 1.4, y, x + s, y + s * 0.6),
    fill: 'none',
    stroke: '#e0a020',
    'stroke-width': 3,
    'stroke-linecap': 'round',
    class: 'dv-twinkle dv-twinkle-1',
  });
}

/** A short "ha" laugh burst: a speech-bubble-like puff with a big open grin mark. */
function haBurst(x: number, y: number, s: number, cls: string): string {
  return h(
    'g',
    { class: cls },
    h('path', {
      d:
        M(x - s, y) +
        L(x - s * 0.5, y - s * 0.3) +
        L(x - s * 0.4, y - s * 0.9) +
        L(x, y - s * 0.5) +
        L(x + s * 0.5, y - s * 0.9) +
        L(x + s * 0.55, y - s * 0.3) +
        L(x + s, y) +
        L(x + s * 0.55, y + s * 0.35) +
        L(x + s * 0.4, y + s * 0.9) +
        L(x, y + s * 0.5) +
        L(x - s * 0.45, y + s * 0.9) +
        L(x - s * 0.55, y + s * 0.35) +
        'Z',
      ...st('#fff3b0', 0.5, 3),
    }),
    h('path', {
      d: M(x - s * 0.4, y - s * 0.12) + Q(x, y + s * 0.5, x + s * 0.4, y - s * 0.12) + 'Z',
      fill: '#6b2440',
      stroke: INK,
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }),
  );
}

function jesterPose(state: BossState): Pose {
  if (state === 'start')
    // arms folded, a straight face: "Bet you cannot make me laugh!"
    return {
      armL: [
        { x: 200, y: 296 },
        { x: 214, y: 352 },
        { x: 296, y: 336 },
      ],
      armR: [
        { x: 312, y: 296 },
        { x: 298, y: 352 },
        { x: 216, y: 334 },
      ],
      eyes: 'side',
      brows: 'raised',
      mouth: 'flat',
      look: 1,
    };
  if (state === 'warming')
    // a giggle escapes: one hand over his mouth, the other waving the slapstick
    return {
      armL: [
        { x: 200, y: 296 },
        { x: 176, y: 260 },
        { x: 222, y: 222 },
      ],
      armR: [
        { x: 312, y: 296 },
        { x: 360, y: 300 },
        { x: 392, y: 252 },
      ],
      eyes: 'squint',
      brows: 'raised',
      mouth: 'grin',
    };
  // laughing out loud: holds his belly, leans back, one shoe kicks up
  return {
    armL: [
      { x: 200, y: 296 },
      { x: 172, y: 352 },
      { x: 222, y: 380 },
    ],
    armR: [
      { x: 312, y: 296 },
      { x: 344, y: 350 },
      { x: 292, y: 384 },
    ],
    eyes: 'happy',
    brows: 'raised',
    mouth: 'laugh',
    kick: 40,
    tilt: 7,
  };
}

export function kasparek(state: BossState, p: P): string {
  const red = '#e0453a';
  const yellow = '#ffc93a';
  const skin = '#f7d0b0';
  const pose = jesterPose(state);
  const kick = pose.kick ?? 0;
  const cx = 256;
  const hip = 388;
  const top = 280;
  const hcy = 196;
  const hr = 64;
  const legs =
    arm(
      [
        { x: cx - 26, y: hip },
        { x: cx - 32 - kick * 0.6, y: 422 - kick * 0.5 },
        { x: cx - 34 - kick * 1.1, y: 452 - kick },
      ],
      26,
      red,
    ) +
    arm(
      [
        { x: cx + 26, y: hip },
        { x: cx + 30, y: 422 },
        { x: cx + 32, y: 452 },
      ],
      26,
      yellow,
    ) +
    boot(cx - 34 - kick * 1.1, 470 - kick, 46, yellow, -1) +
    boot(cx + 32, 470, 46, red, 1) +
    // curled shoe tips with little bells
    h('path', {
      d:
        M(cx - 64 - kick * 1.1, 452 - kick) +
        Q(cx - 80 - kick * 1.1, 440 - kick, cx - 72 - kick * 1.1, 430 - kick),
      fill: 'none',
      stroke: outlineOf(yellow, 0.6),
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }) +
    bell(cx - 72 - kick * 1.1, 428 - kick, 7) +
    h('path', {
      d: M(cx + 60, 452) + Q(cx + 78, 440, cx + 70, 430),
      fill: 'none',
      stroke: outlineOf(red, 0.6),
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }) +
    bell(cx + 70, 428, 7);
  const gl = p('jl');
  const gr = p('jr');
  const half = (s: -1 | 1): string =>
    M(cx, top - 6) +
    L(cx + s * 50, top - 2) +
    Q(cx + s * 70, top + 20, cx + s * 66, top + 60) +
    L(cx + s * 72, hip + 6) +
    Q(cx + s * 40, hip + 18, cx, hip + 14) +
    'Z';
  // diamond pattern on the jacket
  const diamonds = [
    [cx - 36, top + 40],
    [cx - 36, top + 82],
    [cx + 36, top + 40],
    [cx + 36, top + 82],
  ]
    .map(([x, y]) =>
      h('path', {
        d: M(x!, y! - 12) + L(x! + 9, y!) + L(x!, y! + 12) + L(x! - 9, y!) + 'Z',
        fill: x! < cx ? yellow : red,
        opacity: 0.9,
      }),
    )
    .join('');
  const body =
    h(
      'defs',
      null,
      bodyGrad(gl, red, cx - 30, top + 50, 90),
      bodyGrad(gr, yellow, cx + 10, top + 50, 90),
    ) +
    h('path', {
      d: half(-1),
      fill: `url(#${gl})`,
      stroke: outlineOf(red, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: half(1),
      fill: `url(#${gr})`,
      stroke: outlineOf(yellow, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    diamonds +
    // big round buttons and a wavy hem with pompoms
    [0, 1, 2]
      .map((i) => h('circle', { cx, cy: top + 26 + i * 30, r: 7, ...st('#ffffff', 0.55, 2.5) }))
      .join('') +
    [-56, -20, 20, 56]
      .map((dx) =>
        h('circle', {
          cx: cx + dx,
          cy: hip + 12 - Math.abs(dx) * 0.08,
          r: 7,
          ...st(dx < 0 ? yellow : red, 0.55, 2.5),
        }),
      )
      .join('');
  // pleated ruff collar
  const ruff = Array.from({ length: 9 }, (_, i) => {
    const a = (-80 + i * 20) * (Math.PI / 180);
    return { x: cx + Math.sin(a) * 58, y: top - 4 + Math.cos(a) * 8, r: 15 };
  });
  const collar = cloudUnion(ruff, '#ffffff', '#b8b2c8', 4);
  // floppy two-tone cap: one point flops left with a bell, the other right
  const capArt =
    h('path', {
      d:
        M(cx - hr + 2, hcy - 22) +
        C(cx - hr - 10, hcy - 80, cx - 110, hcy - 104, cx - 138, hcy - 60) +
        C(cx - 120, hcy - 76, cx - 96, hcy - 70, cx - 40, hcy - 56) +
        Q(cx - 6, hcy - 70, cx, hcy - 64) +
        L(cx, hcy - 44) +
        Q(cx - 34, hcy - 46, cx - hr + 2, hcy - 22) +
        'Z',
      ...st(red, 0.55, 5),
    }) +
    h('path', {
      d:
        M(cx + hr - 2, hcy - 22) +
        C(cx + hr + 4, hcy - 96, cx + 70, hcy - 150, cx + 126, hcy - 140) +
        C(cx + 102, hcy - 118, cx + 70, hcy - 96, cx + 40, hcy - 58) +
        Q(cx + 12, hcy - 72, cx, hcy - 64) +
        L(cx, hcy - 44) +
        Q(cx + 34, hcy - 46, cx + hr - 2, hcy - 22) +
        'Z',
      ...st(yellow, 0.55, 5),
    }) +
    h('path', {
      d: M(cx - hr - 4, hcy - 20) + Q(cx, hcy - 56, cx + hr + 4, hcy - 20),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 14,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(cx - hr - 4, hcy - 20) + Q(cx, hcy - 56, cx + hr + 4, hcy - 20),
      fill: 'none',
      stroke: '#b8b2c8',
      'stroke-width': 2,
      'stroke-dasharray': '2 8',
    }) +
    bell(cx - 140, hcy - 56, 13) +
    bell(cx + 130, hcy - 138, 13) +
    (state === 'start' ? '' : jingle(cx - 140, hcy - 56, 22) + jingle(cx + 130, hcy - 138, 22));
  // brown curls peeking out from under the cap
  const curls = [-1, 1]
    .map((s) =>
      cloudUnion(
        [
          { x: cx + s * 58, y: hcy - 8, r: 14 },
          { x: cx + s * 66, y: hcy + 12, r: 12 },
        ],
        '#8a4a24',
        '#4a2410',
        3.5,
      ),
    )
    .join('');
  const head =
    h('ellipse', { cx, cy: top - 6, rx: 22, ry: 10, fill: darken(skin, 0.12) }) +
    curls +
    h('circle', { cx, cy: hcy, r: hr, ...st(skin) }) +
    face({
      cx,
      cy: hcy - 6,
      dx: 26,
      r: 12,
      eyes: pose.eyes,
      brows: pose.brows,
      mouth: pose.mouth,
      my: hcy + 32,
      mw: state === 'start' ? 30 : 46,
      skin,
      blush: 0.75,
      browColor: '#5a2a14',
      look: pose.look,
    }) +
    // the round red puppet nose
    h('circle', { cx, cy: hcy + 12, r: 13, ...st('#ff5a5a', 0.55, 3.5) }) +
    h('circle', { cx: cx - 4, cy: hcy + 8, r: 4, fill: '#ffffff', opacity: 0.6 }) +
    capArt;
  const armT = 24;
  const handAngle = state === 'start' ? 0 : -90;
  // the wooden slapstick: tucked under an arm, waved, or dropped at his feet
  const slapstick = (x: number, y: number, rot: number): string =>
    h(
      'g',
      { transform: `translate(${x} ${y}) rotate(${rot})` },
      h('path', { d: roundRectD(-5, 0, 10, 44, 4), ...st('#a8713f', 0.55, 3) }),
      h('path', { d: roundRectD(-11, -54, 22, 58, 6), ...st('#ffd23f', 0.55, 3.5) }),
      h('path', { d: M(0, -52) + L(0, 2), stroke: '#c4900a', 'stroke-width': 2.5 }),
    );
  let armsArt =
    arm(pose.armL, armT, red) +
    arm(pose.armR, armT, yellow) +
    hand(pose.armL[2]!.x, pose.armL[2]!.y, 16, '#ffffff', 180) +
    hand(pose.armR[2]!.x, pose.armR[2]!.y, 16, '#ffffff', handAngle);
  let air = '';
  let behind = '';
  if (state === 'start') {
    armsArt = slapstick(344, 300, 30) + armsArt;
  } else if (state === 'warming') {
    armsArt += slapstick(394, 250, 24);
    air =
      haBurst(110, 110, 26, 'dv-twinkle dv-twinkle-1') +
      sparkles([
        [420, 140, 10],
        [96, 210, 9],
      ]);
  } else {
    behind = slapstick(446, 452, 84);
    air =
      haBurst(96, 92, 32, 'dv-twinkle dv-twinkle-1') +
      haBurst(420, 70, 28, 'dv-twinkle dv-twinkle-2') +
      haBurst(452, 200, 22, 'dv-twinkle dv-twinkle-3') +
      sparkles([
        [256, 34, 14],
        [60, 250, 11],
      ]);
  }
  const won = state === 'won';
  const joyTears = won ? tears(cx - 48, hcy - 2, 16, -1) + tears(cx + 48, hcy - 2, 16, 1) : '';
  const tilt = pose.tilt ?? 0;
  return (
    ground(256, 190) +
    behind +
    h(
      'g',
      { transform: `rotate(${tilt} ${cx} 470)` },
      legs,
      body,
      collar,
      head,
      joyTears,
      armsArt,
    ) +
    air
  );
}
