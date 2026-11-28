/**
 * The Android app's side of the bridge (src/app/platform/): requests answered by id, device events,
 * the file results the grown-ups' area reports, and read-aloud over the device's own voices. The
 * stand-in plays the object android/'s Bridge.java injects as `dvAndroid`.
 */
import { describe, expect, it, vi } from 'vitest';
import { AndroidBridgeError, connectAndroid } from '../../../src/app/platform/android';
import { androidSpeech, readVoices } from '../../../src/app/platform/android-speech';
import { androidPlatform, createPlatform } from '../../../src/app/platform/platform';
import { createReadAloud } from '../../../src/app/speech/read-aloud';

interface Sent {
  readonly id: number;
  readonly method: string;
  readonly args: Record<string, unknown>;
}

function fakeShell() {
  const sent: Sent[] = [];
  const port = {
    onmessage: null as ((event: { readonly data: unknown }) => void) | null,
    postMessage(message: string) {
      sent.push(JSON.parse(message) as Sent);
    },
  };
  const deliver = (message: unknown): void => port.onmessage?.({ data: JSON.stringify(message) });
  return {
    scope: { dvAndroid: port },
    sent,
    reply: (id: number, result: unknown) => deliver({ id, result }),
    refuse: (id: number, error: string) => deliver({ id, error }),
    emit: (event: string, data: unknown) => deliver({ event, data }),
    raw: (data: unknown) => port.onmessage?.({ data }),
    last(method: string): Sent {
      const found = sent.filter((message) => message.method === method).pop();
      if (!found) throw new Error(`The page never asked for ${method}.`);
      return found;
    },
  };
}

const BRITISH = {
  voiceURI: 'en-gb-x-gba-local',
  name: 'English (United Kingdom)',
  lang: 'en-GB',
  localService: true,
  default: false,
};

