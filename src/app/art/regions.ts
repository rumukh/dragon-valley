/**
 * Region ids the art draws, in valley order. The canonical nine are the third-grade valley of
 * the content contract; the Lower Valley five (grades 1-2, docs/grades-plan.md section 3) sit
 * below them on their own map sheet and are art-side ids until the contract adopts them.
 */
import { CANONICAL_REGION_IDS } from '../../rules/contract/ids';

export const LOWER_VALLEY_REGION_IDS = [
  'pebble-brook',
  'mushroom-hollow',
  'rainbow-ford',
  'hundred-hills',
  'market-square',
] as const;

export type LowerValleyRegionId = (typeof LOWER_VALLEY_REGION_IDS)[number];

/** Every region with art, walking up the valley from Pebble Brook to Dragon Castle. */
export const ART_REGION_IDS: readonly string[] = [
  ...LOWER_VALLEY_REGION_IDS,
  ...CANONICAL_REGION_IDS,
];
