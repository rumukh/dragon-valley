/**
 * The nine friendly folklore bosses in three states each. Nobody gets hurt: the child's correct
 * answers make a boss laugh, fall asleep or agree. `start` is the challenge pose, `warming` is
 * about half way along the boss meter, `won` is the happy ending.
 */
import { CANONICAL_BOSS_IDS } from '../../../rules/contract/ids';
import { polar } from '../svg/num';
import { M, L, Q, C, roundRectD, roundStarD, eggD, heartD, polyD } from '../svg/path';
import { h, svgDoc, ids as scoped } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
import { clover, flower, sparkleD } from '../glyphs';
import { cloudUnion } from '../dragon/shapes';
import { getRecipe } from '../dragon/recipes';
import { renderSevenHeaded } from '../dragon/seven';
import { ANIMATIONS_CSS } from '../dragon/animations';
import {
  INK,
  arm,
  bodyGrad,
  boot,
  face,
  ground,
  hand,
  questionMarks,
  rr,
  sparkles,
  tears,
  zzz,
} from './kit';

export const BOSS_IDS = CANONICAL_BOSS_IDS;
export const BOSS_STATES = ['start', 'warming', 'won'] as const;
export type BossState = (typeof BOSS_STATES)[number];

/** How each boss is won (for copy and audio cues). */
export const BOSS_OUTCOME: Record<string, 'laugh' | 'sleep' | 'agree'> = {
  'bridge-troll': 'laugh',
  'forest-witch': 'agree',
  krakonos: 'laugh',
  'gnome-king': 'agree',
  'water-goblin': 'agree',
  'lake-nymphs': 'laugh',
  'friendly-giant': 'sleep',
  golem: 'agree',
  'seven-headed': 'agree',
};

type P = (n: string) => string;