describe('the Android bridge', () => {
  it('is absent in a browser, where the web platform is used', () => {
    expect(connectAndroid({})).toBeNull();
    expect(createPlatform({}).kind).toBe('web');
    expect(createPlatform(fakeShell().scope).kind).toBe('android');
  });

  it('says hello first, then answers every request by its id, in any order', async () => {
    const shell = fakeShell();
    const bridge = connectAndroid(shell.scope)!;
    expect(shell.sent[0]?.method, 'the shell learns where to send events').toBe('hello');
    const first = bridge.request('one');
    const second = bridge.request('two', { table: 7 });
    shell.reply(shell.last('two').id, 'second');
    shell.reply(shell.last('one').id, 'first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(shell.last('two').args).toEqual({ table: 7 });
  });

  it("rejects with the shell's own error code", async () => {
    const shell = fakeShell();
    const bridge = connectAndroid(shell.scope)!;
    const asked = bridge.request('files.save');
    shell.refuse(shell.last('files.save').id, 'write-failed');
    await expect(asked).rejects.toEqual(new AndroidBridgeError('write-failed'));
  });

  it('hands device events to their listeners and ignores what it cannot read', () => {
    const shell = fakeShell();
    const onError = vi.fn();
    const bridge = connectAndroid(shell.scope, onError)!;
    const heard: unknown[] = [];
    const stop = bridge.on('back', (data) => heard.push(data));
    bridge.on('back', () => {
      throw new Error('a broken listener');
    });
    shell.raw('not json');
    shell.raw(42);
    shell.emit('speech.voices', []);
    shell.emit('back', null);
    expect(heard, 'one Back, nothing else').toEqual([null]);
    expect(onError, 'a failing listener is reported, not fatal').toHaveBeenCalledTimes(1);
    stop();
    shell.emit('back', null);
    expect(heard).toEqual([null]);
  });
});

describe("the Android app's files", () => {
  it('reports a backup as saved only when the shell wrote it, and a cancel as a cancel', async () => {
    const shell = fakeShell();
    const platform = androidPlatform(connectAndroid(shell.scope)!);
    const saved = platform.saveFile('dragon-valley-ada.json', '{"a":1}', 'application/json');
    expect(shell.last('files.save').args).toEqual({
      name: 'dragon-valley-ada.json',
      type: 'application/json',
      text: '{"a":1}',
    });
    shell.reply(shell.last('files.save').id, { status: 'saved' });
    await expect(saved).resolves.toBe('saved');

    const cancelled = platform.saveFile('b.json', '{}', 'application/json');
    shell.reply(shell.last('files.save').id, { status: 'cancelled' });
    await expect(cancelled).resolves.toBe('cancelled');

    const odd = platform.saveFile('c.json', '{}', 'application/json');
    shell.reply(shell.last('files.save').id, { status: 'maybe' });
    await expect(odd, 'anything else is not a saved file').rejects.toBeInstanceOf(
      AndroidBridgeError,
    );
  });

  it('opens a file as text within the size limit, or nothing when the grown-up cancels', async () => {
    const shell = fakeShell();
    const platform = androidPlatform(connectAndroid(shell.scope)!);
    const opened = platform.openTextFile(4096);
    expect(shell.last('files.open').args).toEqual({ maxBytes: 4096 });
    shell.reply(shell.last('files.open').id, { status: 'opened', text: '{"backup":true}' });
    await expect(opened).resolves.toBe('{"backup":true}');

    const cancelled = platform.openTextFile(4096);
    shell.reply(shell.last('files.open').id, { status: 'cancelled' });
    await expect(cancelled).resolves.toBeNull();

    const tooLarge = platform.openTextFile(4096);
    shell.refuse(shell.last('files.open').id, 'too-large');
    await expect(tooLarge).rejects.toEqual(new AndroidBridgeError('too-large'));
  });
});

describe("read-aloud with the device's voices", () => {
  it('keeps only well-formed voices from the shell', () => {
    expect(readVoices([BRITISH, { name: 'no uri' }, null, 'voice'])).toEqual([BRITISH]);
    expect(readVoices('nothing')).toEqual([]);
  });

  it('appears once the device lists an on-device English voice, and speaks with it', async () => {
    const shell = fakeShell();
    const speech = createReadAloud(androidSpeech(connectAndroid(shell.scope)!));
    expect(speech.available(), 'no voices until the device lists them').toBe(false);
    const changed = vi.fn();
    speech.subscribe(changed);
    shell.emit('speech.voices', [
      { ...BRITISH, voiceURI: 'en-us-x-online', lang: 'en-US', localService: false },
      BRITISH,
    ]);
    expect(changed).toHaveBeenCalled();
    expect(speech.available()).toBe(true);
    expect(
      speech.voices().map((voice) => voice.uri),
      'never an online voice',
    ).toEqual([BRITISH.voiceURI]);

    const ended = vi.fn();
    expect(speech.speak('Seven times eight?', { voice: null, volume: 0.5, onEnd: ended })).toBe(
      true,
    );
    const line = shell.last('speech.speak');
    expect(line.args).toMatchObject({
      text: 'Seven times eight?',
      voice: BRITISH.voiceURI,
      volume: 0.5,
      rate: 0.92,
    });
    expect(speech.speaking()).toBe(true);
    shell.emit('speech.end', { id: line.args['id'] });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(speech.speaking()).toBe(false);
  });

  it('ends a line that is cancelled or that the device cannot speak', async () => {
    const shell = fakeShell();
    const speech = createReadAloud(androidSpeech(connectAndroid(shell.scope)!));
    // The list may also come as the answer to the engine's first question.
    shell.reply(shell.last('speech.voices').id, [BRITISH]);
    await vi.waitFor(() => expect(speech.available()).toBe(true));
    const cancelled = vi.fn();
    speech.speak('One', { voice: null, onEnd: cancelled });
    speech.cancel();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(shell.sent.filter((message) => message.method === 'speech.cancel').length).toBe(2);

    const failed = vi.fn();
    speech.speak('Two', { voice: BRITISH.voiceURI, onEnd: failed });
    shell.refuse(shell.last('speech.speak').id, 'speech-unavailable');
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
  });
});
