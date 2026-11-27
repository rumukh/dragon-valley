/**
 * The bridge to the Android app's native shell (android/, docs/android.md).
 *
 * The shell injects `dvAndroid` before any page script runs: a WebMessageListener object that
 * only the app's own origin can see. Every message is JSON text. A request `{ id, method, args }`
 * is answered with `{ id, result }` or `{ id, error }` (a short code); the device also sends events
 * `{ event, data }`: the Back button, the speech voices, the end of a spoken line. In a browser
 * there is no such object, `connectAndroid` returns null and every caller takes its web path.
 */

/** The object the shell injects (androidx.webkit `WebViewCompat.addWebMessageListener`). */
interface NativePort {
  postMessage(message: string): void;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
}

export const ANDROID_BRIDGE = 'dvAndroid';

export interface AndroidBridge {
  /** Ask the shell to do something; rejects with an `AndroidBridgeError` carrying its code. */
  request<T = unknown>(method: string, args?: Readonly<Record<string, unknown>>): Promise<T>;
  /** Listen to a device event; returns the function that stops listening. */
  on(event: string, listener: (data: unknown) => void): () => void;
}

export class AndroidBridgeError extends Error {
  constructor(readonly code: string) {
    super(`The Android app refused the request: ${code}`);
    this.name = 'AndroidBridgeError';
  }
}

function isPort(value: unknown): value is NativePort {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { postMessage?: unknown }).postMessage === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The shell's bridge, or null in a browser. `onError` hears a failing event listener, which
 * never stops the other listeners or the bridge.
 */
export function connectAndroid(
  scope: object = globalThis,
  onError: (error: unknown) => void = () => undefined,
): AndroidBridge | null {
  const port = (scope as Record<string, unknown>)[ANDROID_BRIDGE];
  if (!isPort(port)) return null;
  let serial = 0;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const listeners = new Map<string, Set<(data: unknown) => void>>();

  port.onmessage = (event) => {
    let message: unknown;
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : undefined;
    } catch {
      return;
    }
    if (!isRecord(message)) return;
    if (typeof message['id'] === 'number') {
      const waiting = pending.get(message['id']);
      if (!waiting) return;
      pending.delete(message['id']);
      const error = message['error'];
      if (typeof error === 'string') waiting.reject(new AndroidBridgeError(error));
      else waiting.resolve(message['result']);
      return;
    }
    const name = message['event'];
    if (typeof name !== 'string') return;
    for (const listener of [...(listeners.get(name) ?? [])]) {
      try {
        listener(message['data']);
      } catch (error) {
        onError(error);
      }
    }
  };

  const bridge: AndroidBridge = {
    request<T>(method: string, args: Readonly<Record<string, unknown>> = {}): Promise<T> {
      const id = ++serial;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
        try {
          port.postMessage(JSON.stringify({ id, method, args }));
        } catch {
          pending.delete(id);
          reject(new AndroidBridgeError('unavailable'));
        }
      });
    },
    on(name, listener) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
  // The first message gives the shell its way to send events back to this page.
  void bridge.request('hello').catch(() => undefined);
  return bridge;
}
