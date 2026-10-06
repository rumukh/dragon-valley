/**
 * Unit tests for the synthesis toolkit: loudness calibration, limiter ceiling, band-limited
 * oscillators, WAV encoding, the melody notation validator, seam/click detection and circular
 * (seamless) loop rendering. Each check is paired with a deliberately broken input that must fail.
 */
import { describe, expect, it } from 'vitest';
import { clicks, fft, seamMetrics } from '../../../scripts/audio/lib/analysis.mjs';
import { cosTurns, gainToDb, sinTurns } from '../../../scripts/audio/lib/dmath.mjs';
import { limit } from '../../../scripts/audio/lib/dynamics.mjs';
import { momentaryMax } from '../../../scripts/audio/lib/loudness.mjs';
import { parseChord, parseMelody } from '../../../scripts/audio/lib/music.mjs';
import { renderRecipe } from '../../../scripts/audio/lib/render.mjs';
import { decimate } from '../../../scripts/audio/lib/resample.mjs';
import { Rng } from '../../../scripts/audio/lib/rng.mjs';
import { renderVoice } from '../../../scripts/audio/lib/sources.mjs';
import { decodeWav, encodeWav } from '../../../scripts/audio/lib/wav.mjs';

const FS = 22050;

const peakOf = (x: Float64Array): number => {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
};

describe('loudness meter', () => {
  it('reads a -20 dBFS 997 Hz sine as -23 LUFS (BS.1770 calibration)', () => {
    const x = new Float64Array(FS * 2);
    for (let i = 0; i < x.length; i++) x[i] = 0.1 * sinTurns((997 * i) / FS);
    expect(Math.abs(momentaryMax(x, FS) - -23.01)).toBeLessThan(0.1);
  });
});

describe('soft limiter', () => {
  it('keeps every sample under the ceiling', () => {
    const rng = new Rng(9);
    const x = new Float64Array(FS);
    for (let i = 0; i < x.length; i++) x[i] = rng.bipolar() * (i % 3000 < 60 ? 3 : 0.4);
    expect(gainToDb(peakOf(x))).toBeGreaterThan(-1.6);
    for (const circular of [false, true]) {
      const y = limit(x, FS, { ceilingDb: -1.6, kneeDb: 2 }, circular);
      expect(gainToDb(peakOf(y))).toBeLessThanOrEqual(-1.6);
    }
  });
});

describe('oscillators', () => {
  it('render band-limited sawtooth and square waves without audible aliasing', () => {
    const f0 = 1760;
    for (const wave of ['saw', 'square']) {
      const voice = {
        freq: f0,
        gate: 1,
        seed: 1,
        sources: [{ type: 'osc', wave }],
        amp: { a: 0.001, d: 0, s: 1, r: 0.01 },
      };
      const y = decimate(renderVoice(voice, FS * 4, FS), 4, FS, false);
      const size = 16384;
      const re = new Float64Array(size);
      const im = new Float64Array(size);
      for (let i = 0; i < size; i++) re[i] = y[2000 + i]! * (0.5 - 0.5 * cosTurns(i / size));
      fft(re, im);
      let fundamental = 0;
      let worstAlias = 0;
      for (let k = 1; k < size / 2; k++) {
        const hz = (k * FS) / size;
        const power = re[k]! * re[k]! + im[k]! * im[k]!;
        const harmonic = hz / f0;
        const nearHarmonic = Math.abs(harmonic - Math.round(harmonic)) * f0 < 25;
        if (nearHarmonic && Math.round(harmonic) === 1) fundamental += power;
        else if (!nearHarmonic && hz > 50 && hz < 9500) worstAlias = Math.max(worstAlias, power);
      }
      expect(gainToDb(worstAlias / fundamental) / 2).toBeLessThan(-60);
    }
  });
});

