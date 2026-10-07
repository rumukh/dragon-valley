/**
 * Read-aloud through the Web Speech API, restricted to local English voices.
 *
 * Every utterance names its voice explicitly: leaving it unset would let the browser pick its
 * default, which can be a network voice. With no local English voice, `available()` is false,
 * the speaker button is hidden and the grown-ups' area explains why. Speech is cancelled on
 * every screen change, on pause and when the page is hidden. Words the voices say wrongly are
 * replaced by their aliases just before speaking (`aliases.ts`); the screen keeps them.
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

export interface SpeechPlatform {
  readonly synth: SpeechSynthesis | undefined;
  readonly Utterance: typeof SpeechSynthesisUtterance | undefined;
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
  let native: VoiceLike[] = [];
  let active: SpeechSynthesisUtterance | undefined;

  const refresh = (): void => {
    if (!synth) return;
    try {
      native = synth.getVoices() as VoiceLike[];
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
      utterance.voice = voice as SpeechSynthesisVoice;
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
