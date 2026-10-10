import { lerp, polar } from '../svg/num';
import { M, L, Q, eggD, polyD, roundStarD } from '../svg/path';
import { h } from '../svg/xml';
import { berry, clover, flame, flower, gearD, pearl, snowflake, sparkleD } from '../glyphs';
import { glowGradient, type Ctx } from './ctx';
import { cloudUnion, pivot } from './shapes';
import { CX, GROUND } from './skeleton';
import { lighten, darken, outlineOf, mix } from '../svg/color';

export const EGG = { cx: CX, cy: GROUND - 128, w: 196, h: 252 };

const RAINBOW = ['#ff5a5f', '#ff9f40', '#ffd93d', '#5ccc6b', '#4aa8ff', '#5b6cf0', '#a66cf0'];

/** Pattern drawn inside the egg (clipped by the caller). */
function eggPattern(ctx: Ctx): string {
  const { base, accent, pattern } = ctx.recipe.egg;
  const { cx, cy, w, h: eh } = EGG;
  const top = cy - eh / 2;
  const line = outlineOf(accent, 0.45);
  const W = 3;
  switch (pattern) {
    case 'clouds': {
      const puff = (x: number, y: number, s: number): string =>
        cloudUnion(
          [
            { x, y, r: s },
            { x: x - s * 0.9, y: y + s * 0.3, r: s * 0.7 },
            { x: x + s * 0.95, y: y + s * 0.25, r: s * 0.75 },
          ],
          '#ffffff',
          lighten(line, 0.3),
          W,
        );
      return (
        puff(cx - 40, cy + 30, 26) +
        puff(cx + 52, cy - 40, 20) +
        h('ellipse', {
          cx: cx + 30,
          cy: cy + 62,
          rx: 22,
          ry: 26,
          fill: 'none',
          stroke: accent,
          'stroke-width': 11,
        }) +
        h('ellipse', {
          cx: cx - 30,
          cy: cy - 70,
          rx: 13,
          ry: 16,
          fill: 'none',
          stroke: accent,
          'stroke-width': 7,
        })
      );
    }
    case 'shine':
      return (
        h('path', {
          d: M(cx - 120, cy + 40) + L(cx + 40, cy - 140),
          stroke: '#ffffff',
          'stroke-width': 26,
          opacity: 0.55,
        }) +
        h('path', {
          d: M(cx - 80, cy + 120) + L(cx + 110, cy - 90),
          stroke: '#ffffff',
          'stroke-width': 12,
          opacity: 0.45,
        }) +
        h('path', { d: sparkleD(cx + 40, cy + 30, 18), fill: '#ffffff' })
      );
    case 'waves': {
      let d = '';
      for (const y of [cy - 10, cy + 60]) {
        d += M(cx - w, y);
        for (let i = 0; i < 6; i++)
          d +=
            Q(cx - w + i * 40 + 20, y - 18, cx - w + i * 40 + 40, y) +
            Q(cx - w + i * 40 + 60, y + 18, cx - w + i * 40 + 80, y);
      }
      const bub = (x: number, y: number, r: number): string =>
        h('circle', {
          cx: x,
          cy: y,
          r,
          fill: '#ffffff',
          'fill-opacity': 0.6,
          stroke: line,
          'stroke-width': 2.5,
        });
      return (
        h('path', {
          d,
          fill: 'none',
          stroke: accent,
          'stroke-width': 14,
          'stroke-linecap': 'round',
        }) +
        bub(cx - 30, cy - 70, 14) +
        bub(cx - 6, cy - 88, 9) +
        bub(cx + 44, cy + 100, 12) +
        bub(cx + 66, cy + 86, 8)
      );
    }
    case 'clovers':
      return (
        clover(cx - 40, cy - 40, 26, accent, line, W) +
        clover(cx + 46, cy + 22, 22, accent, line, W) +
        clover(cx - 20, cy + 82, 20, accent, line, W)
      );
    case 'flowers':
      return (
        flower(cx - 38, cy - 44, 28, 4, accent, '#ffd84a', line, W, -45) +
        flower(cx + 48, cy + 26, 24, 4, accent, '#ffd84a', line, W, -45) +
        flower(cx - 22, cy + 90, 20, 4, accent, '#ffd84a', line, W, -45)
      );
    case 'sun': {
      let rays = '';
      for (let i = 0; i < 5; i++) {
        const a = -90 + i * 72;
        const p0 = polar(cx, cy + 4, 46, a - 12);
        const p1 = polar(cx, cy + 4, 80, a);
        const p2 = polar(cx, cy + 4, 46, a + 12);
        rays += M(p0.x, p0.y) + L(p1.x, p1.y) + L(p2.x, p2.y) + 'Z';
      }
      return (
        h('path', {
          d: rays,
          fill: accent,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('circle', { cx, cy: cy + 4, r: 44, fill: '#fff3a6', stroke: line, 'stroke-width': W })
      );
    }
    case 'flames': {
      let out = '';
      for (let i = 0; i < 5; i++)
        out += h(
          'g',
          { transform: `translate(${(cx - 76 + i * 38).toFixed(2)} ${(cy + 70).toFixed(2)})` },
          flame(42, accent, '#ffe066', line, W),
        );
      out += h(
        'g',
        { transform: `translate(${cx} ${(cy - 16).toFixed(2)})` },
        // "+1": the extra flame uses the dragon's second accent when it has one (Ember: blue).
        flame(
          84,
          ctx.recipe.colors.accent2 ?? accent,
          ctx.recipe.colors.accent2 ? '#e6f4ff' : '#ffe066',
          outlineOf(ctx.recipe.colors.accent2 ?? accent, 0.5),
          W,
        ),
      );
      return out;
    }
    case 'rainbow': {
      let out = '';
      const step = 15;
      RAINBOW.forEach((c, i) => {
        out += h('rect', {
          x: cx - w,
          y: cy - 40 + i * step,
          width: w * 2,
          height: step + 0.5,
          fill: c,
        });
      });
      return out;
    }
    case 'snowflake':
      return (
        snowflake(cx, cy + 6, 62, 8, line, 11) +
        snowflake(cx, cy + 6, 62, 8, '#ffffff', 5) +
        h('path', {
          d: sparkleD(cx - 52, cy - 76, 10) + sparkleD(cx + 58, cy + 78, 8),
          fill: '#ffffff',
        })
      );
    case 'stars': {
      let out = '';
      const pts = [
        [-44, -70],
        [10, -96],
        [50, -54],
        [-60, -14],
        [-6, -28],
        [52, 6],
        [-40, 46],
        [16, 40],
        [56, 70],
        [-12, 98],
      ];
      pts.forEach(([x, y], i) => {
        const d = roundStarD(cx + x!, cy + y!, 5, 13, 6, -90, 0.2);
        out +=
          i < 9
            ? h('path', {
                d,
                fill: accent,
                stroke: line,
                'stroke-width': 2.2,
                'stroke-linejoin': 'round',
              })
            : h('path', {
                d,
                fill: 'none',
                stroke: accent,
                'stroke-width': 2.5,
                'stroke-dasharray': '3 3',
              });
      });
      return out;
    }
    case 'crown': {
      const n = 10;
      const bandTop = cy - 6;
      const step = (w + 20) / n;
      let d = M(cx - w / 2 - 10, cy + 30) + L(cx - w / 2 - 10, bandTop);
      for (let i = 0; i < n; i++) {
        d +=
          L(cx - w / 2 - 10 + step * (i + 0.5), bandTop - 30) +
          L(cx - w / 2 - 10 + step * (i + 1), bandTop);
      }
      d += L(cx + w / 2 + 10, cy + 30) + 'Z';
      return (
        h('path', {
          d,
          fill: accent,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('circle', { cx, cy: cy + 12, r: 9, fill: '#e0335a', stroke: line, 'stroke-width': 2 }) +
        h('circle', {
          cx: cx - 44,
          cy: cy + 12,
          r: 7,
          fill: '#3d7be0',
          stroke: line,
          'stroke-width': 2,
        }) +
        h('circle', {
          cx: cx + 44,
          cy: cy + 12,
          r: 7,
          fill: '#3d7be0',
          stroke: line,
          'stroke-width': 2,
        })
      );
    }
    case 'scallops': {
      let d = '';
      for (let row = 0; row < 9; row++) {
        const y = top + 40 + row * 26;
        const off = row % 2 ? 0 : 16;
        for (let x = cx - w / 2 - 40 + off; x < cx + w / 2 + 40; x += 32)
          d += M(x - 16, y) + Q(x, y + 18, x + 16, y);
      }
      return (
        h('path', {
          d,
          fill: 'none',
          stroke: accent,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          opacity: 0.8,
        }) +
        pearl(cx + 30, cy + 40, 14, line, 2) +
        pearl(cx - 40, cy - 30, 11, line, 2)
      );
    }
    case 'speckles': {
      let out = '';
      const spots = [
        [-50, -60, 9],
        [30, -80, 6],
        [60, -20, 10],
        [-20, 0, 7],
        [-66, 40, 8],
        [20, 50, 12],
        [56, 90, 6],
        [-30, 100, 7],
        [0, -110, 5],
      ];
      for (const [x, y, r] of spots)
        out += h('circle', { cx: cx + x!, cy: cy + y!, r: r!, fill: accent, opacity: 0.75 });
      out += h('path', {
        d: M(cx - w / 2, cy - 20) + Q(cx - 40, cy - 60, cx - 10, cy - 90),
        fill: 'none',
        stroke: darken(base, 0.35),
        'stroke-width': 3,
        opacity: 0.5,
      });
      out += cloudUnion(
        [
          { x: cx + 40, y: top + 30, r: 22 },
          { x: cx + 10, y: top + 24, r: 18 },
          { x: cx + 66, y: top + 44, r: 16 },
        ],
        '#7fae4f',
        '#3f6b2a',
        3,
      );
      return out;
    }
    case 'gears':
      return (
        h('path', {
          d: gearD(cx - 30, cy - 30, 40, 10),
          fill: accent,
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        }) +
        h('path', {
          d: gearD(cx + 36, cy + 30, 30, 8),
          fill: lighten(accent, 0.35),
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        }) +
        h('path', {
          d: gearD(cx - 18, cy + 84, 20, 7),
          fill: accent,
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        })
      );
    case 'polka': {
      // Dot: neat rows of round dots in two colours, easy to count.
      let out = '';
      const second = ctx.paint.accent2;
      for (let row = 0; row < 7; row++) {
        const y = top + 44 + row * 34;
        const off = row % 2 ? 17 : 0;
        for (let x = cx - w / 2 - 20 + off; x < cx + w / 2 + 20; x += 34)
          out += h('circle', {
            cx: x,
            cy: y,
            r: 8,
            fill: (row + Math.round(x / 34)) % 3 === 0 ? second : accent,
            stroke: line,
            'stroke-width': 1.6,
            opacity: 0.9,
          });
      }
      return out;
    }
    case 'hops': {
      // Hop: a little number line round the waist with dotted hop arcs over it.
      const y = cy + 26;
      const x0 = cx - w / 2 - 10;
      const step = 40;
      let ticks = '';
      for (let x = x0 + 18; x < cx + w / 2 + 10; x += step) ticks += M(x, y - 9) + L(x, y + 9);
      let arcs = '';
      for (let x = x0 + 18; x + step < cx + w / 2; x += step)
        arcs += M(x + 3, y - 12) + Q(x + step / 2, y - 52, x + step - 3, y - 12);
      return (
        h('path', {
          d: M(x0, y) + L(cx + w / 2 + 10, y) + ticks,
          fill: 'none',
          stroke: line,
          'stroke-width': 4,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: arcs,
          fill: 'none',
          stroke: accent,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          'stroke-dasharray': '1 8',
        }) +
        h('path', {
          d: M(cx - 70, cy + 90) + Q(cx - 40, cy + 70, cx - 10, cy + 92),
          fill: 'none',
          stroke: lighten(line, 0.25),
          'stroke-width': 3,
          'stroke-linecap': 'round',
          opacity: 0.6,
        }) +
        h('path', { d: sparkleD(cx + 40, cy - 70, 12), fill: '#ffffff', opacity: 0.8 })
      );
    }
    case 'berries': {
      // Nibble: a scatter of round berries with leafy caps.
      let out = '';
      for (const [x, y, r] of [
        [-48, -70, 13],
        [34, -92, 10],
        [52, -22, 15],
        [-24, 6, 12],
        [-62, 58, 11],
        [22, 70, 14],
      ])
        out += berry(cx + x!, cy + y!, r!, accent, line, 2);
      return out;
    }
    case 'beads': {
      // Bead: strings of round beads draped across the shell, five warm then five teal.
      let out = '';
      for (const [row, y0] of [top + 70, top + 150, top + 222].entries()) {
        const sag = 18;
        let wire = '';
        let beads = '';
        for (let i = 0; i <= 10; i++) {
          const x = cx - w / 2 - 6 + (i * (w + 12)) / 10;
          const tt = i / 10;
          const y = y0 + sag * 4 * tt * (1 - tt) + (row % 2 ? -6 : 0);
          wire += i === 0 ? M(x, y) : L(x, y);
          if (i === 0 || i === 10) continue;
          const fill = i <= 5 !== (row % 2 === 1) ? accent : ctx.paint.accent2;
          beads +=
            h('circle', {
              cx: x,
              cy: y,
              r: 9,
              fill,
              stroke: outlineOf(fill, 0.55),
              'stroke-width': 1.8,
            }) + h('circle', { cx: x - 3, cy: y - 3, r: 2.6, fill: '#ffffff', opacity: 0.75 });
        }
        out +=
          h('path', { d: wire, fill: 'none', stroke: line, 'stroke-width': 2, opacity: 0.6 }) +
          beads;
      }
      return out;
    }
    case 'loops': {
      // Tumble: looping somersault arrows and little tumbling cubes.
      let out = '';
      for (const [x, y, s] of [
        [-40, -70, 1],
        [34, 40, 0.85],
        [-30, 110, 0.7],
      ] as const) {
        const ox = cx + x;
        const oy = cy + y;
        const r = 24 * s;
        const d =
          M(ox - r * 2, oy + r) +
          Q(ox - r * 0.6, oy + r * 1.1, ox - r * 0.2, oy) +
          Q(ox + r * 0.2, oy - r * 1.4, ox - r * 0.8, oy - r) +
          Q(ox - r * 1.6, oy - r * 0.2, ox, oy + r * 0.9) +
          Q(ox + r * 0.9, oy + r * 1.3, ox + r * 1.9, oy + r * 0.2);
        out +=
          h('path', {
            d,
            fill: 'none',
            stroke: accent,
            'stroke-width': 5 * s,
            'stroke-linecap': 'round',
          }) +
          h('path', {
            d:
              M(ox + r * 1.3, oy + r * 0.1) +
              L(ox + r * 1.9, oy + r * 0.2) +
              L(ox + r * 1.7, oy + r * 0.8),
            fill: 'none',
            stroke: accent,
            'stroke-width': 5 * s,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          });
      }
      for (const [x, y, a] of [
        [50, -40, 15],
        [-62, 20, -12],
        [56, 108, 24],
        [10, -112, -20],
      ] as const)
        out += h('rect', {
          x: cx + x - 9,
          y: cy + y - 9,
          width: 18,
          height: 18,
          rx: 4,
          fill: ctx.paint.accent2,
          stroke: outlineOf(ctx.paint.accent2, 0.55),
          'stroke-width': 2,
          transform: `rotate(${a} ${cx + x} ${cy + y})`,
        });
      return out;
    }
    case 'coins': {
      // Penny: a scatter of shiny coins, each with an inner ring.
      let out = '';
      for (const [x, y, r] of [
        [-46, -74, 20],
        [38, -96, 14],
        [50, -14, 22],
        [-30, 10, 16],
        [-58, 82, 14],
        [24, 84, 20],
      ] as const) {
        out +=
          h('circle', {
            cx: cx + x,
            cy: cy + y,
            r,
            fill: accent,
            stroke: line,
            'stroke-width': 2.2,
          }) +
          h('circle', {
            cx: cx + x,
            cy: cy + y,
            r: r * 0.72,
            fill: ctx.paint.accent2,
            stroke: line,
            'stroke-width': 1.4,
          }) +
          h('path', {
            d: sparkleD(cx + x - r * 0.3, cy + y - r * 0.3, r * 0.35),
            fill: '#ffffff',
            opacity: 0.85,
          });
      }
      return out;
    }
    case 'toadstools': {
      // Sprout: red spotted toadstools and little brown ones growing up the shell from moss.
      let out = h('path', {
        d:
          M(cx - w, top + eh * 0.86) +
          Q(cx - 60, top + eh * 0.78, cx - 20, top + eh * 0.84) +
          Q(cx + 30, top + eh * 0.76, cx + w, top + eh * 0.84) +
          'V' +
          (top + eh + 10) +
          'H' +
          (cx - w) +
          'Z',
        fill: '#8fbf5a',
        stroke: '#4f7f32',
        'stroke-width': 2.5,
      });
      for (const [x, y, r, red] of [
        [-42, -64, 26, true],
        [40, -96, 15, false],
        [46, -20, 22, true],
        [-20, 30, 15, false],
        [-50, 74, 18, true],
        [30, 70, 13, false],
      ] as const) {
        const fill = red ? accent : ctx.paint.accent2;
        const ox = cx + x;
        const oy = cy + y;
        out +=
          h('path', {
            d:
              M(ox - r * 0.3, oy) +
              L(ox - r * 0.36, oy + r * 0.9) +
              Q(ox, oy + r * 1.05, ox + r * 0.36, oy + r * 0.9) +
              L(ox + r * 0.3, oy) +
              'Z',
            fill: '#fff8ea',
            stroke: outlineOf('#fff8ea', 0.4),
            'stroke-width': 2,
          }) +
          h('path', {
            d:
              M(ox - r, oy + r * 0.1) +
              Q(ox - r, oy - r * 0.9, ox, oy - r * 0.9) +
              Q(ox + r, oy - r * 0.9, ox + r, oy + r * 0.1) +
              Q(ox, oy - r * 0.15, ox - r, oy + r * 0.1) +
              'Z',
            fill,
            stroke: outlineOf(fill, 0.5),
            'stroke-width': 2.2,
            'stroke-linejoin': 'round',
          }) +
          (red
            ? h('circle', { cx: ox - r * 0.4, cy: oy - r * 0.4, r: r * 0.16, fill: '#ffffff' }) +
              h('circle', { cx: ox + r * 0.3, cy: oy - r * 0.55, r: r * 0.12, fill: '#ffffff' }) +
              h('circle', { cx: ox + r * 0.55, cy: oy - r * 0.15, r: r * 0.1, fill: '#ffffff' })
            : h('ellipse', {
                cx: ox - r * 0.3,
                cy: oy - r * 0.5,
                rx: r * 0.3,
                ry: r * 0.14,
                fill: '#ffffff',
                opacity: 0.55,
              }));
      }
      return out;
    }
    case 'tens': {
      // Tenzi: a ten-frame band (eight orange and two yellow make ten), three more beyond it,
      // and the river ford's ripples.
      const slot = 26;
      const x0 = cx - slot * 2.5;
      const y0 = cy - 70;
      let out = h('path', {
        d:
          M(x0 - 6, y0 - 6) +
          'h' +
          (slot * 5 + 12) +
          'v' +
          (slot * 2 + 12) +
          'h' +
          -(slot * 5 + 12) +
          'Z',
        fill: '#ffffff',
        opacity: 0.55,
        stroke: line,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      });
      const dot = (x: number, y: number, warm: boolean): string => {
        const fill = warm ? ctx.paint.accent : ctx.paint.accent2;
        return (
          h('circle', {
            cx: x,
            cy: y,
            r: slot * 0.36,
            fill,
            stroke: outlineOf(fill, 0.55),
            'stroke-width': 2,
          }) + h('circle', { cx: x - 3, cy: y - 3, r: 2.6, fill: '#ffffff', opacity: 0.75 })
        );
      };
      for (let i = 0; i < 10; i++)
        out += dot(x0 + slot * ((i % 5) + 0.5), y0 + slot * (Math.floor(i / 5) + 0.5), i < 8);
      for (let i = 0; i < 3; i++) out += dot(cx - slot + i * slot, y0 + slot * 3.2, false);
      for (const [y, k] of [
        [cy + 70, 1],
        [cy + 100, -1],
        [cy - 104, 1],
      ] as const)
        out += h('path', {
          d:
            M(cx - w / 2, y) +
            Q(cx - w / 4, y - 10 * k, cx, y) +
            Q(cx + w / 4, y + 10 * k, cx + w / 2, y),
          fill: 'none',
          stroke: accent,
          'stroke-width': 5,
          'stroke-linecap': 'round',
          opacity: 0.55,
        });
      return out;
    }
    default: {
      let out = '';
      for (const [x, y, r] of [
        [-40, -50, 18],
        [40, -10, 14],
        [-20, 60, 16],
        [50, 80, 10],
      ])
        out += h('circle', { cx: cx + x!, cy: cy + y!, r: r!, fill: accent });
      return out;
    }
  }
}

export interface EggParts {
  shape: string;
  fill: string;
  body: string;
}

/** The decorated egg (no shadow), as layered markup sharing one clip. */
export function eggArt(ctx: Ctx): EggParts {
  const { cx, cy, w, h: eh } = EGG;
  const d = eggD(cx, cy, w, eh);
  const { base, accent } = ctx.recipe.egg;
  const line = outlineOf(mix(base, accent, 0.4), 0.5);
  const gid = ctx.def('egg-grad', (id) =>
    h(
      'radialGradient',
      { id, gradientUnits: 'userSpaceOnUse', cx: cx - w * 0.18, cy: cy - eh * 0.22, r: eh * 0.7 },
      h('stop', { offset: '0', 'stop-color': lighten(base, 0.55) }),
      h('stop', { offset: '0.5', 'stop-color': base }),
      h('stop', { offset: '1', 'stop-color': darken(base, 0.18) }),
    ),
  );
  const clip = ctx.def('egg-clip', (id) => h('clipPath', { id }, h('path', { d })));
  const body =
    h('path', { d, fill: `url(#${gid})` }) +
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      eggPattern(ctx),
      h('ellipse', {
        cx: cx + w * 0.2,
        cy: cy + eh * 0.32,
        rx: w * 0.5,
        ry: eh * 0.24,
        fill: darken(base, 0.4),
        opacity: 0.12,
      }),
    ) +
    h('ellipse', {
      cx: cx - w * 0.2,
      cy: cy - eh * 0.26,
      rx: w * 0.13,
      ry: eh * 0.12,
      fill: '#ffffff',
      opacity: 0.6,
      transform: `rotate(-20 ${(cx - w * 0.2).toFixed(2)} ${(cy - eh * 0.26).toFixed(2)})`,
    }) +
    h('path', { d, fill: 'none', stroke: line, 'stroke-width': 5 });
  return { shape: d, fill: `url(#${gid})`, body };
}

/** Zig-zag crack across the egg, used for very warm eggs and the hatch sequence. */
export function crackD(level: number): string {
  const { cx, cy, w } = EGG;
  const y = cy - 22;
  const pts = [
    { x: cx - w * 0.5, y: y + 6 },
    { x: cx - w * 0.36, y: y - 12 },
    { x: cx - w * 0.22, y: y + 10 },
    { x: cx - w * 0.06, y: y - 14 },
    { x: cx + w * 0.08, y: y + 8 },
    { x: cx + w * 0.24, y: y - 12 },
    { x: cx + w * 0.38, y: y + 8 },
    { x: cx + w * 0.5, y: y - 6 },
  ];
  const n = Math.max(2, Math.round(pts.length * Math.min(1, level)));
  const start = Math.floor((pts.length - n) / 2);
  return polyD(pts.slice(start, start + n), false);
}

/** Zig-zag split line as a closed region (top part of the egg) for the hatch shells. */
export function topHalfClipD(): string {
  const { cx, cy, w, h: eh } = EGG;
  const y = cy - 22;
  return (
    M(cx - w, y + 6) +
    L(cx - w * 0.5, y + 6) +
    L(cx - w * 0.36, y - 12) +
    L(cx - w * 0.22, y + 10) +
    L(cx - w * 0.06, y - 14) +
    L(cx + w * 0.08, y + 8) +
    L(cx + w * 0.24, y - 12) +
    L(cx + w * 0.38, y + 8) +
    L(cx + w * 0.5, y - 6) +
    L(cx + w, y - 6) +
    L(cx + w, cy - eh) +
    L(cx - w, cy - eh) +
    'Z'
  );
}

export function bottomHalfClipD(): string {
  const { cx, cy, w, h: eh } = EGG;
  const y = cy - 22;
  return (
    M(cx - w, y + 6) +
    L(cx - w * 0.5, y + 6) +
    L(cx - w * 0.36, y - 12) +
    L(cx - w * 0.22, y + 10) +
    L(cx - w * 0.06, y - 14) +
    L(cx + w * 0.08, y + 8) +
    L(cx + w * 0.24, y - 12) +
    L(cx + w * 0.38, y + 8) +
    L(cx + w * 0.5, y - 6) +
    L(cx + w, y - 6) +
    L(cx + w, cy + eh) +
    L(cx - w, cy + eh) +
    'Z'
  );
}

export function eggShadow(): string {
  return h('ellipse', {
    class: 'dv-shadow',
    cx: CX + 6,
    cy: GROUND + 2,
    rx: EGG.w * 0.5,
    ry: 14,
    fill: '#2a2140',
    opacity: 0.16,
  });
}

/** Static egg with warmth cues. */
export function eggContent(
  ctx: Ctx,
  warmth: number | undefined,
): { back: string; body: string; front: string } {
  const art = eggArt(ctx);
  const { cx, cy, w, h: eh } = EGG;
  let back = '';
  let front = '';
  let over = '';
  if (warmth !== undefined) {
    const wv = Math.max(0, Math.min(1, warmth));
    if (wv < 0.3) {
      // cold: frosty veil, icicle rim, snowflakes
      const k = (0.3 - wv) / 0.3;
      over += h('path', { d: art.shape, fill: '#dff3ff', opacity: lerp(0.2, 0.5, k).toFixed(2) });
      over += h('path', {
        d: art.shape,
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 9,
        opacity: 0.6,
        'stroke-dasharray': '2 14',
        'stroke-linecap': 'round',
      });
      front += h(
        'g',
        { class: 'dv-frost' },
        snowflake(cx - w * 0.62, cy - eh * 0.22, 16, 6, '#9fd6f5', 3.5),
        snowflake(cx + w * 0.62, cy + eh * 0.02, 12, 6, '#9fd6f5', 3),
        snowflake(cx + w * 0.5, cy - eh * 0.45, 9, 6, '#9fd6f5', 2.5),
      );
    } else if (wv >= 0.5) {
      const glow = glowGradient(ctx, 'egg-warm', '#ffb347', lerp(0.35, 0.8, (wv - 0.5) / 0.5));
      back += h(
        'g',
        { transform: `translate(${cx} ${cy.toFixed(2)})` },
        h(
          'g',
          { class: 'dv-egg-glow' },
          h('ellipse', { cx: 0, cy: 0, rx: w * 0.95, ry: eh * 0.78, fill: glow }),
        ),
      );
      if (wv >= 0.85) {
        over += h('path', {
          d: crackD(((wv - 0.85) / 0.15) * 0.6 + 0.4),
          fill: 'none',
          stroke: '#5b3a2a',
          'stroke-width': 4.5,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        });
      }
      front += h(
        'g',
        { class: 'dv-warm-sparkles' },
        h('path', {
          class: 'dv-twinkle dv-twinkle-1',
          d: sparkleD(cx - w * 0.6, cy - eh * 0.3, 11),
          fill: '#ffe08a',
        }),
        h('path', {
          class: 'dv-twinkle dv-twinkle-2',
          d: sparkleD(cx + w * 0.62, cy - eh * 0.1, 9),
          fill: '#ffe08a',
        }),
      );
    }
  }
  const body = pivot(CX, GROUND, 'dv-egg', art.body + over);
  return { back, body, front };
}
