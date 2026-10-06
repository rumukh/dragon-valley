/**
 * Audio build pipeline shared by build.mjs, verify.mjs, report.mjs, audition.mjs and the tests:
 * loads the recipes and the patch library, renders every sound and derives the manifest and the
 * provenance record. Nothing here reads a clock or the environment, so the same recipes always
 * produce the same WAV bytes, manifest and provenance.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gainToDb, roundTo } from './dmath.mjs';
import { integrated, momentaryMax } from './loudness.mjs';
import { truePeak } from './resample.mjs';
import { GENERATOR, renderRecipe, resolveRecipe } from './render.mjs';
import { decodeWav, toFloat } from './wav.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const AUDIO_DIR = join(REPO_ROOT, 'assets', 'audio');
export const RECIPE_DIR = join(AUDIO_DIR, 'recipes');
export const MANIFEST_PATH = join(AUDIO_DIR, 'manifest.json');
export const PROVENANCE_PATH = join(AUDIO_DIR, 'provenance.json');

/** Hard budget for every shipped audio file together (decimal megabytes, the stricter reading). */
export const BUDGET_BYTES = 8_000_000;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** JSON with object keys sorted recursively: a whitespace- and order-independent identity. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadPatches() {
  const patches = readJson(join(RECIPE_DIR, '_patches.json'));
  delete patches.$comment;
  return patches;
}

export function loadManifestSource() {
  return readJson(join(RECIPE_DIR, '_manifest.json'));
}

/** All sound recipes (files not starting with '_'), sorted by id. */
export function loadRecipes() {
  const files = readdirSync(RECIPE_DIR)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return files.map((name) => {
    const recipe = readJson(join(RECIPE_DIR, name));
    if (`${recipe.id}.json` !== name)
      throw new Error(`Recipe ${name} must have id ${name.slice(0, -5)}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id) || recipe.id.length > 64)
      throw new Error(`Sound id ${recipe.id} must be lower-case kebab words (content ID rules)`);
    return { file: `assets/audio/recipes/${name}`, recipe };
  });
}

/** Output path of a sound relative to the repository root (also its src relative to the site). */
export function soundSrc(recipe) {
  return `assets/audio/${recipe.kind === 'music' ? 'music' : 'sfx'}/${recipe.id}.wav`;
}

/** Measurements of the shipped bytes (decoded from the WAV, exactly what players get). */
export function measureWav(wav, loop) {
  const decoded = decodeWav(wav);
  const x = toFloat(decoded.samples);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, v < 0 ? -v : v);
  return {
    sampleRate: decoded.sampleRate,
    samples: decoded.samples.length,
    peakDbfs: roundTo(gainToDb(peak), 2),
    truePeakDbtp: roundTo(gainToDb(truePeak(x, loop)), 2),
    loudnessLufs: roundTo(
      loop ? integrated(x, decoded.sampleRate, true) : momentaryMax(x, decoded.sampleRate),
      2,
    ),
  };
}

/** Render every recipe (optionally a subset). Returns build entries in recipe order. */
export function renderAll({ only } = {}) {
  const patches = loadPatches();
  const entries = [];
  for (const { file, recipe } of loadRecipes()) {
    if (only && !only.includes(recipe.id)) continue;
    const resolved = resolveRecipe(recipe, patches);
    const result = renderRecipe(recipe, patches);
    const loop = recipe.kind === 'music';
    entries.push({
      recipe,
      recipeFile: file,
      recipeSha256: sha256(canonicalJson(resolved)),
      src: soundSrc(recipe),
      wav: result.wav,
      sha256: sha256(result.wav),
      samples: result.samples,
      stats: result.stats,
      measured: measureWav(result.wav, loop),
    });
  }
  return entries;
}

/** The advisory manifest S3 consumes (registerPack assets, event map, music states, mix hints). */
export function buildManifest(entries, source) {
  const sounds = entries.map(({ recipe, src, sha256: digest, wav, measured }) => {
    const loop = recipe.kind === 'music';
    const sound = {
      id: recipe.id,
      title: recipe.title,
      src,
      bus: recipe.bus,
      loop,
      category: recipe.category,
      durationSeconds: roundTo(measured.samples / measured.sampleRate, 4),
      samples: measured.samples,
      sampleRate: measured.sampleRate,
      bytes: wav.length,
      sha256: digest,
      volume: recipe.volume ?? 1,
      loudnessLufs: measured.loudnessLufs,
      loudnessMeasure: loop ? 'integrated' : 'momentary-max',
      truePeakDbtp: measured.truePeakDbtp,
      description: recipe.description,
    };
    if (loop) {
      sound.music = {
        tempo: recipe.tempo,
        meter: `${recipe.meter[0]}/${recipe.meter[1]}`,
        bars: recipe.form.reduce((a, name) => a + recipe.sectionBars[name], 0),
        key: recipe.key,
        form: recipe.form.join(' '),
      };
    }
    return sound;
  });
  const bytes = sounds.reduce((a, s) => a + s.bytes, 0);
  const seconds = sounds.reduce((a, s) => a + s.durationSeconds, 0);
  const revision = `audio-${sha256(sounds.map((s) => `${s.id}:${s.sha256}`).join('\n')).slice(0, 16)}`;
  const ids = new Set(sounds.map((s) => s.id));
  for (const [event, mapping] of Object.entries(source.events)) {
    for (const id of mapping.sounds)
      if (!ids.has(id)) throw new Error(`Event ${event} maps to unknown sound ${id}`);
  }
  for (const [state, id] of Object.entries(source.music.states)) {
    if (!ids.has(id)) throw new Error(`Music state ${state} maps to unknown sound ${id}`);
  }
  return {
    schema: 'dragon-valley-audio-manifest/1',
    packId: source.packId,
    revision,
    advisory: source.advisory,
    format: { container: 'wav', encoding: 'pcm-s16le', channels: 1, sampleRate: source.sampleRate },
    totals: {
      sounds: sounds.length,
      bytes,
      seconds: roundTo(seconds, 3),
      budgetBytes: BUDGET_BYTES,
    },
    buses: source.buses,
    loudnessTargets: source.loudnessTargets,
    voices: source.voices,
    sounds,
    events: source.events,
    music: source.music,
  };
}

export function buildProvenance(entries, source) {
  return {
    schema: 'dragon-valley-audio-provenance/1',
    works:
      'Original works: every sound and every melody is synthesized from the recipes in this repository. No samples, recordings, sample libraries or third-party audio are used, and the music quotes no existing melody, including traditional folk tunes.',
    author:
      "Generated by this repository's scripts (scripts/audio) from the recipes in assets/audio/recipes.",
    license: 'MIT',
    licenseFile: 'LICENSE',
    generator: {
      ...GENERATOR,
      command: 'npm run audio:build',
      verify: 'npm run audio:verify',
      runtime: 'Node.js 24, no npm dependencies, no external tools',
      determinism:
        'Only IEEE-754 basic arithmetic and seeded integer PRNGs (no Math.sin/exp/pow/log/sqrt/random), so regeneration reproduces identical bytes on every platform.',
    },
    patchLibrary: 'assets/audio/recipes/_patches.json',
    recipeSha256:
      'sha256 of the canonical JSON (sorted keys, no whitespace) of a recipe with every patch it extends resolved',
    sounds: entries.map((e) => ({
      id: e.recipe.id,
      file: e.src,
      sha256: e.sha256,
      bytes: e.wav.length,
      recipe: e.recipeFile,
      recipeSha256: e.recipeSha256,
      seed: e.recipe.seed,
    })),
    sampleRate: source.sampleRate,
  };
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
