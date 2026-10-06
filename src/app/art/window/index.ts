/**
 * The Magic Window: a stained-glass mosaic of mastery. The hall variant is an arched cathedral
 * window (11 x 11 multiplication panes below, the division facts as a sunburst fan in the arch);
 * the grid variant is a plain, labelled-by-the-shell grid for the parent progress view.
 */
import {
  MASTERY_LEVELS,
  TABLE_MAX,
  TABLE_MIN,
  type MasteryLevel,
} from '../../../rules/contract/ids';
import { polar } from '../svg/num';
import { M, L, A, roundRectD, roundStarD } from '../svg/path';
import { h, svgDoc, ids as scoped } from '../svg/xml';
import { rng } from '../svg/prng';
import { darken, lighten, mix } from '../svg/color';
import { sparkleD } from '../glyphs';
import paletteJson from '../../../../assets/art/palette.json';

export { MASTERY_LEVELS };
export type { MasteryLevel };

/** A pane: a mastery level, optionally flagged as needing polish (a forgotten fact). */
export type PaneState = MasteryLevel | { level: MasteryLevel; needsPolish?: boolean };

export interface MagicWindowOptions {
  /** 11 rows (first factor 0..10) of 11 panes (second factor 0..10). Missing panes are dim. */
  multiplication?: readonly (readonly PaneState[])[];
  /** 10 rows (divisor 1..10) of 11 panes (quotient 0..10). Missing panes are dim. */
  division?: readonly (readonly PaneState[])[];
  idPrefix?: string;
  size?: number;
  title?: string;
  animated?: boolean;
}

const LEAD = paletteJson.mastery.lead;
const GLASS: Record<MasteryLevel, string> = {
  dim: paletteJson.mastery.dim,
  bronze: paletteJson.mastery.bronze,
  silver: paletteJson.mastery.silver,
  gold: paletteJson.mastery.gold,
};
const N = TABLE_MAX - TABLE_MIN + 1;

function norm(p: PaneState | undefined): { level: MasteryLevel; polish: boolean } {
  if (p === undefined) return { level: 'dim', polish: false };
  if (typeof p === 'string') return { level: p, polish: false };
  return { level: p.level, polish: Boolean(p.needsPolish) };
}

/** Per-pane glass color with a gentle hand-made variation (deterministic). */
function glassColor(level: MasteryLevel, seed: number): { fill: string; light: string } {
  const r = rng(seed * 7919 + 17);
  const base = GLASS[level];
  const tints: Record<MasteryLevel, string[]> = {
    dim: ['#3e4466', '#4f4a74', '#454f73'],
    bronze: ['#e09a4a', '#cf7a34', '#d98a3d'],
    silver: ['#d9e8f7', '#c6d8ee', '#e3ecf8'],
    gold: ['#ffd84a', '#ffc824', '#ffe066'],
  };
  const t = tints[level][Math.floor(r() * 3)]!;
  const fill = mix(base, t, 0.6);
  return { fill, light: lighten(fill, level === 'dim' ? 0.12 : 0.45) };
}

function paneArt(
  d: string,
  level: MasteryLevel,
  polish: boolean,
  seed: number,
  cx: number,
  cy: number,
  size: number,
  data: Record<string, string>,
  gid: (n: string) => string,
): string {
  const { fill, light } = glassColor(level, seed);
  const attrs: Record<string, string> = {
    class: `dv-pane dv-pane-${level}${polish ? ' dv-pane-polish' : ''}`,
  };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k}`] = v;
  let out = h('path', { d, fill: `url(#${gid(`g-${level}`)})` });
  out += h('path', { d, fill, opacity: 0.55 });
  if (level !== 'dim') {
    out += h('path', {
      d: M(cx - size * 0.3, cy + size * 0.1) + L(cx - size * 0.05, cy - size * 0.28),
      stroke: light,
      'stroke-width': size * 0.09,
      'stroke-linecap': 'round',
      opacity: 0.8,
    });
  } else {
    out += h('path', {
      d: M(cx - size * 0.25, cy + size * 0.18) + L(cx + size * 0.2, cy - size * 0.22),
      stroke: '#8a90b8',
      'stroke-width': size * 0.05,
      'stroke-linecap': 'round',
      opacity: 0.35,
    });
  }
  if (level === 'gold') {
    out += h('path', {
      class: `dv-twinkle dv-twinkle-${(seed % 3) + 1}`,
      d: sparkleD(cx + size * 0.18, cy - size * 0.16, size * 0.16),
      fill: '#ffffff',
      opacity: 0.95,
    });
  }
  if (polish) {
    const r = rng(seed * 31 + 5);
    let smudge = '';
    for (let i = 0; i < 3; i++) {
      smudge += h('ellipse', {
        cx: cx + (r() - 0.5) * size * 0.5,
        cy: cy + (r() - 0.5) * size * 0.5,
        rx: size * (0.16 + r() * 0.12),
        ry: size * (0.1 + r() * 0.08),
        fill: paletteJson.mastery.polish,
        opacity: 0.55,
      });
    }
    out += h(
      'g',
      { class: 'dv-dust' },
      smudge,
      h('path', {
        d: M(cx - size * 0.2, cy + size * 0.22) + L(cx + size * 0.24, cy + size * 0.22),
        stroke: '#7a705e',
        'stroke-width': size * 0.05,
        'stroke-dasharray': `${(size * 0.06).toFixed(2)} ${(size * 0.05).toFixed(2)}`,
        opacity: 0.7,
      }),
    );
  }
  return h('g', attrs, out);
}

