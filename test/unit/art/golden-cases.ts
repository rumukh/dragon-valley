import { renderDragon, renderHatch } from '../../../src/app/art';

/**
 * Renders whose SHA-256 digests are pinned as literals in dragon.test.ts. They prove byte-identical
 * output across platforms (CI runs Ubuntu and Windows). After an intentional art change, review the
 * gallery, then run `npm run art:goldens` to re-pin.
 */
export const GOLDEN_CASES: Record<string, () => string> = {
  'bubbles hatchling idle': () =>
    renderDragon({ dragon: 'bubbles', stage: 'hatchling', idPrefix: 'g' }),
  'sunny adult happy fit': () =>
    renderDragon({
      dragon: 'sunny',
      stage: 'adult',
      expression: 'happy',
      framing: 'fit',
      idPrefix: 'g',
    }),
  'goldie crowned proud outfit': () =>
    renderDragon({
      dragon: 'goldie',
      stage: 'crowned',
      expression: 'proud',
      idPrefix: 'g',
      outfit: { neck: 'bow-tie', nest: 'nest-pillow' },
    }),
  'starry egg cold': () =>
    renderDragon({ dragon: 'starry', stage: 'egg', warmth: 0.1, idPrefix: 'g' }),
  'clover hatch': () => renderHatch({ dragon: 'clover', idPrefix: 'g' }),
  'dot youngling happy': () =>
    renderDragon({ dragon: 'dot', stage: 'youngling', expression: 'happy', idPrefix: 'g' }),
  'hop adult proud': () =>
    renderDragon({ dragon: 'hop', stage: 'adult', expression: 'proud', idPrefix: 'g' }),
  'nibble egg': () => renderDragon({ dragon: 'nibble', stage: 'egg', idPrefix: 'g' }),
  'nibble hatchling eating': () =>
    renderDragon({ dragon: 'nibble', stage: 'hatchling', expression: 'eating', idPrefix: 'g' }),
};