const st = (fill: string, k = 0.6, w = 4.5): Record<string, string | number> => ({
  fill,
  stroke: outlineOf(fill, k),
  'stroke-width': w,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

// ---------------------------------------------------------------------------------------------
// 1. Bridge Troll: make him laugh.

function bridgeTroll(state: BossState, p: P): string {
  const skin = '#8fbf5a';
  const skinDark = darken(skin, 0.25);
  const g = p('troll');
  const bridge =
    h('path', {
      d: M(20, 452) + Q(256, 430, 492, 452) + L(492, 506) + L(20, 506) + 'Z',
      ...st('#b8b0a6', 0.55),
    }) +
    h('path', {
      d:
        M(20, 468) +
        Q(256, 448, 492, 468) +
        M(110, 446) +
        L(104, 470) +
        M(200, 440) +
        L(196, 462) +
        M(300, 440) +
        L(304, 462) +
        M(400, 446) +
        L(406, 470) +
        M(60, 482) +
        L(56, 504) +
        M(160, 476) +
        L(156, 504) +
        M(256, 474) +
        L(256, 504) +
        M(352, 476) +
        L(356, 504) +
        M(452, 482) +
        L(456, 504),
      stroke: '#7d756c',
      'stroke-width': 3,
      fill: 'none',
      opacity: 0.6,
    }) +
    h('path', {
      d: M(80, 450) + Q(100, 436, 122, 446),
      fill: 'none',
      stroke: '#7fae4f',
      'stroke-width': 6,
      'stroke-linecap': 'round',
    }) +
    flower(430, 446, 9, 5, '#ffffff', '#ffd23f', INK, 2);
  const won = state === 'won';
  const tilt = won ? -5 : 0;
  const body =
    h('defs', null, bodyGrad(g, skin, 256, 300, 170)) +
    h('ellipse', { cx: 210, cy: 452, rx: 40, ry: 18, ...st(skin) }) +
    h('ellipse', { cx: 302, cy: 452, rx: 40, ry: 18, ...st(skin) }) +
    [-1, 0, 1]
      .map(
        (k) =>
          h('circle', {
            cx: 210 + k * 18 + 10,
            cy: 462,
            r: 7,
            fill: lighten(skin, 0.3),
            stroke: outlineOf(skin, 0.6),
            'stroke-width': 3,
          }) +
          h('circle', {
            cx: 302 + k * 18 + 10,
            cy: 462,
            r: 7,
            fill: lighten(skin, 0.3),
            stroke: outlineOf(skin, 0.6),
            'stroke-width': 3,
          }),
      )
      .join('') +
    h('path', {
      d:
        M(256, 130) +
        C(380, 130, 400, 260, 392, 330) +
        C(386, 420, 330, 450, 256, 450) +
        C(182, 450, 126, 420, 120, 330) +
        C(112, 260, 132, 130, 256, 130) +
        'Z',
      fill: `url(#${g})`,
      stroke: outlineOf(skin, 0.6),
      'stroke-width': 5,
    }) +
    h('ellipse', { cx: 256, cy: 360, rx: 82, ry: 70, fill: lighten(skin, 0.45), opacity: 0.85 }) +
    // vest
    h('path', {
      d:
        M(140, 300) +
        C(150, 270, 190, 262, 206, 272) +
        L(222, 430) +
        C(180, 432, 140, 410, 132, 372) +
        'Z',
      ...st('#9a6a3a'),
    }) +
    h('path', {
      d:
        M(372, 300) +
        C(362, 270, 322, 262, 306, 272) +
        L(290, 430) +
        C(332, 432, 372, 410, 380, 372) +
        'Z',
      ...st('#9a6a3a'),
    }) +
    h('path', { d: roundRectD(330, 340, 26, 22, 4), ...st('#e8a33d', 0.6, 3) }) +
    h('path', {
      d: M(334, 345) + L(352, 357) + M(352, 345) + L(334, 357),
      stroke: '#8a5a1a',
      'stroke-width': 2,
    });
  const headLayer =
    // ears
    h('path', {
      d: M(150, 176) + C(110, 150, 92, 196, 104, 214) + C(116, 232, 146, 222, 158, 210) + 'Z',
      ...st(skin),
    }) +
    h('path', {
      d: M(362, 176) + C(402, 150, 420, 196, 408, 214) + C(396, 232, 366, 222, 354, 210) + 'Z',
      ...st(skin),
    }) +
    // mossy hair tuft
    cloudUnion(
      [
        { x: 222, y: 134, r: 22 },
        { x: 256, y: 120, r: 28 },
        { x: 292, y: 134, r: 22 },
      ],
      '#5f9e3a',
      '#2f5a1e',
      4,
    ) +
    flower(282, 112, 9, 5, '#ff9fbf', '#ffd23f', INK, 2) +
    face({
      cx: 256,
      cy: 196,
      dx: 42,
      r: 13,
      eyes: won ? 'happy' : 'open',
      brows: state === 'start' ? 'grumpy' : 'raised',
      mouth: state === 'start' ? 'frown' : won ? 'laugh' : 'smile',
      my: 262,
      mw: 92,
      skin,
      blush: state === 'start' ? 0.2 : 0.55,
      browColor: '#3f6b2a',
    }) +
    // potato nose
    h('ellipse', { cx: 256, cy: 226, rx: 30, ry: 24, ...st(skinDark) }) +
    h('ellipse', { cx: 246, cy: 217, rx: 10, ry: 6, fill: '#ffffff', opacity: 0.35 }) +
    // one friendly tooth (underbite)
    (state === 'start'
      ? h('path', {
          d: M(276, 262) + L(282, 248) + L(290, 262) + 'Z',
          fill: '#fffaf0',
          stroke: INK,
          'stroke-width': 2.5,
          'stroke-linejoin': 'round',
        })
      : '') +
    (won ? tears(214, 206, 16, -1) + tears(298, 206, 16, 1) : '');
  let arms = '';
  if (state === 'start') {
    arms =
      arm(
        [
          { x: 150, y: 282 },
          { x: 182, y: 352 },
          { x: 300, y: 330 },
        ],
        46,
        skin,
      ) +
      arm(
        [
          { x: 362, y: 282 },
          { x: 330, y: 348 },
          { x: 214, y: 334 },
        ],
        46,
        skin,
      ) +
      hand(306, 326, 22, skin, 0) +
      hand(208, 330, 22, skin, 180);
  } else if (state === 'warming') {
    arms =
      arm(
        [
          { x: 150, y: 282 },
          { x: 128, y: 360 },
          { x: 156, y: 404 },
        ],
        46,
        skin,
      ) +
      hand(160, 410, 22, skin, 90) +
      arm(
        [
          { x: 362, y: 282 },
          { x: 420, y: 240 },
          { x: 398, y: 170 },
        ],
        46,
        skin,
      ) +
      hand(392, 162, 22, skin, -90) +
      questionMarks(430, 110, 30, '#6a4ce0');
  } else {
    arms =
      arm(
        [
          { x: 150, y: 282 },
          { x: 150, y: 352 },
          { x: 214, y: 384 },
        ],
        46,
        skin,
      ) +
      arm(
        [
          { x: 362, y: 282 },
          { x: 362, y: 352 },
          { x: 298, y: 384 },
        ],
        46,
        skin,
      ) +
      hand(220, 386, 22, skin, 0) +
      hand(292, 386, 22, skin, 180) +
      sparkles([
        [110, 120, 16],
        [402, 104, 14],
        [430, 220, 11],
      ]);
  }
  return (
    ground(256, 220) +
    bridge +
    h('g', { transform: `rotate(${tilt} 256 450)` }, body, headLayer, arms)
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Forest Witch: a kind Jezibaba. Make her agree; she shares a gingerbread heart.

function forestWitch(state: BossState, p: P): string {
  const skin = '#f2c9a8';
  const dress = '#5a3f7a';
  const g = p('witch');
  const won = state === 'won';
  const broom = (x: number, y: number, rot: number): string =>
    h(
      'g',
      { transform: `translate(${x} ${y}) rotate(${rot})` },
      h('path', { d: roundRectD(-5, -190, 10, 200, 5), ...st('#a8743a') }),
      h('path', {
        d:
          M(-10, -10) + C(-34, 30, -40, 70, -34, 86) + L(34, 86) + C(40, 70, 34, 30, 10, -10) + 'Z',
        ...st('#d9a95a'),
      }),
      h('path', {
        d:
          M(-18, 30) +
          L(-26, 82) +
          M(-6, 30) +
          L(-8, 84) +
          M(6, 30) +
          L(8, 84) +
          M(18, 30) +
          L(26, 82),
        stroke: '#a8743a',
        'stroke-width': 2.5,
      }),
      h('path', { d: roundRectD(-14, -14, 28, 12, 4), ...st('#e0533a', 0.6, 3) }),
    );
  const dressD =
    M(256, 238) +
    C(330, 238, 360, 330, 378, 460) +
    Q(256, 480, 134, 460) +
    C(152, 330, 182, 238, 256, 238) +
    'Z';
  const dots = [
    [190, 330],
    [320, 330],
    [170, 410],
    [340, 410],
    [210, 450],
    [300, 450],
  ]
    .map(([x, y]) => flower(x!, y!, 7, 5, '#ffcf6b', '#e0533a', outlineOf('#ffcf6b', 0.5), 1.5))
    .join('');
  const body =
    h('defs', null, bodyGrad(g, dress, 256, 340, 160)) +
    boot(212, 470, 46, '#6b4a2e', -1) +
    boot(300, 470, 46, '#6b4a2e', 1) +
    h('path', {
      d: dressD,
      fill: `url(#${g})`,
      stroke: outlineOf(dress, 0.5),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    dots +
    h('path', {
      d: M(214, 290) + L(298, 290) + L(310, 446) + Q(256, 456, 202, 446) + 'Z',
      ...st('#f3e6c8', 0.5),
    }) +
    h('path', { d: roundRectD(232, 372, 48, 34, 8), ...st('#ecd9b0', 0.5, 3) }) +
    clover(256, 389, 9, '#5cc46b', '#2f6b2a', 1.5, false) +
    // knitted shawl
    h('path', {
      d: M(170, 266) + Q(256, 230, 342, 266) + L(330, 316) + Q(256, 360, 182, 316) + 'Z',
      ...st('#c8577a', 0.55),
    }) +
    h('path', {
      d:
        M(186, 314) +
        L(184, 330) +
        M(200, 324) +
        L(198, 342) +
        M(216, 332) +
        L(215, 350) +
        M(296, 332) +
        L(297, 350) +
        M(312, 324) +
        L(314, 342) +
        M(326, 314) +
        L(328, 330),
      stroke: '#c8577a',
      'stroke-width': 4,
      'stroke-linecap': 'round',
    });
  const head =
    h('ellipse', { cx: 256, cy: 186, rx: 76, ry: 72, ...st(skin) }) +
    face({
      cx: 256,
      cy: 180,
      dx: 30,
      r: 10,
      eyes: state === 'start' ? 'squint' : won ? 'happy' : 'open',
      brows: state === 'start' ? 'worried' : 'soft',
      mouth: state === 'start' ? 'pout' : won ? 'grin' : 'smile',
      my: 234,
      mw: 54,
      skin,
      blush: 0.6,
      browColor: '#b8a8a0',
    }) +
    h('ellipse', { cx: 256, cy: 208, rx: 20, ry: 17, ...st(darken(skin, 0.08)) }) +
    h('ellipse', { cx: 249, cy: 202, rx: 6, ry: 4, fill: '#ffffff', opacity: 0.5 }) +
    h('path', {
      d: M(200, 222) + Q(206, 230, 214, 228) + M(312, 222) + Q(306, 230, 298, 228),
      fill: 'none',
      stroke: outlineOf(skin, 0.5),
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
    }) +
    // red polka-dot headscarf, knotted under the chin
    h('path', {
      d:
        M(176, 214) +
        C(160, 110, 230, 92, 256, 96) +
        C(282, 92, 352, 110, 336, 214) +
        C(330, 180, 318, 150, 300, 140) +
        Q(256, 124, 212, 140) +
        C(194, 150, 182, 180, 176, 214) +
        'Z',
      ...st('#e0533a', 0.55),
    }) +
    [
      [214, 124],
      [256, 110],
      [298, 124],
      [190, 166],
      [322, 166],
      [236, 132],
      [278, 132],
    ]
      .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 5, fill: '#ffffff' }))
      .join('') +
    h('path', {
      d: M(212, 252) + Q(256, 272, 300, 252) + L(296, 264) + Q(256, 282, 216, 264) + 'Z',
      ...st('#e0533a', 0.55),
    }) +
    h('path', { d: M(250, 270) + L(232, 300) + L(246, 300) + 'Z', ...st('#e0533a', 0.55, 3.5) }) +
    h('path', { d: M(262, 270) + L(282, 298) + L(268, 302) + 'Z', ...st('#e0533a', 0.55, 3.5) }) +
    h('circle', { cx: 256, cy: 268, r: 9, ...st('#c94a32', 0.55, 3) }) +
    // grey curls peeking out
    h('path', {
      d: M(188, 176) + Q(178, 186, 188, 196) + M(324, 176) + Q(334, 186, 324, 196),
      fill: 'none',
      stroke: '#d9d0e6',
      'stroke-width': 7,
      'stroke-linecap': 'round',
    });
  let arms = '';
  if (state === 'start') {
    arms =
      broom(372, 418, 8) +
      arm(
        [
          { x: 182, y: 290 },
          { x: 150, y: 340 },
          { x: 196, y: 372 },
        ],
        30,
        '#5a3f7a',
      ) +
      hand(202, 372, 15, skin) +
      arm(
        [
          { x: 330, y: 290 },
          { x: 366, y: 320 },
          { x: 370, y: 268 },
        ],
        30,
        '#5a3f7a',
      ) +
      hand(370, 262, 15, skin);
  } else if (state === 'warming') {
    arms =
      broom(376, 420, 12) +
      arm(
        [
          { x: 182, y: 290 },
          { x: 140, y: 262 },
          { x: 132, y: 210 },
        ],
        30,
        '#5a3f7a',
      ) +
      hand(132, 202, 16, skin, -90) +
      arm(
        [
          { x: 330, y: 290 },
          { x: 362, y: 330 },
          { x: 372, y: 300 },
        ],
        30,
        '#5a3f7a',
      ) +
      hand(372, 294, 15, skin);
  } else {
    const heart = heartD(256, 362, 92);
    arms =
      broom(124, 420, -14) +
      arm(
        [
          { x: 182, y: 290 },
          { x: 196, y: 350 },
          { x: 222, y: 372 },
        ],
        30,
        '#5a3f7a',
      ) +
      arm(
        [
          { x: 330, y: 290 },
          { x: 316, y: 350 },
          { x: 290, y: 372 },
        ],
        30,
        '#5a3f7a',
      ) +
      h('path', { d: heart, ...st('#b8662e', 0.55) }) +
      h('path', {
        d: heartD(256, 364, 72),
        fill: 'none',
        stroke: '#fffaf0',
        'stroke-width': 4,
        'stroke-dasharray': '2 7',
        'stroke-linecap': 'round',
      }) +
      h('circle', {
        cx: 256,
        cy: 360,
        r: 7,
        fill: '#ff5a8a',
        stroke: '#fffaf0',
        'stroke-width': 2.5,
      }) +
      hand(222, 376, 15, skin) +
      hand(290, 376, 15, skin) +
      sparkles([
        [170, 330, 14],
        [350, 320, 12],
        [380, 150, 12],
      ]);
  }
  return ground(256, 160) + body + head + arms;
}

// ---------------------------------------------------------------------------------------------
// 3. Krakonos, the mountain spirit: make him laugh; the clouds part and the sun comes out.

function krakonos(state: BossState, p: P): string {
  const coat = '#3f7a4a';
  const skin = '#f0c8a6';
  const g = p('krak');
  const won = state === 'won';
  const weather =
    state === 'start'
      ? cloudUnion(
          [
            { x: 380, y: 70, r: 26 },
            { x: 410, y: 58, r: 30 },
            { x: 442, y: 72, r: 24 },
          ],
          '#b9bfd6',
          '#6b6f8f',
          4,
        ) +
        h('path', {
          d: M(392, 104) + L(386, 118) + M(414, 104) + L(408, 120) + M(436, 104) + L(430, 118),
          stroke: '#4aa8ff',
          'stroke-width': 5,
          'stroke-linecap': 'round',
        })
      : state === 'warming'
        ? h('circle', { cx: 430, cy: 64, r: 26, ...st('#ffd23f', 0.55) }) +
          cloudUnion(
            [
              { x: 384, y: 78, r: 24 },
              { x: 412, y: 70, r: 26 },
            ],
            '#e6e9f5',
            '#8a8fb0',
            4,
          )
        : h(
            'g',
            null,
            ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
              const p0 = polar(420, 70, 38, a);
              const p1 = polar(420, 70, 54, a);
              return h('path', {
                d: M(p0.x, p0.y) + L(p1.x, p1.y),
                stroke: '#ffb31f',
                'stroke-width': 7,
                'stroke-linecap': 'round',
              });
            }),
          ) +
          h('circle', { cx: 420, cy: 70, r: 30, ...st('#ffd23f', 0.55) }) +
          face({
            cx: 420,
            cy: 66,
            dx: 10,
            r: 4,
            eyes: 'happy',
            brows: 'none',
            mouth: 'smile',
            my: 78,
            mw: 18,
            skin: '#ffd23f',
            blush: 0.4,
          });
  const body =
    h('defs', null, bodyGrad(g, coat, 256, 330, 170)) +
    boot(206, 470, 54, '#5a3a22', -1) +
    boot(306, 470, 54, '#5a3a22', 1) +
    h('path', {
      d:
        M(256, 236) +
        C(340, 236, 368, 300, 372, 440) +
        L(140, 440) +
        C(144, 300, 172, 236, 256, 236) +
        'Z',
      fill: `url(#${g})`,
      stroke: outlineOf(coat, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(256, 300) + L(256, 440),
      stroke: outlineOf(coat, 0.5),
      'stroke-width': 3,
      opacity: 0.6,
    }) +
    h('path', { d: roundRectD(148, 372, 216, 20, 6), ...st('#7a4f2a') }) +
    h('path', { d: roundRectD(240, 368, 32, 28, 5), ...st('#ffd23f', 0.55, 3.5) }) +
    [318, 344]
      .map((y) => h('circle', { cx: 270, cy: y, r: 5, ...st('#ffd23f', 0.55, 2) }))
      .join('');
  const beardD =
    M(206, 210) +
    C(196, 260, 206, 330, 256, 352) +
    C(306, 330, 316, 260, 306, 210) +
    Q(256, 236, 206, 210) +
    'Z';
  const head =
    h('ellipse', { cx: 256, cy: 186, rx: 64, ry: 64, ...st(skin) }) +
    face({
      cx: 256,
      cy: 178,
      dx: 26,
      r: 9.5,
      eyes: won ? 'happy' : 'open',
      brows: 'none',
      mouth: 'flat',
      my: 900,
      mw: 1,
      skin,
      blush: 0.5,
    }) +
    h('path', { d: beardD, ...st('#eef0f5', 0.45) }) +
    h('path', {
      d:
        M(226, 250) +
        Q(232, 290, 244, 320) +
        M(286, 250) +
        Q(280, 290, 268, 320) +
        M(256, 262) +
        L(256, 336),
      fill: 'none',
      stroke: '#c9cbe0',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }) +
    // moustache + mouth
    h('path', {
      d:
        M(256, 214) +
        C(240, 206, 214, 210, 206, 228) +
        C(222, 226, 238, 228, 256, 222) +
        C(274, 228, 290, 226, 306, 228) +
        C(298, 210, 272, 206, 256, 214) +
        'Z',
      ...st('#f6f7fb', 0.45, 3.5),
    }) +
    (state === 'start'
      ? h('path', {
          d: M(240, 236) + Q(256, 230, 272, 236),
          fill: 'none',
          stroke: INK,
          'stroke-width': 4,
          'stroke-linecap': 'round',
        })
      : won
        ? h('path', {
            d: M(236, 232) + Q(256, 236, 276, 232) + C(274, 258, 238, 258, 236, 232) + 'Z',
            fill: '#6b2440',
            stroke: INK,
            'stroke-width': 3,
          })
        : h('path', {
            d: M(238, 232) + Q(256, 244, 274, 232),
            fill: 'none',
            stroke: INK,
            'stroke-width': 4,
            'stroke-linecap': 'round',
          })) +
    h('ellipse', { cx: 256, cy: 200, rx: 15, ry: 13, ...st(darken(skin, 0.1)) }) +
    // bushy brows
    [-1, 1]
      .map((s) => {
        const x = 256 + s * 26;
        const y = state === 'start' ? 160 : 156;
        const tilt = state === 'start' ? s * 7 : -s * 3;
        return h('path', {
          d:
            M(x - 18, y + tilt) +
            Q(x, y - 12, x + 18, y - tilt) +
            Q(x + 6, y + 8, x - 18, y + tilt) +
            'Z',
          ...st('#eef0f5', 0.45, 3),
        });
      })
      .join('') +
    // hat with a feather
    h(
      'g',
      { transform: 'translate(0 -16)' },
      h('ellipse', { cx: 256, cy: 140, rx: 118, ry: 22, ...st('#6b4a2e') }),
      h('path', {
        d:
          M(196, 138) +
          C(194, 92, 220, 74, 256, 74) +
          C(292, 74, 318, 92, 316, 138) +
          Q(256, 150, 196, 138) +
          'Z',
        ...st('#7d5634'),
      }),
      h('path', {
        d: M(198, 124) + Q(256, 136, 314, 124) + L(316, 136) + Q(256, 148, 196, 136) + 'Z',
        fill: '#3f7a4a',
      }),
      h('path', {
        d: M(306, 128) + C(330, 96, 352, 70, 358, 46) + C(340, 72, 322, 96, 312, 124) + 'Z',
        ...st('#ffffff', 0.4, 3),
      }),
      h('path', {
        d: M(304, 130) + C(322, 106, 340, 84, 350, 60),
        fill: 'none',
        stroke: '#9fb3c8',
        'stroke-width': 2,
      }),
    );
  const staff =
    h('path', {
      d: M(388, 470) + C(384, 400, 396, 330, 386, 236) + C(382, 214, 396, 204, 400, 196),
      fill: 'none',
      stroke: '#7a5230',
      'stroke-width': 13,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(388, 470) + C(384, 400, 396, 330, 386, 236),
      fill: 'none',
      stroke: '#a8743a',
      'stroke-width': 7,
      'stroke-linecap': 'round',
    }) +
    flower(400, 196, 8, 5, '#ffffff', '#ffd23f', INK, 1.5);
  let arms = '';
  if (state === 'start') {
    arms =
      arm(
        [
          { x: 330, y: 270 },
          { x: 368, y: 320 },
          { x: 386, y: 300 },
        ],
        34,
        coat,
      ) +
      hand(386, 296, 17, skin) +
      arm(
        [
          { x: 182, y: 270 },
          { x: 150, y: 330 },
          { x: 186, y: 372 },
        ],
        34,
        coat,
      ) +
      hand(190, 372, 17, skin);
  } else if (state === 'warming') {
    arms =
      arm(
        [
          { x: 330, y: 270 },
          { x: 368, y: 320 },
          { x: 386, y: 300 },
        ],
        34,
        coat,
      ) +
      hand(386, 296, 17, skin) +
      arm(
        [
          { x: 182, y: 270 },
          { x: 140, y: 250 },
          { x: 132, y: 204 },
        ],
        34,
        coat,
      ) +
      hand(132, 196, 17, skin, -90);
  } else {
    arms =
      arm(
        [
          { x: 330, y: 270 },
          { x: 368, y: 320 },
          { x: 386, y: 300 },
        ],
        34,
        coat,
      ) +
      hand(386, 296, 17, skin) +
      arm(
        [
          { x: 182, y: 270 },
          { x: 186, y: 330 },
          { x: 228, y: 352 },
        ],
        34,
        coat,
      ) +
      hand(232, 352, 17, skin) +
      sparkles([
        [120, 150, 14],
        [100, 260, 11],
      ]);
  }
  return ground(256, 170) + weather + staff + body + head + arms;
}

// ---------------------------------------------------------------------------------------------
// 4. Gnome King of the miners (permonici): make him agree; he shows his crystal and dances.

function gnomeKing(state: BossState, p: P): string {
  const skin = '#f2c2a0';
  const tunic = '#3d6bc4';
  const g = p('gnome');
  const won = state === 'won';
  const lantern = (x: number, y: number): string =>
    h(
      'g',
      { transform: `translate(${x} ${y})` },
      h(
        'g',
        { class: 'dv-lantern-glow' },
        h('circle', { cx: 0, cy: -26, r: 40, fill: '#ffd36b', opacity: 0.35 }),
      ),
      h('path', { d: roundRectD(-20, -50, 40, 46, 8), ...st('#c99a3a', 0.55) }),
      h('path', { d: roundRectD(-13, -43, 26, 32, 5), fill: '#ffe08a' }),
      h('path', { d: M(0, -18) + Q(-7, -28, 0, -38) + Q(7, -28, 0, -18) + 'Z', fill: '#ff9a2e' }),
      h('path', {
        d: M(-14, -50) + Q(0, -70, 14, -50),
        fill: 'none',
        stroke: '#8a6a2a',
        'stroke-width': 4,
      }),
    );
  const crystal = (x: number, y: number, s: number): string =>
    h('path', {
      d: polyD([
        { x, y: y - s },
        { x: x + s * 0.5, y: y - s * 0.35 },
        { x: x + s * 0.35, y: y + s * 0.5 },
        { x: x - s * 0.35, y: y + s * 0.5 },
        { x: x - s * 0.5, y: y - s * 0.35 },
      ]),
      ...st('#b9a4ff', 0.5),
    }) +
    h('path', {
      d:
        M(x, y - s) +
        L(x, y + s * 0.5) +
        M(x - s * 0.5, y - s * 0.35) +
        L(x + s * 0.5, y - s * 0.35),
      stroke: '#ffffff',
      'stroke-width': 2.5,
      opacity: 0.7,
    }) +
    h('path', { d: sparkleD(x + s * 0.6, y - s * 0.9, s * 0.3), fill: '#ffffff' });
  const legs = won
    ? boot(214, 470, 50, '#6b3f22', -1) +
      h('g', { transform: 'rotate(-32 300 430)' }, boot(300, 470, 50, '#6b3f22', 1))
    : boot(214, 470, 50, '#6b3f22', -1) + boot(298, 470, 50, '#6b3f22', 1);
  const body =
    h('defs', null, bodyGrad(g, tunic, 256, 360, 130)) +
    legs +
    h('path', {
      d:
        M(256, 280) +
        C(336, 280, 352, 340, 350, 400) +
        C(348, 444, 300, 452, 256, 452) +
        C(212, 452, 164, 444, 162, 400) +
        C(160, 340, 176, 280, 256, 280) +
        'Z',
      fill: `url(#${g})`,
      stroke: outlineOf(tunic, 0.55),
      'stroke-width': 5,
    }) +
    h('path', {
      d: M(196, 330) + L(316, 330) + L(326, 446) + Q(256, 456, 186, 446) + 'Z',
      ...st('#9a6a3a', 0.55),
    }) +
    h('path', { d: roundRectD(164, 400, 184, 18, 6), ...st('#5a3a22') }) +
    h('path', { d: roundRectD(240, 396, 32, 26, 5), ...st('#ffd23f', 0.55, 3.5) });
  const beardD =
    M(196, 220) +
    C(180, 280, 200, 360, 256, 392) +
    C(312, 360, 332, 280, 316, 220) +
    Q(256, 250, 196, 220) +
    'Z';
  const head =
    h('ellipse', { cx: 256, cy: 206, rx: 74, ry: 70, ...st(skin) }) +
    face({
      cx: 256,
      cy: 196,
      dx: 30,
      r: 10,
      eyes: won ? 'happy' : state === 'start' ? 'open' : 'wide',
      brows: 'none',
      mouth: 'flat',
      my: 900,
      mw: 1,
      skin,
      blush: 0.55,
    }) +
    h('path', { d: beardD, ...st('#f8f8fc', 0.4) }) +
    h('path', {
      d:
        M(226, 270) +
        Q(230, 320, 244, 352) +
        M(286, 270) +
        Q(282, 320, 268, 352) +
        M(256, 280) +
        L(256, 372),
      fill: 'none',
      stroke: '#d0d2e6',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }) +
    (state === 'start'
      ? h('path', {
          d: M(238, 254) + Q(256, 246, 274, 254),
          fill: 'none',
          stroke: INK,
          'stroke-width': 4.5,
          'stroke-linecap': 'round',
        })
      : won
        ? h('path', {
            d: M(234, 250) + Q(256, 254, 278, 250) + C(276, 280, 236, 280, 234, 250) + 'Z',
            fill: '#6b2440',
            stroke: INK,
            'stroke-width': 3,
          })
        : h('path', {
            d: M(236, 250) + Q(256, 264, 276, 250),
            fill: 'none',
            stroke: INK,
            'stroke-width': 4.5,
            'stroke-linecap': 'round',
          })) +
    h('ellipse', { cx: 256, cy: 222, rx: 22, ry: 18, ...st('#ff8f7a', 0.55) }) +
    h('ellipse', { cx: 249, cy: 215, rx: 7, ry: 5, fill: '#ffffff', opacity: 0.45 }) +
    [-1, 1]
      .map((s) => {
        const x = 256 + s * 30;
        const y = 174;
        const tilt = state === 'start' ? s * 7 : -s * 2;
        return h('path', {
          d:
            M(x - 16, y + tilt) +
            Q(x, y - 11, x + 16, y - tilt) +
            Q(x + 4, y + 7, x - 16, y + tilt) +
            'Z',
          ...st('#f8f8fc', 0.4, 3),
        });
      })
      .join('') +
    // red cap with the king's crown
    h('path', {
      d:
        M(184, 176) +
        C(186, 110, 230, 92, 262, 96) +
        C(300, 80, 336, 40, 362, 50) +
        C(344, 70, 330, 110, 328, 176) +
        Q(256, 150, 184, 176) +
        'Z',
      ...st('#e0533a', 0.55),
    }) +
    h('circle', { cx: 364, cy: 50, r: 13, ...st('#ffffff', 0.4) }) +
    h('path', {
      d:
        M(188, 168) +
        L(194, 128) +
        L(212, 148) +
        L(232, 118) +
        L(252, 142) +
        L(272, 118) +
        L(292, 142) +
        L(312, 122) +
        L(322, 168) +
        Q(256, 150, 188, 168) +
        'Z',
      ...st('#ffd23f', 0.55),
    }) +
    h('circle', { cx: 256, cy: 152, r: 7, fill: '#e0335a', stroke: '#7a2a00', 'stroke-width': 2 });
  let arms = '';
  if (state === 'start') {
    arms =
      lantern(392, 470) +
      arm(
        [
          { x: 180, y: 314 },
          { x: 196, y: 368 },
          { x: 290, y: 352 },
        ],
        34,
        tunic,
      ) +
      arm(
        [
          { x: 332, y: 314 },
          { x: 316, y: 366 },
          { x: 222, y: 356 },
        ],
        34,
        tunic,
      ) +
      hand(294, 350, 17, skin) +
      hand(218, 354, 17, skin);
  } else if (state === 'warming') {
    arms =
      arm(
        [
          { x: 180, y: 314 },
          { x: 150, y: 368 },
          { x: 186, y: 400 },
        ],
        34,
        tunic,
      ) +
      hand(190, 402, 17, skin) +
      arm(
        [
          { x: 332, y: 314 },
          { x: 384, y: 300 },
          { x: 396, y: 250 },
        ],
        34,
        tunic,
      ) +
      hand(396, 246, 17, skin) +
      lantern(396, 252);
  } else {
    arms =
      arm(
        [
          { x: 180, y: 314 },
          { x: 130, y: 280 },
          { x: 118, y: 226 },
        ],
        34,
        tunic,
      ) +
      hand(118, 220, 17, skin, -90) +
      arm(
        [
          { x: 332, y: 314 },
          { x: 384, y: 286 },
          { x: 396, y: 226 },
        ],
        34,
        tunic,
      ) +
      hand(396, 220, 17, skin, -90) +
      crystal(396, 170, 40) +
      sparkles([
        [130, 150, 14],
        [450, 120, 12],
        [460, 260, 10],
      ]);
  }
  return ground(256, 150) + body + head + arms;
}

// ---------------------------------------------------------------------------------------------
// 5. Water Goblin (vodnik): keeps lost fruit in teacups. Make him agree to give it back.

function teacup(
  x: number,
  y: number,
  s: number,
  lid: 'on' | 'lifted' | 'off',
  fruit?: string,
): string {
  const cup =
    M(x - s, y - s * 0.6) +
    L(x + s, y - s * 0.6) +
    C(x + s, y + s * 0.5, x - s, y + s * 0.5, x - s, y - s * 0.6) +
    'Z';
  const handle =
    M(x + s * 0.92, y - s * 0.35) +
    C(x + s * 1.55, y - s * 0.45, x + s * 1.5, y + s * 0.25, x + s * 0.7, y + s * 0.15);
  let out =
    h('ellipse', { cx: x, cy: y + s * 0.42, rx: s * 1.2, ry: s * 0.24, ...st('#e8f1ff', 0.5, 3) }) +
    h('path', {
      d: handle,
      fill: 'none',
      stroke: '#9fb8e0',
      'stroke-width': s * 0.18,
      'stroke-linecap': 'round',
    }) +
    h('path', { d: cup, ...st('#ffffff', 0.45, 3.5) }) +
    h('path', {
      d: M(x - s * 0.7, y - s * 0.2) + Q(x, y + s * 0.15, x + s * 0.7, y - s * 0.2),
      fill: 'none',
      stroke: '#4f7bd0',
      'stroke-width': s * 0.12,
      'stroke-dasharray': `${(s * 0.18).toFixed(1)} ${(s * 0.14).toFixed(1)}`,
    });
  if (fruit) out += fruitBit(x, y - s * 0.7, s * 0.55, fruit);
  if (lid === 'on')
    out +=
      h('path', {
        d: M(x - s * 1.02, y - s * 0.6) + Q(x, y - s * 1.25, x + s * 1.02, y - s * 0.6) + 'Z',
        ...st('#ffffff', 0.45, 3.5),
      }) + h('circle', { cx: x, cy: y - s * 1.0, r: s * 0.14, ...st('#9fb8e0', 0.5, 2.5) });
  if (lid === 'lifted')
    out += h(
      'g',
      { transform: `rotate(-24 ${x - s} ${y - s * 0.6})` },
      h('path', {
        d: M(x - s * 1.02, y - s * 1.0) + Q(x, y - s * 1.65, x + s * 1.02, y - s * 1.0) + 'Z',
        ...st('#ffffff', 0.45, 3.5),
      }),
    );
  return out;
}

function fruitBit(x: number, y: number, r: number, kind: string): string {
  switch (kind) {
    case 'plum':
      return (
        h('ellipse', { cx: x, cy: y, rx: r * 0.9, ry: r, ...st('#6a3f9e', 0.5, 3) }) +
        h('path', { d: M(x, y - r) + L(x + 2, y - r * 1.4), stroke: '#7a5230', 'stroke-width': 3 })
      );
    case 'cherries':
      return (
        h('path', {
          d:
            M(x - r * 0.45, y) +
            Q(x, y - r * 1.4, x + r * 0.2, y - r * 1.6) +
            M(x + r * 0.5, y) +
            Q(x + r * 0.3, y - r * 1.2, x + r * 0.2, y - r * 1.6),
          fill: 'none',
          stroke: '#5f7a2a',
          'stroke-width': 2.5,
        }) +
        h('circle', { cx: x - r * 0.45, cy: y, r: r * 0.55, ...st('#d7263d', 0.5, 2.5) }) +
        h('circle', { cx: x + r * 0.5, cy: y + r * 0.1, r: r * 0.55, ...st('#e8303f', 0.5, 2.5) })
      );
    case 'pear':
      return h('path', { d: eggD(x, y, r * 1.5, r * 2.1), ...st('#c9d64a', 0.5, 3) });
    default:
      return (
        h('circle', { cx: x, cy: y, r, ...st('#e8423f', 0.5, 3) }) +
        h('path', {
          d: M(x, y - r) + L(x + 2, y - r * 1.45),
          stroke: '#7a5230',
          'stroke-width': 3,
        }) +
        h('path', {
          d:
            M(x + 2, y - r * 1.2) +
            Q(x + r * 0.8, y - r * 1.6, x + r, y - r * 1.1) +
            Q(x + r * 0.5, y - r, x + 2, y - r * 1.2) +
            'Z',
          fill: '#5cbf5a',
        })
      );
  }
}

function waterGoblin(state: BossState, p: P): string {
  const skin = '#86cfae';
  const coat = '#2f8f6a';
  const g = p('vodnik');
  const won = state === 'won';
  const drips = [
    [168, 452],
    [196, 466],
    [320, 466],
    [346, 452],
  ]
    .map(([x, y]) =>
      h('path', {
        d: M(x!, y!) + Q(x! + 7, y! + 12, x!, y! + 16) + Q(x! - 7, y! + 12, x!, y!) + 'Z',
        fill: '#7fd0ff',
        stroke: '#2f7ac0',
        'stroke-width': 2,
      }),
    )
    .join('');
  const body =
    h('defs', null, bodyGrad(g, coat, 256, 340, 150)) +
    boot(214, 470, 48, '#2a4a40', -1) +
    boot(298, 470, 48, '#2a4a40', 1) +
    h('path', {
      d:
        M(256, 248) +
        C(330, 248, 352, 320, 362, 452) +
        L(300, 440) +
        L(256, 452) +
        L(212, 440) +
        L(150, 452) +
        C(160, 320, 182, 248, 256, 248) +
        'Z',
      fill: `url(#${g})`,
      stroke: outlineOf(coat, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(226, 256) + L(256, 330) + L(286, 256) + Q(256, 266, 226, 256) + 'Z',
      ...st('#fff6e0', 0.45),
    }) +
    h('path', {
      d: M(238, 262) + L(256, 286) + L(274, 262) + L(268, 300) + L(256, 290) + L(244, 300) + 'Z',
      ...st('#e0335a', 0.55, 3),
    }) +
    [340, 380, 420]
      .map((y) => h('circle', { cx: 256, cy: y, r: 6, ...st('#ffd23f', 0.55, 2.5) }))
      .join('') +
    drips;
  const hairDrips = [196, 214, 298, 316]
    .map((x, i) =>
      h('path', {
        d: M(x, 196) + Q(x + (i < 2 ? -6 : 6), 226, x, 244),
        fill: 'none',
        stroke: '#2f8f6a',
        'stroke-width': 9,
        'stroke-linecap': 'round',
      }),
    )
    .join('');
  const head =
    hairDrips +
    h('ellipse', { cx: 256, cy: 196, rx: 78, ry: 66, ...st(skin) }) +
    [
      [210, 158],
      [300, 160],
      [228, 236],
    ]
      .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 4, fill: darken(skin, 0.2), opacity: 0.6 }))
      .join('') +
    face({
      cx: 256,
      cy: 186,
      dx: 32,
      r: 13,
      eyes: won ? 'happy' : 'wide',
      brows: state === 'start' ? 'grumpy' : 'raised',
      mouth: state === 'start' ? 'pout' : won ? 'grin' : 'smile',
      my: 228,
      mw: 70,
      skin,
      blush: 0.45,
      browColor: '#1f6b4a',
    }) +
    // top hat with ribbons
    h('ellipse', { cx: 256, cy: 140, rx: 92, ry: 16, ...st('#24403a') }) +
    h('path', {
      d: M(208, 140) + L(204, 56) + Q(256, 44, 308, 56) + L(304, 140) + Q(256, 150, 208, 140) + 'Z',
      ...st('#2f5a50'),
    }) +
    h('path', {
      d: M(207, 118) + Q(256, 126, 305, 118) + L(304, 134) + Q(256, 142, 208, 134) + 'Z',
      fill: '#e0335a',
    }) +
    h('path', {
      d:
        M(300, 126) +
        C(326, 140, 334, 170, 330, 196) +
        M(304, 130) +
        C(340, 146, 352, 170, 350, 186) +
        M(306, 128) +
        C(330, 128, 356, 144, 366, 160),
      fill: 'none',
      stroke: '#ffd23f',
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(304, 130) + C(316, 150, 312, 176, 300, 196),
      fill: 'none',
      stroke: '#4aa8ff',
      'stroke-width': 5,
      'stroke-linecap': 'round',
    });
  let arms = '';
  if (state === 'start') {
    arms =
      arm(
        [
          { x: 192, y: 290 },
          { x: 170, y: 350 },
          { x: 214, y: 380 },
        ],
        32,
        coat,
      ) +
      arm(
        [
          { x: 320, y: 290 },
          { x: 342, y: 350 },
          { x: 298, y: 380 },
        ],
        32,
        coat,
      ) +
      teacup(232, 372, 28, 'on') +
      teacup(290, 380, 28, 'on') +
      hand(206, 386, 15, skin) +
      hand(306, 388, 15, skin);
  } else if (state === 'warming') {
    arms =
      arm(
        [
          { x: 192, y: 290 },
          { x: 170, y: 350 },
          { x: 214, y: 384 },
        ],
        32,
        coat,
      ) +
      teacup(246, 384, 30, 'lifted', 'plum') +
      hand(208, 390, 15, skin) +
      arm(
        [
          { x: 320, y: 290 },
          { x: 368, y: 300 },
          { x: 384, y: 250 },
        ],
        32,
        coat,
      ) +
      hand(384, 244, 15, skin, -90);
  } else {
    arms =
      arm(
        [
          { x: 192, y: 290 },
          { x: 150, y: 330 },
          { x: 132, y: 370 },
        ],
        32,
        coat,
      ) +
      teacup(110, 398, 30, 'off', 'apple') +
      hand(132, 378, 15, skin) +
      arm(
        [
          { x: 320, y: 290 },
          { x: 362, y: 330 },
          { x: 380, y: 370 },
        ],
        32,
        coat,
      ) +
      teacup(404, 398, 30, 'off', 'cherries') +
      hand(380, 378, 15, skin) +
      fruitBit(176, 300, 13, 'plum') +
      fruitBit(338, 300, 13, 'pear') +
      fruitBit(150, 250, 12, 'apple') +
      sparkles([
        [110, 180, 13],
        [404, 170, 12],
      ]);
  }
  return ground(256, 160) + body + head + arms;
}

