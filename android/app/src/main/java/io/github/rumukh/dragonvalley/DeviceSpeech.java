package io.github.rumukh.dragonvalley;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Read-aloud with the device's own text-to-speech (Android's WebView has no Web Speech voices).
 *
 * <p>Only voices that are installed and need no network are offered or used, so the words never
 * leave the device: the page chooses one of them for every line (speech/read-aloud.ts), and
 * {@link #speak} refuses any other. Lines are numbered by the page; {@code speech.end} tells it
 * when one finished, failed or was stopped.
 */
final class DeviceSpeech extends UtteranceProgressListener implements TextToSpeech.OnInitListener {
    private final Bridge page;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final TextToSpeech engine;
    private boolean ready;

    DeviceSpeech(Context context, Bridge page) {
        this.page = page;
        this.engine = new TextToSpeech(context, this);
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (ready) {
            engine.setOnUtteranceProgressListener(this);
            engine.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build());
        }
        publish();
    }

    /** Tells the page which voices it may use (an empty list hides read-aloud). */
    void publish() {
        page.emit("speech.voices", voices());
    }

    JSONArray voices() {
        JSONArray list = new JSONArray();
        List<Voice> usable = onDeviceVoices();
        if (usable.isEmpty()) return list;
        Voice preferred = defaultVoice();
        Map<String, Integer> perLanguage = new HashMap<>();
        for (Voice voice : usable) perLanguage.merge(label(voice), 1, Integer::sum);
        Map<String, Integer> numbered = new HashMap<>();
        try {
            for (Voice voice : usable) {
                String label = label(voice);
                Integer count = perLanguage.get(label);
                String name =
                        count != null && count > 1
                                ? label + ", voice " + numbered.merge(label, 1, Integer::sum)
                                : label;
                list.put(
                        new JSONObject()
                                .put("voiceURI", voice.getName())
                                .put("name", name)
                                .put("lang", voice.getLocale().toLanguageTag())
                                .put("localService", true)
                                .put("default", voice.equals(preferred)));
            }
        } catch (JSONException impossible) {
            return new JSONArray();
        }
        return list;
    }

    /** Speaks one line with the named on-device voice; false when it cannot. */
    boolean speak(int line, String text, @Nullable String voiceName, float rate, float volume) {
        if (!ready || voiceName == null) return false;
        Voice chosen = null;
        for (Voice voice : onDeviceVoices()) {
            if (voice.getName().equals(voiceName)) chosen = voice;
        }
        if (chosen == null || engine.setVoice(chosen) != TextToSpeech.SUCCESS) return false;
        engine.setSpeechRate(Math.max(0.5f, Math.min(rate, 2f)));
        Bundle params = new Bundle();
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(volume, 1f)));
        // "page:line", so the end of a line a reloaded page asked for never ends a new one.
        String utterance = page.page() + ":" + line;
        return engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utterance)
                == TextToSpeech.SUCCESS;
    }

    void cancel() {
        if (ready) engine.stop();
    }

    void shutdown() {
        ready = false;
        engine.shutdown();
    }

    private List<Voice> onDeviceVoices() {
        List<Voice> usable = new ArrayList<>();
        if (!ready) return usable;
        Set<Voice> all;
        try {
            all = engine.getVoices();
        } catch (RuntimeException engineFailed) {
            return usable;
        }
        if (all == null) return usable;
        for (Voice voice : all) {
            if (onDevice(voice)) usable.add(voice);
        }
        usable.sort(Comparator.comparing(Voice::getName));
        return usable;
    }

    private static boolean onDevice(Voice voice) {
        Set<String> features = voice.getFeatures();
        return !voice.isNetworkConnectionRequired()
                && (features == null
                        || (!features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
                                && !features.contains(
                                        TextToSpeech.Engine.KEY_FEATURE_NETWORK_SYNTHESIS)));
    }

    @Nullable
    private Voice defaultVoice() {
        try {
            return engine.getDefaultVoice();
        } catch (RuntimeException engineFailed) {
            return null;
        }
    }

    /** "English (United Kingdom)": what a grown-up sees in the voice list. */
    private static String label(Voice voice) {
        return voice.getLocale().getDisplayName(Locale.ENGLISH);
    }

    @Override
    public void onStart(String utteranceId) {}

    @Override
    public void onDone(String utteranceId) {
        ended(utteranceId);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onError(String utteranceId) {
        ended(utteranceId);
    }

    @Override
    public void onError(String utteranceId, int errorCode) {
        ended(utteranceId);
    }

    @Override
    public void onStop(String utteranceId, boolean interrupted) {
        ended(utteranceId);
    }

    /** Engine callbacks arrive on its own thread; the page hears them on the main thread. */
    private void ended(String utteranceId) {
        String[] parts = utteranceId.split(":", 2);
        int asker;
        int line;
        try {
            asker = Integer.parseInt(parts[0]);
            line = Integer.parseInt(parts.length > 1 ? parts[1] : "");
        } catch (NumberFormatException notOurs) {
            return;
        }
        main.post(
                () -> {
                    if (!page.current(asker)) return;
                    try {
                        page.emit("speech.end", new JSONObject().put("id", line));
                    } catch (JSONException impossible) {
                        // A number always makes a JSON object.
                    }
                });
    }
}
