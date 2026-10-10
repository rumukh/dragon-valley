import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hitHotspot, validateHotspots } from '@aegis/browser/ui';
import {
  CANONICAL_BOSS_IDS,
  CANONICAL_REGION_IDS,
  MASTERY_LEVELS,
} from '../../../src/rules/contract/ids';
import {
  BACKGROUND_IDS,
  BOSS_IDS,
  BOSS_STATES,
  COSMETICS,
  HALL_WINDOW,
  LOWER_VALLEY_HOTSPOTS,
  LOWER_VALLEY_LEVELS,
  LOWER_VALLEY_REGION_IDS,
  MAP_HOTSPOTS,
  MAP_LEVELS,
  MAP_SHEETS,
  lowerValleyNodePositions,
  STICKER_COLORS,
  STICKER_FRAMES,
  magicWindowLayout,
  magicWindowSamples,
  mapNodePositions,
  renderBackgrounds,
  renderBoss,
  renderCosmeticIcon,
  renderMagicWindow,
  renderMasteryGrid,
  renderSticker,
  stickerSamples,
} from '../../../src/app/art';
import { checkChildSafe } from './svg-check';

describe('bosses', () => {
  it('draws every boss in every state as child-safe SVG', () => {
    expect(BOSS_IDS).toEqual([
      'will-o-wisps',
      'skritek',
      'kasparek',
      'long-broad-sharp-eyes',
      'otesanek',
      ...CANONICAL_BOSS_IDS,
    ]);
    for (const id of BOSS_IDS) {
      const states = new Set<string>();
      for (const state of BOSS_STATES) {
        const svg = renderBoss(id, state, { idPrefix: `b-${state}` });
        checkChildSafe(svg);
        expect(svg, id).toContain(`data-boss="${id}"`);
        expect(svg, id).toContain(`data-state="${state}"`);
        states.add(svg.replace(/b-(start|warming|won)/g, 'b'));
      }
      expect(states.size, `${id} states differ`).toBe(3);
    }
    expect(() => renderBoss('dragon-slayer', 'start')).toThrow();
    expect(() => renderBoss('golem', 'lost' as never)).toThrow();
  });
});

describe('Magic Window', () => {
  it('renders every sample state with one pane per fact', () => {
    for (const { options } of magicWindowSamples()) {
      const svg = renderMagicWindow({ ...options, idPrefix: 'w' });
      checkChildSafe(svg);
      expect(svg.match(/data-op="mul"/g)).toHaveLength(121);
      expect(svg.match(/data-op="div"/g)).toHaveLength(110);
    }
  });

  it('marks levels and the needs-polish flag on panes', () => {
    const svg = renderMagicWindow({
      multiplication: [['gold', { level: 'silver', needsPolish: true }, 'bronze']],
      idPrefix: 'w',
    });
    for (const level of MASTERY_LEVELS) expect(svg).toContain(`dv-pane-${level}`);
    expect(svg).toContain('dv-pane-polish');
    expect(svg).toContain('data-a="0" data-b="1"');
    expect(svg).toContain('data-divisor="7" data-quotient="8" data-dividend="56"');
    expect(svg).toContain('data-lit="3"');
  });

  it('exposes pane geometry and plain grids for the parent view', () => {
    const layout = magicWindowLayout();
    expect(layout.multiplication).toHaveLength(121);
    const mul = renderMasteryGrid({ op: 'mul', idPrefix: 'gm' });
    const div = renderMasteryGrid({ op: 'div', idPrefix: 'gd' });
    checkChildSafe(mul);
    checkChildSafe(div);
    expect(mul.match(/data-op="mul"/g)).toHaveLength(121);
    expect(div.match(/data-op="div"/g)).toHaveLength(110);
  });
});

