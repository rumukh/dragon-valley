/**
 * One child's game: a runtime host whose every commit is a strict durable checkpoint in the
 * child's own save record, restored only after validation, with explicit recovery.
 *
 * Generic over the rules' `RuntimeAdapter<S, A, V, C>`, so the same layer serves the preview
 * adapter today and the real Dragon Valley adapter later. Follows the Aegis reference shell
 * (poc/lab-shared/session.ts):
 *
 * - The stored envelope is validated by the SDK codec, then the snapshot is restored into a
 *   throwaway probe host with the exact content revision it pinned. Only then does the real
 *   host restore it, passing `durableRevision` because the record was read back from storage.
 * - Anything that fails becomes `RecoveryRequired`: the original bytes stay untouched.
 * - Old saves restore with their own content pack; `activateLatestContent()` moves them to the
 *   newest pack at a safe boundary (the hub, never mid-round) through the adapter's own
 *   `activateContent` migration.
 */
import { createSaveCheckpoint } from '@aegis/browser/checkpoint';
import { exportSave, importSave, SaveService } from '@aegis/browser/save';
import type { SavePolicy, SaveStorage } from '@aegis/browser/save';
import { createRuntimeHost, isRuntimeSnapshot, requireValue, RuntimeFault } from '@aegis/runtime';
import type { ContentPack, RuntimeAdapter, RuntimeHost, RuntimeSnapshot } from '@aegis/runtime';
import { deriveSaveIndicator } from './save-status';
import type { SaveIndicator } from './save-status';
import { recoveryFor } from './recovery';

export const ENGINE_ID = 'aegis-runtime';
export const ENGINE_SNAPSHOT_VERSION = 1;
export const ENGINE_REVISION = 'runtime-1';

export interface GameDefinition<S, A, V, C> {
  /** The save namespace, e.g. `dragon-valley`. */
  readonly gameId: string;
  readonly adapter: RuntimeAdapter<S, A, V, C>;
  /** The newest content pack; new games start on it. */
  readonly content: ContentPack<C>;
  /** Every older shipped pack, so a save restores with the exact revision it pinned. */
  readonly history?: readonly ContentPack<C>[];
}

export interface GameProfile {
  readonly id: string;
  readonly seed: string;
}

export interface GameSession<S, A, V, C> {
  readonly profileId: string;
  readonly host: RuntimeHost<S, A, V, C>;
  readonly saves: SaveService<RuntimeSnapshot, null>;
  readonly policy: SavePolicy<RuntimeSnapshot, null>;
  indicator(): SaveIndicator;
  subscribeIndicator(listener: (indicator: SaveIndicator) => void): () => void;
  /** The acknowledged stored envelope, or undefined when nothing was saved yet. */
  storedText(): Promise<string | undefined>;
  /** Validate and install a save envelope (from a backup), then store it durably. */
  importEnvelope(text: string): Promise<void>;
  /** At a safe boundary, move an older save to the newest content. True if it changed. */
  activateLatestContent(): Promise<boolean>;
  close(): Promise<void>;
}

function packs<S, A, V, C>(game: GameDefinition<S, A, V, C>): ContentPack<C>[] {
  return [game.content, ...(game.history ?? [])];
}

export function gamePolicy<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  profileId: string,
): SavePolicy<RuntimeSnapshot, null> {
  const known = new Set(packs(game).map((pack) => pack.revision));
  return {
    gameId: game.gameId,
    profileId,
    schemaVersion: game.adapter.stateVersion,
    engineId: ENGINE_ID,
    engineSnapshotVersion: ENGINE_SNAPSHOT_VERSION,
    acceptsContent: (revision) => known.has(revision),
    validateState: (value) => isRuntimeSnapshot(value),
    validateResume: (value): value is null => value === null,
    isCurrentState: isRuntimeSnapshot,
  };
}

function packFor<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  revision: string,
): ContentPack<C> | undefined {
  return packs(game).find((pack) => pack.revision === revision);
}

