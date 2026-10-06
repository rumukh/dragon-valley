/** Deterministic color math on `#rrggbb` strings. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

export function parseHex(hex: string): Rgb {
  if (!isHex(hex)) throw new Error(`Invalid color: ${hex}`);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function hex2(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return (v < 16 ? '0' : '') + v.toString(16);
}

export function toHex(c: Rgb): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

/** Linear mix in sRGB space: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** Storybook light: warm cream rather than pure white keeps highlights friendly. */
export const LIGHT = '#fff8e6';
/** Storybook dark: shadows lean toward deep plum instead of grey. */
export const DARK = '#2a1b45';

export function lighten(c: string, t: number): string {
  return mix(c, LIGHT, t);
}

export function darken(c: string, t: number): string {
  return mix(c, DARK, t);
}

/** Outline color derived from a fill: a deep, hue-tinted line instead of black. */
export function outlineOf(c: string, t = 0.62): string {
  return mix(c, DARK, t);
}

/** WCAG relative luminance (only used by palette checks, not by renderers). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
