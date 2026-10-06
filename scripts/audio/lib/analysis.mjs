/**
 * Numerical self-review: levels, DC, spectral balance, onsets, clicks, dead air and loop-seam
 * continuity, plus a simulation of the browser's decode-time resampling at the loop seam.
 */
import { cosTurns, gainToDb, PI, powerToDb, roundTo, sinTurns, sqrt } from './dmath.mjs';
import { integrated, momentaryMax, shortTermMax } from './loudness.mjs';
import { truePeak } from './resample.mjs';

export function levelStats(x) {
  let peak = 0;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v;
    sq += v * v;
  }
  const rms = sqrt(sq / x.length);
  return {
    peak,
    peakDb: gainToDb(peak),
    rmsDb: gainToDb(rms),
    dc: sum / x.length,
    crestDb: gainToDb(peak) - gainToDb(rms),
  };
}

// ---------------------------------------------------------------------------------------------
// FFT

const twiddleCache = new Map();
function twiddles(n) {
  let t = twiddleCache.get(n);
  if (!t) {
    t = { re: new Float64Array(n / 2), im: new Float64Array(n / 2) };
    for (let k = 0; k < n / 2; k++) {
      t.re[k] = cosTurns(k / n);
      t.im[k] = -sinTurns(k / n);
    }
    twiddleCache.set(n, t);
  }
  return t;
}

/** In-place radix-2 FFT. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  const tw = twiddles(n);
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = tw.re[k * step];
        const wi = tw.im[k * step];
        const a = i + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/** Power spectra of Hann-windowed frames. Returns { frames: Float64Array[], size, hop }. */
export function stft(x, size = 1024, hop = 256, circular = false) {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * cosTurns(i / size);
  const frames = [];
  const n = x.length;
  const count = circular ? Math.ceil(n / hop) : Math.max(1, Math.ceil((n - size) / hop) + 1);
  for (let f = 0; f < count; f++) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      let idx = f * hop + i;
      if (circular) idx %= n;
      re[i] = idx < n ? x[idx] * window[i] : 0;
    }
    fft(re, im);
    const p = new Float64Array(size / 2 + 1);
    for (let k = 0; k <= size / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
    frames.push(p);
  }
  return { frames, size, hop };
}

export function spectralStats(x, fs) {
  const { frames, size } = stft(x, 1024, 256);
  const binHz = fs / size;
  const total = new Float64Array(size / 2 + 1);
  for (const p of frames) for (let k = 0; k < p.length; k++) total[k] += p[k];
  let sum = 0;
  let weighted = 0;
  for (let k = 1; k < total.length; k++) {
    sum += total[k];
    weighted += total[k] * k * binHz;
  }
  const band = (lo, hi) => {
    let e = 0;
    for (let k = 1; k < total.length; k++) if (k * binHz >= lo && k * binHz < hi) e += total[k];
    return e / (sum || 1);
  };
  let acc = 0;
  let rolloff95 = 0;
  for (let k = 1; k < total.length; k++) {
    acc += total[k];
    if (acc >= 0.95 * sum) {
      rolloff95 = k * binHz;
      break;
    }
  }
  return {
    centroidHz: sum ? weighted / sum : 0,
    rolloff95Hz: rolloff95,
    lowBelow150: band(0, 150),
    highAbove6k: band(6000, fs / 2 + 1),
    highAbove9k: band(9000, fs / 2 + 1),
  };
}

// ---------------------------------------------------------------------------------------------
// Time-domain features

/** RMS envelope in dB over frames of `ms` milliseconds. */
export function envelopeDb(x, fs, ms = 5) {
  const w = Math.max(1, Math.round((fs * ms) / 1000));
  const out = [];
  for (let start = 0; start < x.length; start += w) {
    let sq = 0;
    const end = Math.min(x.length, start + w);
    for (let i = start; i < end; i++) sq += x[i] * x[i];
    out.push(powerToDb(sq / (end - start) || 1e-30));
  }
  return { db: out, frameSeconds: w / fs };
}

/** Onset times (seconds): frames rising >= 9 dB above the recent minimum and within 35 dB of the max. */
export function onsets(x, fs) {
  const { db, frameSeconds } = envelopeDb(x, fs, 5);
  const max = Math.max(...db);
  const result = [];
  let armed = true;
  for (let i = 1; i < db.length; i++) {
    let recentMin = Infinity;
    for (let k = Math.max(0, i - 6); k < i; k++) recentMin = Math.min(recentMin, db[k]);
    if (armed && db[i] > max - 35 && db[i] - recentMin >= 9) {
      result.push(roundTo(i * frameSeconds, 3));
      armed = false;
    }
    if (!armed && db[i] < db[i - 1] - 0.5) armed = true;
  }
  return result;
}