function gradients(gid: (n: string) => string): string {
  return (Object.keys(GLASS) as MasteryLevel[])
    .map((level) =>
      h(
        'radialGradient',
        { id: gid(`g-${level}`), cx: '0.35', cy: '0.3', r: '0.9' },
        h('stop', {
          offset: '0',
          'stop-color': lighten(GLASS[level], level === 'dim' ? 0.1 : 0.55),
        }),
        h('stop', { offset: '0.6', 'stop-color': GLASS[level] }),
        h('stop', {
          offset: '1',
          'stop-color': darken(GLASS[level], level === 'gold' ? 0.12 : 0.25),
        }),
      ),
    )
    .join('');
}

const W = 600;
const H = 872;
const GRID_X = 60;
const GRID_Y = 330;
const GRID_W = 480;
const CELL = GRID_W / N;

/** Pane geometry of the hall window (for hit targets), in the window's 600 x 872 viewBox. */
export function magicWindowLayout(): {
  viewBox: [number, number, number, number];
  multiplication: Array<{
    a: number;
    b: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  arch: { cx: number; cy: number; r: number };
} {
  const mul = [];
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++)
      mul.push({
        a: a + TABLE_MIN,
        b: b + TABLE_MIN,
        x: GRID_X + b * CELL,
        y: GRID_Y + a * CELL,
        width: CELL,
        height: CELL,
      });
  return {
    viewBox: [0, 0, W, H],
    multiplication: mul,
    arch: { cx: W / 2, cy: GRID_Y, r: GRID_W / 2 },
  };
}

