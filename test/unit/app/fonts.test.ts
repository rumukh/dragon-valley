/**
 * The bundled reading font: a renamed subset of Andika (SIL OFL 1.1). The files match their
 * recorded provenance, stay within the size budget, carry the copyright and license records,
 * no longer use the Reserved Font Name, and cover every character the game shows.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FAMILY,
  MAX_FACE_BYTES,
  OUTPUT_DIRECTORY,
  readFace,
  REQUIRED,
} from '../../../scripts/fonts/subset-andika.mjs';

interface Provenance {
  family: string;
  origin: { name: string; version: string; reservedFontNames: string[]; license: string };
  license: { file: string; bytes: number; sha256: string };
  faces: { file: string; style: string; weight: number; bytes: number; sha256: string }[];
}

const provenance: Provenance = JSON.parse(
  readFileSync(join(OUTPUT_DIRECTORY, 'provenance.json'), 'utf8'),
);
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('DV Reading font', () => {
  it('records its origin: Andika 7.000 under the SIL Open Font License', () => {
    expect(provenance.family).toBe(FAMILY);
    expect(provenance.origin).toMatchObject({
      name: 'Andika',
      version: '7.000',
      reservedFontNames: ['Andika', 'SIL'],
      license: 'SIL Open Font License, Version 1.1',
    });
    expect(provenance.faces.map((face) => face.style)).toEqual(['Regular', 'Bold']);
  });

  it('ships the license text unchanged next to the fonts', () => {
    const license = readFileSync(join(OUTPUT_DIRECTORY, 'OFL.txt'));
    expect(license.length).toBe(provenance.license.bytes);
    expect(sha256(license)).toBe(provenance.license.sha256);
    expect(license.toString('utf8')).toMatch(/^Copyright \(c\) 2004-2025 SIL Global/);
    expect(license.toString('utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  for (const face of provenance.faces) {
    describe(face.style, () => {
      const bytes = readFileSync(join(OUTPUT_DIRECTORY, face.file));

      it('matches its provenance digest and stays within the size budget', () => {
        expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
        expect(bytes.length).toBe(face.bytes);
        expect(sha256(bytes)).toBe(face.sha256);
        expect(bytes.length).toBeLessThanOrEqual(MAX_FACE_BYTES);
      });

      it('is renamed, keeping the copyright and license records', async () => {
        const { names } = await readFace(bytes);
        expect(names.get(1)).toBe(FAMILY);
        expect(names.get(2)).toBe(face.style);
        for (const id of [1, 3, 4, 6]) expect(names.get(id) ?? '').not.toMatch(/Andika|SIL/);
        expect(names.get(0)).toContain('SIL Global');
        expect(names.get(13)).toMatch(/Open Font License/);
        expect(names.get(10)).toContain('Modified Version of Andika');
      });

      it('covers Czech letters, digits and every math sign in both notations', async () => {
        const { codePoints } = await readFace(bytes);
        const missing = [...REQUIRED].filter(
          (character) => !codePoints.has(character.codePointAt(0)!),
        );
        expect(missing).toEqual([]);
        for (const sign of ['·', '×', '÷', ':', '=', '<', '>', '+', '\u2212', '(', ')', '?']) {
          expect(codePoints.has(sign.codePointAt(0)!), sign).toBe(true);
        }
      });
    });
  }
});
