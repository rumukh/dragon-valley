// @ts-check
/**
 * Build the game's reading font: a renamed subset of Andika (SIL Open Font License 1.1).
 *
 *   node scripts/fonts/subset-andika.mjs --source <dir>           write assets/fonts/dv-reading/
 *   node scripts/fonts/subset-andika.mjs --source <dir> --check   rebuild in memory and compare
 *
 * `<dir>` is the `Andika-7.000` folder of the extracted official release archive:
 *
 *   gh release download v7.000 -R silnrsi/font-andika -p Andika-7.000.zip
 *
 * Every source file is checked against the SHA-256 pinned in SOURCE before it is used.
 *
 * Why the family is renamed: subsetting a webfont is a modification (OFL FAQ 2.6), and "Andika"
 * and "SIL" are Reserved Font Names, which a Modified Version may not use as its primary font
 * name (OFL condition 3). The output therefore carries the family name "DV Reading", keeps the
 * original copyright notice and license records, and states its origin in the description
 * record. OFL.txt (line endings normalised to LF, text unchanged) travels next to the fonts and
 * is shipped with the site.
 *
 * The output is deterministic: HarfBuzz subsetting and WOFF2 (Brotli) compression of the same
 * inputs with the same tool versions produce the same bytes, which --check proves.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { isMain, readJson, repositoryRoot } from '../lib/tools.mjs';

/** CommonJS loader for the subsetting tools (dev dependencies without type declarations). */
const load = createRequire(import.meta.url);

export const OUTPUT_DIRECTORY = join(repositoryRoot, 'assets', 'fonts', 'dv-reading');
export const FAMILY = 'DV Reading';
export const MAX_FACE_BYTES = 80 * 1024;

/** The pinned official release; digests were taken from the downloaded files. */
export const SOURCE = {
  name: 'Andika',
  version: '7.000',
  release: 'https://github.com/silnrsi/font-andika/releases/tag/v7.000',
  archive: {
    file: 'Andika-7.000.zip',
    url: 'https://github.com/silnrsi/font-andika/releases/download/v7.000/Andika-7.000.zip',
    sha256: '88ba6ea41ef4a8e5214b090df8fa2983be1babe4843efaa99cdb6078b0e2c070',
  },
  license: {
    file: 'OFL.txt',
    sha256: 'fd0f044f061aa463fa1675a71fa0c229a067e2062c321c89e5f20965883f23b2',
  },
  faces: [
    {
      style: 'Regular',
      weight: 400,
      file: 'Andika-Regular.ttf',
      sha256: '27484fdc98d0d63f90407f8266e28295f6fb16d2b13c5024df0214f17152919a',
    },
    {
      style: 'Bold',
      weight: 700,
      file: 'Andika-Bold.ttf',
      sha256: '3ad43a77a29ea060528be69a9e0e81c9dbbe8dff894a26ae1818d3c472393319',
    },
  ],
};

/**
 * Code points kept in the subset, as inclusive ranges. Latin-1 and Latin Extended-A cover
 * Czech names (č ď ě ň ř š ť ů ž); the math symbols are the ones the game renders in either
 * notation: · × ÷ : = < > + − ( ) ?
 * @type {readonly (readonly [number, number])[]}
 */
export const RANGES = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x0100, 0x017f],
  [0x2009, 0x2009],
  [0x2010, 0x2027],
  [0x202f, 0x202f],
  [0x2039, 0x203a],
  [0x2212, 0x2212],
];

/** Characters the game cannot do without; the build fails if a face lacks any of them. */
export const REQUIRED =
  '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  '·×÷:=<>+\u2212()?!.,\'’"“”…-–' +
  'ÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž';

/** @param {Uint8Array} bytes */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function subsetText() {
  let text = '';
  for (const [from, to] of RANGES) {
    for (let code = from; code <= to; code++) text += String.fromCodePoint(code);
  }
  return text;
}