/** The hall window: arched frame, multiplication panes and the division sunburst. */
export function renderMagicWindow(opts: MagicWindowOptions = {}): string {
  const prefix = opts.idPrefix ?? 'dv-window';
  const sc = scoped(prefix);
  const gid = (n: string): string => sc.id(n);
  const cx = W / 2;
  const R = GRID_W / 2;
  const archClip = gid('arch');
  const outline =
    M(GRID_X, GRID_Y + GRID_W) +
    L(GRID_X, GRID_Y) +
    A(R, R, 0, 0, 1, GRID_X + GRID_W, GRID_Y) +
    L(GRID_X + GRID_W, GRID_Y + GRID_W) +
    'Z';
  let panes = '';
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const { level, polish } = norm(opts.multiplication?.[a]?.[b]);
      const x = GRID_X + b * CELL;
      const y = GRID_Y + a * CELL;
      const d = roundRectD(x + 2.6, y + 2.6, CELL - 5.2, CELL - 5.2, 6);
      panes += paneArt(
        d,
        level,
        polish,
        a * N + b,
        x + CELL / 2,
        y + CELL / 2,
        CELL,
        { op: 'mul', a: String(a + TABLE_MIN), b: String(b + TABLE_MIN) },
        gid,
      );
    }
  }
  // Division sunburst in the arch: ring = divisor 1..10 (inside out), sector = quotient 0..10 (left to right).
  const hub = R * 0.2;
  const ringW = (R - hub - 6) / 10;
  let fan = '';
  for (let d = 1; d <= 10; d++) {
    const r0 = hub + (d - 1) * ringW + 2;
    const r1 = hub + d * ringW - 2;
    for (let q = 0; q < N; q++) {
      const a0 = 180 + (q * 180) / N + 0.9;
      const a1 = 180 + ((q + 1) * 180) / N - 0.9;
      const p0 = polar(cx, GRID_Y, r1, a0);
      const p1 = polar(cx, GRID_Y, r1, a1);
      const p2 = polar(cx, GRID_Y, r0, a1);
      const p3 = polar(cx, GRID_Y, r0, a0);
      const dd =
        M(p0.x, p0.y) +
        A(r1, r1, 0, 0, 1, p1.x, p1.y) +
        L(p2.x, p2.y) +
        A(r0, r0, 0, 0, 0, p3.x, p3.y) +
        'Z';
      const mid = polar(cx, GRID_Y, (r0 + r1) / 2, (a0 + a1) / 2);
      const { level, polish } = norm(opts.division?.[d - 1]?.[q]);
      fan += paneArt(
        dd,
        level,
        polish,
        500 + d * N + q,
        mid.x,
        mid.y,
        ringW * 1.1,
        {
          op: 'div',
          divisor: String(d),
          quotient: String(q + TABLE_MIN),
          dividend: String(d * (q + TABLE_MIN)),
        },
        gid,
      );
    }
  }
  const total = N * N + 10 * N;
  const lit = [...(opts.multiplication ?? []).flat(), ...(opts.division ?? []).flat()].filter(
    (p) => norm(p).level !== 'dim',
  ).length;
  const hubGlow = lit / total;
  const hubArt =
    h('circle', {
      cx,
      cy: GRID_Y,
      r: hub - 3,
      fill: mix('#4a4f72', '#ffcf33', hubGlow),
      stroke: LEAD,
      'stroke-width': 4,
    }) +
    h('path', {
      d: roundStarD(cx, GRID_Y - hub * 0.12, 7, hub * 0.62, hub * 0.32, -90, 0.2),
      fill: mix('#6b6f8f', '#fff3b0', hubGlow),
      stroke: LEAD,
      'stroke-width': 2.5,
    });
  const frame =
    // stone frame with a keystone and two lanterns of light
    h('path', {
      d:
        M(GRID_X - 40, H - 26) +
        L(GRID_X - 40, GRID_Y) +
        A(R + 40, R + 40, 0, 0, 1, GRID_X + GRID_W + 40, GRID_Y) +
        L(GRID_X + GRID_W + 40, H - 26) +
        'Z',
      fill: `url(#${gid('stone')})`,
      stroke: '#4a3f63',
      'stroke-width': 5,
    }) +
    h('path', { d: outline, fill: LEAD, stroke: '#ffd23f', 'stroke-width': 7 }) +
    h('path', {
      d:
        M(cx - 26, GRID_Y - R - 46) +
        L(cx + 26, GRID_Y - R - 46) +
        L(cx + 18, GRID_Y - R + 2) +
        L(cx - 18, GRID_Y - R + 2) +
        'Z',
      fill: '#c9b48f',
      stroke: '#4a3f63',
      'stroke-width': 4,
    }) +
    h('path', {
      d: roundStarD(cx, GRID_Y - R - 22, 5, 13, 6, -90, 0.2),
      fill: '#ffd23f',
      stroke: '#8a5a00',
      'stroke-width': 2,
    }) +
    [0.14, 0.32, 0.5, 0.68, 0.86]
      .map((k) => {
        const p = polar(cx, GRID_Y, R + 20, 180 + k * 180);
        return h('circle', {
          cx: p.x,
          cy: p.y,
          r: 7,
          fill: '#e8dcc0',
          stroke: '#4a3f63',
          'stroke-width': 3,
        });
      })
      .join('') +
    h('path', {
      d: roundRectD(GRID_X - 54, H - 44, GRID_W + 108, 34, 10),
      fill: '#b8a888',
      stroke: '#4a3f63',
      'stroke-width': 4,
    });
  const defs = h(
    'defs',
    null,
    gradients(gid),
    h(
      'linearGradient',
      { id: gid('stone'), x1: 0, y1: 0, x2: 1, y2: 1 },
      h('stop', { offset: '0', 'stop-color': '#e8dcc0' }),
      h('stop', { offset: '1', 'stop-color': '#b8a888' }),
    ),
    h('clipPath', { id: archClip }, h('path', { d: outline })),
  );
  const animated = opts.animated ?? true;
  return svgDoc(
    {
      viewBox: [0, 0, W, H],
      width: opts.size,
      height: opts.size,
      className: ['dv-window', animated ? 'dv-animated' : ''].filter(Boolean).join(' '),
      title: opts.title,
      idPrefix: prefix,
      data: { lit: String(lit), total: String(total) },
    },
    defs,
    frame,
    h('g', { 'clip-path': `url(#${archClip})` }, panes, fan, hubArt),
    h('path', {
      d: M(GRID_X, GRID_Y) + L(GRID_X + GRID_W, GRID_Y),
      stroke: '#ffd23f',
      'stroke-width': 6,
    }),
  );
}

