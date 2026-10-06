import type { CosmeticSlot } from '../dragon/types';

/** Anchor geometry handed to cosmetics, in the dragon's design space. */
export interface CosmeticAnchors {
  /** Head top centre; w = head width; ry = head half-height. */
  head: { x: number; y: number; w: number; ry: number };
  /** Midpoint between the eyes; dx = eye offset from centre; r = eye radius. */
  eyes: { x: number; y: number; dx: number; r: number };
  /** Neck/collar line centre; w = collar width. */
  neck: { x: number; y: number; w: number };
  /** Ground centre under the dragon; w = footprint width. */
  nest: { x: number; y: number; w: number };
  /** Growth 0 (hatchling) .. 1 (adult). */
  t: number;
}

export interface CosmeticDef {
  id: string;
  slot: CosmeticSlot;
  name: string;
}
