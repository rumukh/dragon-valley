/**
 * A stand-in for the device's speech engine (the Web Speech API), installed before the game
 * starts. It offers the voices a test describes, records every utterance (text, voice, language)
 * and every cancel, and can announce a late voice list with `voiceschanged`, as real browsers
 * often do after the first page load. Nothing is spoken.
 */
import type { BrowserContext, Page } from '@playwright/test';

export interface FakeVoice {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
}

export interface SpokenLine {
  readonly text: string;
  readonly voiceURI: string | null;
  readonly voiceLocal: boolean | null;
  readonly lang: string;
  readonly volume: number;
}

export interface SpeechLog {
  readonly spoken: SpokenLine[];
  readonly cancels: number;
}

/** A remote "natural" voice the browser marks as its default: it must never be used. */
export const REMOTE_ENGLISH: FakeVoice = {
  voiceURI: 'qa-remote-en-US',
  name: 'Natural Online English (United States)',
  lang: 'en-US',
  localService: false,
  default: true,
};
export const LOCAL_CZECH: FakeVoice = {
  voiceURI: 'qa-local-cs-CZ',
  name: 'Czech (Czechia)',
  lang: 'cs-CZ',
  localService: true,
  default: false,
};
/** Names as an Android tablet reports its built-in voices. */
export const LOCAL_BRITISH: FakeVoice = {
  voiceURI: 'qa-local-en-GB',
  name: 'English (United Kingdom)',
  lang: 'en-GB',
  localService: true,
  default: false,
};
export const LOCAL_AMERICAN: FakeVoice = {
  voiceURI: 'qa-local-en-US',
  name: 'English (United States)',
  lang: 'en-US',
  localService: true,
  default: false,
};

/** A typical device: a remote default voice, and local English and Czech voices. */
export const TYPICAL_VOICES: readonly FakeVoice[] = [
  REMOTE_ENGLISH,
  LOCAL_CZECH,
  LOCAL_AMERICAN,
  LOCAL_BRITISH,
];

function fakeSpeech(config: { voices: FakeVoice[] }): void {
  // No class fields or helpers: Playwright serialises this function into the page as written.
  let voices = config.voices.slice();
  const spoken: SpokenLine[] = [];
  let cancels = 0;

  class FakeUtterance extends EventTarget {
    text: string;
    voice: FakeVoice | null;
    lang: string;
    volume: number;
    rate: number;
    pitch: number;
    constructor(text = '') {
      super();
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
    }
  }

  class FakeSynthesis extends EventTarget {
    speaking: boolean;
    pending: boolean;
    paused: boolean;
    constructor() {
      super();
      this.speaking = false;
      this.pending = false;
      this.paused = false;
    }
    getVoices(): FakeVoice[] {
      return voices.slice();
    }
    speak(utterance: FakeUtterance): void {
      spoken.push({
        text: utterance.text,
        voiceURI: utterance.voice ? utterance.voice.voiceURI : null,
        voiceLocal: utterance.voice ? utterance.voice.localService : null,
        lang: utterance.lang,
        volume: utterance.volume,
      });
      this.speaking = true;
      setTimeout(() => {
        this.speaking = false;
        utterance.dispatchEvent(new Event('end'));
      }, 30);
    }
    cancel(): void {
      cancels++;
      this.speaking = false;
    }
    pause(): void {
      this.paused = true;
    }
    resume(): void {
      this.paused = false;
    }
  }

  const synthesis = new FakeSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: synthesis, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, '__dvQaSpeech', {
    configurable: true,
    value: {
      log: () => ({ spoken: spoken.slice(), cancels }),
      publish(next: FakeVoice[]) {
        voices = next.slice();
        synthesis.dispatchEvent(new Event('voiceschanged'));
      },
    },
  });
}

/** Install the fake speech engine with `voices` in every page of the context. */
export async function installSpeech(
  context: BrowserContext,
  voices: readonly FakeVoice[],
): Promise<void> {
  await context.addInitScript(fakeSpeech, { voices: [...voices] });
}

export async function speechLog(page: Page): Promise<SpeechLog> {
  return page.evaluate(() =>
    (window as unknown as { __dvQaSpeech: { log(): SpeechLog } }).__dvQaSpeech.log(),
  );
}

export async function spokenTexts(page: Page): Promise<string[]> {
  return (await speechLog(page)).spoken.map((line) => line.text);
}

/** The device finishes loading its voices later and says so with `voiceschanged`. */
export async function publishVoices(page: Page, voices: FakeVoice[]): Promise<void> {
  await page.evaluate((next) => {
    (window as unknown as { __dvQaSpeech: { publish(v: FakeVoice[]): void } }).__dvQaSpeech.publish(
      next,
    );
  }, voices);
}