export interface MasteryGridOptions {
  op: 'mul' | 'div';
  cells?: readonly (readonly PaneState[])[];
  idPrefix?: string;
  size?: number;
  title?: string;
}

/** Plain mastery grid for the parent area (the shell adds axis labels). 11 x 11 or 10 x 11. */
export function renderMasteryGrid(opts: MasteryGridOptions): string {
  const prefix = opts.idPrefix ?? `dv-grid-${opts.op}`;
  const sc = scoped(prefix);
  const gid = (n: string): string => sc.id(n);
  const rows = opts.op === 'mul' ? N : 10;
  const cell = 40;
  let panes = '';
  for (let a = 0; a < rows; a++) {
    for (let b = 0; b < N; b++) {
      const { level, polish } = norm(opts.cells?.[a]?.[b]);
      const x = b * cell;
      const y = a * cell;
      const data: Record<string, string> =
        opts.op === 'mul'
          ? { op: 'mul', a: String(a + TABLE_MIN), b: String(b + TABLE_MIN) }
          : {
              op: 'div',
              divisor: String(a + 1),
              quotient: String(b + TABLE_MIN),
              dividend: String((a + 1) * (b + TABLE_MIN)),
            };
      panes += paneArt(
        roundRectD(x + 2, y + 2, cell - 4, cell - 4, 7),
        level,
        polish,
        a * N + b + (opts.op === 'mul' ? 0 : 500),
        x + cell / 2,
        y + cell / 2,
        cell,
        data,
        gid,
      );
    }
  }
  return svgDoc(
    {
      viewBox: [0, 0, N * cell, rows * cell],
      width: opts.size,
      height: opts.size ? (opts.size * rows) / N : undefined,
      className: 'dv-mastery-grid',
      title: opts.title,
      idPrefix: prefix,
    },
    h('defs', null, gradients(gid)),
    h('path', { d: roundRectD(0, 0, N * cell, rows * cell, 10), fill: LEAD }),
    panes,
  );
}

/** Deterministic sample states for the gallery and tests. */
export function magicWindowSamples(): Array<{ label: string; options: MagicWindowOptions }> {
  const build = (
    seed: string,
    weights: [number, number, number, number],
    polishRate: number,
  ): MagicWindowOptions => {
    const r = rng(seed);
    const pick = (): PaneState => {
      const x = r();
      const level: MasteryLevel =
        x < weights[0]
          ? 'dim'
          : x < weights[0] + weights[1]
            ? 'bronze'
            : x < weights[0] + weights[1] + weights[2]
              ? 'silver'
              : 'gold';
      return level !== 'dim' && r() < polishRate ? { level, needsPolish: true } : level;
    };
    return {
      multiplication: Array.from({ length: N }, () => Array.from({ length: N }, pick)),
      division: Array.from({ length: 10 }, () => Array.from({ length: N }, pick)),
    };
  };
  const gold = (): MagicWindowOptions => ({
    multiplication: Array.from({ length: N }, () =>
      Array.from({ length: N }, (): PaneState => 'gold'),
    ),
    division: Array.from({ length: 10 }, () => Array.from({ length: N }, (): PaneState => 'gold')),
  });
  const firstDay = (): MagicWindowOptions => ({
    multiplication: Array.from({ length: N }, (_, a) =>
      Array.from({ length: N }, (__, b): PaneState =>
        a === 2 || b === 2 || a === 10 || b === 10
          ? 'bronze'
          : a === 1 || b === 1
            ? 'silver'
            : 'dim',
      ),
    ),
  });
  return [
    { label: 'new game: all dim', options: {} },
    { label: 'first week: x1, x2, x10', options: firstDay() },
    {
      label: 'midway: mixed, some need polish',
      options: build('mid', [0.35, 0.3, 0.25, 0.1], 0.12),
    },
    { label: 'late: mostly gold', options: build('late', [0.04, 0.08, 0.22, 0.66], 0.06) },
    { label: 'restored: all gold', options: gold() },
  ];
}
