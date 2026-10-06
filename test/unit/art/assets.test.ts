import { describe, expect, it } from 'vitest';
import {
  ANIMATIONS_CSS,
  FRUIT_IDS,
  GLYPH_ICON_IDS,
  ICON_IDS,
  KEEPER_AVATARS,
  renderAvatar,
  renderIcon,
} from '../../../src/app/art';
import { checkChildSafe } from './svg-check';

describe('animation stylesheet', () => {
  const keyframes = [...ANIMATIONS_CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)];

  it('animates only transform and opacity', () => {
    expect(keyframes.length).toBeGreaterThan(20);
    for (const [, name, body] of keyframes) {
      for (const [, prop] of body!.matchAll(/([a-z-]+)\s*:/g)) {
        expect(['transform', 'opacity'], `${name}: ${prop}`).toContain(prop);
      }
    }
  });

  it('scopes every rule to .dv-animated and honours reduced motion both ways', () => {
    const selectors = ANIMATIONS_CSS.replace(/@keyframes[\s\S]*?\n\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((block) => block.split('{')[0]!.trim())
      .filter((s) => s && !s.startsWith('@media'));
    for (const s of selectors) {
      for (const part of s.split(',')) expect(part, s).toMatch(/\.dv-animated/);
    }
    expect(ANIMATIONS_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(ANIMATIONS_CSS).toMatch(/\[data-reduced-motion=['"]true['"]\] \.dv-animated \*/);
  });

  it('defines the required motions', () => {
    const names = new Set(keyframes.map((k) => k[1]));
    for (const n of [
      'dv-breathe',
      'dv-blink',
      'dv-flap',
      'dv-sway',
      'dv-chew',
      'dv-bounce',
      'dv-tilt',
      'dv-z',
      'dv-glow',
      'dv-twinkle',
      'dv-hatch-wobble',
      'dv-hatch-top',
      'dv-hatch-baby',
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });
});

describe('icons and avatars', () => {
  it('renders every icon as child-safe SVG with scoped ids', () => {
    for (const id of ICON_IDS) {
      const svg = renderIcon(id, { size: 48, idPrefix: `p-${id}` });
      const facts = checkChildSafe(svg);
      for (const x of facts.ids) expect(x.startsWith(`p-${id}-`)).toBe(true);
    }
    expect(() => renderIcon('not-an-icon')).toThrow();
  });

  it('draws UI glyphs in currentColor so buttons can theme them', () => {
    for (const id of GLYPH_ICON_IDS) expect(renderIcon(id), id).toContain('currentColor');
  });

  it('ships the five orchard fruits for Feeding Time', () => {
    expect([...FRUIT_IDS]).toEqual(['apple', 'plum', 'pear', 'cherries', 'berries']);
  });

  it('labels icons for assistive tech only when titled', () => {
    expect(renderIcon('speaker')).toContain('aria-hidden="true"');
    const titled = renderIcon('speaker', { title: 'Read aloud', idPrefix: 'spk' });
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title id="spk-title">Read aloud</title>');
  });

  it('renders all eight keeper avatars', () => {
    expect(KEEPER_AVATARS).toHaveLength(8);
    const all = KEEPER_AVATARS.map((id) => renderAvatar(id, { idPrefix: id }));
    for (const svg of all) checkChildSafe(svg);
    expect(new Set(all).size).toBe(8);
  });
});