describe('sticker composer', () => {
  it('composes every frame with icons and dragon portraits', () => {
    for (const [i, s] of stickerSamples().entries())
      checkChildSafe(renderSticker({ ...s, idPrefix: `s${i}` }));
    for (const frame of STICKER_FRAMES) {
      for (const color of STICKER_COLORS.slice(0, 3)) {
        checkChildSafe(renderSticker({ frame, color, icon: 'coin', idPrefix: 'x' }));
      }
      checkChildSafe(renderSticker({ frame, color: '#9fdcff', dragon: 'starry', idPrefix: 'y' }));
    }
  });

  it('renders every cosmetic as a standalone icon and accepts cosmetics as sticker icons', () => {
    for (const c of COSMETICS) {
      const svg = renderCosmeticIcon(c.id, { idPrefix: `ci-${c.id}` });
      checkChildSafe(svg);
      expect(svg).toContain(`data-slot="${c.slot}"`);
    }
    checkChildSafe(
      renderSticker({ frame: 'frame-round', color: '#c77dff', icon: 'hat-party', idPrefix: 'hp' }),
    );
    expect(() => renderCosmeticIcon('hat-jetpack')).toThrow();
  });

  it('rejects unknown frames, colors, icons and dragons', () => {
    expect(() => renderSticker({ frame: 'blob' as never, color: 'sun', icon: 'coin' })).toThrow();
    expect(() => renderSticker({ frame: 'frame-round', color: 'plaid', icon: 'coin' })).toThrow();
    expect(() => renderSticker({ frame: 'frame-round', color: 'sun', icon: 'rocket' })).toThrow();
    expect(() => renderSticker({ frame: 'frame-round', color: 'sun', dragon: 'nessie' })).toThrow();
  });
});