/** Restore a snapshot into a throwaway host: the full adapter, content and reference checks. */
export async function validateSnapshot<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  snapshot: RuntimeSnapshot,
): Promise<void> {
  const content = packFor(game, snapshot.content.revision);
  if (!content) throw new RangeError('The save pins a content revision this build lacks.');
  const probe = createRuntimeHost({ adapter: game.adapter, content, seed: 'probe' });
  try {
    requireValue(await probe.restore(snapshot));
  } finally {
    await probe.dispose();
  }
}

export async function openGameSession<S, A, V, C>(
  storage: SaveStorage,
  game: GameDefinition<S, A, V, C>,
  profile: GameProfile,
): Promise<GameSession<S, A, V, C>> {
  const policy = gamePolicy(game, profile.id);
  const saves = new SaveService<RuntimeSnapshot, null>(storage, policy);
  const validate = (snapshot: RuntimeSnapshot): Promise<void> => validateSnapshot(game, snapshot);
  let saved;
  try {
    saved = await saves.load();
    if (saved) await validate(saved.state);
  } catch (cause) {
    throw await recoveryFor('game', storage, policy, cause, validate);
  }
  const checkpoint = createSaveCheckpoint<null>(saves, ({ snapshot }) => ({
    format: 'aegis.save',
    formatVersion: 1,
    gameId: game.gameId,
    profileId: profile.id,
    contentRevision: snapshot.content.revision,
    schemaVersion: snapshot.stateVersion,
    engine: { id: ENGINE_ID, snapshotVersion: ENGINE_SNAPSHOT_VERSION, revision: ENGINE_REVISION },
    resume: null,
  }));
  const start = saved ? packFor(game, saved.state.content.revision) : game.content;
  if (!start) throw new RangeError('The validated save lost its content pack.');
  const host = createRuntimeHost({
    adapter: game.adapter,
    content: start,
    seed: profile.seed,
    checkpoint,
  });
  for (const pack of packs(game)) {
    if (pack.revision !== start.revision) requireValue(host.stageContent(pack));
  }
  if (saved) {
    const restored = await host.restore(saved.state, { durableRevision: saved.state.revision });
    if (!restored.ok) {
      await host.dispose();
      throw await recoveryFor('game', storage, policy, new RuntimeFault(restored.error), validate);
    }
  }

  let closed = false;
  const listeners = new Set<(indicator: SaveIndicator) => void>();
  let last = '';
  const indicator = (): SaveIndicator => deriveSaveIndicator(host.getStatus(), saves.status());
  const publish = (): void => {
    const current = indicator();
    const key = JSON.stringify(current);
    if (key === last) return;
    last = key;
    for (const listener of listeners) listener(current);
  };
  const unsubscribeHost = host.subscribeStatus(publish);
  const unsubscribeSaves = saves.subscribe(publish);

  return {
    profileId: profile.id,
    host,
    saves,
    policy,
    indicator,
    subscribeIndicator(listener) {
      listeners.add(listener);
      listener(indicator());
      return () => listeners.delete(listener);
    },
    async storedText() {
      const status = host.getStatus();
      if (status.durableRevision === null) return undefined;
      requireValue(await host.flush());
      const record = await storage.read(policy);
      return record.current
        ? exportSave(importSave(record.current.payload, policy), policy)
        : undefined;
    },
    async importEnvelope(text) {
      const candidate = importSave(text, policy);
      await validate(candidate.state);
      requireValue(await host.restore(candidate.state));
      requireValue(await host.retryCheckpoint());
    },
    async activateLatestContent() {
      if (host.inspect().content.revision === game.content.revision) return false;
      const status = host.getStatus();
      if (status.pendingAction !== null || status.checkpoint !== 'idle') return false;
      const staged = requireValue(host.stageContent(game.content));
      const result = await host.activateContent(staged, 'boundary');
      if (result.ok) return true;
      if (result.error.code === 'unsafe-boundary' || result.error.code === 'pending-jobs') {
        return false;
      }
      throw new RuntimeFault(result.error);
    },
    async close() {
      if (closed) return;
      closed = true;
      unsubscribeHost();
      unsubscribeSaves();
      listeners.clear();
      await host.dispose();
    },
  };
}