describe('WAV codec', () => {
  it('round-trips canonical 16-bit mono PCM', () => {
    const samples = Int16Array.from([0, 1, -1, 32767, -32768, 1234, 0]);
    const wav = encodeWav(samples, FS);
    expect(wav.length).toBe(44 + 2 * samples.length);
    const decoded = decodeWav(wav);
    expect(decoded).toMatchObject({ format: 1, channels: 1, sampleRate: FS, bitsPerSample: 16 });
    expect([...decoded.samples]).toEqual([...samples]);
  });

  it('rejects malformed files', () => {
    const wav = encodeWav(Int16Array.from([1, 2, 3]), FS);
    const stereo = Buffer.from(wav);
    stereo.writeUInt16LE(2, 22);
    expect(() => decodeWav(stereo)).toThrow(/mono/);
    expect(() => decodeWav(wav.subarray(0, wav.length - 2))).toThrow(/size/);
    const notRiff = Buffer.from(wav);
    notRiff.write('RIFX', 0, 'ascii');
    expect(() => decodeWav(notRiff)).toThrow(/RIFF/);
  });
});

describe('music notation', () => {
  it('parses durations, ties, chords and dynamics', () => {
    const { events, beats } = parseMelody("mf C5:q. D5:e~ D5:q [C4,E4,G4]:h r:q E5:e'", {
      barBeats: undefined,
    });
    expect(beats).toBe(6.5);
    expect(events.map((e: { beat: number; beats: number }) => [e.beat, e.beats])).toEqual([
      [0, 1.5],
      [1.5, 1.5],
      [3, 2],
      [6, 0.5],
    ]);
    expect(events[2]!.midi).toEqual([60, 64, 67]);
    expect(events[3]!.gate).toBe(0.5);
    expect(parseChord('Bbmaj7/D')).toMatchObject({ root: 10, bass: 2, pcs: [10, 2, 5, 9] });
  });

  it('rejects a bar that does not fill the meter', () => {
    expect(() => parseMelody('C5:q D5:q E5:q | F5:q G5:q', { barBeats: 3 })).toThrow(/Bar 2/);
    expect(() => parseMelody('C5:q D5:q E5:h', { barBeats: 3 })).toThrow(/Bar 1/);
  });
});

describe('loop seams', () => {
  const loop = (): Float64Array => {
    const n = FS * 2;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++)
      x[i] = 0.3 * sinTurns((110 * i) / FS) + 0.2 * sinTurns((330 * i) / FS);
    return x;
  };

  it('accepts a continuous loop and flags a broken one', () => {
    const good = loop();
    expect(seamMetrics(good, FS).seamStepRatio).toBeLessThan(1.5);
    expect(clicks(good, FS, true)).toEqual([]);
    const broken = good.slice(0, good.length - 37); // the end no longer meets the start
    const found = clicks(broken, FS, true);
    const seamFound =
      seamMetrics(broken, FS).seamStepRatio > 1.5 || found.some((t: number) => t < 0.002);
    expect(seamFound).toBe(true);
  });

  it('wraps release and reverb tails around to the loop start', () => {
    const recipe = {
      id: 'test-loop',
      kind: 'music',
      bus: 'music',
      category: 'music',
      seed: 5,
      sampleRate: FS,
      oversample: 2,
      tempo: 120,
      meter: [4, 4],
      form: ['A'],
      sectionBars: { A: 1 },
      loudness: { measure: 'integrated', target: -23 },
      instruments: {
        bell: {
          sources: [{ type: 'additive', partials: [{ ratio: 1, db: 0, t60: 1.5 }] }],
          amp: { a: 0.002, d: 0, s: 1, r: 0.3 },
          minGate: 1.2,
        },
      },
      tracks: [
        {
          name: 'bell',
          instrument: 'bell',
          sends: { hall: -6 },
          phrases: { A: 'r:h r:q A4:q' },
        },
      ],
      buses: { hall: { type: 'reverb', decay: 1.5 } },
    };
    const { samples } = renderRecipe(recipe, {});
    // The note starts on beat 4 (1.5 s); its ring and reverb must continue at the loop start.
    let headEnergy = 0;
    for (let i = 0; i < Math.round(0.2 * FS); i++) headEnergy += samples[i]! * samples[i]!;
    expect(headEnergy).toBeGreaterThan(1e-4);
    expect(clicks(samples, FS, true)).toEqual([]);
    expect(seamMetrics(samples, FS).seamStepRatio).toBeLessThan(1.5);
  });
});
