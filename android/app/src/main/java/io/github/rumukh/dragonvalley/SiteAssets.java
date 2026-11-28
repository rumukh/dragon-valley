package io.github.rumukh.dragonvalley;

import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Serves the game's files from assets/www at the page's origin, each with its exact media type
 * (a module script or a style sheet with the wrong type would not load). The file types are the
 * ones the web build allows (scripts/lib/site.mjs); anything else is not found, so a request can
 * never fall through to the network.
 */
final class SiteAssets implements WebViewAssetLoader.PathHandler {
    private static final Map<String, String> TYPES = new HashMap<>();

    static {
        TYPES.put("html", "text/html");
        TYPES.put("js", "text/javascript");
        TYPES.put("mjs", "text/javascript");
        TYPES.put("css", "text/css");
        TYPES.put("json", "application/json");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("txt", "text/plain");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("png", "image/png");
        TYPES.put("webp", "image/webp");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("jpeg", "image/jpeg");
        TYPES.put("avif", "image/avif");
        TYPES.put("ico", "image/x-icon");
        TYPES.put("woff2", "font/woff2");
        TYPES.put("woff", "font/woff");
        TYPES.put("ttf", "font/ttf");
        TYPES.put("otf", "font/otf");
        TYPES.put("wav", "audio/wav");
        TYPES.put("ogg", "audio/ogg");
        TYPES.put("opus", "audio/ogg");
        TYPES.put("mp3", "audio/mpeg");
        TYPES.put("m4a", "audio/mp4");
    }

    private final AssetManager assets;

    SiteAssets(AssetManager assets) {
        this.assets = assets;
    }

    @Override
    public WebResourceResponse handle(@NonNull String path) {
        String file = path.isEmpty() ? "index.html" : path;
        if (file.startsWith("/") || file.contains("..") || file.contains("\\")) return missing();
        int dot = file.lastIndexOf('.');
        String type = dot < 0 ? null : TYPES.get(file.substring(dot + 1).toLowerCase(Locale.ROOT));
        if (type == null) return missing();
        try {
            InputStream data = assets.open("www/" + file, AssetManager.ACCESS_STREAMING);
            boolean text =
                    type.startsWith("text/")
                            || type.endsWith("json")
                            || type.equals("image/svg+xml");
            return new WebResourceResponse(type, text ? "utf-8" : null, data);
        } catch (IOException notInTheApp) {
            return missing();
        }
    }

    static WebResourceResponse missing() {
        return new WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                Collections.emptyMap(),
                new ByteArrayInputStream(new byte[0]));
    }
}