// ---------------------------------------------------------------------------------------------
// 6. Lake Nymphs (vily): three water fairies who love dancing. Make them laugh and dance.

function nymph(
  cx: number,
  cy: number,
  k: number,
  hair: string,
  dress: string,
  state: BossState,
  pose: 'left' | 'mid' | 'right',
  p: P,
  idx: number,
): string {
  const skin = idx === 1 ? '#e8b48a' : idx === 0 ? '#f6d5b8' : '#c98e5e';
  const g = p(`nymph${idx}`);
  const won = state === 'won';
  const s = (n: number): number => n * k;
  const hairBack = h('path', {
    d:
      M(cx - s(52), cy - s(10)) +
      C(cx - s(70), cy + s(80), cx - s(50), cy + s(150), cx - s(30), cy + s(170)) +
      Q(cx, cy + s(150), cx + s(30), cy + s(170)) +
      C(cx + s(50), cy + s(150), cx + s(70), cy + s(80), cx + s(52), cy - s(10)) +
      C(cx + s(40), cy - s(70), cx - s(40), cy - s(70), cx - s(52), cy - s(10)) +
      'Z',
    ...st(hair, 0.5),
  });
  const dressD =
    M(cx, cy + s(60)) +
    C(cx + s(56), cy + s(60), cx + s(80), cy + s(170), cx + s(100), cy + s(260)) +
    Q(cx, cy + s(282), cx - s(100), cy + s(260)) +
    C(cx - s(80), cy + s(170), cx - s(56), cy + s(60), cx, cy + s(60)) +
    'Z';
  const waves =
    M(cx - s(90), cy + s(240)) +
    Q(cx - s(60), cy + s(226), cx - s(30), cy + s(240)) +
    Q(cx, cy + s(254), cx + s(30), cy + s(240)) +
    Q(cx + s(60), cy + s(226), cx + s(90), cy + s(240));
  let armsD = '';
  if (state === 'start') {
    armsD =
      arm(
        [
          { x: cx - s(36), y: cy + s(80) },
          { x: cx - s(30), y: cy + s(124) },
          { x: cx - s(8), y: cy + s(40) },
        ],
        s(18),
        skin,
      ) +
      arm(
        [
          { x: cx + s(36), y: cy + s(80) },
          { x: cx + s(30), y: cy + s(124) },
          { x: cx + s(8), y: cy + s(40) },
        ],
        s(18),
        skin,
      );
  } else if (state === 'warming') {
    armsD =
      arm(
        [
          { x: cx - s(36), y: cy + s(80) },
          { x: cx - s(70), y: cy + s(60) },
          { x: cx - s(84), y: cy + s(10) },
        ],
        s(18),
        skin,
      ) +
      arm(
        [
          { x: cx + s(36), y: cy + s(80) },
          { x: cx + s(52), y: cy + s(130) },
          { x: cx + s(40), y: cy + s(160) },
        ],
        s(18),
        skin,
      );
  } else {
    const reachL = pose === 'left' ? -60 : -110;
    const reachR = pose === 'right' ? 60 : 110;
    armsD =
      arm(
        [
          { x: cx - s(36), y: cy + s(80) },
          { x: cx + s(reachL * 0.6), y: cy + s(112) },
          { x: cx + s(reachL), y: cy + s(118) },
        ],
        s(18),
        skin,
      ) +
      arm(
        [
          { x: cx + s(36), y: cy + s(80) },
          { x: cx + s(reachR * 0.6), y: cy + s(112) },
          { x: cx + s(reachR), y: cy + s(118) },
        ],
        s(18),
        skin,
      );
  }
  const wreath = [-60, -30, 0, 30, 60]
    .map((a, i) => {
      const q = polar(cx, cy + s(4), s(52), a - 90);
      return flower(
        q.x,
        q.y,
        s(10),
        5,
        ['#ffffff', '#ffd23f', '#ff9fbf', '#b98cff', '#ffffff'][i]!,
        '#ffd23f',
        INK,
        1.5,
      );
    })
    .join('');
  return (
    hairBack +
    h(
      'defs',
      null,
      h(
        'linearGradient',
        { id: g, x1: 0, y1: 0, x2: 0, y2: 1 },
        h('stop', { offset: '0', 'stop-color': '#ffffff' }),
        h('stop', { offset: '1', 'stop-color': dress }),
      ),
    ) +
    h('path', {
      d: dressD,
      fill: `url(#${g})`,
      stroke: outlineOf(dress, 0.5),
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: waves,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': s(5),
      'stroke-linecap': 'round',
      opacity: 0.85,
    }) +
    armsD +
    h('ellipse', { cx, cy, rx: s(46), ry: s(48), ...st(skin) }) +
    h('path', {
      d:
        M(cx - s(46), cy - s(4)) +
        C(cx - s(40), cy - s(52), cx + s(40), cy - s(52), cx + s(46), cy - s(4)) +
        C(cx + s(26), cy - s(30), cx - s(10), cy - s(26), cx - s(46), cy - s(4)) +
        'Z',
      ...st(hair, 0.5),
    }) +
    face({
      cx,
      cy: cy + s(4),
      dx: s(17),
      r: s(7),
      eyes: state === 'start' ? (pose === 'mid' ? 'side' : 'happy') : won ? 'happy' : 'open',
      brows: 'soft',
      mouth: state === 'start' ? 'wobbly' : won ? 'laugh' : 'smile',
      my: cy + s(28),
      mw: s(30),
      skin,
      blush: 0.6,
      browColor: darken(hair, 0.3),
      look: pose === 'mid' ? 1 : 0,
    }) +
    wreath
  );
}

