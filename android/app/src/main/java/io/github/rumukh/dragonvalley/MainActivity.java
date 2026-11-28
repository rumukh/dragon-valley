package io.github.rumukh.dragonvalley;

import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;

/**
 * Dragon Valley's Android shell: one full-screen WebView showing the game that ships inside the app
 * (assets/www, built by scripts/android/build.mjs) from the WebView's local origin for app files.
 * The app has no INTERNET permission, so nothing the page does can reach a network.
 *
 * <p>The page reaches the device only through {@link Bridge}: saving and opening a grown-up's files
 * with the system's document screens ({@link Documents}), printing, reading aloud with on-device
 * voices ({@link DeviceSpeech}), the Back button and leaving for the home screen.
 */
public final class MainActivity extends ComponentActivity {
    /**
     * The page's origin. Saved games live in this origin's storage, so it must never change, or
     * every child's progress would be left behind after an update.
     */
    static final String ORIGIN = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN;

    static final String HOME = ORIGIN + "/index.html";

    /** The oldest WebView the game's CSS and JavaScript work in (color-mix, :has, @container). */
    static final int MIN_WEBVIEW_MAJOR = 111;

    /** Below this smallest width (dp) the device is a phone: the game is played upright there. */
    static final int TABLET_MIN_WIDTH_DP = 600;

