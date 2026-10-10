/**
 * The art catalog: every art id content may reference. `assets/art/catalog.json` is generated from
 * this function by `npm run art:build`, and a test keeps the committed file identical.
 */
import { CANONICAL_BOSS_IDS, CANONICAL_REGION_IDS } from '../../rules/contract/ids';
import { ART_REGION_IDS } from './regions';
import { KEEPER_AVATARS } from './characters/avatars';
import { COSMETICS } from './cosmetics';
import { COSMETIC_SLOTS, DRAGON_EXPRESSIONS, DRAGON_RECIPES, DRAGON_STAGES } from './dragon';
import { FRUIT_IDS, GLYPH_ICON_IDS, ITEM_ICON_IDS } from './icons';
import { REGION_EMBLEM_IDS } from './icons/emblems';
import { PALETTE } from './palette';
import { BOSS_IDS, BOSS_MOOD, BOSS_OUTCOME, BOSS_STATES } from './characters/bosses';
import { STICKER_COLORS, STICKER_FRAMES } from './stickers';
import { MASTERY_LEVELS, magicWindowLayout } from './window';
import { BACKGROUND_IDS, HALL_WINDOW, MAP_SHEETS, SCENE_LAYOUT } from './backgrounds';

/** Where each dragon hatches (docs/plan.md section 2.3). */
const HOME_REGION: Record<string, string> = {
  dot: 'pebble-brook',
  hop: 'pebble-brook',
  nibble: 'mushroom-hollow',
  sprout: 'mushroom-hollow',
  tenzi: 'rainbow-ford',
  bead: 'hundred-hills',
  tumble: 'market-square',
  penny: 'market-square',
  puff: 'sunny-meadow',
  mirror: 'sunny-meadow',
  bubbles: 'sunny-meadow',
  sunny: 'sunny-meadow',
  goldie: 'sunny-meadow',
  clover: 'whispering-woods',
  petal: 'whispering-woods',
  ember: 'fire-mountain',
  rainbow: 'fire-mountain',
  crystal: 'crystal-caves',
  starry: 'crystal-caves',
  pearl: 'leftover-lagoon',
  boulder: 'giants-peaks',
  clockwork: 'riddle-ruins',
  'seven-headed': 'dragon-castle',
  glimmer: 'dragon-castle',
};

/** Where each boss waits: the canonical nine in valley order, plus the Lower Valley bosses. */
const BOSS_REGION: Record<string, string> = {
  'will-o-wisps': 'pebble-brook',
  skritek: 'mushroom-hollow',
  kasparek: 'rainbow-ford',
  'long-broad-sharp-eyes': 'hundred-hills',
  otesanek: 'market-square',
  ...Object.fromEntries(CANONICAL_BOSS_IDS.map((id, i) => [id, CANONICAL_REGION_IDS[i]!])),
};

export const CATALOG_SCHEMA_VERSION = 1;

export function buildCatalog(): Record<string, unknown> {
  const signature = PALETTE.dragonSignature as Record<string, string>;
  const all = [...DRAGON_RECIPES.values()];
  const dragons = all
    .filter((r) => r.kind !== 'guide')
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      ...(r.table === undefined ? {} : { table: r.table }),
      homeRegion: HOME_REGION[r.id],
      signature: signature[r.id],
      mnemonic: r.mnemonic,
      recipe: `assets/art/dragons/${r.id}.json`,
    }));
  const characters = all
    .filter((r) => r.kind === 'guide')
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      render: 'renderDragon',
      recipe: `assets/art/dragons/${r.id}.json`,
    }));
  const regions = ART_REGION_IDS.map((id) => {
    const r = (
      PALETTE.regions as Record<
        string,
        { name: string; accent: string; deep: string; soft: string; onAccent: string }
      >
    )[id]!;
    return {
      id,
      accentName: r.name,
      accent: r.accent,
      deep: r.deep,
      soft: r.soft,
      onAccent: r.onAccent,
      emblem: `emblem-${id}`,
    };
  });
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generatedBy: 'scripts/art/build-art.mjs from src/app/art/catalog.ts',
    grids: {
      dragonCanvas: 512,
      bossCanvas: 512,
      icon: 64,
      avatar: 120,
      sticker: 120,
      background: [1600, 1000],
    },
    dragonStages: [...DRAGON_STAGES],
    dragonExpressions: [...DRAGON_EXPRESSIONS],
    cosmeticSlots: [...COSMETIC_SLOTS],
    dragons,
    characters,
    bosses: BOSS_IDS.map((id) => ({
      id,
      region: BOSS_REGION[id],
      states: [...BOSS_STATES],
      outcome: BOSS_OUTCOME[id],
      mood: BOSS_MOOD[id],
    })),
    cosmetics: COSMETICS.map((c) => ({ id: c.id, slot: c.slot, name: c.name })),
    avatars: KEEPER_AVATARS.map((id) => ({ id })),
    icons: {
      items: ITEM_ICON_IDS.filter(
        (id) => !(FRUIT_IDS as readonly string[]).includes(id) && !id.startsWith('node-'),
      ),
      fruits: [...FRUIT_IDS],
      mapNodes: ITEM_ICON_IDS.filter((id) => id.startsWith('node-')),
      glyphs: [...GLYPH_ICON_IDS],
      emblems: [...REGION_EMBLEM_IDS],
    },
    stickers: {
      frames: STICKER_FRAMES.map((id) => ({ id })),
      colors: [...STICKER_COLORS],
      content: 'icon: any icon id (icons.*) or cosmetic id; or dragon: any dragon id',
    },
    magicWindow: {
      levels: [...MASTERY_LEVELS],
      flags: ['needs-polish'],
      multiplication: {
        rows: 11,
        cols: 11,
        rowMeaning: 'first factor 0-10',
        colMeaning: 'second factor 0-10',
      },
      division: { rows: 10, cols: 11, rowMeaning: 'divisor 1-10', colMeaning: 'quotient 0-10' },
      hallViewBox: magicWindowLayout().viewBox,
    },
    backgrounds: BACKGROUND_IDS.map((id) => ({
      id,
      file: `assets/backgrounds/${id}.svg`,
      width: 1600,
      height: 1000,
      kind: MAP_SHEETS.some((m) => m.id === id) ? 'map' : id === 'castle-hall' ? 'hall' : 'region',
      ...(ART_REGION_IDS.includes(id) ? { region: id, layout: SCENE_LAYOUT } : {}),
      ...Object.fromEntries(
        MAP_SHEETS.filter((m) => m.id === id).map((m) => ['hotspots', m.hotspotsFile]),
      ),
      ...(id === 'castle-hall' ? { window: HALL_WINDOW } : {}),
      prompt: `assets/backgrounds/prompts/${id}.prompt.txt`,
    })),
    regions,
  };
}

/** Every id in the catalog, flattened, for cross-checking content references. */
export function catalogIds(catalog: Record<string, unknown> = buildCatalog()): Set<string> {
  const ids = new Set<string>();
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o['id'] === 'string') ids.add(o['id']);
      Object.values(o).forEach(visit);
    }
  };
  visit(catalog);
  const icons = catalog['icons'] as Record<string, string[]>;
  for (const list of Object.values(icons)) for (const id of list) ids.add(id);
  return ids;
}
