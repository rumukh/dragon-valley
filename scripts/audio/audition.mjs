/**
 * Audition page for the audio pack: out/audio-audition/index.html (scratch, not committed).
 *
 *   node scripts/audio/audition.mjs
 *
 * The page embeds the committed WAV files (exactly the shipped bytes) and plays them through Web
 * Audio the way the game does: effects as one-shot buffers, music as sample-accurate looping
 * buffers. Loops get a "jump to seam" button that starts 4 seconds before the loop point. A toggle
 * compares a 22050 Hz AudioContext (no decode-time resampling, the recommended setting) with the
 * device default rate.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifestSource, MANIFEST_PATH, REPO_ROOT } from './lib/pipeline.mjs';
import { spectrogramCanvas, stackCanvases, waveformCanvas } from './lib/png.mjs';
import { decodeWav, toFloat } from './lib/wav.mjs';

const outDir = join(REPO_ROOT, 'out', 'audio-audition');
mkdirSync(join(outDir, 'png'), { recursive: true });
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const source = loadManifestSource();

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const data = {};
for (const sound of manifest.sounds) {
  const bytes = readFileSync(join(REPO_ROOT, sound.src));
  data[sound.id] = bytes.toString('base64');
  const decoded = decodeWav(bytes);
  const x = toFloat(decoded.samples);
  const width = sound.loop ? 900 : 520;
  const png = stackCanvases(
    [
      waveformCanvas(x, decoded.sampleRate, { width, height: 70, title: sound.id }),
      spectrogramCanvas(x, decoded.sampleRate, {
        width,
        height: 90,
        title: sound.id,
        circular: sound.loop,
      }),
    ],
    2,
  ).png();
  writeFileSync(join(outDir, 'png', `${sound.id}.png`), png);
}

const usedBy = {};
for (const [event, mapping] of Object.entries(source.events))
  for (const id of mapping.sounds) (usedBy[id] ??= []).push(event);
const statesFor = (id) =>
  Object.entries(source.music.states)
    .filter(([, sound]) => sound === id)
    .map(([state]) => state);

const card = (s) => `
  <article class="card" id="card-${s.id}">
    <header>
      <h3>${escapeHtml(s.title)} <code>${s.id}</code></h3>
      <div class="meta">${s.durationSeconds.toFixed(2)} s · ${s.loudnessLufs} LUFS (${s.loudnessMeasure}) · ${s.truePeakDbtp} dBTP · ${s.category}${
        s.music ? ` · ${s.music.tempo} BPM ${s.music.meter} · ${s.music.key} · ${s.music.form}` : ''
      }</div>
    </header>
    <p>${escapeHtml(s.description)}</p>
    <p class="events">${
      s.loop
        ? `Music states: ${statesFor(s.id).join(', ') || 'none'}`
        : `Events: ${(usedBy[s.id] || []).join(', ') || 'none mapped'}`
    }</p>
    <div class="buttons">${
      s.loop
        ? `<button data-loop="${s.id}">Play loop</button>
           <button data-seam="${s.id}">Jump to seam (4 s before the loop point)</button>
           <button data-stop>Stop music</button>`
        : `<button data-play="${s.id}">Play</button>`
    }</div>
    <img src="png/${s.id}.png" alt="Waveform and spectrogram of ${s.id}" loading="lazy">
  </article>`;

const music = manifest.sounds.filter((s) => s.loop);
const sfxByCategory = {};
for (const s of manifest.sounds.filter((x) => !x.loop)) (sfxByCategory[s.category] ??= []).push(s);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dragon Valley audio audition (${manifest.revision})</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; background: #12141c; color: #e8e8f0; }
  main { max-width: 1100px; margin: 0 auto; padding: 16px 20px 80px; }
  h1 { font-size: 1.5rem; margin: 8px 0; }
  h2 { margin-top: 32px; border-bottom: 1px solid #333a50; padding-bottom: 4px; }
  .panel { position: sticky; top: 0; background: #1b1f2c; padding: 10px 14px; border-radius: 10px;
           display: flex; flex-wrap: wrap; gap: 14px; align-items: center; z-index: 2; box-shadow: 0 4px 12px #0008; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 14px; }
  .card { background: #1b1f2c; border-radius: 10px; padding: 10px 14px; }
  .card h3 { margin: 0; font-size: 1.05rem; }
  .card code { color: #9fc5ff; font-size: 0.9rem; }
  .meta, .events { color: #a8adc2; font-size: 0.82rem; margin: 4px 0; }
  .card p { margin: 6px 0; font-size: 0.92rem; line-height: 1.35; }
  .card img { width: 100%; border-radius: 6px; margin-top: 6px; }
  button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #4b5578; background: #2a3150;
           color: #fff; cursor: pointer; min-height: 40px; }
  button:hover, button:focus-visible { background: #3b4570; outline: 2px solid #9fc5ff; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
  label { font-size: 0.9rem; }
  #status { font-size: 0.85rem; color: #ffd27a; }
</style>
</head>
<body>
<main>
  <h1>Dragon Valley audio audition</h1>
  <p>Pack <code>${manifest.revision}</code>: ${manifest.totals.sounds} sounds, ${(manifest.totals.bytes / 1e6).toFixed(2)} MB of 16-bit mono PCM at ${manifest.format.sampleRate} Hz (budget ${(manifest.totals.budgetBytes / 1e6).toFixed(0)} MB). These are the exact committed files, played through Web Audio like the game: effects as one-shot buffers, music as gapless looping buffers. Headphones or laptop speakers both make sense; also try a tablet.</p>
  <div class="panel" role="group" aria-label="Playback settings">
    <label>Music volume <input id="musicVol" type="range" min="0" max="1" step="0.05" value="1"></label>
    <label>Effects volume <input id="fxVol" type="range" min="0" max="1" step="0.05" value="1"></label>
    <label>Context rate
      <select id="rate">
        <option value="22050" selected>22050 Hz (recommended: no resampling at the loop seam)</option>
        <option value="default">Device default (browser resamples each file)</option>
      </select>
    </label>
    <button data-stop>Stop music</button>
    <span id="status">Click any button to start audio.</span>
  </div>

  <h2>Music loops</h2>
  <p>"Play loop" starts at the beginning (with the game's 1.2 s fade-in). "Jump to seam" starts 4 seconds before the loop point so you hear the wrap-around after 4 seconds; it should be inaudible. Changing loops crossfades over 1.2 s like <code>setAtmosphere</code>.</p>
  <div class="grid">${music.map(card).join('')}</div>

  <h2>Sequences (as the game would trigger them)</h2>
  <div class="buttons">
    <button data-seq="streak">Answer streak: chime-1 to chime-5, then a miss, then chime-1</button>
    <button data-seq="level">Level complete + three stars</button>
    <button data-seq="hatch">Hatching: wobble, crack, fanfare</button>
    <button data-seq="feeding">Feeding Time: chime then chomp</button>
    <button data-seq="coins">coin x3, then coin-shower</button>
    <button data-seq="panes">Magic Window: 3 panes staggered 150 ms</button>
    <button data-seq="mix">Mix check: practice loop with answers over it</button>
  </div>

  ${Object.entries(sfxByCategory)
    .map(
      ([category, sounds]) => `<h2>Effects: ${escapeHtml(category)} (${
        manifest.loudnessTargets[category]?.target
      } LUFS momentary max)</h2>
  <div class="grid">${sounds.map(card).join('')}</div>`,
    )
    .join('\n')}
</main>
<script>
const DATA = ${JSON.stringify(data)};
let ctx = null;
let buses = null;
const buffers = new Map();
let music = null;
const status = (t) => { document.getElementById('status').textContent = t; };

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function ensureContext() {
  const wanted = document.getElementById('rate').value;
  if (ctx && ctx.__rate === wanted) {
    if (ctx.state !== 'running') await ctx.resume();
    return ctx;
  }
  if (ctx) { stopMusic(0); await ctx.close(); }
  ctx = wanted === 'default' ? new AudioContext() : new AudioContext({ sampleRate: 22050 });
  ctx.__rate = wanted;
  buffers.clear();
  buses = { music: ctx.createGain(), effects: ctx.createGain() };
  buses.music.connect(ctx.destination);
  buses.effects.connect(ctx.destination);
  applyVolumes();
  if (ctx.state !== 'running') await ctx.resume();
  status('AudioContext running at ' + ctx.sampleRate + ' Hz.');
  return ctx;
}

function applyVolumes() {
  if (!buses) return;
  buses.music.gain.value = Number(document.getElementById('musicVol').value);
  buses.effects.gain.value = Number(document.getElementById('fxVol').value);
}

async function buffer(id) {
  if (!buffers.has(id)) buffers.set(id, await ctx.decodeAudioData(b64ToBytes(DATA[id])));
  return buffers.get(id);
}

async function play(id, when = 0) {
  await ensureContext();
  const src = ctx.createBufferSource();
  src.buffer = await buffer(id);
  src.connect(buses.effects);
  src.start(ctx.currentTime + when);
}

function stopMusic(fade = 1.2) {
  if (!music) return;
  const { src, gain } = music;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + fade);
  src.stop(now + fade + 0.05);
  music = null;
}

async function loop(id, offset = 0, fade = 1.2) {
  await ensureContext();
  stopMusic(fade);
  const src = ctx.createBufferSource();
  src.buffer = await buffer(id);
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = fade ? 0 : 1;
  src.connect(gain);
  gain.connect(buses.music);
  const now = ctx.currentTime;
  if (fade) gain.gain.linearRampToValueAtTime(1, now + fade);
  src.start(now, offset);
  music = { id, src, gain };
  status('Looping ' + id + (offset ? ' from ' + offset.toFixed(2) + ' s (seam in ' + (src.buffer.duration - offset).toFixed(1) + ' s)' : '') + ' at ' + ctx.sampleRate + ' Hz.');
}

const SEQUENCES = {
  streak: [['chime-1', 0], ['chime-2', 0.7], ['chime-3', 1.4], ['chime-4', 2.1], ['chime-5', 2.8], ['miss', 4.2], ['chime-1', 5.4]],
  level: [['level-complete', 0], ['star-1', 2.6], ['star-2', 3.0], ['star-3', 3.4]],
  hatch: [['egg-wobble', 0], ['egg-wobble', 0.9], ['egg-crack', 1.8], ['hatch-fanfare', 2.6], ['dragon-chirp', 5.4]],
  feeding: [['chime-1', 0], ['chomp', 0.3], ['chime-2', 1.6], ['chomp', 1.9]],
  coins: [['coin', 0], ['coin', 0.25], ['coin', 0.5], ['coin-shower', 1.4]],
  panes: [['pane-light', 0], ['pane-light', 0.15], ['pane-light', 0.3]],
};

document.addEventListener('click', async (event) => {
  const el = event.target.closest('button');
  if (!el) return;
  try {
    if (el.dataset.play) await play(el.dataset.play);
    else if (el.dataset.loop) await loop(el.dataset.loop);
    else if (el.dataset.seam) {
      await ensureContext();
      const b = await buffer(el.dataset.seam);
      await loop(el.dataset.seam, Math.max(0, b.duration - 4), 0);
    } else if ('stop' in el.dataset) { if (ctx) stopMusic(); status('Music stopped.'); }
    else if (el.dataset.seq === 'mix') {
      await loop('practice');
      for (const [id, t] of [['chime-1', 2], ['chomp', 2.3], ['chime-2', 5], ['chomp', 5.3], ['miss', 8], ['chime-1', 11], ['chime-2', 14], ['chime-3', 17]]) play(id, t);
    } else if (el.dataset.seq) for (const [id, t] of SEQUENCES[el.dataset.seq]) play(id, t);
  } catch (error) {
    status('Audio error: ' + error.message);
  }
});
document.getElementById('musicVol').addEventListener('input', applyVolumes);
document.getElementById('fxVol').addEventListener('input', applyVolumes);
document.getElementById('rate').addEventListener('change', () => { if (ctx) { stopMusic(0); ctx.close(); ctx = null; status('Context closed; the next click reopens it at the chosen rate.'); } });
</script>
</body>
</html>
`;
writeFileSync(join(outDir, 'index.html'), html);
console.log(
  `audition page written to ${join(outDir, 'index.html')} (${(html.length / 1e6).toFixed(1)} MB)`,
);
