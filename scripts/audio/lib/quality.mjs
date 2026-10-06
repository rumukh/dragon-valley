/**
 * Quality gates for the audio pack, shared by verify.mjs and the Vitest suite. Every check works on
 * the decoded WAV bytes, exactly what players receive.
 */
import { clicks, firstSoundMs, levelStats, seamMetrics } from './analysis.mjs';
import { decodeWav, toFloat } from './wav.mjs';
import { BUDGET_BYTES } from './pipeline.mjs';

export const LIMITS = Object.freeze({
  truePeakDbtp: -1,
  sfxMaxSeconds: 1.5,
  fanfareMaxSeconds: 3,
  musicMinSeconds: 20,
  musicMaxSeconds: 40,
  loudnessToleranceLu: 0.5,
  maxDcOffset: 0.0005,
  seamStepRatio: 1.5,
  seamFluxRatio: 4,
  maxFirstSoundMs: 12,
});

/** Problems (strings) for one rendered entry. An empty list means the sound passes. */
export function soundProblems(entry, source) {
  const problems = [];
  const { recipe, wav } = entry;
  const id = recipe.id;
  const loop = recipe.kind === 'music';
  let decoded;
  try {
    decoded = decodeWav(wav);
  } catch (error) {
    return [`${id}: ${error.message}`];
  }
  if (decoded.sampleRate !== source.sampleRate)
    problems.push(`${id}: sample rate ${decoded.sampleRate}`);
  const x = toFloat(decoded.samples);
  const seconds = x.length / decoded.sampleRate;
  const m = entry.measured;
  if (m.truePeakDbtp > LIMITS.truePeakDbtp)
    problems.push(`${id}: true peak ${m.truePeakDbtp} dBTP > ${LIMITS.truePeakDbtp}`);
  const { dc } = levelStats(x);
  if (Math.abs(dc) > LIMITS.maxDcOffset) problems.push(`${id}: DC offset ${dc}`);
  const tier = source.loudnessTargets[recipe.category];
  if (tier === undefined) problems.push(`${id}: unknown category ${recipe.category}`);
  else {
    if (recipe.loudness.target !== tier.target)
      problems.push(
        `${id}: recipe target ${recipe.loudness.target} differs from ${recipe.category} tier ${tier.target}`,
      );
    if (Math.abs(m.loudnessLufs - tier.target) > LIMITS.loudnessToleranceLu)
      problems.push(
        `${id}: loudness ${m.loudnessLufs} LUFS, tier ${recipe.category} expects ${tier.target}`,
      );
  }
  if (recipe.bus !== (loop ? 'music' : 'effects')) problems.push(`${id}: bus ${recipe.bus}`);
  if (loop) {
    if (seconds < LIMITS.musicMinSeconds || seconds > LIMITS.musicMaxSeconds)
      problems.push(`${id}: loop length ${seconds.toFixed(2)} s`);
    const seam = seamMetrics(x, decoded.sampleRate);
    if (seam.seamStepRatio > LIMITS.seamStepRatio)
      problems.push(`${id}: seam step ratio ${seam.seamStepRatio}`);
    if (seam.seamFluxRatio > LIMITS.seamFluxRatio)
      problems.push(`${id}: seam spectral flux ratio ${seam.seamFluxRatio}`);
    const found = clicks(x, decoded.sampleRate, true);
    if (found.length) problems.push(`${id}: clicks at ${found.join(', ')} s`);
  } else {
    const max = recipe.fanfare ? LIMITS.fanfareMaxSeconds : LIMITS.sfxMaxSeconds;
    if (seconds > max + 1e-9)
      problems.push(`${id}: ${seconds.toFixed(3)} s is longer than ${max} s`);
    if (decoded.samples[0] !== 0 || decoded.samples[decoded.samples.length - 1] !== 0)
      problems.push(`${id}: one-shot must start and end on digital zero`);
    const found = clicks(x, decoded.sampleRate, false);
    if (found.length) problems.push(`${id}: clicks at ${found.join(', ')} s`);
    const first = firstSoundMs(x, decoded.sampleRate);
    if (first === null || first > LIMITS.maxFirstSoundMs)
      problems.push(`${id}: first sound at ${first} ms (feedback must feel instant)`);
  }
  return problems;
}

/** Problems for the whole pack: every sound plus the byte budget. */
export function packProblems(entries, source) {
  const problems = entries.flatMap((e) => soundProblems(e, source));
  const bytes = entries.reduce((a, e) => a + e.wav.length, 0);
  if (bytes > BUDGET_BYTES)
    problems.push(`pack: ${bytes} bytes exceeds the ${BUDGET_BYTES} byte budget`);
  return problems;
}
