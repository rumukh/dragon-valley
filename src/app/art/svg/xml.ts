import { f } from './num';

/** Attribute values: numbers are formatted deterministically; nullish/false are omitted. */
export type AttrValue = string | number | undefined | null | false;
export type Attrs = Record<string, AttrValue>;
export type Child = string | false | null | undefined;

export function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s: string): string {
  return escText(s).replace(/"/g, '&quot;');
}

function attrString(attrs: Attrs | null | undefined): string {
  if (!attrs) return '';
  let out = '';
  for (const key of Object.keys(attrs)) {
    const v = attrs[key];
    if (v === undefined || v === null || v === false) continue;
    out += ` ${key}="${typeof v === 'number' ? f(v) : escAttr(v)}"`;
  }
  return out;
}

/** Hyperscript-style SVG element builder returning markup. Children are trusted markup. */
export function h(tag: string, attrs?: Attrs | null, ...children: Child[]): string {
  const inner = children.filter((c): c is string => typeof c === 'string' && c !== '').join('');
  const a = attrString(attrs);
  return inner === '' ? `<${tag}${a}/>` : `<${tag}${a}>${inner}</${tag}>`;
}

/** Group helper that skips empty groups entirely. */
export function g(attrs: Attrs | null, ...children: Child[]): string {
  const inner = children.filter((c): c is string => typeof c === 'string' && c !== '').join('');
  if (inner === '') return '';
  return `<g${attrString(attrs)}>${inner}</g>`;
}

export function join(...parts: Child[]): string {
  return parts.filter((c): c is string => typeof c === 'string').join('');
}

/** Valid id prefix: starts with a letter, then letters, digits, `-` or `_`. */
export function checkPrefix(prefix: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(prefix)) {
    throw new Error(`Invalid SVG id prefix: ${prefix}`);
  }
  return prefix;
}

/** Scoped id factory so many SVGs can share one HTML page without id collisions. */
export interface Ids {
  id(name: string): string;
  url(name: string): string;
  href(name: string): string;
}

export function ids(prefix: string): Ids {
  checkPrefix(prefix);
  return {
    id: (name) => `${prefix}-${name}`,
    url: (name) => `url(#${prefix}-${name})`,
    href: (name) => `#${prefix}-${name}`,
  };
}

export interface SvgDocOptions {
  viewBox: [number, number, number, number];
  width?: number | string;
  height?: number | string;
  className?: string;
  title?: string;
  idPrefix?: string;
  data?: Record<string, string>;
  style?: string;
}

/** Root `<svg>` element. Decorative by default (aria-hidden) unless a title is given. */
export function svgDoc(opts: SvgDocOptions, ...children: Child[]): string {
  const [x, y, w, hgt] = opts.viewBox;
  const attrs: Attrs = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `${f(x)} ${f(y)} ${f(w)} ${f(hgt)}`,
    width: opts.width,
    height: opts.height,
    class: opts.className,
  };
  if (opts.data) {
    for (const key of Object.keys(opts.data)) attrs[`data-${key}`] = opts.data[key];
  }
  if (opts.title) {
    const titleId = `${opts.idPrefix ?? 'svg'}-title`;
    attrs.role = 'img';
    attrs['aria-labelledby'] = titleId;
    return h(
      'svg',
      attrs,
      h('title', { id: titleId }, escText(opts.title)),
      opts.style ? `<style>${opts.style}</style>` : '',
      ...children,
    );
  }
  attrs['aria-hidden'] = 'true';
  attrs.focusable = 'false';
  return h('svg', attrs, opts.style ? `<style>${opts.style}</style>` : '', ...children);
}
