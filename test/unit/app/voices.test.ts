/**
 * Read-aloud uses only voices that run on the device and speak English. A network voice is
 * never chosen, not even when it is the browser's default.
 */
import { describe, expect, it, vi } from 'vitest';
import { createReadAloud } from '../../../src/app/speech/read-aloud';
import type { SpeechPlatform } from '../../../src/app/speech/read-aloud';
import { chooseVoice, isLocalEnglish, localEnglishVoices } from '../../../src/app/speech/voices';
import type { VoiceLike } from '../../../src/app/speech/voices';

const voice = (
  voiceURI: string,
  lang: string,
  localService: boolean,
  isDefault = false,
): VoiceLike => ({ voiceURI, name: voiceURI, lang, localService, default: isDefault });

const VOICES = [
  voice('Google US English', 'en-US', false, true),
  voice('Zira', 'en-US', true),
  voice('Hazel', 'en-GB', true),
  voice('Jakub', 'cs-CZ', true),
  voice('Catherine', 'en_AU', true),
  voice('Hazel', 'en-GB', true),
  voice('Natural Aria', 'en-US', false),
];

describe('voice selection', () => {
  it('keeps only local English voices, once each', () => {
    expect(isLocalEnglish({ localService: true, lang: 'en' })).toBe(true);
    expect(isLocalEnglish({ localService: true, lang: 'eng' })).toBe(false);
    expect(localEnglishVoices(VOICES).map((v) => v.uri)).toEqual(['Hazel', 'Zira', 'Catherine']);
  });

  it('puts a local default first, then British, then American English', () => {
    const withDefault = [...VOICES, voice('Mark', 'en-US', true, true)];
    expect(localEnglishVoices(withDefault).map((v) => v.uri)).toEqual([
      'Mark',
      'Hazel',
      'Zira',
      'Catherine',
    ]);
  });

  it('keeps the chosen voice while it exists and falls back to the best local one', () => {
    const voices = localEnglishVoices(VOICES);
    expect(chooseVoice(voices, 'Zira')?.uri).toBe('Zira');
    expect(chooseVoice(voices, 'Natural Aria')?.uri).toBe('Hazel');
    expect(chooseVoice(voices, null)?.uri).toBe('Hazel');
    expect(chooseVoice([], null)).toBeUndefined();
  });
});

class FakeUtterance {
  voice: unknown = null;
  lang = '';
  volume = 1;
  rate = 1;
  private readonly listeners = new Map<string, () => void>();
  constructor(readonly text: string) {}
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  fire(type: string): void {
    this.listeners.get(type)?.();
  }
}

function platform(voices: VoiceLike[]) {
  const spoken: FakeUtterance[] = [];
  let changed: (() => void) | undefined;
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
    cancel: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => {
      changed = listener;
    },
    removeEventListener: vi.fn(),
  };
  const environment = {
    synth: synth as unknown as SpeechSynthesis,
    Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  } satisfies SpeechPlatform;
  return { environment, synth, spoken, voicesChanged: () => changed?.() };
}

describe('read-aloud', () => {
  it('names a local voice on every utterance and never falls back to a network voice', () => {
    const fake = platform(VOICES);
    const reader = createReadAloud(fake.environment);
    expect(reader.available()).toBe(true);
    expect(reader.speak('Seven times eight equals what?', { voice: 'Google US English' })).toBe(
      true,
    );
    const utterance = fake.spoken[0]!;
    expect((utterance.voice as VoiceLike).voiceURI).toBe('Hazel');
    expect(utterance.lang).toBe('en-GB');
    expect(fake.synth.cancel).toHaveBeenCalled();
  });

  it('is unavailable, and silent, without a local English voice', () => {
    const fake = platform([
      voice('Google US English', 'en-US', false, true),
      voice('Jakub', 'cs-CZ', true),
    ]);
    const reader = createReadAloud(fake.environment);
    expect(reader.available()).toBe(false);
    expect(reader.speak('Hello', { voice: null })).toBe(false);
    expect(fake.synth.speak).not.toHaveBeenCalled();
  });

  it('notices voices that arrive later and reports when speech ends', () => {
    const list: VoiceLike[] = [];
    const fake = platform(list);
    const reader = createReadAloud(fake.environment);
    const listener = vi.fn();
    reader.subscribe(listener);
    expect(reader.available()).toBe(false);
    list.push(voice('Zira', 'en-US', true));
    fake.voicesChanged();
    expect(listener).toHaveBeenCalled();
    expect(reader.available()).toBe(true);
    const onEnd = vi.fn();
    reader.speak('Hi', { voice: null, onEnd });
    expect(reader.speaking()).toBe(true);
    fake.spoken[0]!.fire('end');
    expect(onEnd).toHaveBeenCalledOnce();
    expect(reader.speaking()).toBe(false);
  });

  it('is unavailable where the platform has no speech at all', () => {
    const reader = createReadAloud({ synth: undefined, Utterance: undefined });
    expect(reader.available()).toBe(false);
    expect(reader.speak('Hello', { voice: null })).toBe(false);
  });
});
