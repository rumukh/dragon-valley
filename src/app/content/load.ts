/**
 * The game's content pack, fetched from the same origin and validated against the contract's
 * registration (schema, references, cross-checks) before any rule sees it. A pack that fails
 * validation never reaches a runtime host: boot shows the error screen instead.
 */
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { contentRegistration } from '../../rules/contract';
import type { ContentData } from '../../rules/contract';

export const CONTENT_FILE = 'dragon-valley.content.json';
export const CONTENT_PATH = `content/${CONTENT_FILE}`;

export interface FetchedText {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type Fetcher = (url: string) => Promise<FetchedText>;

const browserFetch: Fetcher = (url) => fetch(url, { credentials: 'same-origin' });

/** A same-origin static file below the deployment base, as text. */
export async function fetchSiteText(
  baseUrl: string,
  path: string,
  fetcher: Fetcher = browserFetch,
): Promise<string> {
  const response = await fetcher(new URL(path, baseUrl).href);
  if (!response.ok) throw new Error(`${path} is unavailable (${response.status}).`);
  return response.text();
}

export async function loadContent(
  baseUrl: string,
  fetcher: Fetcher = browserFetch,
): Promise<ContentPack<ContentData>> {
  const text = await fetchSiteText(baseUrl, CONTENT_PATH, fetcher);
  return requireValue(parseContentJson(text, contentRegistration, CONTENT_FILE));
}
