/**
 * What differs between a browser and the Android app (android/, docs/android.md): saving and
 * opening a grown-up's files, printing, the speech engine, the system Back button and leaving.
 *
 * In a browser a file is offered as a download, which the browser keeps without telling the page
 * where, and picked with a file field; printing is the browser's own dialog. In the Android app
 * the shell does all three with the system's own screens: the grown-up chooses where a file goes,
 * and the game hears whether it was written, so it never reports a backup that does not exist.
 */
import type { SpeechPlatform } from '../speech/read-aloud';
import { AndroidBridgeError, connectAndroid } from './android';
import type { AndroidBridge } from './android';
import { androidSpeech } from './android-speech';

/**
 * How saving a file ended: `saved` (written where the grown-up chose), `cancelled` (they closed
 * the system's save screen) or `downloaded` (handed to the browser, which says no more).
 */
export type SaveOutcome = 'saved' | 'cancelled' | 'downloaded';

export interface Platform {
  readonly kind: 'web' | 'android';
  /** Save text as a file for a grown-up; rejects when it could not be saved. */
  saveFile(name: string, text: string, type: string): Promise<SaveOutcome>;
  /** A file a grown-up picks, as text; null when they cancel. Rejects past `maxBytes`. */
  openTextFile(maxBytes: number): Promise<string | null>;
  /** Print the page as it is (the print preview shows only its pages to the printer). */
  print(title: string): Promise<void>;
  /** The device's speech engine, or undefined for the browser's own Web Speech API. */
  readonly speech: SpeechPlatform | undefined;
  /** The Android Back button or gesture; a browser never calls it. */
  onBack(listener: () => void): () => void;
  /** Leave the game for the home screen (Back on the first screen); nothing in a browser. */
  exit(): void;
}

/** Offer `text` as a file download without putting a link into the page. */
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for one local file and read it as text (bounded by `maxBytes`). Call from a tap. */
export function pickTextFile(maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.className = 'dv-visually-hidden';
    input.tabIndex = -1;
    const done = (): void => input.remove();
    input.addEventListener('change', () => {
      done();
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > maxBytes) {
        reject(new RangeError('The file is too large.'));
        return;
      }
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => {
      done();
      resolve(null);
    });
    document.body.append(input);
    input.click();
  });
}

export function webPlatform(): Platform {
  return {
    kind: 'web',
    async saveFile(name, text, type) {
      downloadText(name, text, type);
      return 'downloaded';
    },
    openTextFile: pickTextFile,
    async print() {
      window.print();
    },
    speech: undefined,
    onBack: () => () => undefined,
    exit: () => undefined,
  };
}

export function androidPlatform(bridge: AndroidBridge): Platform {
  return {
    kind: 'android',
    async saveFile(name, text, type) {
      const result = await bridge.request<{ status?: unknown } | null>('files.save', {
        name,
        type,
        text,
      });
      if (result?.status === 'saved' || result?.status === 'cancelled') return result.status;
      throw new AndroidBridgeError('unexpected-reply');
    },
    async openTextFile(maxBytes) {
      const result = await bridge.request<{ status?: unknown; text?: unknown } | null>(
        'files.open',
        { maxBytes },
      );
      if (result?.status === 'cancelled') return null;
      if (result?.status === 'opened' && typeof result.text === 'string') return result.text;
      throw new AndroidBridgeError('unexpected-reply');
    },
    async print(title) {
      await bridge.request('print', { title });
    },
    speech: androidSpeech(bridge),
    onBack: (listener) => bridge.on('back', listener),
    exit() {
      void bridge.request('exit').catch(() => undefined);
    },
  };
}

/** The Android app's platform when its shell is there, else the browser's. */
export function createPlatform(
  scope: object = globalThis,
  onError?: (error: unknown) => void,
): Platform {
  const bridge = connectAndroid(scope, onError);
  return bridge ? androidPlatform(bridge) : webPlatform();
}
