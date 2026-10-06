/**
 * Visual models shown after a miss, before the child tries again: an array of dots in rows and
 * columns (multiplication as equal groups), or equal groups with the leftovers set apart
 * (division with remainder). Leftovers differ in shape (ring, not dot), not only in color.
 */
import { h } from './dom';

export function arrayModel(rows: number, columns: number, label: string): HTMLElement {
  const grid = h('div', {
    className: 'dv-model__array',
    attributes: { 'aria-hidden': 'true' },
  });
  grid.style.setProperty('--columns', String(Math.max(1, columns)));
  for (let index = 0; index < rows * columns; index++) {
    grid.append(h('span', { className: 'dv-model__dot' }));
  }
  return h(
    'figure',
    { className: 'dv-model', testId: 'model', dataset: { kind: 'array' } },
    grid,
    h('figcaption', { text: label }),
  );
}

export function groupsModel(total: number, size: number, label: string): HTMLElement {
  const groups = h('div', { className: 'dv-model__groups', attributes: { 'aria-hidden': 'true' } });
  const full = Math.floor(total / Math.max(1, size));
  for (let group = 0; group < full; group++) {
    const box = h('span', { className: 'dv-model__group' });
    for (let index = 0; index < size; index++)
      box.append(h('span', { className: 'dv-model__dot' }));
    groups.append(box);
  }
  const leftover = total - full * size;
  if (leftover > 0) {
    const rest = h('span', { className: 'dv-model__group dv-model__group--left' });
    for (let index = 0; index < leftover; index++) {
      rest.append(h('span', { className: 'dv-model__dot dv-model__dot--left' }));
    }
    groups.append(rest);
  }
  return h(
    'figure',
    { className: 'dv-model', testId: 'model', dataset: { kind: 'groups' } },
    groups,
    h('figcaption', { text: label }),
  );
}
