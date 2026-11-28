package io.github.rumukh.dragonvalley;

import android.net.Uri;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The page's one way to the device (src/app/platform/android.ts on the other side). The page posts
 * JSON requests {@code {id, method, args}}; each is answered with {@code {id, result}} or
 * {@code {id, error}}, and the device sends events {@code {event, data}}, all through the reply
 * proxy of the page's latest message. Only the app's own origin, in the main frame, is heard.
 * Everything here runs on the main thread.
 */
final class Bridge implements WebViewCompat.WebMessageListener {
    /** The object the page sees as {@code globalThis.dvAndroid}. */
    static final String NAME = "dvAndroid";

    interface Handler {
        void handle(Bridge page, int id, String method, JSONObject args) throws JSONException;
    }

    private final Handler handler;
    @Nullable private JavaScriptReplyProxy reply;
    /** Counts page loads, so work a gone page asked for is never answered to the next one. */
    private int page;

    Bridge(Handler handler) {
        this.handler = handler;
    }

    @Override
    public void onPostMessage(
            @NonNull WebView view,
            @NonNull WebMessageCompat message,
            @NonNull Uri sourceOrigin,
            boolean isMainFrame,
            @NonNull JavaScriptReplyProxy replyProxy) {
        if (!isMainFrame || !MainActivity.ORIGIN.equals(sourceOrigin.toString())) return;
        String data = message.getData();
        if (data == null) return;
        reply = replyProxy;
        int id;
        String method;
        JSONObject args;
        try {
            JSONObject request = new JSONObject(data);
            id = request.getInt("id");
            method = request.getString("method");
            JSONObject given = request.optJSONObject("args");
            args = given != null ? given : new JSONObject();
        } catch (JSONException unreadable) {
            return;
        }
        try {
            handler.handle(this, id, method, args);
        } catch (JSONException | RuntimeException malformed) {
            fail(id, "bad-request");
        }
    }

    /** True once the current page has said hello, so it can hear events. */
    boolean connected() {
        return reply != null;
    }

    /** The current page's number; work started now is answered only while it is still current. */
    int page() {
        return page;
    }

    boolean current(int asker) {
        return asker == page;
    }

    /** A new page is loading: nothing is sent until it says hello, and older work is dropped. */
    void forget() {
        reply = null;
        page++;
    }

    void respond(int id, Object result) {
        try {
            send(new JSONObject().put("id", id).put("result", result));
        } catch (JSONException impossible) {
            fail(id, "bad-reply");
        }
    }

    void fail(int id, String code) {
        try {
            send(new JSONObject().put("id", id).put("error", code));
        } catch (JSONException impossible) {
            // A number and a string always make a JSON object.
        }
    }

    void emit(String event, Object data) {
        try {
            send(new JSONObject().put("event", event).put("data", data));
        } catch (JSONException impossible) {
            // Events carry JSON values only.
        }
    }

    private void send(JSONObject message) {
        JavaScriptReplyProxy page = reply;
        if (page != null) page.postMessage(message.toString());
    }
}