function lakeNymphs(state: BossState, p: P): string {
  const lilies = [
    [70, 470],
    [446, 470],
  ]
    .map(
      ([x, y]) =>
        h('ellipse', { cx: x!, cy: y!, rx: 40, ry: 12, ...st('#5cbf5a', 0.55, 3) }) +
        flower(x!, y! - 10, 11, 6, '#ffffff', '#ffd23f', INK, 1.8),
    )
    .join('');
  const water =
    h('ellipse', { cx: 256, cy: 474, rx: 236, ry: 26, fill: '#9fdcff', opacity: 0.55 }) +
    h('path', {
      d: M(60, 472) + Q(100, 464, 140, 472) + M(372, 472) + Q(412, 464, 452, 472),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 4,
      'stroke-linecap': 'round',
      opacity: 0.8,
    });
  const won = state === 'won';
  return (
    water +
    lilies +
    nymph(126, 196, 0.82, '#b98cff', '#cfc0ff', state, 'left', p, 0) +
    nymph(386, 196, 0.82, '#5cc4a8', '#bdf0e0', state, 'right', p, 2) +
    nymph(256, 160, 0.95, '#4aa8ff', '#bfe3ff', state, 'mid', p, 1) +
    (won
      ? sparkles([
          [256, 50, 16],
          [80, 90, 13],
          [430, 90, 13],
          [256, 300, 10],
        ])
      : state === 'start'
        ? h('path', { d: sparkleD(420, 60, 12) + sparkleD(96, 70, 10), fill: '#bfe3ff' })
        : '')
  );
}

