import { isHex } from '../svg/color';
import type {
  CrestStyle,
  DragonRecipe,
  EarStyle,
  EggPattern,
  FeatureStyle,
  HornStyle,
  MarkingStyle,
  SpikeStyle,
  TailTip,
  WingStyle,
} from './types';
import puff from '../../../../assets/art/dragons/puff.json';
import mirror from '../../../../assets/art/dragons/mirror.json';
import bubbles from '../../../../assets/art/dragons/bubbles.json';
import clover from '../../../../assets/art/dragons/clover.json';
import petal from '../../../../assets/art/dragons/petal.json';
import sunny from '../../../../assets/art/dragons/sunny.json';
import ember from '../../../../assets/art/dragons/ember.json';
import rainbow from '../../../../assets/art/dragons/rainbow.json';
import crystal from '../../../../assets/art/dragons/crystal.json';
import starry from '../../../../assets/art/dragons/starry.json';
import goldie from '../../../../assets/art/dragons/goldie.json';
import pearl from '../../../../assets/art/dragons/pearl.json';
import boulder from '../../../../assets/art/dragons/boulder.json';
import clockwork from '../../../../assets/art/dragons/clockwork.json';
import sevenHeaded from '../../../../assets/art/dragons/seven-headed.json';
import glimmer from '../../../../assets/art/dragons/glimmer.json';

const HORNS: readonly HornStyle[] = [
  'curved',
  'straight',
  'nub',
  'cloud',
  'crystal',
  'crescent',
  'ram',
  'branch',
  'none',
];
const EARS: readonly EarStyle[] = ['frill', 'fin', 'leaf', 'petal', 'cloud', 'shell', 'none'];
const WINGS: readonly WingStyle[] = [
  'bat',
  'cloud',
  'fin',
  'leaf',
  'petal',
  'crystal',
  'shell',
  'stone',
  'gear',
  'feather',
];
const TIPS: readonly TailTip[] = [
  'spade',
  'cloud',
  'fin',
  'clover',
  'flower',
  'clock-hand',
  'flame',
  'heart',
  'crystal',
  'star',
  'pearl',
  'rock',
  'gear',
  'tuft',
];
const SPIKES: readonly SpikeStyle[] = ['round', 'flame', 'crystal', 'leaf', 'stone', 'none'];
const CRESTS: readonly CrestStyle[] = ['none', 'sun', 'flower', 'crown10', 'shell', 'cloud-tuft'];
const MARKINGS: readonly MarkingStyle[] = [
  'belly-plates',
  'rainbow-belly',
  'clock-belly',
  'snowflake-belly',
  'ten-frame-stars',
  'clover-spots',
  'mirror-belly',
  'bubble-spots',
  'zero-medallion',
  'place-value',
  'moss',
  'gears',
  'freckles',
  'scales',
];
const FEATURES: readonly FeatureStyle[] = [
  'reflection',
  'smoke-ring',
  'bubbles',
  'pearl-pile',
  'shine',
  'cloud-body',
  'wind-key',
  'beard',
  'spectacles',
  'bushy-brows',
  'shawl',
  'sparkle-cheeks',
];
const EGGS: readonly EggPattern[] = [
  'clouds',
  'shine',
  'waves',
  'clovers',
  'flowers',
  'sun',
  'flames',
  'rainbow',
  'snowflake',
  'stars',
  'crown',
  'scallops',
  'speckles',
  'gears',
  'spots',
];

type Json = Record<string, unknown>;

function obj(v: unknown, path: string): Json {
  if (v === null || typeof v !== 'object' || Array.isArray(v))
    throw new Error(`${path} must be an object`);
  return v as Json;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0)
    throw new Error(`${path} must be a non-empty string`);
  return v;
}

function num(v: unknown, path: string, lo: number, hi: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
    throw new Error(`${path} must be a number in [${lo}, ${hi}]`);
  return v;
}

function color(v: unknown, path: string): string {
  if (!isHex(v)) throw new Error(`${path} must be a #rrggbb color`);
  return v.toLowerCase();
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v))
    throw new Error(`${path} must be one of ${allowed.join(', ')}`);
  return v as T;
}

function only(o: Json, keys: readonly string[], path: string): void {
  for (const k of Object.keys(o))
    if (!keys.includes(k)) throw new Error(`${path}.${k} is not a recipe field`);
}