    @Nullable private WebView webView;
    @Nullable private Bridge bridge;
    @Nullable private DeviceSpeech speech;
    @Nullable private Documents documents;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        holdPhonesUpright(getResources().getConfiguration());
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.sky));
        setContentView(root);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // The game keeps clear of a camera cutout and of the keyboard; the system bars are hidden
        // (a swipe shows them for a moment) and take no room.
        ViewCompat.setOnApplyWindowInsetsListener(
                root,
                (view, insets) -> {
                    Insets safe =
                            insets.getInsets(
                                    WindowInsetsCompat.Type.systemBars()
                                            | WindowInsetsCompat.Type.displayCutout());
                    Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
                    view.setPadding(
                            safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
                    return WindowInsetsCompat.CONSUMED;
                });
        hideSystemBars();

        if (!webViewUsable()) {
            root.addView(message(R.string.webview_update));
            return;
        }
        WebView view;
        try {
            view = new WebView(this);
        } catch (RuntimeException missingWebView) {
            root.addView(message(R.string.webview_update));
            return;
        }
        webView = view;
        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        configure(view);

        Bridge pageBridge = new Bridge(this::handle);
        bridge = pageBridge;
        speech = new DeviceSpeech(getApplicationContext(), pageBridge);
        documents = new Documents(this, pageBridge);
        WebViewCompat.addWebMessageListener(
                view, Bridge.NAME, Collections.singleton(ORIGIN), pageBridge);

        getOnBackPressedDispatcher()
                .addCallback(
                        this,
                        new OnBackPressedCallback(true) {
                            @Override
                            public void handleOnBackPressed() {
                                // The game decides: close a dialog, pause, go back a screen, or
                                // ask to leave (the "exit" request).
                                if (pageBridge.connected()) pageBridge.emit("back", JSONObject.NULL);
                                else moveTaskToBack(true);
                            }
                        });
        view.loadUrl(HOME);
    }

    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // The game has its own text sizes for each child (100 % to 200 %).
        settings.setTextZoom(100);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(settings, false);
        }
        CookieManager.getInstance().setAcceptCookie(false);
        view.setBackgroundColor(getColor(R.color.sky));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setWebViewClient(new Client());
        view.setWebChromeClient(new Chrome());
        WebView.setWebContentsDebuggingEnabled(
                (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
    }

    /** Requests from the page (Bridge); each is answered once, now or when the device is done. */
    private void handle(Bridge page, int id, String method, JSONObject args) throws JSONException {
        DeviceSpeech voices = speech;
        Documents files = documents;
        if (voices == null || files == null) {
            page.fail(id, "unavailable");
            return;
        }
        switch (method) {
            case "hello":
                page.respond(id, new JSONObject().put("version", 1));
                voices.publish();
                break;
            case "files.save":
                files.save(
                        id,
                        args.getString("name"),
                        args.optString("type", "application/octet-stream"),
                        args.getString("text"));
                break;
            case "files.open":
                files.open(id, args.optLong("maxBytes", Documents.DEFAULT_MAX_BYTES));
                break;
            case "print":
                print(args.optString("title", ""));
                page.respond(id, JSONObject.NULL);
                break;
            case "speech.voices":
                page.respond(id, voices.voices());
                break;
            case "speech.speak":
                if (voices.speak(
                        args.getInt("id"),
                        args.getString("text"),
                        args.isNull("voice") ? null : args.getString("voice"),
                        (float) args.optDouble("rate", 1),
                        (float) args.optDouble("volume", 1))) {
                    page.respond(id, JSONObject.NULL);
                } else {
                    page.fail(id, "speech-unavailable");
                }
                break;
            case "speech.cancel":
                voices.cancel();
                page.respond(id, JSONObject.NULL);
                break;
            case "exit":
                page.respond(id, JSONObject.NULL);
                moveTaskToBack(true);
                break;
            default:
                page.fail(id, "unknown-method");
        }
    }

    /** Prints the page as it is: the print preview shows only its A4 pages to a printer. */
    private void print(String title) {
        WebView view = webView;
        PrintManager printer = getSystemService(PrintManager.class);
        if (view == null || printer == null) return;
        String job = title.isEmpty() ? getString(R.string.app_name) : title;
        printer.print(
                job,
                view.createPrintDocumentAdapter(job),
                new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .build());
    }

    private boolean webViewUsable() {
        PackageInfo info = WebViewCompat.getCurrentWebViewPackage(this);
        if (info == null || info.versionName == null) return false;
        int major;
        try {
            major = Integer.parseInt(info.versionName.split("\\.", 2)[0]);
        } catch (NumberFormatException unreadable) {
            return false;
        }
        return major >= MIN_WEBVIEW_MAJOR
                && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
    }

    private TextView message(int text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setGravity(Gravity.CENTER);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        view.setTextColor(getColor(R.color.ink));
        int padding = Math.round(32 * getResources().getDisplayMetrics().density);
        view.setPadding(padding, padding, padding, padding);
        return view;
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat bars =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * On a phone the game is played upright: lying on its side, a round's problem and its keypad
     * do not fit one screen. Tablets and unfolded foldables turn freely (Android 16 ignores an
     * orientation request on them anyway).
     */
    private void holdPhonesUpright(Configuration configuration) {
        setRequestedOrientation(
                configuration.smallestScreenWidthDp < TABLET_MIN_WIDTH_DP
                        ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                        : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration configuration) {
        super.onConfigurationChanged(configuration);
        // A foldable folded or unfolded: a phone again, or a tablet again.
        holdPhonesUpright(configuration);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Back from a system screen (saving a file, printing), the game is full screen again.
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        // The page pauses its round and its sounds when it is hidden; speech stops here.
        if (speech != null) speech.cancel();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (speech != null) speech.shutdown();
        if (documents != null) documents.close();
        if (webView != null) {
            ((ViewGroup) webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** Only the game's own files load, and the page never leaves its one page. */
    private final class Client extends WebViewClient {
        private final WebViewAssetLoader site =
                new WebViewAssetLoader.Builder()
                        .addPathHandler("/", new SiteAssets(getAssets()))
                        .build();

        @Nullable
        @Override
        public WebResourceResponse shouldInterceptRequest(
                @NonNull WebView view, @NonNull WebResourceRequest request) {
            Uri url = request.getUrl();
            WebResourceResponse response = site.shouldInterceptRequest(url);
            return response != null ? response : SiteAssets.missing();
        }

        @Override
        public boolean shouldOverrideUrlLoading(
                @NonNull WebView view, @NonNull WebResourceRequest request) {
            return !HOME.equals(request.getUrl().toString());
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            // A new page says hello again before the device sends it anything, and nothing the
            // old page started (a line being spoken, a document screen) is answered to it.
            if (bridge != null) bridge.forget();
            if (speech != null) speech.cancel();
        }

        @Override
        public boolean onRenderProcessGone(
                @NonNull WebView view, @NonNull RenderProcessGoneDetail detail) {
            // The page's renderer stopped (often to free memory). Every answer is already saved
            // on the device, so the game starts again from its title screen.
            if (view == webView) {
                ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
                webView = null;
                recreate();
            }
            return true;
        }
    }

    /** Files open through the bridge (files.open), so a stray file field opens nothing. */
    private static final class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            callback.onReceiveValue(null);
            return true;
        }
    }
}
