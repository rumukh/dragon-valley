/**
 * The build id in the grown-ups' About tab (src/app/parent/about.ts): a short id that always
 * fits a phone's line, whatever the build's revision is.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../src/app/i18n/messages';
import { SHORT_REVISION_LENGTH, shortRevision } from '../../../src/app/parent/about';

describe('the About build id', () => {
  const revision = '1d9340225b68a7510757b959';

  it('shows the first 8 characters of the offline revision', () => {
    expect(SHORT_REVISION_LENGTH).toBe(8);
    expect(shortRevision(revision)).toBe('1d934022');
    expect(revision.startsWith(shortRevision(revision))).toBe(true);
    for (const other of ['ffffffffffffffffffffffff', '0123456789abcdef01234567']) {
      expect(shortRevision(other).length).toBeLessThanOrEqual(SHORT_REVISION_LENGTH);
    }
    expect(shortRevision('abc')).toBe('abc');
  });

  it('reads "Version 1d934022" in the About tab', () => {
    const t = createTranslator();
    expect(t('parent.about.version', { revision: shortRevision(revision) })).toBe(
      'Version 1d934022',
    );
  });
});
