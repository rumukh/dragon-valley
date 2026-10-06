/**
 * The content pack loads below the deployment base and is validated against the contract's
 * registration before anything uses it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_PATH, loadContent } from '../../../src/app/content/load';
import type { Fetcher } from '../../../src/app/content/load';

const shipped = readFileSync(CONTENT_PATH, 'utf8');

const serve =
  (status: number, body: string): Fetcher =>
  async () => ({ ok: status < 400, status, text: async () => body });

describe('content loading', () => {
  it('fetches the shipped pack from below the base and validates it', async () => {
    const requested: string[] = [];
    const pack = await loadContent('https://example.test/dragon-valley/', async (url) => {
      requested.push(url);
      return serve(200, shipped)(url);
    });
    expect(requested).toEqual([`https://example.test/dragon-valley/${CONTENT_PATH}`]);
    expect(pack.id).toBe('dragon-valley');
    expect(pack.revision).toBe((JSON.parse(shipped) as { revision: string }).revision);
  });

  it('refuses a missing, malformed or invalid pack', async () => {
    const base = 'https://example.test/';
    await expect(loadContent(base, serve(404, ''))).rejects.toThrow('404');
    await expect(loadContent(base, serve(200, '{ nope'))).rejects.toThrow();
    const tampered = JSON.parse(shipped) as { data: { levels: unknown[] } };
    tampered.data.levels = [{ id: 'not a level' }];
    await expect(loadContent(base, serve(200, JSON.stringify(tampered)))).rejects.toThrow();
  });
});
