// @ts-check
/**
 * Where the Android build tools are: a JDK (JAVA_HOME, else Android Studio's own) and the Android
 * SDK (ANDROID_HOME or ANDROID_SDK_ROOT, else Android Studio's default place). Shared by
 * scripts/android/build.mjs and upload-key.mjs.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const windows = process.platform === 'win32';

/** A JDK home with bin/java, or an error that says how to get one. */
export function findJava() {
  const candidates = [
    process.env['JAVA_HOME'],
    windows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : undefined,
    process.platform === 'darwin'
      ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
      : undefined,
    process.platform === 'linux' ? '/opt/android-studio/jbr' : undefined,
  ];
  const home = candidates.find(
    (path) => path && existsSync(join(path, 'bin', windows ? 'java.exe' : 'java')),
  );
  if (!home) {
    throw new Error(
      'No JDK found. Install Android Studio (it brings one) or set JAVA_HOME to a JDK 17 or newer.',
    );
  }
  return home;
}

/** @param {string} javaHome @param {string} tool */
export function javaTool(javaHome, tool) {
  return join(javaHome, 'bin', windows ? `${tool}.exe` : tool);
}

/** The Android SDK directory, or an error that says how to get one. */
export function findSdk() {
  const candidates = [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    windows && process.env['LOCALAPPDATA']
      ? join(process.env['LOCALAPPDATA'], 'Android', 'Sdk')
      : join(homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk'),
  ];
  const sdk = candidates.find((path) => path && existsSync(join(path, 'platforms')));
  if (!sdk) {
    throw new Error('No Android SDK found. Install Android Studio or set ANDROID_HOME.');
  }
  return sdk;
}

/** The newest installed build-tools' aapt2, used to check what an APK asks for. */
export function findAapt2(/** @type {string} */ sdk) {
  const root = join(sdk, 'build-tools');
  const versions = existsSync(root)
    ? readdirSync(root).sort((a, b) =>
        b.localeCompare(a, 'en', { numeric: true, sensitivity: 'base' }),
      )
    : [];
  for (const version of versions) {
    const tool = join(root, version, windows ? 'aapt2.exe' : 'aapt2');
    if (existsSync(tool)) return tool;
  }
  return undefined;
}
