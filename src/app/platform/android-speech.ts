/**
 * Read-aloud's engine in the Android app. Android's WebView has no Web Speech voices, so the
 * shell speaks with the device's own text-to-speech (android/ DeviceSpeech) and this module
 * gives read-aloud the same shape as the Web Speech API (`SpeechPlatform`).
 *
 * The shell lists only voices that are installed and need no network; read-aloud then keeps the
 * English ones (speech/voices.ts) and names one for every line, as it does in a browser. A line
 * ends when the shell says so (`speech.end`) or when it is cancelled here.
 */
import type { SpeechPlatform, SynthLike, UtteranceLike } from '../speech/read-aloud';
import type { VoiceLike } from '../speech/voices';
import type { AndroidBridge } from './android';

/** The shell's list of voices, keeping only well-formed entries. */
export function readVoices(data: unknown): VoiceLike[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const voice = item as Record<string, unknown>;
    const { voiceURI, name, lang } = voice;
    if (typeof voiceURI !== 'string' || typeof name !== 'string' || typeof lang !== 'string') {
      return [];
    }
    return [
      {
        voiceURI,
        name,
        lang,
        localService: voice['localService'] === true,
        default: voice['default'] === true,
      },
    ];
  });
}

class NativeUtterance extends EventTarget implements UtteranceLike {
  text: string;
  voice: VoiceLike | null = null;
  lang = '';
  volume = 1;
  rate = 1;

  constructor(text = '') {
    super();
    this.text = text;
  }
}

export function androidSpeech(bridge: AndroidBridge): SpeechPlatform {
  let voices: readonly VoiceLike[] = [];
  const events = new EventTarget();
  const speaking = new Map<number, UtteranceLike>();
  let serial = 0;

  const publish = (data: unknown): void => {
    voices = readVoices(data);
    events.dispatchEvent(new Event('voiceschanged'));
  };
  const finish = (id: number, type: 'end' | 'error'): void => {
    const utterance = speaking.get(id);
    if (!utterance) return;
    speaking.delete(id);
    utterance.dispatchEvent(new Event(type));
  };

  bridge.on('speech.voices', publish);
  bridge.on('speech.end', (data) => {
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id === 'number') finish(id, 'end');
  });
  // The engine may already be ready; otherwise its list arrives as an event once it is.
  void bridge.request('speech.voices').then(publish, () => undefined);

  const synth: SynthLike = {
    getVoices: () => voices,
    speak(utterance) {
      const id = ++serial;
      speaking.set(id, utterance);
      bridge
        .request('speech.speak', {
          id,
          text: utterance.text,
          voice: utterance.voice?.voiceURI ?? null,
          rate: utterance.rate,
          volume: utterance.volume,
        })
        .catch(() => finish(id, 'error'));
    },
    cancel() {
      const lines = [...speaking.keys()];
      void bridge.request('speech.cancel').catch(() => undefined);
      for (const id of lines) finish(id, 'end');
    },
    addEventListener: (type, listener) => events.addEventListener(type, listener),
    removeEventListener: (type, listener) => events.removeEventListener(type, listener),
  };
  return { synth, Utterance: NativeUtterance };
}
