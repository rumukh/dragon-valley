/**
 * The Android build's own tooling (scripts/android/): what the app may ask for, its version, the
 * manifest's privacy promises, and the opaque PNGs Google Play requires for its graphics.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readVersion, requestedPermissions } from '../../scripts/android/build.mjs';
import { decodePng, pngInfo, toOpaquePng } from '../../scripts/android/png.mjs';

const manifest = readFileSync(join('android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

/** A PNG with RGBA rows written with the given PNG filter byte (0 none, 1 sub). */
function rgbaPng(width: number, rows: number[][], filter: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, body: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    // decodePng does not check CRCs; a zero CRC keeps this writer small.
    return Buffer.concat([length, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(rows.length, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = rows.flatMap((row) => {
    if (filter === 0) return [0, ...row];
    return [
      1,
      ...row.map((value, index) => (index >= 4 ? (value - row[index - 4]!) & 0xff : value)),
    ];
  });
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('scripts/android', () => {
  it('counts every permission an APK asks for except AndroidX’s own signature permission', () => {
    const dump = [
      'package: io.github.rumukh.dragonvalley',
      "uses-permission: name='io.github.rumukh.dragonvalley.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'",
    ].join('\n');
    expect(requestedPermissions(dump)).toEqual([]);
    expect(
      requestedPermissions(`${dump}\nuses-permission: name='android.permission.INTERNET'`),
    ).toEqual(['android.permission.INTERNET']);
  });

  it('reads the version Google Play sees from the app build', () => {
    const version = readVersion();
    expect(version.code).toBeGreaterThanOrEqual(1);
    expect(version.name).toMatch(/^\d+\.\d+\.\d+$/);
    expect(readVersion('versionCode = 12\nversionName = "1.2.3"')).toEqual({
      code: 12,
      name: '1.2.3',
    });
  });

  it('keeps the app offline and its data on the device', () => {
    expect(manifest, 'no permissions at all, so no INTERNET').not.toMatch(/<uses-permission/);
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toMatch(/android\.webkit\.WebView\.MetricsOptOut"\s+android:value="true"/);
    expect(manifest).toMatch(
      /android\.webkit\.WebView\.EnableSafeBrowsing"\s+android:value="false"/,
    );
  });

  it('lays a transparent picture over white as a 24-bit PNG', () => {
    const opaque = [255, 0, 0, 255, 0, 0, 255, 255];
    const seeThrough = [0, 0, 0, 0, 0, 128, 0, 128];
    for (const filter of [0, 1]) {
      const converted = toOpaquePng(rgbaPng(2, [opaque, seeThrough], filter));
      expect(pngInfo(converted)).toEqual({ width: 2, height: 2, colorType: 2 });
      expect([...decodePng(converted).pixels], `filter ${filter}`).toEqual([
        ...[255, 0, 0, 0, 0, 255],
        ...[255, 255, 255, 127, 191, 127],
      ]);
    }
  });
});
