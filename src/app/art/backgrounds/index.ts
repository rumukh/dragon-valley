/**
 * Background scenes: the two map sheets (Lower Valley and valley map), the region scenes and the castle hall, as layered SVG
 * (1600 x 1000, 16:10). They are generated into assets/backgrounds/*.svg by `npm run art:build`;
 * painted versions can replace them later (prompts in assets/backgrounds/prompts/).
 */
import { svgDoc } from '../svg/xml';
import { h } from '../svg/xml';
import { makeDefs, SH, SW, type Defs } from './kit';
import { MAP_HOTSPOTS, MAP_LEVELS, mapNodePositions, valleyMap, type MapHotspots } from './map';
import { crystalCaves, fireMountain, sharingLake, sunnyMeadow, whisperingWoods } from './scenes-a';
import {
  HALL_WINDOW,
  castleHall,
  dragonCastle,
  giantsPeaks,
  leftoverLagoon,
  riddleRuins,
} from './scenes-b';
import { pebbleBrook } from './scenes-c';
import {
  LOWER_VALLEY_HOTSPOTS,
  LOWER_VALLEY_LEVELS,
  lowerValleyMap,
  lowerValleyNodePositions,
} from './lower-valley';

export {
  MAP_HOTSPOTS,
  MAP_LEVELS,
  mapNodePositions,
  LOWER_VALLEY_HOTSPOTS,
  LOWER_VALLEY_LEVELS,
  lowerValleyNodePositions,
  HALL_WINDOW,
  type MapHotspots,
};

export interface MapSheet {
  /** Background id of the sheet (assets/backgrounds/<id>.svg). */
  id: string;
  /** Repository path of the sheet's hotspots JSON. */
  hotspotsFile: string;
  hotspots: MapHotspots;
}

/** The valley's map sheets in travel order: the Lower Valley (grades 1-2), then the valley map. */
export const MAP_SHEETS: readonly MapSheet[] = [
  {
    id: 'lower-valley-map',
    hotspotsFile: 'assets/backgrounds/lower-valley-hotspots.json',
    hotspots: LOWER_VALLEY_HOTSPOTS,
  },
  {
    id: 'valley-map',
    hotspotsFile: 'assets/backgrounds/map-hotspots.json',
    hotspots: MAP_HOTSPOTS,
  },
];

const SCENES: Record<string, (defs: Defs) => string> = {
  'lower-valley-map': lowerValleyMap,
  'valley-map': valleyMap,
  'pebble-brook': pebbleBrook,
  'sunny-meadow': sunnyMeadow,
  'whispering-woods': whisperingWoods,
  'fire-mountain': fireMountain,
  'crystal-caves': crystalCaves,
  'sharing-lake': sharingLake,
  'leftover-lagoon': leftoverLagoon,
  'giants-peaks': giantsPeaks,
  'riddle-ruins': riddleRuins,
  'dragon-castle': dragonCastle,
  'castle-hall': castleHall,
};

export const BACKGROUND_IDS: readonly string[] = /* @__PURE__ */ Object.keys(SCENES);

/**
 * Where things go on a region scene (logical 1600 x 1000): the player's dragon stands left of
 * centre, the boss right of centre, and the UI card sits over the calm centre-top area.
 */
export const SCENE_LAYOUT = {
  logical: { width: SW, height: SH },
  dragon: { x: 430, y: 850 },
  boss: { x: 1170, y: 850 },
  ui: { x: 400, y: 70, width: 800, height: 470 },
} as const;

export function renderBackground(id: string): string {
  const scene = SCENES[id];
  if (!scene) throw new Error(`Unknown background id: ${id}`);
  const defs = makeDefs(`bg-${id}`);
  const body = scene(defs);
  const svg = svgDoc(
    {
      viewBox: [0, 0, SW, SH],
      width: SW,
      height: SH,
      className: 'dv-background',
      data: { background: id },
    },
    defs.list.length ? h('defs', null, ...defs.list) : '',
    body,
  );
  // One decimal is plenty at 1600 x 1000 and keeps every scene well inside its byte budget.
  return `${svg.replace(/(\.\d)\d+/g, '$1')}\n`;
}

export function renderBackgrounds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of BACKGROUND_IDS) out[id] = renderBackground(id);
  return out;
}