// ---------------------------------------------------------------------------------------------
// 7. Friendly Giant: sits down to listen. Make him so calm and happy that he falls asleep.

function friendlyGiant(state: BossState, p: P): string {
  const skin = '#e8b48a';
  const overalls = '#4a7bd0';
  const shirt = '#e0533a';
  const g = p('giant');
  const asleep = state === 'won';
  const body =
    h('defs', null, bodyGrad(g, overalls, 256, 380, 220)) +
    h('ellipse', { cx: 150, cy: 470, rx: 92, ry: 30, ...st('#7a4f2a') }) +
    h('ellipse', { cx: 362, cy: 470, rx: 92, ry: 30, ...st('#7a4f2a') }) +
    h('path', {
      d:
        M(256, 240) +
        C(420, 240, 462, 330, 452, 430) +
        Q(256, 470, 60, 430) +
        C(50, 330, 92, 240, 256, 240) +
        'Z',
      fill: shirt,
      stroke: outlineOf(shirt, 0.55),
      'stroke-width': 5,
    }) +
    h('path', {
      d:
        M(80, 300) +
        L(432, 300) +
        M(70, 360) +
        L(442, 360) +
        M(150, 250) +
        L(140, 440) +
        M(362, 250) +
        L(372, 440),
      stroke: darken(shirt, 0.2),
      'stroke-width': 4,
      opacity: 0.5,
    }) +
    h('path', {
      d: M(150, 300) + L(362, 300) + L(380, 440) + Q(256, 462, 132, 440) + 'Z',
      fill: `url(#${g})`,
      stroke: outlineOf(overalls, 0.55),
      'stroke-width': 5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(170, 300) + L(150, 252) + M(342, 300) + L(362, 252),
      stroke: overalls,
      'stroke-width': 18,
      'stroke-linecap': 'round',
    }) +
    [170, 342]
      .map((x) => h('circle', { cx: x, cy: 304, r: 8, ...st('#ffd23f', 0.55, 3) }))
      .join('') +
    h('path', { d: roundRectD(214, 340, 84, 60, 10), ...st(lighten(overalls, 0.15), 0.55, 3.5) }) +
    flower(256, 370, 18, 8, '#ffd23f', '#8a5a2e', INK, 2) +
    h('path', {
      d: roundRectD(320, 400, 40, 34, 4),
      fill: '#f5d27e',
      stroke: outlineOf('#f5d27e', 0.55),
      'stroke-width': 3,
      'stroke-dasharray': '6 4',
    });
  const headY = asleep ? 168 : 150;
  const head = h(
    'g',
    { transform: asleep ? 'rotate(-10 256 236)' : '' },
    h('ellipse', { cx: 156, cy: headY + 10, rx: 20, ry: 28, ...st(skin) }),
    h('ellipse', { cx: 356, cy: headY + 10, rx: 20, ry: 28, ...st(skin) }),
    h('ellipse', { cx: 256, cy: headY, rx: 100, ry: 96, ...st(skin) }),
    cloudUnion(
      [
        { x: 196, y: headY - 78, r: 32 },
        { x: 240, y: headY - 96, r: 36 },
        { x: 290, y: headY - 92, r: 34 },
        { x: 328, y: headY - 66, r: 28 },
        { x: 172, y: headY - 50, r: 24 },
      ],
      '#8a5a2e',
      '#4f3018',
      5,
    ),
    [
      [214, headY + 22],
      [224, headY + 30],
      [290, headY + 22],
      [300, headY + 30],
    ]
      .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 3, fill: darken(skin, 0.3), opacity: 0.7 }))
      .join(''),
    face({
      cx: 256,
      cy: headY - 8,
      dx: 40,
      r: 13,
      eyes: asleep ? 'closed' : state === 'warming' ? 'sleepy' : 'open',
      brows: state === 'start' ? 'raised' : 'soft',
      mouth: asleep ? 'snore' : state === 'warming' ? 'o' : 'smile',
      my: headY + 50,
      mw: state === 'warming' ? 90 : 70,
      skin,
      blush: 0.5,
      browColor: '#4f3018',
    }),
    h('ellipse', { cx: 256, cy: headY + 22, rx: 22, ry: 18, ...st(darken(skin, 0.1)) }),
  );
  let arms = '';
  if (state === 'start') {
    arms =
      arm(
        [
          { x: 96, y: 300 },
          { x: 70, y: 380 },
          { x: 120, y: 420 },
        ],
        52,
        shirt,
      ) +
      hand(124, 420, 26, skin) +
      arm(
        [
          { x: 416, y: 300 },
          { x: 452, y: 230 },
          { x: 384, y: 120 },
        ],
        52,
        shirt,
      ) +
      hand(380, 112, 26, skin, -90) +
      questionMarks(430, 60, 32);
  } else if (state === 'warming') {
    arms =
      arm(
        [
          { x: 96, y: 300 },
          { x: 70, y: 380 },
          { x: 120, y: 420 },
        ],
        52,
        shirt,
      ) +
      hand(124, 420, 26, skin) +
      arm(
        [
          { x: 416, y: 300 },
          { x: 420, y: 250 },
          { x: 330, y: 214 },
        ],
        52,
        shirt,
      ) +
      hand(322, 210, 26, skin, 180);
  } else {
    arms =
      arm(
        [
          { x: 96, y: 300 },
          { x: 110, y: 390 },
          { x: 214, y: 418 },
        ],
        52,
        shirt,
      ) +
      arm(
        [
          { x: 416, y: 300 },
          { x: 402, y: 390 },
          { x: 298, y: 418 },
        ],
        52,
        shirt,
      ) +
      hand(222, 420, 26, skin) +
      hand(290, 420, 26, skin) +
      zzz(370, 70, 36);
  }
  return ground(256, 230) + body + head + arms;
}

