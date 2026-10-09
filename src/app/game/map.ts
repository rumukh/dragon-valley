/**
 * The valley map's layout from S4 (`assets/backgrounds/map-hotspots.json`): the logical size,
 * one hotspot per region (validated with the SDK's `validateHotspots`), and per region the road's
 * level nodes and boss node. Positions are logical map coordinates (1600 × 1000); screens turn
 * them into percentages so the same layout works at any size.
 */
import { validateHotspots } from '@aegis/browser/ui';
import type { Hotspot } from '@aegis/browser/ui';
import { fetchSiteText } from '../content/load';
import type { Fetcher } from '../content/load';

export const MAP_PATH = 'assets/backgrounds/map-hotspots.json';

/**
 * The map's sheets in travel order (docs/design.md §12.5): the Lower Valley of grades 1-2, then
 * today's valley. Each is a picture (a background id) with its hotspots file. The Lower Valley
 * sheet is S4/G5's (`lower-valley-map`); until its file ships the map is the one valley sheet.
 */
export const MAP_SHEET_FILES = [
  {
    background: 'lower-valley-map',
    path: 'assets/backgrounds/lower-valley-hotspots.json',
    optional: true,
  },
  { background: 'valley-map', path: MAP_PATH, optional: false },
] as const;

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface MapRegion {
  readonly center: MapPoint;
  readonly nodes: readonly MapPoint[];
  readonly boss: MapPoint;
  readonly path: readonly MapPoint[];
}

export interface ValleyMap {
  /** The sheet's picture: a background id. */
  readonly background: string;
  readonly logical: { readonly width: number; readonly height: number };
  readonly hotspots: readonly Hotspot[];
  readonly regions: Readonly<Record<string, MapRegion>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function finite(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Map: ${what}.`);
  return value;
}

function point(value: unknown, what: string): MapPoint {
  if (Array.isArray(value) && value.length === 2) {
    return { x: finite(value[0], what), y: finite(value[1], what) };
  }
  if (!isRecord(value)) throw new Error(`Map: ${what}.`);
  return { x: finite(value['x'], what), y: finite(value['y'], what) };
}

function points(value: unknown, what: string): MapPoint[] {
  if (!Array.isArray(value)) throw new Error(`Map: ${what}.`);
  return value.map((entry) => point(entry, what));
}

export function parseValleyMap(input: unknown, background = 'valley-map'): ValleyMap {
  if (!isRecord(input) || !isRecord(input['logical'])) throw new Error('Map: no logical size.');
  const logical = {
    width: finite(input['logical']['width'], 'logical width'),
    height: finite(input['logical']['height'], 'logical height'),
  };
  if (!Array.isArray(input['hotspots'])) throw new Error('Map: no hotspots.');
  const hotspots: Hotspot[] = (input['hotspots'] as unknown[]).map((entry) => {
    if (!isRecord(entry) || typeof entry['id'] !== 'string') throw new Error('Map: bad hotspot.');
    return {
      id: entry['id'],
      x: finite(entry['x'], 'hotspot x'),
      y: finite(entry['y'], 'hotspot y'),
      width: finite(entry['width'], 'hotspot width'),
      height: finite(entry['height'], 'hotspot height'),
      labelKey: typeof entry['labelKey'] === 'string' ? entry['labelKey'] : entry['id'],
    };
  });
  validateHotspots(hotspots, logical);
  const regions: Record<string, MapRegion> = {};
  if (!isRecord(input['regions'])) throw new Error('Map: no regions.');
  for (const [id, region] of Object.entries(input['regions'])) {
    if (!isRecord(region)) throw new Error(`Map: bad region ${id}.`);
    regions[id] = {
      center: point(region['center'], `${id} center`),
      nodes: points(region['nodes'], `${id} nodes`),
      boss: point(region['boss'], `${id} boss`),
      path: points(region['path'], `${id} path`),
    };
  }
  return { background, logical, hotspots, regions };
}

/** `count` points spaced evenly along a polyline (its ends included when count ≥ 2). */
export function pointsAlong(path: readonly MapPoint[], count: number): MapPoint[] {
  if (count <= 0 || path.length === 0) return [];
  if (path.length === 1 || count === 1) return Array.from({ length: count }, () => path[0]!);
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const out: MapPoint[] = [];
  for (let n = 0; n < count; n++) {
    let distance = (total * n) / (count - 1);
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]!) {
      distance -= lengths[segment]!;
      segment += 1;
    }
    const a = path[segment]!;
    const b = path[segment + 1]!;
    const share = lengths[segment]! === 0 ? 0 : Math.min(1, distance / lengths[segment]!);
    out.push({ x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share });
  }
  return out;
}

/**
 * Where a region's lessons and its boss sit on the road. S4's nodes are used as drawn when the
 * content has as many lessons; otherwise the lessons are spaced along the region's road.
 */
export function levelPositions(region: MapRegion, lessons: number): MapPoint[] {
  if (region.nodes.length === lessons) return [...region.nodes];
  return pointsAlong(region.path, lessons);
}

const cached = new Map<string, Promise<ValleyMap>>();

function loadSheet(
  sheet: (typeof MAP_SHEET_FILES)[number],
  baseUrl: string,
  fetcher?: Fetcher,
): Promise<ValleyMap> {
  let loading = cached.get(sheet.path);
  if (!loading) {
    loading = fetchSiteText(baseUrl, sheet.path, fetcher).then((text) =>
      parseValleyMap(JSON.parse(text) as unknown, sheet.background),
    );
    cached.set(sheet.path, loading);
    loading.catch(() => cached.delete(sheet.path));
  }
  return loading;
}

const VALLEY_SHEET = MAP_SHEET_FILES.find((sheet) => !sheet.optional)!;

/** The valley sheet (today's map, of grade 3's regions). */
export function loadValleyMap(baseUrl: string, fetcher?: Fetcher): Promise<ValleyMap> {
  return loadSheet(VALLEY_SHEET, baseUrl, fetcher);
}

/**
 * The sheets of the map in travel order. The other sheets (the Lower Valley) are fetched only when
 * the content has regions the valley sheet does not, so a pack of grade 3 alone asks for nothing
 * more.
 */
export async function loadMapSheets(
  baseUrl: string,
  regionIds: readonly string[],
  fetcher?: Fetcher,
): Promise<readonly ValleyMap[]> {
  const valley = await loadValleyMap(baseUrl, fetcher);
  if (regionIds.every((id) => sheetOf([valley], id) !== null)) return [valley];
  // An optional sheet that cannot load (its art not shipped yet) leaves its regions off the map.
  const sheets = await Promise.all(
    MAP_SHEET_FILES.map((sheet) =>
      sheet === VALLEY_SHEET
        ? valley
        : loadSheet(sheet, baseUrl, fetcher).catch((error: unknown) => {
            if (sheet.optional) return null;
            throw error;
          }),
    ),
  );
  return sheets.filter((sheet): sheet is ValleyMap => sheet !== null);
}
/** The sheet a region is on, or null. */
export function sheetOf(sheets: readonly ValleyMap[], regionId: string): ValleyMap | null {
  return (
    sheets.find(
      (sheet) =>
        sheet.regions[regionId] !== undefined ||
        sheet.hotspots.some((spot) => spot.id === regionId),
    ) ?? null
  );
}
