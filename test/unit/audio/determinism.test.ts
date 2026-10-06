/**
 * Primitive-level determinism for the audio synthesizer. The audio pack must regenerate byte for
 * byte on Windows and Linux, so the math under it is built from IEEE-754 basic arithmetic only.
 * Every expected value below is a pinned literal computed once; CI runs this file on ubuntu and
 * windows, so any platform-dependent arithmetic would turn it red.
 */
import { describe, expect, it } from 'vitest';
import {
  besselI0,
  cos,
  dbToGain,
  exp,
  log,
  mtof,
  pow,
  sin,
  sinTurns,
  sqrt,
  tanh,
} from '../../../scripts/audio/lib/dmath.mjs';
import { hashSeed, Noise, Rng } from '../../../scripts/audio/lib/rng.mjs';

describe('deterministic math', () => {
  it('reproduces pinned bit patterns', () => {
    expect(sinTurns(0.1234)).toBe(0.699962556739481);
    expect(sin(1)).toBe(0.8414709848078965);
    expect(cos(2.5)).toBe(-0.8011436155469338);
    expect(exp(1.5)).toBe(4.4816890703380645);
    expect(exp(-7.25)).toBe(0.0007101743888425491);
    expect(log(10)).toBe(2.302585092994046);
    expect(log(0.001234)).toBe(-6.697494353498941);
    expect(sqrt(2)).toBe(1.414213562373095);
    expect(pow(3.7, 0.41)).toBe(1.7098684813347365);
    expect(mtof(61.5)).toBe(285.30470202322215);
    expect(tanh(0.731)).toBe(0.6236767579913203);
    expect(dbToGain(-6.5)).toBe(0.47315125896148047);
    expect(besselI0(8.96)).toBe(1053.1251224911705);
  });

  it('is accurate to well below 16-bit resolution', () => {
    // Reference values are the correctly rounded constants.
    expect(Math.abs(sin(1) - 0.8414709848078965)).toBeLessThan(1e-15);
    expect(Math.abs(exp(1) - 2.718281828459045)).toBeLessThan(1e-15);
    expect(Math.abs(log(2) - 0.6931471805599453)).toBeLessThan(1e-15);
    expect(Math.abs(sqrt(10) - 3.1622776601683795)).toBeLessThan(1e-15);
    expect(mtof(69)).toBe(440);
    expect(Math.abs(mtof(81) - 880)).toBeLessThan(1e-12);
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const s = sinTurns(x);
      const c = sinTurns(x + 0.25);
      expect(Math.abs(s * s + c * c - 1)).toBeLessThan(1e-14);
      expect(Math.abs(exp(log(1 + x)) - (1 + x))).toBeLessThan(1e-14);
    }
  });
});

describe('seeded randomness', () => {
  it('reproduces pinned streams', () => {
    const rng = new Rng(12345);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985,
    ]);
    expect(hashSeed('chime-1', 3)).toBe(1671792975);
    const pink = new Noise(7, 'pink');
    expect([pink.tick(), pink.tick()]).toEqual([-0.17694883781405177, -0.2629472901522833]);
  });

  it('separates streams by seed', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
    expect(hashSeed('chime-1', 3)).not.toBe(hashSeed('chime-1', 4));
  });
});