/** Validates a recipe JSON document (strict: unknown fields are errors). */
export function parseRecipe(input: unknown): DragonRecipe {
  const r = obj(input, 'recipe');
  only(
    r,
    [
      '$schema',
      'id',
      'name',
      'kind',
      'table',
      'mnemonic',
      'colors',
      'build',
      'horns',
      'ears',
      'wings',
      'tail',
      'spikes',
      'crest',
      'markings',
      'features',
      'egg',
    ],
    'recipe',
  );
  const id = str(r.id, 'id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`id ${id} must be kebab-case`);
  const kind = oneOf(r.kind, ['table', 'special', 'finale', 'guide'] as const, 'kind');
  const c = obj(r.colors, 'colors');
  only(
    c,
    ['body', 'belly', 'wing', 'horn', 'accent', 'iris', 'cheek', 'shade', 'accent2'],
    'colors',
  );
  const b = obj(r.build, 'build');
  only(b, ['chub', 'head', 'snout', 'body'], 'build');
  const horns = obj(r.horns, 'horns');
  const ears = obj(r.ears, 'ears');
  const wings = obj(r.wings, 'wings');
  const tail = obj(r.tail, 'tail');
  const spikes = obj(r.spikes, 'spikes');
  const crest = obj(r.crest, 'crest');
  const egg = obj(r.egg, 'egg');
  if (!Array.isArray(r.markings)) throw new Error('markings must be an array');
  if (!Array.isArray(r.features)) throw new Error('features must be an array');
  const recipe: DragonRecipe = {
    id,
    name: str(r.name, 'name'),
    kind,
    mnemonic: str(r.mnemonic, 'mnemonic'),
    colors: {
      body: color(c.body, 'colors.body'),
      belly: color(c.belly, 'colors.belly'),
      wing: color(c.wing, 'colors.wing'),
      horn: color(c.horn, 'colors.horn'),
      accent: color(c.accent, 'colors.accent'),
      iris: color(c.iris, 'colors.iris'),
      cheek: color(c.cheek, 'colors.cheek'),
      ...(c.shade === undefined ? {} : { shade: color(c.shade, 'colors.shade') }),
      ...(c.accent2 === undefined ? {} : { accent2: color(c.accent2, 'colors.accent2') }),
    },
    build: {
      chub: num(b.chub, 'build.chub', 0, 1),
      head: num(b.head, 'build.head', 0.8, 1.2),
      snout: num(b.snout, 'build.snout', 0.7, 1.3),
      body: num(b.body, 'build.body', 0.8, 1.2),
    },
    horns: {
      style: oneOf(horns.style, HORNS, 'horns.style'),
      count: num(horns.count, 'horns.count', 0, 3),
      length: num(horns.length, 'horns.length', 0.3, 1.6),
    },
    ears: {
      style: oneOf(ears.style, EARS, 'ears.style'),
      size: num(ears.size, 'ears.size', 0.4, 1.6),
    },
    wings: {
      style: oneOf(wings.style, WINGS, 'wings.style'),
      count: num(wings.count, 'wings.count', 2, 4) === 4 ? 4 : 2,
      size: num(wings.size, 'wings.size', 0.4, 1.4),
    },
    tail: {
      count: num(tail.count, 'tail.count', 1, 2) === 2 ? 2 : 1,
      tip: oneOf(tail.tip, TIPS, 'tail.tip'),
      length: num(tail.length, 'tail.length', 0.5, 1.5),
    },
    spikes: {
      style: oneOf(spikes.style, SPIKES, 'spikes.style'),
      where: oneOf(spikes.where, ['tail', 'head', 'none'] as const, 'spikes.where'),
      count: num(spikes.count, 'spikes.count', 0, 9),
    },
    crest: {
      style: oneOf(crest.style, CRESTS, 'crest.style'),
      count: num(crest.count, 'crest.count', 0, 12),
    },
    markings: r.markings.map((m, i) => oneOf(m, MARKINGS, `markings[${i}]`)),
    features: r.features.map((m, i) => oneOf(m, FEATURES, `features[${i}]`)),
    egg: {
      base: color(egg.base, 'egg.base'),
      accent: color(egg.accent, 'egg.accent'),
      pattern: oneOf(egg.pattern, EGGS, 'egg.pattern'),
    },
  };
  if (r.table !== undefined) recipe.table = num(r.table, 'table', 0, 10);
  if (kind === 'table' && recipe.table === undefined)
    throw new Error(`${id}: table dragons need a table`);
  return recipe;
}

const RAW: readonly unknown[] = [
  puff,
  mirror,
  bubbles,
  clover,
  petal,
  sunny,
  ember,
  rainbow,
  crystal,
  starry,
  goldie,
  pearl,
  boulder,
  clockwork,
  sevenHeaded,
  glimmer,
];

/** All built-in recipes, validated once at module load. */
export const DRAGON_RECIPES: ReadonlyMap<string, DragonRecipe> = new Map(
  RAW.map((raw) => {
    const recipe = parseRecipe(raw);
    return [recipe.id, recipe] as const;
  }),
);

export function getRecipe(id: string): DragonRecipe {
  const recipe = DRAGON_RECIPES.get(id);
  if (!recipe) throw new Error(`Unknown dragon id: ${id}`);
  return recipe;
}
