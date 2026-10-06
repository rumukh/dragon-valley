/**
 * S5's audio manifest as the shell reads it: the shipped manifest parses into a valid map with
 * the documented music states and throttles, every sound file exists, and anything unreadable
 * falls back to the silent stub instead of breaking boot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadAudioMap,
  MANIFEST_PATH,
  MANIFEST_SCHEMA,
  parseAudioManifest,
} from '../../../src/app/audio/manifest';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';
import type { Fetcher } from '../../../src/app/content/load';

const shipped = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>;

/** Event and cue names the shell sends (src/app/shell/app.ts, ui/keypad.ts, …). */
const SHELL_CUES = ['ui.tap', 'ui.keypad', 'ui.navigate', 'ui.blocked'];
/** Music states the screens ask for (`Screen.music`). */
const SCREEN_STATES = ['title', 'hub', 'round', 'results'];

const serve =
  (status: number, body: string): Fetcher =>
  async () => ({ ok: status < 400, status, text: async () => body });

describe('the shipped audio manifest', () => {
  const map = parseAudioManifest(shipped);

  it('parses into a valid map whose files all exist', () => {
    expect(map.effects.length).toBeGreaterThan(0);
    for (const asset of [...map.effects, ...map.music]) {
      expect(existsSync(asset.src), asset.src).toBe(true);
      expect(asset.durationMs).toBeGreaterThan(0);
    }
    expect(map.crossfadeSeconds).toBe(1.2);
  });

  it('maps every cue and music state the shell uses', () => {
    for (const cue of SHELL_CUES) expect(map.events[cue]?.sounds.length, cue).toBeGreaterThan(0);
    for (const state of SCREEN_STATES) expect(map.musicStates[state], state).toBeTruthy();
    expect(map.musicStates['round']).not.toBe(map.musicStates['hub']);
  });

  it('keeps the selection policies of the event map', () => {
    expect(map.events['answer.correct']?.pick).toBe('streak');
    expect(map.events['coins.earned']?.pick).toBe('amount');
    expect(map.events['level.completed']?.pick).toBe('sequence');
    expect(map.events['answer.incorrect']?.pick).toBe('first');
  });

  it('keeps per-sound throttles and skips advice that names no sound', () => {
    expect(map.throttle['coin']).toEqual({ minIntervalMs: 70, maxConcurrent: 3 });
    expect(map.throttle).not.toHaveProperty('sparkle-family');
  });
});

describe('reading a manifest', () => {
  it('refuses another schema and malformed entries', () => {
    expect(() => parseAudioManifest({ ...shipped, schema: 'other/1' })).toThrow(MANIFEST_SCHEMA);
    expect(() => parseAudioManifest({ ...shipped, sounds: {} })).toThrow();
    const sounds = shipped['sounds'] as Record<string, unknown>[];
    expect(() =>
      parseAudioManifest({ ...shipped, sounds: [{ ...sounds[0], bus: 'voice' }, ...sounds] }),
    ).toThrow();
    expect(() =>
      parseAudioManifest({
        ...shipped,
        events: { 'answer.correct': { sounds: ['chime-1'], select: 'shuffle' } },
      }),
    ).toThrow();
  });

  it('loads the manifest below the deployment base', async () => {
    const requested: string[] = [];
    const map = await loadAudioMap('https://example.test/dragon-valley/', async (url) => {
      requested.push(url);
      return serve(200, JSON.stringify(shipped))(url);
    });
    expect(requested).toEqual([`https://example.test/dragon-valley/${MANIFEST_PATH}`]);
    expect(map.packId).toBe(shipped['packId']);
  });

  it('falls back to the silent stub when the manifest is missing or broken', async () => {
    const base = 'https://example.test/';
    expect(await loadAudioMap(base, serve(404, ''))).toBe(STUB_AUDIO_MAP);
    expect(await loadAudioMap(base, serve(200, '{ not json'))).toBe(STUB_AUDIO_MAP);
    expect(await loadAudioMap(base, serve(200, '{"schema":"other/1"}'))).toBe(STUB_AUDIO_MAP);
    expect(
      await loadAudioMap(base, async () => {
        throw new TypeError('offline');
      }),
    ).toBe(STUB_AUDIO_MAP);
  });
});