describe('backgrounds', () => {
  const rendered = renderBackgrounds();

  it('commits exactly the generated, deterministic SVGs (npm run art:build)', () => {
    expect(Object.keys(rendered).sort()).toEqual([...BACKGROUND_IDS].sort());
    for (const id of BACKGROUND_IDS) {
      const file = `assets/backgrounds/${id}.svg`;
      expect(readFileSync(file, 'utf8'), file).toBe(rendered[id]);
    }
    expect(renderBackgrounds()).toEqual(rendered);
  });

  it('covers the map, every region and the castle hall within budget and child safe', () => {
    expect([...BACKGROUND_IDS].sort()).toEqual(
      [
        'castle-hall',
        'lower-valley-map',
        'valley-map',
        'pebble-brook',
        'mushroom-hollow',
        'rainbow-ford',
        'hundred-hills',
        'market-square',
        ...CANONICAL_REGION_IDS,
      ].sort(),
    );
    for (const id of BACKGROUND_IDS) {
      const svg = rendered[id]!;
      checkChildSafe(svg.trim());
      expect(svg).toContain('viewBox="0 0 1600 1000"');
      expect(statSync(`assets/backgrounds/${id}.svg`).size, id).toBeLessThanOrEqual(150 * 1024);
      expect(existsSync(`assets/backgrounds/prompts/${id}.prompt.txt`), id).toBe(true);
    }
  });

  it('records provenance and prompts for every background', () => {
    const provenance = JSON.parse(readFileSync('assets/backgrounds/provenance.json', 'utf8')) as {
      backgrounds: Array<{
        id: string;
        file: string;
        kind: string;
        painted: { status: string; prompt: string };
      }>;
    };
    expect(provenance.backgrounds.map((b) => b.id).sort()).toEqual([...BACKGROUND_IDS].sort());
    for (const b of provenance.backgrounds) {
      expect(existsSync(b.file), b.file).toBe(true);
      expect(existsSync(b.painted.prompt), b.painted.prompt).toBe(true);
      const prompt = readFileSync(b.painted.prompt, 'utf8');
      expect(prompt).toMatch(/no text/i);
    }
  });

  it('ships map hotspots the SDK accepts, with every node inside its region', () => {
    const file = JSON.parse(readFileSync('assets/backgrounds/map-hotspots.json', 'utf8'));
    expect(file).toEqual(JSON.parse(JSON.stringify(MAP_HOTSPOTS)));
    expect(() => validateHotspots(MAP_HOTSPOTS.hotspots, MAP_HOTSPOTS.logical)).not.toThrow();
    expect(MAP_HOTSPOTS.hotspots.map((s) => s.id)).toEqual([...CANONICAL_REGION_IDS]);
    for (const id of CANONICAL_REGION_IDS) {
      const region = MAP_HOTSPOTS.regions[id]!;
      expect(region.nodes, id).toHaveLength(MAP_LEVELS[id]!);
      for (const p of [...region.nodes, region.boss]) {
        expect(hitHotspot(p, MAP_HOTSPOTS.hotspots), `${id} node ${p.x},${p.y}`).toBe(id);
      }
      const extra = mapNodePositions(id, 9);
      expect(extra).toHaveLength(9);
      for (const p of extra)
        expect(hitHotspot(p, MAP_HOTSPOTS.hotspots), `${id} extra node`).toBe(id);
    }
    // nodes keep a comfortable tap distance from each other (48 px targets at about half scale)
    const all = CANONICAL_REGION_IDS.flatMap((id) => [
      ...MAP_HOTSPOTS.regions[id]!.nodes,
      MAP_HOTSPOTS.regions[id]!.boss,
    ]);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const dx = all[i]!.x - all[j]!.x;
        const dy = all[i]!.y - all[j]!.y;
        expect(dx * dx + dy * dy, `nodes ${i} and ${j}`).toBeGreaterThan(44 * 44);
      }
    }
  });

  it('ships the Lower Valley sheet the same way, linked to the valley map', () => {
    const file = JSON.parse(readFileSync('assets/backgrounds/lower-valley-hotspots.json', 'utf8'));
    expect(file).toEqual(JSON.parse(JSON.stringify(LOWER_VALLEY_HOTSPOTS)));
    const sheet = LOWER_VALLEY_HOTSPOTS;
    expect(sheet.background).toBe('lower-valley-map');
    expect(() => validateHotspots(sheet.hotspots, sheet.logical)).not.toThrow();
    expect(sheet.hotspots.map((s) => s.id)).toEqual([...LOWER_VALLEY_REGION_IDS]);
    for (const id of LOWER_VALLEY_REGION_IDS) {
      const region = sheet.regions[id]!;
      expect(region.nodes, id).toHaveLength(LOWER_VALLEY_LEVELS[id]!);
      for (const p of [...region.nodes, region.boss, ...lowerValleyNodePositions(id, 9)])
        expect(hitHotspot(p, sheet.hotspots), `${id} node ${p.x},${p.y}`).toBe(id);
    }
    const all = LOWER_VALLEY_REGION_IDS.flatMap((id) => [
      ...sheet.regions[id]!.nodes,
      sheet.regions[id]!.boss,
    ]);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const dx = all[i]!.x - all[j]!.x;
        const dy = all[i]!.y - all[j]!.y;
        expect(dx * dx + dy * dy, `nodes ${i} and ${j}`).toBeGreaterThan(44 * 44);
      }
    // the sheets are travelled in order and link up at the sheet edges
    expect(MAP_SHEETS.map((m) => m.id)).toEqual(['lower-valley-map', 'valley-map']);
    expect(MAP_SHEETS.map((m) => m.hotspots.background)).toEqual(MAP_SHEETS.map((m) => m.id));
    expect(sheet.next).toBe('valley-map');
    expect(MAP_HOTSPOTS.previous).toBe('lower-valley-map');
    const [ex, ey] = [sheet.exit!.x, sheet.exit!.y];
    expect(Math.min(ex, ey, 1600 - ex, 1000 - ey)).toBeLessThan(20);
    expect(sheet.path.at(-1)).toEqual([ex, ey]);
    expect(MAP_HOTSPOTS.path[0]).toEqual([MAP_HOTSPOTS.entry!.x, MAP_HOTSPOTS.entry!.y]);
  });

  it('places the Magic Window inside the hall scene', () => {
    expect(HALL_WINDOW.x).toBeGreaterThan(0);
    expect(HALL_WINDOW.x + HALL_WINDOW.width).toBeLessThan(1600);
    expect(HALL_WINDOW.y + HALL_WINDOW.height).toBeLessThan(1000);
    const [, , w, hh] = magicWindowLayout().viewBox;
    expect(Math.abs(HALL_WINDOW.width / HALL_WINDOW.height - w / hh)).toBeLessThan(0.01);
  });
});
