/**
 * Read-aloud through the Web Speech API, restricted to local English voices.
 *
 * Every utterance names its voice explicitly: leaving it unset would let the browser pick its
 * default, which can be a network voice. With no local English voice, `available()` is false,
 * the speaker button is hidden and the grown-ups' area explains why. Speech is cancelled on
 * every screen change, on pause and when the page is hidden. Words the voices say wrongly are
 * replaced by their aliases just before speaking (`aliases.ts`); the screen keeps them.
 *
 * The engine is anything shaped like the Web Speech API (`SpeechPlatform`): the browser's own,
 * or in the Android app the device's text-to-speech through the shell (platform/android-speech.ts),
 * because Android's WebView has no Web Speech voices.
 */
import { applyAliases } from './aliases';
import type { SpeechAlias } from './aliases';
import { chooseVoice, localEnglishVoices } from './voices';
import type { VoiceInfo, VoiceLike } from './voices';

export interface SpeakOptions {
  readonly voice: string | null;
  /** 0-1, from the narration volume preference. */
  readonly volume?: number;
  readonly rate?: number;
  onEnd?(): void;
}

export interface ReadAloud {
  available(): boolean;
  voices(): readonly VoiceInfo[];
  /** Called when the device's voice list changes (often only after the first page load). */
  subscribe(listener: () => void): () => void;
  speak(text: string, options: SpeakOptions): boolean;
  cancel(): void;
  speaking(): boolean;
  dispose(): void;
}

/** The part of a `SpeechSynthesisUtterance` read-aloud uses. */
export interface UtteranceLike extends EventTarget {
  text: string;
  voice: VoiceLike | null;
  lang: string;
  volume: number;
  rate: number;
}

/** The part of `speechSynthesis` read-aloud uses. */
export interface SynthLike {
  getVoices(): readonly VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  addEventListener?(type: 'voiceschanged', listener: () => void): void;
  removeEventListener?(type: 'voiceschanged', listener: () => void): void;
}

export interface SpeechPlatform {
  readonly synth: SynthLike | undefined;
  readonly Utterance: (new (text?: string) => UtteranceLike) | undefined;
}

function platform(): SpeechPlatform {
  return {
    synth: typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis,
    Utterance:
      typeof SpeechSynthesisUtterance === 'undefined' ? undefined : SpeechSynthesisUtterance,
  };
}

export function createReadAloud(
  environment: SpeechPlatform = platform(),
  aliases: readonly SpeechAlias[] = [],
): ReadAloud {
  const { synth, Utterance } = environment;
  const listeners = new Set<() => void>();
  let voices: VoiceInfo[] = [];
  let native: readonly VoiceLike[] = [];
  let active: UtteranceLike | undefined;

  const refresh = (): void => {
    if (!synth) return;
    try {
      native = synth.getVoices();
    } catch {
      native = [];
    }
    voices = localEnglishVoices(native);
    for (const listener of listeners) listener();
  };
  synth?.addEventListener?.('voiceschanged', refresh);
  refresh();

  return {
    available: () => synth !== undefined && Utterance !== undefined && voices.length > 0,
    voices: () => voices,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    speak(text, options) {
      if (!synth || !Utterance) return false;
      const chosen = chooseVoice(voices, options.voice);
      const voice = chosen && native.find((candidate) => candidate.voiceURI === chosen.uri);
      if (!chosen || !voice) return false;
      synth.cancel();
      const utterance = new Utterance(applyAliases(text, aliases));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.volume = options.volume ?? 1;
      utterance.rate = options.rate ?? 0.92;
      const finish = (): void => {
        if (active === utterance) active = undefined;
        options.onEnd?.();
      };
      utterance.addEventListener('end', finish);
      utterance.addEventListener('error', finish);
      active = utterance;
      synth.speak(utterance);
      return true;
    },
    cancel() {
      active = undefined;
      synth?.cancel();
    },
    speaking: () => active !== undefined,
    dispose() {
      listeners.clear();
      synth?.removeEventListener?.('voiceschanged', refresh);
      synth?.cancel();
    },
  };
}
