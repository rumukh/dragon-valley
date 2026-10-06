/**
 * Browser storage persistence. Browsers may evict site storage under pressure; asking for
 * persistent storage lowers that risk. The request is only made from the grown-ups' area,
 * because some browsers answer it with a permission prompt meant for an adult.
 */
export interface StorageReport {
  /** True when the browser promised to keep the data; null when it cannot say. */
  readonly persisted: boolean | null;
  readonly usageBytes: number | null;
}

export async function storageReport(): Promise<StorageReport> {
  const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  try {
    if (manager?.persisted) persisted = await manager.persisted();
  } catch {
    persisted = null;
  }
  try {
    if (manager?.estimate) usageBytes = (await manager.estimate()).usage ?? null;
  } catch {
    usageBytes = null;
  }
  return { persisted, usageBytes };
}

/** Ask the browser to keep this site's storage; resolves to the browser's answer. */
export async function requestPersistence(): Promise<boolean | null> {
  const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!manager?.persist) return null;
  try {
    return await manager.persist();
  } catch {
    return null;
  }
}

/** A short human size: "12 KB", "3.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
