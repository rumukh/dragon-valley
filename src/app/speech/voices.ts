/**
 * Which speech voices read-aloud may use: only voices the device itself provides
 * (`localService === true`) that speak English. Remote "natural" voices send text to a
 * service, so they are never used, not even as a fallback.
 */
export interface VoiceLike {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
}

export interface VoiceInfo {
  readonly uri: string;
  readonly name: string;
  readonly lang: string;
  readonly isDefault: boolean;
}

export function isLocalEnglish(voice: Pick<VoiceLike, 'localService' | 'lang'>): boolean {
  return voice.localService === true && /^en(?:[-_]|$)/i.test(voice.lang);
}

function rank(voice: VoiceInfo): number {
  if (voice.isDefault) return 0;
  const lang = voice.lang.toLowerCase().replace('_', '-');
  if (lang === 'en-gb') return 1;
  if (lang === 'en-us') return 2;
  return 3;
}

/** Local English voices, unique by URI: device default first, then British, American, other. */
export function localEnglishVoices(voices: readonly VoiceLike[]): VoiceInfo[] {
  const seen = new Set<string>();
  const result: VoiceInfo[] = [];
  for (const voice of voices) {
    if (!isLocalEnglish(voice) || seen.has(voice.voiceURI)) continue;
    seen.add(voice.voiceURI);
    result.push({
      uri: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      isDefault: voice.default,
    });
  }
  return result.sort(
    (a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

/** The preferred voice if it is still available, otherwise the best local English voice. */
export function chooseVoice(
  voices: readonly VoiceInfo[],
  preferred: string | null,
): VoiceInfo | undefined {
  return voices.find((voice) => voice.uri === preferred) ?? voices[0];
}
