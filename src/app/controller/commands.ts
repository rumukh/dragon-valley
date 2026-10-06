/**
 * Command controller: the only way screens dispatch game actions.
 *
 * - **Stale-view guard.** `capture()` binds a dispatcher to the committed revision and to a
 *   view generation when a screen renders. Any newer view (a commit or a restore, even one with
 *   the same numeric revision) makes older dispatchers refuse with `StaleCommandError`, and the
 *   runtime refuses a mismatched `expectedRevision` before any rule runs.
 * - **Strict durability.** After a failed checkpoint, `retry()` asks the runtime to retry the
 *   exact failed write, then continues an accepted multi-turn action with `continuePending()`.
 *   The original action is never dispatched again.
 * - **Pause.** `resume(reason)` removes one pause reason and continues accepted work.
 *
 * Ported from the Aegis reference shell (poc/lab-shared/commands.ts).
 */
import type { DispatchReceipt, RuntimeError, RuntimeHost } from '@aegis/runtime';

export class StaleCommandError extends Error {
  constructor() {
    super('This control belongs to a view that has been replaced.');
    this.name = 'StaleCommandError';
  }
}

export class CommandRejectedError extends Error {
  constructor(
    readonly error: RuntimeError,
    readonly accepted: boolean,
  ) {
    super(`The runtime refused the command: ${error.code}`);
    this.name = 'CommandRejectedError';
  }
}

export type Dispatch<A> = (action: A) => Promise<DispatchReceipt>;

export interface CommandController<A> {
  capture(): Dispatch<A>;
  retry(): Promise<void>;
  resume(reason: string): Promise<void>;
  continueAccepted(): Promise<void>;
  dispose(): void;
}

export function createCommandController<S, A, V, C>(
  host: RuntimeHost<S, A, V, C>,
  onError: (error: unknown) => void,
): CommandController<A> {
  let generation = 0;
  let disposed = false;
  let failed = false;
  let continuation: Promise<void> | undefined;

  const ready = (): boolean => {
    const status = host.getStatus();
    return (
      !disposed &&
      !failed &&
      !status.disposed &&
      !status.busy &&
      status.pendingAction !== null &&
      status.pauseReasons.length === 0 &&
      status.checkpoint !== 'failed' &&
      status.checkpoint !== 'pending'
    );
  };

  const continueAccepted = (): Promise<void> => {
    if (continuation) return continuation;
    if (!ready()) return Promise.resolve();
    continuation = Promise.resolve()
      .then(async () => {
        if (!ready()) return;
        const result = await host.continuePending();
        if (!result.ok) {
          failed = true;
          throw new CommandRejectedError(result.error, result.progress.accepted);
        }
      })
      .finally(() => {
        continuation = undefined;
      });
    return continuation;
  };

  const unsubscribeView = host.subscribe((_view, reason) => {
    generation++;
    if (reason === 'restore') failed = false;
  });
  const unsubscribeStatus = host.subscribeStatus(() => {
    void continueAccepted().catch(onError);
  });
  void continueAccepted().catch(onError);

  return {
    capture() {
      const revision = host.getStatus().revision;
      const epoch = generation;
      return async (action) => {
        if (disposed || epoch !== generation) throw new StaleCommandError();
        const result = await host.dispatch(action, { expectedRevision: revision });
        if (!result.ok) {
          if (result.error.code === 'stale-action') throw new StaleCommandError();
          throw new CommandRejectedError(result.error, result.progress.accepted);
        }
        return result.value;
      };
    },
    async retry() {
      failed = false;
      const result = await host.retryCheckpoint();
      if (!result.ok) throw new CommandRejectedError(result.error, true);
      await continueAccepted();
    },
    async resume(reason) {
      failed = false;
      host.resume(reason);
      await continueAccepted();
    },
    continueAccepted,
    dispose() {
      disposed = true;
      generation++;
      unsubscribeStatus();
      unsubscribeView();
    },
  };
}