// ---------------------------------------------------------------------------------------------
// 8. Golem: a clay helper who follows instructions in the right order (lamps 1, 2, 3).

function digitD(n: number, x: number, y: number, s: number): string {
  switch (n) {
    case 1:
      return (
        M(x - s * 0.15, y - s * 0.35) + L(x + s * 0.05, y - s * 0.5) + L(x + s * 0.05, y + s * 0.5)
      );
    case 2:
      return (
        M(x - s * 0.3, y - s * 0.25) +
        Q(x - s * 0.2, y - s * 0.55, x + s * 0.05, y - s * 0.5) +
        Q(x + s * 0.4, y - s * 0.4, x + s * 0.2, y - s * 0.05) +
        L(x - s * 0.32, y + s * 0.5) +
        L(x + s * 0.34, y + s * 0.5)
      );
    default:
      return (
        M(x - s * 0.3, y - s * 0.4) +
        Q(x, y - s * 0.62, x + s * 0.24, y - s * 0.36) +
        Q(x + s * 0.3, y - s * 0.08, x - s * 0.06, y - s * 0.02) +
        Q(x + s * 0.36, y + s * 0.04, x + s * 0.26, y + s * 0.34) +
        Q(x, y + s * 0.62, x - s * 0.32, y + s * 0.4)
      );
  }
}

