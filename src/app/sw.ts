/**
 * Offline worker entry, bundled to `sw.js` by scripts/build.mjs from the PUBLIC
 * `@aegis/browser/offline/worker` export (never from an engine `dist` path).
 *
 * The build pins the exact offline pack revision it just published. The worker serves only that
 * verified resource graph, denies outbound requests, never calls skipWaiting and never forces a
 * reload: a new revision activates only under the shell's update policy at a safe boundary.
 */
import { OfflinePackStore } from '@aegis/browser/offline';
import { attachOfflineWorker } from '@aegis/browser/offline/worker';

declare const __DV_OFFLINE_PACK_ID__: string;
declare const __DV_OFFLINE_NAMESPACE__: string;
declare const __DV_OFFLINE_REVISION__: string;

const worker = self as unknown as ServiceWorkerGlobalScope;

const store = new OfflinePackStore({
  namespace: __DV_OFFLINE_NAMESPACE__,
  baseUrl: worker.registration.scope,
});

attachOfflineWorker(worker, store, {
  packs: [{ id: __DV_OFFLINE_PACK_ID__, revision: __DV_OFFLINE_REVISION__ }],
  shell: 'index.html',
  onError() {
    // Report only the fact of a failure to open pages; no request data or state leaves the worker.
    void worker.clients
      .matchAll()
      .then((clients) => {
        for (const client of clients) client.postMessage({ type: 'dv-offline-error' });
      })
      .catch(() => undefined);
  },
});
