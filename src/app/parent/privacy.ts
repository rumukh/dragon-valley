/**
 * The privacy policy: every `parent.privacy.*` message in the UI catalog, in catalog order. Its
 * title, then headings (keys ending in `.heading`) each followed by their text. The grown-ups'
 * About tab shows it, so it is there on the device without a connection, and the build publishes
 * the same blocks as `privacy.html` (scripts/build.mjs), the address given to Google Play.
 */
import { EN_UI } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';

export const PRIVACY_PREFIX = 'parent.privacy.';
export const PRIVACY_TITLE: MessageKey = 'parent.privacy.heading';

export interface PolicyBlock {
  readonly kind: 'title' | 'heading' | 'text';
  readonly key: MessageKey;
}

export function privacyPolicy(): PolicyBlock[] {
  return (Object.keys(EN_UI) as MessageKey[])
    .filter((key) => key.startsWith(PRIVACY_PREFIX))
    .map((key) => ({
      key,
      kind: key === PRIVACY_TITLE ? 'title' : key.endsWith('.heading') ? 'heading' : 'text',
    }));
}