/** @param {number} code */
function hex(code) {
  return code.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parse an SFNT table directory.
 * @param {Buffer} font
 */
export function readTables(font) {
  const count = font.readUInt16BE(4);
  /** @type {Map<string, Buffer>} */
  const tables = new Map();
  for (let index = 0; index < count; index++) {
    const record = 12 + index * 16;
    const tag = font.toString('latin1', record, record + 4);
    const offset = font.readUInt32BE(record + 8);
    const length = font.readUInt32BE(record + 12);
    tables.set(tag, font.subarray(offset, offset + length));
  }
  return { version: font.readUInt32BE(0), tables };
}

/** @param {Buffer} table */
function checksum(table) {
  const padded = Buffer.alloc((table.length + 3) & ~3);
  table.copy(padded);
  let sum = 0;
  for (let offset = 0; offset < padded.length; offset += 4) {
    sum = (sum + padded.readUInt32BE(offset)) >>> 0;
  }
  return sum;
}

/**
 * Assemble an SFNT from tables: sorted records, 4-byte alignment, table checksums and a
 * correct head.checkSumAdjustment.
 * @param {number} version
 * @param {Map<string, Buffer>} tables
 */
export function writeSfnt(version, tables) {
  const tags = [...tables.keys()].sort();
  const count = tags.length;
  let power = 1;
  let exponent = 0;
  while (power * 2 <= count) {
    power *= 2;
    exponent++;
  }
  const header = Buffer.alloc(12 + count * 16);
  header.writeUInt32BE(version, 0);
  header.writeUInt16BE(count, 4);
  header.writeUInt16BE(power * 16, 6);
  header.writeUInt16BE(exponent, 8);
  header.writeUInt16BE(count * 16 - power * 16, 10);
  /** @type {Buffer[]} */
  const bodies = [];
  let offset = header.length;
  let headOffset = -1;
  tags.forEach((tag, index) => {
    const table = Buffer.from(/** @type {Buffer} */ (tables.get(tag)));
    if (tag === 'head') {
      table.writeUInt32BE(0, 8);
      headOffset = offset;
    }
    const record = 12 + index * 16;
    header.write(tag, record, 'latin1');
    header.writeUInt32BE(checksum(table), record + 4);
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(table.length, record + 12);
    const padded = Buffer.alloc((table.length + 3) & ~3);
    table.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  if (headOffset < 0) throw new Error('The font has no head table.');
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);
  return font;
}

/**
 * Windows Unicode (platform 3, encoding 1, US English) name records by name ID.
 * @param {Buffer} table
 */
export function readNames(table) {
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  /** @type {Map<number, string>} */
  const names = new Map();
  for (let index = 0; index < count; index++) {
    const record = 6 + index * 12;
    const platform = table.readUInt16BE(record);
    const encoding = table.readUInt16BE(record + 2);
    const language = table.readUInt16BE(record + 4);
    const id = table.readUInt16BE(record + 6);
    const length = table.readUInt16BE(record + 8);
    const offset = table.readUInt16BE(record + 10);
    if (platform !== 3 || encoding !== 1 || language !== 0x0409) continue;
    const bytes = Buffer.from(table.subarray(storage + offset, storage + offset + length));
    names.set(id, bytes.swap16().toString('utf16le'));
  }
  return names;
}

/**
 * A format-0 name table with Windows Unicode US English records only.
 * @param {Map<number, string>} names
 */
export function writeNames(names) {
  const ids = [...names.keys()].sort((a, b) => a - b);
  const strings = ids.map((id) => Buffer.from(names.get(id) ?? '', 'utf16le').swap16());
  const header = Buffer.alloc(6 + ids.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(ids.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  ids.forEach((id, index) => {
    const record = 6 + index * 12;
    const text = /** @type {Buffer} */ (strings[index]);
    header.writeUInt16BE(3, record);
    header.writeUInt16BE(1, record + 2);
    header.writeUInt16BE(0x0409, record + 4);
    header.writeUInt16BE(id, record + 6);
    header.writeUInt16BE(text.length, record + 8);
    header.writeUInt16BE(offset, record + 10);
    offset += text.length;
  });
  return Buffer.concat([header, ...strings]);
}

/**
 * Every code point mapped to a real glyph by the Unicode cmap subtables (formats 4 and 12).
 * @param {Buffer} table
 */
export function readCodePoints(table) {
  /** @type {Set<number>} */
  const points = new Set();
  const count = table.readUInt16BE(2);
  for (let index = 0; index < count; index++) {
    const record = 4 + index * 8;
    const platform = table.readUInt16BE(record);
    const encoding = table.readUInt16BE(record + 2);
    const offset = table.readUInt32BE(record + 4);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const format = table.readUInt16BE(offset);
    if (format === 4) {
      const segments = table.readUInt16BE(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        const end = table.readUInt16BE(ends + segment * 2);
        const start = table.readUInt16BE(starts + segment * 2);
        const delta = table.readUInt16BE(deltas + segment * 2);
        const rangeOffset = table.readUInt16BE(ranges + segment * 2);
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph;
          if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
          else {
            glyph = table.readUInt16BE(ranges + segment * 2 + rangeOffset + (code - start) * 2);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) points.add(code);
        }
      }
    } else if (format === 12) {
      const groups = table.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group++) {
        const at = offset + 16 + group * 12;
        const end = table.readUInt32BE(at + 4);
        for (let code = table.readUInt32BE(at); code <= end; code++) points.add(code);
      }
    }
  }
  return points;
}

/**
 * Decode a built WOFF2 face back to its name records and mapped code points (for the tests).
 * @param {Buffer} woff2
 */
export async function readFace(woff2) {
  const fontverter = load('fontverter');
  /** @type {Buffer} */
  const sfnt = await fontverter.convert(woff2, 'sfnt', 'woff2');
  const { tables } = readTables(sfnt);
  return {
    names: readNames(/** @type {Buffer} */ (tables.get('name'))),
    codePoints: readCodePoints(/** @type {Buffer} */ (tables.get('cmap'))),
    tables: [...tables.keys()].sort(),
  };
}

/**
 * Subset, rename and compress one face.
 * @param {Buffer} source the original TrueType face
 * @param {{ style: string }} face
 */
export async function buildFace(source, face) {
  const subsetFont = load('subset-font');
  const fontverter = load('fontverter');
  /** @type {Buffer} */
  const subset = await subsetFont(source, subsetText(), { targetFormat: 'sfnt' });
  const { version, tables } = readTables(subset);
  const original = readNames(/** @type {Buffer} */ (readTables(source).tables.get('name')));
  const copyright = original.get(0);
  const license = original.get(13);
  const licenseUrl = original.get(14);
  if (!copyright || !license || !licenseUrl) {
    throw new Error('The source face lacks its copyright or license name records.');
  }
  const postscript = `DVReading-${face.style}`;
  tables.set(
    'name',
    writeNames(
      new Map([
        [0, copyright],
        [1, FAMILY],
        [2, face.style],
        [3, `${postscript};${SOURCE.version};dragon-valley-subset-1`],
        [4, `${FAMILY} ${face.style}`],
        [5, `Version ${SOURCE.version}; Dragon Valley subset 1`],
        [6, postscript],
        [
          10,
          `Modified Version of ${SOURCE.name} ${SOURCE.version} by SIL Global, subset to Latin, digits and math symbols for Dragon Valley and renamed as the OFL requires.`,
        ],
        [13, license],
        [14, licenseUrl],
      ]),
    ),
  );
  const sfnt = writeSfnt(version, tables);
  const points = readCodePoints(/** @type {Buffer} */ (tables.get('cmap')));
  const missing = [...REQUIRED].filter((character) => !points.has(character.codePointAt(0) ?? 0));
  if (missing.length) {
    throw new Error(`${FAMILY} ${face.style} lacks required characters: ${missing.join(' ')}`);
  }
  /** @type {Buffer} */
  const woff2 = await fontverter.convert(sfnt, 'woff2', 'sfnt');
  if (woff2.length > MAX_FACE_BYTES) {
    throw new Error(`${FAMILY} ${face.style} is ${woff2.length} bytes (budget ${MAX_FACE_BYTES}).`);
  }
  return { woff2, codePoints: points.size, tables: [...tables.keys()].sort() };
}

/**
 * @param {string} directory
 * @param {string} file
 * @param {string} expected
 */
function readVerified(directory, file, expected) {
  const path = join(directory, file);
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  const bytes = readFileSync(path);
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(
      `${file} has SHA-256 ${actual}, expected ${expected} (Andika ${SOURCE.version}).`,
    );
  }
  return bytes;
}

/**
 * @param {{ source: string; check?: boolean }} options
 */
export async function buildFonts(options) {
  const directory = resolve(options.source);
  const sourceLicense = readVerified(directory, SOURCE.license.file, SOURCE.license.sha256);
  const license = Buffer.from(sourceLicense.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  const faces = [];
  for (const face of SOURCE.faces) {
    const source = readVerified(directory, face.file, face.sha256);
    const built = await buildFace(source, face);
    faces.push({
      file: `DVReading-${face.style}.woff2`,
      family: FAMILY,
      style: face.style,
      weight: face.weight,
      bytes: built.woff2.length,
      sha256: sha256(built.woff2),
      codePoints: built.codePoints,
      tables: built.tables,
      source: { file: face.file, bytes: source.length, sha256: face.sha256 },
      woff2: built.woff2,
    });
  }
  const provenance = {
    format: 'dragon-valley-font-provenance/1',
    family: FAMILY,
    origin: {
      name: SOURCE.name,
      version: SOURCE.version,
      copyright: 'Copyright (c) 2004-2025 SIL Global (https://www.sil.org/)',
      reservedFontNames: ['Andika', 'SIL'],
      license: 'SIL Open Font License, Version 1.1',
      release: SOURCE.release,
      archive: SOURCE.archive,
    },
    license: {
      file: 'OFL.txt',
      bytes: license.length,
      sha256: sha256(license),
      source: { file: SOURCE.license.file, sha256: SOURCE.license.sha256 },
      note: 'The release OFL.txt with CRLF line endings normalised to LF; the text is unchanged.',
    },
    modification:
      'Subset with HarfBuzz to the ranges below (all layout features kept), name table rewritten to the family "DV Reading" (copyright and license records kept), compressed to WOFF2. Renamed because subsetting is a modification (OFL FAQ 2.6) and "Andika" is a Reserved Font Name.',
    ranges: RANGES.map(([from, to]) =>
      from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`,
    ),
    required: REQUIRED,
    tools: Object.fromEntries(
      ['subset-font', 'harfbuzzjs', 'fontverter', 'wawoff2'].map((name) => [
        name,
        readJson(join(repositoryRoot, 'node_modules', name, 'package.json')).version,
      ]),
    ),
    command: 'node scripts/fonts/subset-andika.mjs --source <extracted Andika-7.000 folder>',
    faces: faces.map((face) => ({
      file: face.file,
      family: face.family,
      style: face.style,
      weight: face.weight,
      bytes: face.bytes,
      sha256: face.sha256,
      codePoints: face.codePoints,
      tables: face.tables,
      source: face.source,
    })),
  };
  /** @type {Map<string, Buffer>} */
  const files = new Map([
    ...faces.map((face) => /** @type {[string, Buffer]} */ ([face.file, face.woff2])),
    ['OFL.txt', license],
    ['provenance.json', Buffer.from(JSON.stringify(provenance, null, 2) + '\n')],
  ]);
  if (options.check) {
    const drift = [...files].filter(([name, bytes]) => {
      const path = join(OUTPUT_DIRECTORY, name);
      return !existsSync(path) || !readFileSync(path).equals(bytes);
    });
    if (drift.length) {
      throw new Error(
        `Committed fonts differ from a fresh build: ${drift.map(([name]) => name).join(', ')}`,
      );
    }
    return { checked: [...files.keys()], faces: provenance.faces };
  }
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  for (const [name, bytes] of files) writeFileSync(join(OUTPUT_DIRECTORY, name), bytes);
  return { written: [...files.keys()], faces: provenance.faces };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  /** @type {{ source?: string; check?: boolean }} */
  const options = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--source') options.source = args[++index];
    else if (args[index] === '--check') options.check = true;
    else {
      console.error(`Unknown option: ${args[index]}`);
      process.exit(2);
    }
  }
  if (!options.source) {
    console.error('Usage: node scripts/fonts/subset-andika.mjs --source <dir> [--check]');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await buildFonts({ ...options, source: options.source }), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
