/**
 * Minimal PNG encoder (RGB, 8-bit, zlib via node:zlib) and plots for self-review: waveform with RMS
 * envelope, log-frequency spectrogram and loop-seam zoom, labelled with a tiny 5x7 bitmap font.
 */
import { deflateSync } from 'node:zlib';
import { gainToDb, log2, pow2, powerToDb, sqrt } from './dmath.mjs';
import { stft } from './analysis.mjs';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(
      raw,
      y * (width * 3 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// prettier-ignore
const FONT = {
  '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[31,2,4,2,1,17,14],
  '4':[2,6,10,18,31,2,2],'5':[31,16,30,1,1,17,14],'6':[6,8,16,30,17,17,14],'7':[31,1,2,4,8,8,8],
  '8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,2,12],A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],
  C:[14,17,16,16,16,17,14],D:[28,18,17,17,17,18,28],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],
  G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[14,4,4,4,4,4,14],J:[7,2,2,2,2,18,12],
  K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,17,25,21,19,17,17],
  O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],
  S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],
  W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],Y:[17,17,17,10,4,4,4],Z:[31,1,2,4,8,16,31],
  '-':[0,0,0,31,0,0,0],'.':[0,0,0,0,0,12,12],':':[0,12,12,0,12,12,0],'/':[0,1,2,4,8,16,0],
  '(':[2,4,8,8,8,4,2],')':[8,4,2,2,2,4,8],'%':[24,25,2,4,8,19,3],'+':[0,4,4,31,4,4,0],
  '=':[0,0,31,0,31,0,0],'_':[0,0,0,0,0,0,31],',':[0,0,0,0,12,4,8],' ':[0,0,0,0,0,0,0],
  '>':[8,4,2,1,2,4,8],'<':[2,4,8,16,8,4,2],
};

export class Canvas {
  constructor(width, height, bg = [16, 18, 26]) {
    this.width = width;
    this.height = height;
    this.rgb = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i++) this.rgb.set(bg, i * 3);
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.rgb[i] = c[0];
    this.rgb[i + 1] = c[1];
    this.rgb[i + 2] = c[2];
  }

  rect(x0, y0, w, h, c) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c);
  }

  vline(x, y0, y1, c) {
    const a = Math.min(y0, y1);
    const b = Math.max(y0, y1);
    for (let y = a; y <= b; y++) this.set(x, y, c);
  }

  hline(y, x0, x1, c) {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }

  text(x, y, str, c = [230, 230, 240], scale = 1) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const glyph = FONT[ch] ?? FONT[' '];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 5; col++)
          if (glyph[row] & (16 >> col))
            this.rect(cx + col * scale, y + row * scale, scale, scale, c);
      cx += 6 * scale;
    }
  }

  blit(other, ox, oy) {
    for (let y = 0; y < other.height; y++)
      for (let x = 0; x < other.width; x++) {
        const i = (y * other.width + x) * 3;
        this.set(ox + x, oy + y, [other.rgb[i], other.rgb[i + 1], other.rgb[i + 2]]);
      }
  }

  png() {
    return encodePng(this.width, this.height, this.rgb);
  }
}

const STOPS = [
  [0, [4, 4, 16]],
  [0.25, [62, 18, 112]],
  [0.5, [178, 54, 120]],
  [0.75, [248, 138, 44]],
  [1, [252, 248, 170]],
];

