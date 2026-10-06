/**
 * Minimal strict SVG/XML checks for art tests (no DOM in the Node test environment).
 * Well-formedness: balanced tags, quoted attributes, no duplicate attributes, escaped text.
 * Child safety: no scripts, event handlers, foreign content, external references or fonts.
 */
export interface SvgFacts {
  ids: string[];
  refs: string[];
  tags: Set<string>;
}

const NAME = /^[A-Za-z_][\w:.-]*$/;
const BARE_AMP = /&(?!(amp|lt|gt|quot|apos|#\d+);)/;

export function checkWellFormed(svg: string): SvgFacts {
  const ids: string[] = [];
  const refs: string[] = [];
  const tags = new Set<string>();
  const stack: string[] = [];
  let i = 0;
  let roots = 0;
  while (i < svg.length) {
    const lt = svg.indexOf('<', i);
    const text = lt === -1 ? svg.slice(i) : svg.slice(i, lt);
    if (/>/.test(text) || BARE_AMP.test(text)) {
      throw new Error(`Unescaped text near: ${text.slice(0, 40)}`);
    }
    if (stack.length === 0 && text.trim() !== '') throw new Error('Text outside the root element');
    if (lt === -1) break;
    const gt = svg.indexOf('>', lt);
    if (gt === -1) throw new Error('Unclosed tag');
    const raw = svg.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const open = stack.pop();
      if (open !== name) throw new Error(`Mismatched </${name}> for <${open}>`);
      continue;
    }
    if (raw.startsWith('!') || raw.startsWith('?')) {
      throw new Error(`Unexpected markup <${raw.slice(0, 20)}`);
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const m = /^(\S+)([\s\S]*)$/.exec(body);
    if (!m) throw new Error(`Bad tag <${raw.slice(0, 30)}`);
    const name = m[1]!;
    if (!NAME.test(name)) throw new Error(`Bad tag name ${name}`);
    tags.add(name);
    const attrText = m[2]!;
    const seen = new Set<string>();
    const attrRe = /\s+([^\s=]+)="([^"]*)"/g;
    let consumed = 0;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrText))) {
      if (am.index !== consumed) {
        throw new Error(
          `Malformed attributes on <${name}>: ${attrText.slice(consumed, consumed + 30)}`,
        );
      }
      consumed = attrRe.lastIndex;
      const an = am[1]!;
      const av = am[2]!;
      if (!NAME.test(an)) throw new Error(`Bad attribute name ${an}`);
      if (seen.has(an)) throw new Error(`Duplicate attribute ${an} on <${name}>`);
      seen.add(an);
      if (av.includes('<') || BARE_AMP.test(av)) throw new Error(`Unescaped attribute ${an}`);
      if (an === 'id') ids.push(av);
      if (an === 'href' || an === 'xlink:href') refs.push(av);
      for (const u of av.matchAll(/url\(([^)]*)\)/g)) refs.push(u[1]!);
    }
    if (attrText.slice(consumed).trim() !== '') {
      throw new Error(`Trailing junk in <${name}>: ${attrText.slice(consumed, consumed + 30)}`);
    }
    if (stack.length === 0) roots++;
    if (name === 'style' && !selfClosing) {
      // CSS text may contain '>' (child combinators); skip to the closing tag.
      const end = svg.indexOf('</style>', i);
      if (end === -1) throw new Error('Unclosed <style>');
      i = end + '</style>'.length;
      continue;
    }
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) throw new Error(`Unclosed <${stack.join('> <')}>`);
  if (roots !== 1) throw new Error(`Expected exactly one root element, got ${roots}`);
  return { ids, refs, tags };
}

const FORBIDDEN_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'image',
  'audio',
  'video',
  'a',
  'feImage',
  'object',
  'embed',
];

/** Throws unless the SVG is child safe and every internal reference resolves. */
export function checkChildSafe(svg: string): SvgFacts {
  const facts = checkWellFormed(svg);
  for (const t of FORBIDDEN_TAGS)
    if (facts.tags.has(t)) throw new Error(`Forbidden element <${t}>`);
  if (/\son[a-z]+\s*=/i.test(svg)) throw new Error('Event handler attribute');
  const withoutNamespace = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
  if (
    /javascript:|data:|https?:\/\/|\/\//i.test(withoutNamespace.replace(/\/\*[\s\S]*?\*\//g, ''))
  ) {
    throw new Error('External or scripted URL');
  }
  if (/@import|@font-face|font-family/i.test(svg)) throw new Error('Fonts or imports in SVG');
  const idSet = new Set(facts.ids);
  if (idSet.size !== facts.ids.length) throw new Error('Duplicate ids inside one SVG');
  for (const r of facts.refs) {
    if (!r.startsWith('#')) throw new Error(`Non-local reference ${r}`);
    if (!idSet.has(r.slice(1))) throw new Error(`Dangling reference ${r}`);
  }
  return facts;
}