function golem(state: BossState, p: P): string {
  const clay = '#c9794a';
  const g = p('golem');
  const lit = state === 'start' ? 0 : state === 'warming' ? 2 : 3;
  const won = state === 'won';
  const body =
    h('defs', null, bodyGrad(g, clay, 256, 330, 200)) +
    rr(178, 400, 56, 66, 14, darken(clay, 0.08)) +
    rr(278, 400, 56, 66, 14, darken(clay, 0.08)) +
    rr(162, 446, 84, 30, 12, darken(clay, 0.18)) +
    rr(266, 446, 84, 30, 12, darken(clay, 0.18)) +
    h('path', {
      d: roundRectD(150, 226, 212, 196, 40),
      fill: `url(#${g})`,
      stroke: outlineOf(clay, 0.6),
      'stroke-width': 5.5,
    }) +
    h('path', {
      d:
        M(170, 250) +
        Q(180, 240, 196, 244) +
        M(330, 400) +
        Q(344, 392, 344, 376) +
        M(176, 380) +
        L(190, 372),
      stroke: darken(clay, 0.25),
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.6,
    }) +
    [0, 1, 2]
      .map((i) => {
        const x = 202 + i * 54;
        const y = 318;
        const on = i < lit;
        return (
          (on ? h('circle', { cx: x, cy: y, r: 30, fill: '#ffe680', opacity: 0.45 }) : '') +
          h('circle', {
            cx: x,
            cy: y,
            r: 21,
            fill: on ? '#ffd23f' : '#7a4a2e',
            stroke: outlineOf(clay, 0.6),
            'stroke-width': 4,
          }) +
          h('path', {
            d: digitD(i + 1, x, y, 22),
            fill: 'none',
            stroke: on ? '#8a4a00' : '#c9a084',
            'stroke-width': 4,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          })
        );
      })
      .join('');
  const head =
    h('path', { d: roundRectD(184, 92, 144, 140, 34), ...st(clay, 0.6, 5.5) }) +
    h('path', {
      d: roundStarD(256, 124, 5, 13, 6, -90, 0.2),
      fill: darken(clay, 0.2),
      stroke: darken(clay, 0.35),
      'stroke-width': 2,
    }) +
    face({
      cx: 256,
      cy: 168,
      dx: 30,
      r: 11,
      eyes: won ? 'happy' : state === 'start' ? 'wide' : 'open',
      brows: state === 'start' ? 'worried' : 'soft',
      mouth: state === 'start' ? 'wobbly' : won ? 'grin' : 'smile',
      my: 204,
      mw: 56,
      skin: clay,
      blush: 0.35,
      browColor: darken(clay, 0.4),
      look: state === 'start' ? -1 : 0,
    });
  let arms = '';
  if (state === 'start') {
    arms =
      rr(84, 240, 70, 46, 20, clay) +
      rr(358, 240, 70, 46, 20, clay) +
      hand(84, 256, 22, clay, 180) +
      hand(428, 256, 22, clay, 0) +
      questionMarks(330, 50, 34);
  } else if (state === 'warming') {
    arms =
      rr(116, 240, 50, 120, 22, clay) +
      hand(140, 372, 24, clay, 90) +
      h('g', { transform: 'rotate(35 376 250)' }, rr(352, 160, 50, 110, 22, clay)) +
      hand(428, 166, 24, clay, -60);
  } else {
    arms =
      h('g', { transform: 'rotate(-35 136 250)' }, rr(112, 140, 50, 116, 22, clay)) +
      h('g', { transform: 'rotate(35 376 250)' }, rr(352, 140, 50, 116, 22, clay)) +
      hand(74, 152, 25, clay, -120) +
      hand(440, 152, 25, clay, -60) +
      sparkles([
        [100, 70, 16],
        [420, 64, 14],
        [256, 40, 12],
      ]);
  }
  return ground(256, 160) + body + arms + head;
}

