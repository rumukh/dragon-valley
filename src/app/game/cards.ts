/**
 * Memory Match card faces. The rules give each card a label key; the proposed contract encoding
 * is notation-agnostic so the shell can write it in the child's notation and read it aloud:
 * `fact:<item>` (an expression from a fact item, `fact:mul:7x8` → 7 · 8), `num:<n>` (a number),
 * `term:<term>` (a term's name). Anything else is a content string key; a face-down card shows
 * its back.
 */
import { num, op, parseItemId, TERMS } from '../../rules/contract';
import type { Expr, Term } from '../../rules/contract';

export type CardFace =
  | { readonly kind: 'back' }
  | { readonly kind: 'fact'; readonly expr: Expr }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'term'; readonly term: Term }
  | { readonly kind: 'text'; readonly key: string };

export function cardFace(labelKey: string, faceUp: boolean): CardFace {
  if (!faceUp) return { kind: 'back' };
  const [prefix, ...rest] = labelKey.split(':');
  const body = rest.join(':');
  if (prefix === 'fact') {
    const item = parseItemId(body);
    if (item?.kind === 'mul') return { kind: 'fact', expr: op('mul', num(item.a), num(item.b)) };
    if (item?.kind === 'div') {
      return { kind: 'fact', expr: op('div', num(item.dividend), num(item.divisor)) };
    }
  }
  if (prefix === 'num' && /^\d{1,6}$/.test(body)) return { kind: 'number', value: Number(body) };
  if (prefix === 'term' && (TERMS as readonly string[]).includes(body)) {
    return { kind: 'term', term: body as Term };
  }
  return { kind: 'text', key: labelKey };
}
