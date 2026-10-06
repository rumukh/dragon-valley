/**
 * The committed audio pack (assets/audio) is a build output that must be reproducible. This test
 * re-synthesizes every recipe and requires byte-identical WAVs on every OS CI runs (ubuntu and
 * windows), then checks the headers, levels, loop seams, budget, manifest and provenance.
 *
 * The expected SHA-256 values are the ones committed in assets/audio/provenance.json; they are
 * literal goldens written by `npm run audio:build`, never derived from this run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { isContentId } from '../../../src/rules/contract/ids';
import {
  levelStats,
  resamplerSeamError,
  seamMetrics,
} from '../../../scripts/audio/lib/analysis.mjs';
import {
  BUDGET_BYTES,
  buildManifest,
  buildProvenance,
  loadManifestSource,
  REPO_ROOT,
  renderAll,
  sha256,
  stableJson,
} from '../../../scripts/audio/lib/pipeline.mjs';
import { LIMITS, packProblems } from '../../../scripts/audio/lib/quality.mjs';
import { renderRecipe } from '../../../scripts/audio/lib/render.mjs';
import { decodeWav, toFloat } from '../../../scripts/audio/lib/wav.mjs';

type Entry = ReturnType<typeof renderAll>[number];
type Committed = { id: string; file: string; sha256: string; bytes: number };

const read = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf8');
const provenance = JSON.parse(read('assets/audio/provenance.json'));
const manifest = JSON.parse(read('assets/audio/manifest.json'));
const source = loadManifestSource();
let entries: Entry[];

beforeAll(() => {
  entries = renderAll();
}, 600_000);

describe('audio pack reproducibility', () => {
  it('re-synthesizes every committed WAV byte for byte', () => {
    const committed: Committed[] = provenance.sounds;
    expect(entries.map((e) => e.recipe.id)).toEqual(committed.map((s) => s.id));
    for (const [index, entry] of entries.entries()) {
      const golden = committed[index]!;
      expect(entry.src, entry.recipe.id).toBe(golden.file);
      expect(entry.sha256, `${entry.recipe.id} re-synthesis`).toBe(golden.sha256);
      expect(sha256(readFileSync(join(REPO_ROOT, golden.file))), `${golden.file} on disk`).toBe(
        golden.sha256,
      );
    }
  });

  it('regenerates the committed manifest and provenance exactly', () => {
    expect(stableJson(buildManifest(entries, source))).toBe(read('assets/audio/manifest.json'));
    expect(stableJson(buildProvenance(entries, source))).toBe(read('assets/audio/provenance.json'));
  });

  it('changes the bytes when a recipe parameter changes', () => {
    const entry = entries.find((e) => e.recipe.id === 'chime-1')!;
    const patches = JSON.parse(read('assets/audio/recipes/_patches.json'));
    const altered = renderRecipe({ ...entry.recipe, seed: entry.recipe.seed + 1 }, patches);
    expect(sha256(altered.wav)).not.toBe(entry.sha256);
  });
});

describe('audio pack quality', () => {
  it('passes every quality gate', () => {
    expect(packProblems(entries, source)).toEqual([]);
  });

  it('uses canonical 16-bit mono PCM WAV headers at 22050 Hz', () => {
    for (const entry of entries) {
      const decoded = decodeWav(readFileSync(join(REPO_ROOT, entry.src)));
      expect(decoded, entry.recipe.id).toMatchObject({
        format: 1,
        channels: 1,
        bitsPerSample: 16,
        sampleRate: 22050,
      });
      expect(decoded.samples.length, entry.recipe.id).toBeGreaterThan(0);
    }
  });

  it('keeps peaks under -1 dBTP and levels inside sane bounds', () => {
    for (const entry of entries) {
      const x = toFloat(decodeWav(entry.wav).samples);
      const { peakDb, rmsDb, dc } = levelStats(x);
      const id = entry.recipe.id;
      expect(entry.measured.truePeakDbtp, id).toBeLessThanOrEqual(LIMITS.truePeakDbtp);
      expect(peakDb, id).toBeLessThanOrEqual(-1);
      expect(Math.abs(dc), id).toBeLessThan(LIMITS.maxDcOffset);
      const [lo, hi] = entry.recipe.kind === 'music' ? [-40, -16] : [-45, -10];
      expect(rmsDb, id).toBeGreaterThan(lo);
      expect(rmsDb, id).toBeLessThan(hi);
    }
  });

  it('keeps effects consistent within their loudness tiers and music under the effects', () => {
    const tiers = source.loudnessTargets;
    for (const entry of entries) {
      const tier = tiers[entry.recipe.category];
      expect(tier, entry.recipe.id).toBeDefined();
      expect(
        Math.abs(entry.measured.loudnessLufs - tier.target),
        entry.recipe.id,
      ).toBeLessThanOrEqual(LIMITS.loudnessToleranceLu);
    }
    expect(tiers.music.target).toBeLessThan(tiers.feedback.target - 6);
    expect(tiers.musicCalm.target).toBeLessThan(tiers.music.target);
  });

  it('loops seamlessly, even after a browser resamples them at decode time', () => {
    const loops = entries.filter((e) => e.recipe.kind === 'music');
    expect(loops.map((e) => e.recipe.id).sort()).toEqual(['boss', 'practice', 'valley', 'victory']);
    for (const entry of loops) {
      const x = toFloat(decodeWav(entry.wav).samples);
      const seam = seamMetrics(x, 22050);
      expect(seam.seamStepRatio, entry.recipe.id).toBeLessThan(LIMITS.seamStepRatio);
      for (const rate of [44100, 48000]) {
        expect((x.length * rate) % 22050, `${entry.recipe.id} at ${rate} Hz`).toBe(0);
        const error = resamplerSeamError(x, 22050, rate);
        expect(error.maxErrorDb, `${entry.recipe.id} resampled to ${rate} Hz`).toBeLessThan(-45);
      }
    }
  });

  it('fits the offline budget', () => {
    const bytes = entries.reduce((sum, e) => sum + e.wav.length, 0);
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    expect(BUDGET_BYTES).toBe(8_000_000);
    expect(manifest.totals.bytes).toBe(bytes);
  });
});

describe('audio manifest', () => {
  it('uses canonical content IDs and maps every sound to a use', () => {
    const used = new Set<string>();
    for (const [event, mapping] of Object.entries(manifest.events) as [
      string,
      { sounds: string[] },
    ][]) {
      expect(isContentId(event), event).toBe(true);
      for (const id of mapping.sounds) used.add(id);
    }
    for (const [state, id] of Object.entries(manifest.music.states) as [string, string][]) {
      expect(isContentId(state), state).toBe(true);
      used.add(id);
    }
    for (const sound of manifest.sounds as {
      id: string;
      src: string;
      bus: string;
      loop: boolean;
    }[]) {
      expect(isContentId(sound.id), sound.id).toBe(true);
      expect(used.has(sound.id), `${sound.id} is unused`).toBe(true);
      expect(sound.bus).toBe(sound.loop ? 'music' : 'effects');
      expect(sound.src).toMatch(/^assets\/audio\/(sfx|music)\/[a-z0-9-]+\.wav$/);
    }
  });

  it('maps the plan section 3.3 events that carry sound', () => {
    for (const event of [
      'answer.correct',
      'answer.incorrect',
      'level.completed',
      'region.unlocked',
      'boss.defeated',
      'dragon.hatched',
      'dragon.grew',
      'dragon.crowned',
      'pane.lit',
      'coins.earned',
      'item.purchased',
      'sticker.earned',
      'quest.completed',
      'gift.opened',
      'finale.completed',
    ]) {
      expect(manifest.events[event]?.sounds.length, event).toBeGreaterThan(0);
    }
    expect(manifest.events['answer.correct'].sounds).toEqual([
      'chime-1',
      'chime-2',
      'chime-3',
      'chime-4',
      'chime-5',
    ]);
    expect(manifest.music.states).toMatchObject({
      hub: 'valley',
      map: 'valley',
      round: 'practice',
      boss: 'boss',
      results: 'victory',
      finale: 'victory',
    });
  });

  it('describes provenance as original MIT works generated by this repository', () => {
    expect(provenance.license).toBe('MIT');
    expect(provenance.generator.name).toBe('dragon-valley-audio-synth');
    expect(provenance.works).toMatch(/Original works/);
  });
});