// ---------------------------------------------------------------------------------------------

const DRAW: Record<string, (state: BossState, p: P) => string> = {
  'bridge-troll': bridgeTroll,
  'forest-witch': forestWitch,
  krakonos,
  'gnome-king': gnomeKing,
  'water-goblin': waterGoblin,
  'lake-nymphs': lakeNymphs,
  'friendly-giant': friendlyGiant,
  golem,
};

export interface BossOptions {
  size?: number;
  idPrefix?: string;
  title?: string;
  animated?: boolean;
  embedStyles?: boolean;
}

/** Renders a boss in one of its three states on the 512 x 512 character canvas (feet at y = 470). */
export function renderBoss(id: string, state: BossState, opts: BossOptions = {}): string {
  if (!(BOSS_STATES as readonly string[]).includes(state))
    throw new Error(`Unknown boss state: ${state}`);
  const prefix = opts.idPrefix ?? `dv-boss-${id}`;
  if (id === 'seven-headed') {
    const cured = state === 'start' ? 0 : state === 'warming' ? 4 : 7;
    const svg = renderSevenHeaded(
      {
        dragon: 'seven-headed',
        stage: 'adult',
        expression: state === 'won' ? 'happy' : 'idle',
        idPrefix: prefix,
        framing: 'fit',
        size: opts.size,
        title: opts.title,
        animated: opts.animated,
        embedStyles: opts.embedStyles,
      },
      getRecipe('seven-headed'),
      cured,
    );
    return svg.replace(
      'class="dv-dragon',
      `data-boss="${id}" data-state="${state}" class="dv-boss dv-dragon`,
    );
  }
  const draw = DRAW[id];
  if (!draw) throw new Error(`Unknown boss id: ${id}`);
  const sc = scoped(prefix);
  const animated = opts.animated ?? true;
  return svgDoc(
    {
      viewBox: [0, 0, 512, 512],
      width: opts.size,
      height: opts.size,
      className: ['dv-boss', animated ? 'dv-animated' : ''].filter(Boolean).join(' '),
      title: opts.title,
      idPrefix: prefix,
      data: { boss: id, state, expression: state === 'won' ? 'happy' : 'idle' },
      style: opts.embedStyles ? ANIMATIONS_CSS : undefined,
    },
    draw(state, (n) => sc.id(n)),
  );
}