function colormap(t) {
  const v = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (v - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** Waveform: min/max per column (light), RMS (bright), -1 dBFS guide lines, 100 ms ticks. */
export function waveformCanvas(x, fs, { width = 1000, height = 180, title = '' } = {}) {
  const c = new Canvas(width, height);
  const top = 14;
  const h = height - top - 4;
  const mid = top + Math.floor(h / 2);
  const ceiling = 0.8912509381337456; // -1 dBFS
  const yOf = (v) => mid - Math.round((v * h) / 2);
  c.hline(yOf(ceiling), 0, width - 1, [90, 40, 40]);
  c.hline(yOf(-ceiling), 0, width - 1, [90, 40, 40]);
  c.hline(mid, 0, width - 1, [50, 54, 70]);
  const seconds = x.length / fs;
  const tick = seconds > 8 ? 1 : 0.1;
  for (let t = tick; t < seconds; t += tick)
    c.vline(Math.round((t / seconds) * width), top, top + h, [34, 38, 52]);
  for (let col = 0; col < width; col++) {
    const a = Math.floor((col * x.length) / width);
    const b = Math.max(a + 1, Math.floor(((col + 1) * x.length) / width));
    let lo = 0;
    let hi = 0;
    let sq = 0;
    for (let i = a; i < b; i++) {
      const v = x[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sq += v * v;
    }
    const r = sqrt(sq / (b - a));
    c.vline(col, yOf(hi), yOf(lo), [70, 130, 200]);
    c.vline(col, yOf(r), yOf(-r), [150, 210, 255]);
    if (hi >= ceiling || lo <= -ceiling) c.vline(col, top, top + 3, [255, 60, 60]);
  }
  c.text(4, 3, `${title}  ${seconds.toFixed(2)}S  TICK ${tick}S`);
  return c;
}

/** Log-frequency spectrogram (40 Hz .. Nyquist), dB colour scale over the top 90 dB. */
export function spectrogramCanvas(
  x,
  fs,
  { width = 1000, height = 220, title = '', circular = false } = {},
) {
  const c = new Canvas(width, height);
  const top = 14;
  const h = height - top;
  const size = 1024;
  const hop = Math.max(32, Math.floor(x.length / width / 2) * 2 || 32);
  const { frames } = stft(x, size, Math.min(hop, 256), circular);
  let max = -Infinity;
  const dbFrames = frames.map((p) => {
    const d = new Float64Array(p.length);
    for (let k = 0; k < p.length; k++) {
      d[k] = powerToDb(p[k] + 1e-20);
      if (d[k] > max) max = d[k];
    }
    return d;
  });
  const fMin = 40;
  const fMax = fs / 2;
  const span = log2(fMax / fMin);
  for (let col = 0; col < width; col++) {
    const f = dbFrames[Math.min(dbFrames.length - 1, Math.floor((col * dbFrames.length) / width))];
    for (let row = 0; row < h; row++) {
      const hz = fMin * pow2(((h - 1 - row) / (h - 1)) * span);
      const bin = Math.min(f.length - 1, Math.round((hz * size) / fs));
      c.set(col, top + row, colormap((f[bin] - (max - 90)) / 90));
    }
  }
  for (const hz of [100, 1000, 5000, 10000]) {
    if (hz >= fMax) continue;
    const row = top + h - 1 - Math.round((log2(hz / fMin) / span) * (h - 1));
    c.hline(row, 0, 6, [255, 255, 255]);
    c.text(9, row - 3, hz >= 1000 ? `${hz / 1000}K` : `${hz}`, [200, 200, 210]);
  }
  c.text(4, 3, `${title}  SPECTROGRAM 40HZ-${(fMax / 1000).toFixed(1)}KHZ  TOP 90DB`);
  return c;
}

/** Loop seam zoom: the last `ms` before the seam and the first `ms` after it, sample by sample. */
export function seamCanvas(x, fs, { width = 1000, height = 160, ms = 30, title = '' } = {}) {
  const n = x.length;
  const half = Math.round((fs * ms) / 1000);
  const seg = new Float64Array(2 * half);
  for (let i = 0; i < half; i++) {
    seg[i] = x[n - half + i];
    seg[half + i] = x[i];
  }
  let peak = 1e-6;
  for (const v of seg) peak = Math.max(peak, v < 0 ? -v : v);
  const c = new Canvas(width, height);
  const top = 14;
  const h = height - top - 4;
  const mid = top + Math.floor(h / 2);
  c.hline(mid, 0, width - 1, [50, 54, 70]);
  c.vline(Math.round(width / 2), top, top + h, [200, 80, 80]);
  let prevY = null;
  for (let col = 0; col < width; col++) {
    const i = Math.min(seg.length - 1, Math.floor((col * seg.length) / width));
    const y = mid - Math.round((((seg[i] / peak) * h) / 2) * 0.95);
    if (prevY !== null) c.vline(col, prevY, y, [150, 210, 255]);
    prevY = y;
  }
  c.text(4, 3, `${title}  LOOP SEAM +-${ms}MS  SCALE ${gainToDb(peak).toFixed(1)}DBFS`);
  return c;
}

export function stackCanvases(canvases, gap = 4) {
  const width = Math.max(...canvases.map((c) => c.width));
  const height = canvases.reduce((a, c) => a + c.height, 0) + gap * (canvases.length - 1);
  const out = new Canvas(width, height, [0, 0, 0]);
  let y = 0;
  for (const c of canvases) {
    out.blit(c, 0, y);
    y += c.height + gap;
  }
  return out;
}
