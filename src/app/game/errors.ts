/**
 * The rules' rejection codes (docs/contract.md §9). The shell shows a child-friendly line for
 * each (`error.<code>` in `en.ui.json`) and never the diagnostic text.
 */
export const RULE_ERROR_CODES = [
  'no-session',
  'invalid-day',
  'story-pending',
  'round-active',
  'unknown-level',
  'locked-level',
  'no-level',
  'locked-activity',
  'no-problem',
  'wrong-action',
  'already-hinted',
  'no-round',
  'round-finished',
  'not-timed',
  'unknown-item',
  'owned',
  'insufficient-coins',
  'unknown-dragon',
  'not-owned',
  'wrong-slot',
  'gift-not-ready',
  'story-choice',
  'invalid-setting',
  'not-implemented',
] as const;
