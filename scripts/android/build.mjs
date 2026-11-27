// @ts-check
/**
 * Build the Android app (android/, docs/android.md):
 *
 *   node scripts/android/build.mjs             debug APK, to install on a test device or emulator
 *   node scripts/android/build.mjs --release   release bundle (.aab) for Google Play, signed with
 *                                              the upload key, and the same app as a release APK
 *
 * 1. Builds the game with base "/" into out/android/site/www (scripts/build.mjs): the files the app
 *    carries and serves from its own local origin.
 * 2. Runs the Gradle wrapper in android/ with a JDK and the Android SDK (scripts/android/tools.mjs).
 * 3. Checks what the app asks for: no permissions at all (no INTERNET), so nothing in it can
 *    reach a network.
 * 4. Copies the results to out/android/ with the version in their names, and prints their SHA-256.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildSite } from '../build.mjs';
import { isMain, repositoryRoot } from '../lib/tools.mjs';
import { findAapt2, findJava, findSdk } from './tools.mjs';

const ANDROID = join(repositoryRoot, 'android');
const OUT = join(repositoryRoot, 'out', 'android');
const APP = join(ANDROID, 'app');

/** versionCode and versionName from android/app/build.gradle.kts. */
export function readVersion(gradle = readFileSync(join(APP, 'build.gradle.kts'), 'utf8')) {
  const code = /versionCode = (\d+)/.exec(gradle)?.[1];
  const name = /versionName = "([^"]+)"/.exec(gradle)?.[1];
  if (!code || !name)
    throw new Error('android/app/build.gradle.kts has no versionCode/versionName.');
  return { code: Number(code), name };
}

/**
 * Permissions an APK asks for, other than the signature-only one AndroidX declares for its own
 * receivers (`<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`).
 * @param {string} dump the output of `aapt2 dump permissions`
 */
export function requestedPermissions(dump) {
  return [...dump.matchAll(/uses-permission: name='([^']+)'/g)]
    .map((match) => match[1] ?? '')
    .filter((name) => !name.endsWith('.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'));
}

/** @param {string} file */
function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** @param {string[]} tasks @param {NodeJS.ProcessEnv} env */
function gradle(tasks, env) {
  const args = [...tasks, '--console=plain', '--warning-mode=summary'];
  // A .bat file runs only through cmd.exe; the arguments here are fixed task names. Elsewhere the
  // wrapper runs through sh, so it works even where a Windows checkout committed it without its
  // executable bit.
  const result =
    process.platform === 'win32'
      ? spawnSync(env['ComSpec'] ?? 'cmd.exe', ['/d', '/c', 'gradlew.bat', ...args], {
          cwd: ANDROID,
          env,
          stdio: 'inherit',
        })
      : spawnSync('sh', ['gradlew', ...args], { cwd: ANDROID, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Gradle failed: ${tasks.join(' ')}`);
}

/** @param {string} apk @param {string} sdk */
function checkPermissions(apk, sdk) {
  const aapt2 = findAapt2(sdk);
  if (!aapt2) throw new Error('No aapt2 in the Android SDK build-tools to check the APK with.');
  const dump = spawnSync(aapt2, ['dump', 'permissions', apk], { encoding: 'utf8' });
  if (dump.status !== 0) throw new Error(`aapt2 could not read ${apk}: ${dump.stderr}`);
  const asked = requestedPermissions(dump.stdout);
  if (asked.length > 0) {
    throw new Error(`The app must ask for no permissions, but asks for: ${asked.join(', ')}`);
  }
}

/** @param {{ release?: boolean }} [options] */
export async function buildAndroid(options = {}) {
  const java = findJava();
  const sdk = findSdk();
  const version = readVersion();
  const site = await buildSite({ outDir: join(OUT, 'site', 'www'), base: '/', clean: true });
  const env = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk };
  mkdirSync(OUT, { recursive: true });
  /** @type {string[]} */
  const outputs = [];
  if (options.release) {
    const key =
      process.env['DV_UPLOAD_KEY'] ??
      join(
        process.env['USERPROFILE'] ?? process.env['HOME'] ?? '',
        '.dragon-valley',
        'upload-key.properties',
      );
    if (!existsSync(key)) {
      throw new Error(
        `No upload key at ${key}. Create it once with \`npm run android:upload-key -- --name "<developer name>"\` ` +
          'or point DV_UPLOAD_KEY at its properties file (docs/android.md).',
      );
    }
    gradle([':app:bundleRelease', ':app:assembleRelease'], env);
    const apk = join(APP, 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    checkPermissions(apk, sdk);
    const base = `dragon-valley-${version.name}-${version.code}`;
    copyFileSync(
      join(APP, 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
      join(OUT, `${base}.aab`),
    );
    copyFileSync(apk, join(OUT, `${base}.apk`));
    outputs.push(join(OUT, `${base}.aab`), join(OUT, `${base}.apk`));
  } else {
    gradle([':app:assembleDebug'], env);
    const apk = join(APP, 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    checkPermissions(apk, sdk);
    const target = join(OUT, `dragon-valley-${version.name}-debug.apk`);
    copyFileSync(apk, target);
    outputs.push(target);
  }
  return {
    version,
    site: { revision: site.revision, resources: site.resources },
    outputs: outputs.map((file) => ({
      file: relative(repositoryRoot, file),
      sha256: sha256(file),
    })),
  };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--release');
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(' ')}`);
    process.exit(2);
  }
  try {
    console.log(
      JSON.stringify(await buildAndroid({ release: args.includes('--release') }), null, 2),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