/** Time from the start to the first 5 ms frame within 30 dB of the loudest frame. */
export function firstSoundMs(x, fs) {
  const { db, frameSeconds } = envelopeDb(x, fs, 1);
  const max = Math.max(...db);
  for (let i = 0; i < db.length; i++)
    if (db[i] > max - 30) return roundTo(i * frameSeconds * 1000, 1);
  return null;
}

/** Longest stretch (seconds) more than `belowDb` under the loudest 10 ms frame, between the first and last loud frame. */
export function longestGap(x, fs, belowDb = 40) {
  const { db, frameSeconds } = envelopeDb(x, fs, 10);
  const max = Math.max(...db);
  const loud = db.map((v) => v > max - belowDb);
  const first = loud.indexOf(true);
  const last = loud.lastIndexOf(true);
  let best = 0;
  let run = 0;
  for (let i = first; i <= last; i++) {
    run = loud[i] ? 0 : run + 1;
    best = Math.max(best, run);
  }
  let tail = 0;
  for (let i = db.length - 1; i >= 0 && db[i] < max - 60; i--) tail++;
  return {
    gapSeconds: roundTo(best * frameSeconds, 3),
    silentTailSeconds: roundTo(tail * frameSeconds, 3),
  };
}

/**
 * Click detector: second-difference spikes far above the local second-difference level.
 * Returns times (seconds) of suspicious discontinuities.
 */
export function clicks(x, fs, circular = false) {
  const n = x.length;
  const at = (i) => (circular ? x[((i % n) + n) % n] : i >= 0 && i < n ? x[i] : 0);
  const d2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = at(i) - 2 * at(i - 1) + at(i - 2);
    d2[i] = v < 0 ? -v : v;
  }
  const w = Math.round(fs * 0.004);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + d2[i] * d2[i];
  const found = [];
  for (let i = 2; i < n; i++) {
    const lo = Math.max(0, i - w);
    const hi = Math.min(n, i + w + 1);
    const local = (prefix[hi] - prefix[lo] - d2[i] * d2[i]) / Math.max(1, hi - lo - 1);
    const ref = sqrt(local) + 1e-5;
    if (d2[i] > 0.02 && d2[i] > 10 * ref) {
      if (!found.length || i / fs - found[found.length - 1] > 0.01) found.push(roundTo(i / fs, 4));
    }
  }
  return found;
}

/**
 * Loop-seam continuity for a loop buffer: compares the step across the seam (last -> first sample)
 * and the local spectral/energy change with the distribution elsewhere in the loop.
 */
export function seamMetrics(x, fs) {
  const n = x.length;
  const steps = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const prev = x[(i - 1 + n) % n];
    const v = x[i] - prev;
    steps[i] = v < 0 ? -v : v;
  }
  const sorted = Float64Array.from(steps).sort();
  const p999 = sorted[Math.floor(0.999 * (n - 1))];
  const seamStep = steps[0];
  const d2 = (i) => {
    const v = x[(i + n) % n] - 2 * x[(i - 1 + n) % n] + x[(i - 2 + n) % n];
    return v < 0 ? -v : v;
  };
  let d2max = 0;
  for (let i = 0; i < n; i++) d2max = Math.max(d2max, d2(i));
  const seamD2 = Math.max(d2(0), d2(1));
  const rmsAround = (from, len) => {
    let sq = 0;
    for (let i = 0; i < len; i++) {
      const v = x[(((from + i) % n) + n) % n];
      sq += v * v;
    }
    return gainToDb(sqrt(sq / len) || 1e-12);
  };
  const w = Math.round(fs * 0.05);
  // Spectral flux across the seam vs elsewhere (circular frames).
  const { frames } = stft(x, 512, 128, true);
  const flux = frames.map((p, f) => {
    const q = frames[(f - 1 + frames.length) % frames.length];
    let s = 0;
    for (let k = 0; k < p.length; k++) {
      const d = sqrt(p[k]) - sqrt(q[k]);
      if (d > 0) s += d;
    }
    return s;
  });
  const fluxSorted = [...flux].sort((a, b) => a - b);
  const median = fluxSorted[Math.floor(flux.length / 2)] || 1e-12;
  // frames whose window covers the seam: those starting within the last 512 samples
  let seamFlux = 0;
  for (let f = 0; f < frames.length; f++) {
    const start = f * 128;
    if (start > n - 512 || start === 0) seamFlux = Math.max(seamFlux, flux[f]);
  }
  return {
    seamStep: roundTo(seamStep, 6),
    stepP999: roundTo(p999, 6),
    seamStepRatio: roundTo(seamStep / (p999 || 1e-12), 3),
    seamSecondDiff: roundTo(seamD2, 6),
    maxSecondDiff: roundTo(d2max, 6),
    rmsLast50msDb: roundTo(rmsAround(n - w, w), 2),
    rmsFirst50msDb: roundTo(rmsAround(0, w), 2),
    seamFluxRatio: roundTo(seamFlux / median, 3),
    fluxP99Ratio: roundTo(fluxSorted[Math.floor(0.99 * (flux.length - 1))] / median, 3),
  };
}

