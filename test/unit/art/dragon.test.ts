import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DRAGON_IDS,
  COSMETIC_SLOTS,
  DRAGON_EXPRESSIONS,
  DRAGON_STAGES,
  GUIDE_ID,
} from '../../../src/rules/contract/ids';
import {
  ANIMATIONS_CSS,
  COSMETICS,
  DRAGON_RECIPES,
  getDragonAnchors,
  parseRecipe,
  renderDragon,
  renderHatch,
} from '../../../src/app/art';
import { checkChildSafe } from './svg-check';
import { GOLDEN_CASES } from './golden-cases';

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const ALL_DRAGONS = [...CANONICAL_DRAGON_IDS, GUIDE_ID];

describe('dragon rig', () => {
  it('has a recipe for every canonical dragon and the guide', () => {
    for (const id of ALL_DRAGONS) expect(DRAGON_RECIPES.has(id), id).toBe(true);
    expect(DRAGON_RECIPES.get('ember')?.table).toBe(6);
    expect(DRAGON_RECIPES.get('puff')?.table).toBe(0);
  });

  it('renders every dragon x stage x expression as well-formed, child-safe SVG', () => {
    for (const id of ALL_DRAGONS) {
      for (const stage of DRAGON_STAGES) {
        for (const expression of DRAGON_EXPRESSIONS) {
          const svg = renderDragon({ dragon: id, stage, expression, idPrefix: 't' });
          expect(() => checkChildSafe(svg), `${id} ${stage} ${expression}`).not.toThrow();
          expect(svg).toContain(`data-dragon="${id}"`);
        }
      }
    }
  });

  it('is deterministic: the same options give byte-identical markup', () => {
    const opts = {
      dragon: 'sunny',
      stage: 'adult',
      expression: 'happy',
      idPrefix: 'det',
      outfit: {
        head: 'hat-wizard',
        neck: 'scarf-striped',
        eyes: 'glasses-star',
        wings: 'paint-stars',
        nest: 'nest-flowers',
      },
    } as const;
    expect(renderDragon(opts)).toBe(renderDragon(opts));
    expect(renderHatch({ dragon: 'bubbles', idPrefix: 'h' })).toBe(
      renderHatch({ dragon: 'bubbles', idPrefix: 'h' }),
    );
  });

  it('matches pinned golden digests (cross-platform byte identity)', () => {
    const digests = Object.fromEntries(
      Object.entries(GOLDEN_CASES).map(([name, render]) => [name, sha(render())]),
    );
    expect(digests).toEqual(GOLDENS);
  });

  it('scopes every id with the instance prefix so many dragons can share a page', () => {
    const a = checkChildSafe(renderDragon({ dragon: 'mirror', stage: 'adult', idPrefix: 'one' }));
    const b = checkChildSafe(renderDragon({ dragon: 'mirror', stage: 'adult', idPrefix: 'two' }));
    expect(a.ids.length).toBeGreaterThan(0);
    for (const id of a.ids) expect(id.startsWith('one-')).toBe(true);
    for (const id of b.ids) expect(id.startsWith('two-')).toBe(true);
    expect(() =>
      renderDragon({ dragon: 'mirror', stage: 'adult', idPrefix: '1bad prefix' }),
    ).toThrow();
  });

  it('marks the animatable parts with stable class names', () => {
    const svg = renderDragon({ dragon: 'ember', stage: 'adult', expression: 'eating' });
    for (const cls of [
      'dv-body',
      'dv-head',
      'dv-eye',
      'dv-jaw',
      'dv-wing-l',
      'dv-wing-r',
      'dv-tail',
      'dv-breathe',
      'dv-bounce',
    ]) {
      expect(svg, cls).toContain(cls);
    }
    expect(renderDragon({ dragon: 'ember', stage: 'adult' })).toContain('dv-lid');
  });

  it('exposes anchors for every slot at every stage, inside the view box', () => {
    for (const id of ALL_DRAGONS) {
      for (const stage of DRAGON_STAGES) {
        for (const framing of ['stage', 'fit'] as const) {
          const a = getDragonAnchors({ dragon: id, stage, framing });
          const [x, y, w, hgt] = a.viewBox;
          for (const key of [
            'head',
            'eyes',
            'neck',
            'mouth',
            'belly',
            'nest',
            'wingL',
            'wingR',
            'top',
          ] as const) {
            const p = a[key];
            expect(
              Number.isFinite(p.x) && Number.isFinite(p.y) && p.width > 0,
              `${id} ${stage} ${key}`,
            ).toBe(true);
            expect(
              p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + hgt,
              `${id} ${stage} ${framing} ${key}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('draws every cosmetic on every slot-capable dragon and stage', () => {
    for (const c of COSMETICS) {
      for (const id of ['bubbles', 'clover', 'petal', 'seven-headed']) {
        for (const stage of ['egg', 'hatchling', 'adult'] as const) {
          const svg = renderDragon({
            dragon: id,
            stage,
            idPrefix: 'c',
            outfit: { [c.slot]: c.id },
          });
          expect(() => checkChildSafe(svg), `${c.id} ${id} ${stage}`).not.toThrow();
        }
      }
      const shown = renderDragon({
        dragon: 'sunny',
        stage: 'adult',
        idPrefix: 'c',
        outfit: { [c.slot]: c.id },
      });
      expect(shown, c.id).toContain(`dv-${c.id}`);
    }
    expect(new Set(COSMETICS.map((c) => c.slot))).toEqual(new Set(COSMETIC_SLOTS));
  });

  it('plays the hatch sequence once and falls back to the hatchling without CSS', () => {
    const svg = renderHatch({ dragon: 'goldie', idPrefix: 'hatch' });
    checkChildSafe(svg);
    for (const cls of [
      'dv-hatch-egg',
      'dv-hatch-crack-1',
      'dv-hatch-top',
      'dv-hatch-bottom',
      'dv-hatch-baby',
    ])
      expect(svg).toContain(cls);
    expect(svg).toMatch(/class="dv-hatch-bottom" opacity="0"/);
  });

  it('can embed the animation styles for standalone files', () => {
    const svg = renderDragon({
      dragon: 'petal',
      stage: 'youngling',
      embedStyles: true,
      title: 'Petal the flower dragon',
    });
    checkChildSafe(svg);
    expect(svg).toContain('<style>');
    expect(svg).toContain(ANIMATIONS_CSS.slice(0, 40));
    expect(svg).toContain('role="img"');
  });

  it('validates recipes strictly', () => {
    const good = JSON.parse(JSON.stringify(DRAGON_RECIPES.get('clover')));
    expect(parseRecipe(good).id).toBe('clover');
    expect(() => parseRecipe({ ...good, colors: { ...good.colors, body: 'green' } })).toThrow(
      /colors.body/,
    );
    expect(() => parseRecipe({ ...good, sparkles: true })).toThrow(/not a recipe field/);
    expect(() => parseRecipe({ ...good, wings: { ...good.wings, style: 'jet' } })).toThrow(
      /wings.style/,
    );
  });

  it('keeps each rendered dragon small enough to animate many at once', () => {
    for (const id of ALL_DRAGONS) {
      const svg = renderDragon({
        dragon: id,
        stage: 'crowned',
        expression: 'proud',
        outfit: { head: 'hat-straw', nest: 'nest-flowers', wings: 'paint-galaxy' },
      });
      expect(svg.length, id).toBeLessThan(90_000);
    }
  });
});

// Pinned literals: re-pin with `npm run art:goldens` only after reviewing the gallery.
// goldens:start
const GOLDENS: Record<string, string> = {
  'bubbles hatchling idle': '9bde7df0c40921d14acc5a7875c488c90aaf43695998a1f908a0a8ad3cc14290',
  'sunny adult happy fit': 'ac057989976739d2782676fc3f217bbfc3cff9d30ae1e50e9bc90a1b8ce2d9e9',
  'goldie crowned proud outfit': 'd5a79401feb06d948726a09b04d44b5ab6d83a661f27e940f3e2b77c55a6b016',
  'starry egg cold': '09dd4b9502a99c3deccc0150c009650aab3c39ebb541a583ab2c53c922f314a8',
  'clover hatch': '4f8a78fbe2657af7268b304e9a6ce4988b684e0df23d0787dab48518723fee7d',
};
// goldens:end
