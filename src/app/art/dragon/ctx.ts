import { darken, lighten, mix, outlineOf } from '../svg/color';
import { h, ids, type Ids } from '../svg/xml';
import type { Skeleton } from './skeleton';
import type { DragonExpression, DragonRecipe, Outfit } from './types';

/** Fully derived color set for one dragon. */
export interface Paint {
  body: string;
  bodyLight: string;
  bodyShade: string;
  line: string;
  belly: string;
  bellyLight: string;
  bellyShade: string;
  bellyLine: string;
  wing: string;
  wingLight: string;
  wingShade: string;
  wingLine: string;
  horn: string;
  hornShade: string;
  hornLine: string;
  accent: string;
  accentLight: string;
  accentShade: string;
  accentLine: string;
  accent2: string;
  iris: string;
  irisDark: string;
  irisLight: string;
  cheek: string;
  muzzle: string;
  mouth: string;
  tongue: string;
  sclera: string;
  pupil: string;
}

export function derivePaint(recipe: DragonRecipe): Paint {
  const c = recipe.colors;
  const bodyShade = c.shade ?? darken(c.body, 0.3);
  return {
    body: c.body,
    bodyLight: lighten(c.body, 0.38),
    bodyShade,
    line: outlineOf(mix(c.body, bodyShade, 0.5), 0.58),
    belly: c.belly,
    bellyLight: lighten(c.belly, 0.45),
    bellyShade: darken(c.belly, 0.14),
    bellyLine: outlineOf(c.belly, 0.36),
    wing: c.wing,
    wingLight: lighten(c.wing, 0.4),
    wingShade: darken(c.wing, 0.22),
    wingLine: outlineOf(c.wing, 0.55),
    horn: c.horn,
    hornShade: darken(c.horn, 0.2),
    hornLine: outlineOf(c.horn, 0.6),
    accent: c.accent,
    accentLight: lighten(c.accent, 0.4),
    accentShade: darken(c.accent, 0.25),
    accentLine: outlineOf(c.accent, 0.55),
    accent2: c.accent2 ?? lighten(c.accent, 0.5),
    iris: c.iris,
    irisDark: darken(c.iris, 0.5),
    irisLight: lighten(c.iris, 0.55),
    cheek: c.cheek,
    muzzle: mix(lighten(c.body, 0.42), c.belly, 0.35),
    mouth: '#5b2143',
    tongue: '#ff8fa8',
    sclera: '#fffdf7',
    pupil: '#1f1533',
  };
}

/** Render context shared by all part painters. */
export interface Ctx {
  recipe: DragonRecipe;
  sk: Skeleton;
  paint: Paint;
  ids: Ids;
  expression: DragonExpression;
  outfit: Outfit;
  /** Main outline width. */
  W: number;
  defs: string[];
  /** Registers a def once (by id) and returns its id. */
  def(name: string, markup: (id: string) => string): string;
}

export function makeCtx(
  recipe: DragonRecipe,
  sk: Skeleton,
  prefix: string,
  expression: DragonExpression,
  outfit: Outfit,
): Ctx {
  const scoped = ids(prefix);
  const defs: string[] = [];
  const seen = new Set<string>();
  return {
    recipe,
    sk,
    paint: derivePaint(recipe),
    ids: scoped,
    expression,
    outfit,
    W: 5 * sk.line,
    defs,
    def(name, markup) {
      const id = scoped.id(name);
      if (!seen.has(id)) {
        seen.add(id);
        defs.push(markup(id));
      }
      return id;
    },
  };
}

/** Radial "toy vinyl" gradient: light top-left, base, shade bottom-right (user space). */
export function softGradient(
  ctx: Ctx,
  name: string,
  base: string,
  light: string,
  shade: string,
  box: { cx: number; cy: number; r: number },
): string {
  const id = ctx.def(name, (gid) =>
    h(
      'radialGradient',
      {
        id: gid,
        gradientUnits: 'userSpaceOnUse',
        cx: box.cx - box.r * 0.32,
        cy: box.cy - box.r * 0.42,
        r: box.r * 1.45,
      },
      h('stop', { offset: '0', 'stop-color': light }),
      h('stop', { offset: '0.45', 'stop-color': base }),
      h('stop', { offset: '1', 'stop-color': shade }),
    ),
  );
  return `url(#${id})`;
}

/** Vertical linear gradient in user space. */
export function linearGradient(
  ctx: Ctx,
  name: string,
  stops: Array<[number, string, number?]>,
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const id = ctx.def(name, (gid) =>
    h(
      'linearGradient',
      { id: gid, gradientUnits: 'userSpaceOnUse', x1: from.x, y1: from.y, x2: to.x, y2: to.y },
      ...stops.map(([o, c, a]) =>
        h('stop', {
          offset: String(o),
          'stop-color': c,
          'stop-opacity': a === undefined ? undefined : a,
        }),
      ),
    ),
  );
  return `url(#${id})`;
}

/** Radial glow gradient (center color fading to transparent). */
export function glowGradient(ctx: Ctx, name: string, color: string, inner = 0.75): string {
  const id = ctx.def(name, (gid) =>
    h(
      'radialGradient',
      { id: gid },
      h('stop', { offset: '0', 'stop-color': color, 'stop-opacity': inner }),
      h('stop', { offset: '0.55', 'stop-color': color, 'stop-opacity': inner * 0.45 }),
      h('stop', { offset: '1', 'stop-color': color, 'stop-opacity': 0 }),
    ),
  );
  return `url(#${id})`;
}
