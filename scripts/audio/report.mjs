/**
 * Self-review report: renders every sound (or --only a subset), analyses it numerically and draws
 * waveform, spectrogram and loop-seam PNGs into out/audio-report/ (scratch, not committed).
 *
 *   node scripts/audio/report.mjs [--only a,b] [--from-disk]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from './lib/analysis.mjs';
import { REPO_ROOT, renderAll } from './lib/pipeline.mjs';
import { seamCanvas, spectrogramCanvas, stackCanvases, waveformCanvas } from './lib/png.mjs';
import { decodeWav, toFloat } from './lib/wav.mjs';

const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(',') : undefined;
const outDir = join(REPO_ROOT, 'out', 'audio-report');
mkdirSync(outDir, { recursive: true });

const entries = renderAll({ only });
const summary = [];
for (const entry of entries) {
  const loop = entry.recipe.kind === 'music';
  const wav = args.includes('--from-disk') ? readFileSync(join(REPO_ROOT, entry.src)) : entry.wav;
  const decoded = decodeWav(wav);
  const x = toFloat(decoded.samples);
  const fs = decoded.sampleRate;
  const report = analyze(x, fs, { loop });
  report.stats = entry.stats;
  summary.push({ id: entry.recipe.id, ...report });
  writeFileSync(join(outDir, `${entry.recipe.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const width = loop ? 1400 : 900;
  const canvases = [
    waveformCanvas(x, fs, { width, height: 170, title: entry.recipe.id }),
    spectrogramCanvas(x, fs, { width, height: 200, title: entry.recipe.id, circular: loop }),
  ];
  if (loop)
    canvases.push(seamCanvas(x, fs, { width, height: 150, ms: 25, title: entry.recipe.id }));
  writeFileSync(join(outDir, `${entry.recipe.id}.png`), stackCanvases(canvases).png());
  const r = report;
  const line = loop
    ? `${entry.recipe.id.padEnd(16)} I ${r.integratedLufs} LUFS  TP ${r.truePeakDbtp}  centroid ${r.centroidHz} Hz  low<150 ${r.lowBelow150}  >6k ${r.highAbove6k}  seam step x${r.seam.seamStepRatio} flux x${r.seam.seamFluxRatio}  resampler ${r.resamplerSeam.map((s) => `${s.targetRate}:${s.maxErrorVsRmsDb}dB`).join(' ')}  clicks ${r.clicks.length}`
    : `${entry.recipe.id.padEnd(16)} M ${r.momentaryMaxLufs} LUFS  TP ${r.truePeakDbtp}  crest ${r.crestDb}  centroid ${r.centroidHz} Hz  >6k ${r.highAbove6k}  first ${r.firstSoundMs} ms  onsets ${r.onsets.length}  gap ${r.gapSeconds} s  tail ${r.silentTailSeconds} s  clicks ${r.clicks.length ? r.clicks.join(',') : 0}`;
  console.log(line);
}
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`report written to ${outDir}`);