/**
 * Browser decodeAudioData resamples files to the context rate as a one-shot, padding with zeros
 * beyond both ends, so a looping buffer gets slightly wrong samples near its seam. This simulates a
 * 32-tap windowed-sinc resampler with zero padding versus the ideal (circular) resampling and
 * reports the seam error relative to the loop's RMS.
 */
export function resamplerSeamError(x, fs, targetFs) {
  const n = x.length;
  const ratio = fs / targetFs;
  const outLen = Math.floor(n / ratio);
  const half = 16;
  const scale = Math.min(1, 1 / ratio) * 0.9;
  const kernel = (t) => {
    const a = t < 0 ? -t : t;
    if (a >= half) return 0;
    const w =
      0.42 -
      0.5 * cosTurns((a + half) / (2 * half)) +
      0.08 * cosTurns((2 * (a + half)) / (2 * half));
    const s = scale * t;
    return s === 0 ? scale * w : ((scale * sinTurns(s * 0.5)) / (PI * s)) * w;
  };
  const sample = (pos, circular) => {
    const base = Math.floor(pos);
    let acc = 0;
    for (let k = base - half + 1; k <= base + half; k++) {
      let v;
      if (circular) v = x[((k % n) + n) % n];
      else v = k >= 0 && k < n ? x[k] : 0;
      acc += v * kernel(pos - k);
    }
    return acc;
  };
  let errSq = 0;
  let maxErr = 0;
  const edge = Math.ceil((half + 2) / ratio) + 2;
  const idx = [];
  for (let j = 0; j < edge; j++) idx.push(j);
  for (let j = outLen - edge; j < outLen; j++) idx.push(j);
  for (const j of idx) {
    const pos = j * ratio;
    const e = sample(pos, false) - sample(pos, true);
    errSq += e * e;
    maxErr = Math.max(maxErr, e < 0 ? -e : e);
  }
  const { rmsDb } = levelStats(x);
  return {
    targetRate: targetFs,
    maxErrorDb: roundTo(gainToDb(maxErr || 1e-12), 1),
    maxErrorVsRmsDb: roundTo(gainToDb(maxErr || 1e-12) - rmsDb, 1),
    errorEnergyDb: roundTo(powerToDb(errSq || 1e-24), 1),
  };
}

/** Full report for one rendered sound. */
export function analyze(x, fs, { loop = false } = {}) {
  const levels = levelStats(x);
  const report = {
    peakDbfs: roundTo(levels.peakDb, 2),
    truePeakDbtp: roundTo(gainToDb(truePeak(x, loop)), 2),
    rmsDbfs: roundTo(levels.rmsDb, 2),
    crestDb: roundTo(levels.crestDb, 2),
    dcOffset: roundTo(levels.dc, 7),
    momentaryMaxLufs: roundTo(momentaryMax(x, fs, loop), 2),
    ...spectralStats(x, fs),
    clicks: clicks(x, fs, loop),
  };
  if (x.length / fs >= 3) report.shortTermMaxLufs = roundTo(shortTermMax(x, fs, loop), 2);
  if (loop) {
    report.integratedLufs = roundTo(integrated(x, fs, true), 2);
    report.seam = seamMetrics(x, fs);
    report.resamplerSeam = [44100, 48000].map((r) => resamplerSeamError(x, fs, r));
  } else {
    report.firstSoundMs = firstSoundMs(x, fs);
    report.onsets = onsets(x, fs);
    Object.assign(report, longestGap(x, fs));
    report.firstSample = x[0];
    report.lastSample = x[x.length - 1];
  }
  for (const key of ['centroidHz', 'rolloff95Hz']) report[key] = roundTo(report[key], 0);
  for (const key of ['lowBelow150', 'highAbove6k', 'highAbove9k'])
    report[key] = roundTo(report[key], 4);
  return report;
}
