// @ts-check
/**
 * Create the upload key once, outside the repository (docs/android.md, "The upload key"):
 *
 *   node scripts/android/upload-key.mjs --name "Indigenous Alien"
 *
 * Writes ~/.dragon-valley/upload-key.jks (PKCS12, RSA 4096, valid for 30 years) and
 * ~/.dragon-valley/upload-key.properties (where it is and its generated password), which
 * android/app/build.gradle.kts reads to sign release bundles. DV_UPLOAD_KEY names another
 * properties file. It never overwrites a key: Google Play knows the first one it receives.
 * Back both files up somewhere safe; a lost upload key can be reset in Play Console.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMain } from '../lib/tools.mjs';
import { findJava, javaTool } from './tools.mjs';

/** @param {string[]} args */
export function parseUploadKeyArgs(args) {
  const index = args.indexOf('--name');
  const name = index >= 0 ? args[index + 1]?.trim() : undefined;
  if (!name || /[,=+<>#;"\\]/.test(name)) {
    throw new Error('Pass the developer name for the key certificate: --name "Your Name".');
  }
  return { name };
}

/** @param {{ name: string }} options */
export function createUploadKey(options) {
  const properties =
    process.env['DV_UPLOAD_KEY'] ?? join(homedir(), '.dragon-valley', 'upload-key.properties');
  const store = join(dirname(properties), 'upload-key.jks');
  for (const file of [properties, store]) {
    if (existsSync(file))
      throw new Error(`${file} already exists; an upload key is never replaced.`);
  }
  mkdirSync(dirname(properties), { recursive: true });
  const password = randomBytes(24).toString('base64url');
  const keytool = javaTool(findJava(), 'keytool');
  const env = { ...process.env, DV_KEY_PASSWORD: password };
  const created = spawnSync(
    keytool,
    [
      '-genkeypair',
      '-keystore',
      store,
      '-storetype',
      'PKCS12',
      '-alias',
      'upload',
      '-keyalg',
      'RSA',
      '-keysize',
      '4096',
      '-validity',
      '10950',
      '-dname',
      `CN=${options.name}, O=${options.name}`,
      '-storepass:env',
      'DV_KEY_PASSWORD',
      '-keypass:env',
      'DV_KEY_PASSWORD',
    ],
    { env, encoding: 'utf8' },
  );
  if (created.status !== 0) throw new Error(`keytool failed: ${created.stderr || created.stdout}`);
  writeFileSync(
    properties,
    [
      '# The Dragon Valley upload key for Google Play (scripts/android/upload-key.mjs).',
      '# Keep this file and upload-key.jks private and backed up; never commit them.',
      `storeFile=${store.replaceAll('\\', '/')}`,
      `storePassword=${password}`,
      'keyAlias=upload',
      `keyPassword=${password}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  const listed = spawnSync(
    keytool,
    ['-list', '-v', '-keystore', store, '-alias', 'upload', '-storepass:env', 'DV_KEY_PASSWORD'],
    { env, encoding: 'utf8' },
  );
  const fingerprint = /SHA256: ([0-9A-F:]+)/.exec(listed.stdout)?.[1] ?? 'unknown';
  return { properties, store, sha256: fingerprint };
}

if (isMain(import.meta.url)) {
  try {
    console.log(
      JSON.stringify(createUploadKey(parseUploadKeyArgs(process.argv.slice(2))), null, 2),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
