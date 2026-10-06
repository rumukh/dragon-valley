/** Public types of the Dragon Valley art rig. Closed vocabularies come from the domain contract. */
import {
  COSMETIC_SLOTS,
  DRAGON_EXPRESSIONS,
  DRAGON_STAGES,
  FINALE_DRAGON_ID,
  GUIDE_ID,
  SPECIAL_DRAGON_IDS,
  TABLE_DRAGON_IDS,
  type CosmeticSlot,
  type DragonExpression,
  type DragonStage,
} from '../../../rules/contract/ids';

export { COSMETIC_SLOTS, DRAGON_EXPRESSIONS, DRAGON_STAGES, SPECIAL_DRAGON_IDS, TABLE_DRAGON_IDS };
export type { CosmeticSlot, DragonExpression, DragonStage };

/** Every dragon the rig can draw: raisable dragons plus Glimmer, the guide. */
export const DRAGON_IDS = [
  ...TABLE_DRAGON_IDS,
  ...SPECIAL_DRAGON_IDS,
  FINALE_DRAGON_ID,
  GUIDE_ID,
] as const;
export type DragonId = (typeof DRAGON_IDS)[number];

export type Outfit = Partial<Record<CosmeticSlot, string>>;

export type HornStyle =
  'curved' | 'straight' | 'nub' | 'cloud' | 'crystal' | 'crescent' | 'ram' | 'branch' | 'none';
export type EarStyle = 'frill' | 'fin' | 'leaf' | 'petal' | 'cloud' | 'shell' | 'none';
export type WingStyle =
  'bat' | 'cloud' | 'fin' | 'leaf' | 'petal' | 'crystal' | 'shell' | 'stone' | 'gear' | 'feather';
export type TailTip =
  | 'spade'
  | 'cloud'
  | 'fin'
  | 'clover'
  | 'flower'
  | 'clock-hand'
  | 'flame'
  | 'heart'
  | 'crystal'
  | 'star'
  | 'pearl'
  | 'rock'
  | 'gear'
  | 'tuft';
export type SpikeStyle = 'round' | 'flame' | 'crystal' | 'leaf' | 'stone' | 'none';
export type CrestStyle = 'none' | 'sun' | 'flower' | 'crown10' | 'shell' | 'cloud-tuft';
export type MarkingStyle =
  | 'belly-plates'
  | 'rainbow-belly'
  | 'clock-belly'
  | 'snowflake-belly'
  | 'ten-frame-stars'
  | 'clover-spots'
  | 'mirror-belly'
  | 'bubble-spots'
  | 'zero-medallion'
  | 'place-value'
  | 'moss'
  | 'gears'
  | 'freckles'
  | 'scales';
export type FeatureStyle =
  | 'reflection'
  | 'smoke-ring'
  | 'bubbles'
  | 'pearl-pile'
  | 'shine'
  | 'cloud-body'
  | 'wind-key'
  | 'beard'
  | 'spectacles'
  | 'bushy-brows'
  | 'shawl'
  | 'sparkle-cheeks';
export type EggPattern =
  | 'clouds'
  | 'shine'
  | 'waves'
  | 'clovers'
  | 'flowers'
  | 'sun'
  | 'flames'
  | 'rainbow'
  | 'snowflake'
  | 'stars'
  | 'crown'
  | 'scallops'
  | 'speckles'
  | 'gears'
  | 'spots';

export interface DragonColors {
  body: string;
  belly: string;
  wing: string;
  horn: string;
  accent: string;
  iris: string;
  cheek: string;
  /** Optional explicit shade; otherwise derived from body. */
  shade?: string;
  /** Optional second accent used by some features (gems, stripes, gears). */
  accent2?: string;
}

export interface DragonRecipe {
  id: string;
  name: string;
  kind: 'table' | 'special' | 'finale' | 'guide';
  table?: number;
  mnemonic: string;
  colors: DragonColors;
  build: { chub: number; head: number; snout: number; body: number };
  horns: { style: HornStyle; count: number; length: number };
  ears: { style: EarStyle; size: number };
  wings: { style: WingStyle; count: 2 | 4; size: number };
  tail: { count: 1 | 2; tip: TailTip; length: number };
  spikes: { style: SpikeStyle; where: 'tail' | 'head' | 'none'; count: number };
  crest: { style: CrestStyle; count: number };
  markings: MarkingStyle[];
  features: FeatureStyle[];
  egg: { base: string; accent: string; pattern: EggPattern };
}

export interface DragonRenderOptions {
  /** Catalog id (e.g. "ember") or a full recipe object. */
  dragon: string | DragonRecipe;
  stage: DragonStage;
  expression?: DragonExpression;
  outfit?: Outfit;
  /** Unique per instance on a page; all internal ids are scoped with it. */
  idPrefix?: string;
  /**
   * `stage` (default): shared 512x512 canvas where the dragon grows with its stage.
   * `fit`: crop to the drawing so thumbnails stay readable at 64 px.
   */
  framing?: 'stage' | 'fit';
  /** Adds the `dv-animated` class so animations.css applies (default true). */
  animated?: boolean;
  /** Egg warmth 0..1: cold eggs are frosty, warm eggs glow, very warm eggs show cracks. */
  warmth?: number;
  /** Seven-Headed Dragon only: sneezy until cured (default `cured`). */
  condition?: 'sneezy' | 'cured';
  /** Accessible name; when omitted the SVG is decorative (aria-hidden). */
  title?: string;
  /** Optional width/height attributes. */
  size?: number;
  /** Embed animations.css inside the SVG (for standalone files). */
  embedStyles?: boolean;
}

export interface AnchorPoint {
  x: number;
  y: number;
  /** Width of the body part the cosmetic should span (e.g. head width for hats). */
  width: number;
  /** Rotation in degrees (positive = clockwise). */
  angle: number;
}

export interface DragonAnchors {
  viewBox: [number, number, number, number];
  head: AnchorPoint;
  eyes: AnchorPoint;
  neck: AnchorPoint;
  mouth: AnchorPoint;
  belly: AnchorPoint;
  nest: AnchorPoint;
  wingL: AnchorPoint;
  wingR: AnchorPoint;
  /** Topmost point of the drawing (for speech bubbles, hearts, coins). */
  top: AnchorPoint;
}
