package io.github.rumukh.dragonvalley;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * A grown-up's files (backups, printables, a record the game could not read), saved and opened with
 * the system's own document screens, so they choose the place and the app needs no permission.
 *
 * <p>A save is reported "saved" only after every byte was written to the chosen document, and
 * "cancelled" when they closed the screen; the game shows a backup as saved only then. Files are
 * read and written off the main thread; one document screen is open at a time.
 */
final class Documents {
    /** The largest file the page may ask to open when it names no limit (a backup is ≤ 4 MiB). */
    static final long DEFAULT_MAX_BYTES = 4L * 1024 * 1024;

    private final ComponentActivity activity;
    private final Bridge page;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ActivityResultLauncher<Intent> create;
    private final ActivityResultLauncher<String[]> open;
    @Nullable private Pending saving;
    @Nullable private Pending opening;

    private static final class Pending {
        final int page;
        final int id;
        final String text;
        final long maxBytes;

        Pending(int page, int id, String text, long maxBytes) {
            this.page = page;
            this.id = id;
            this.text = text;
            this.maxBytes = maxBytes;
        }
    }

    Documents(ComponentActivity activity, Bridge page) {
        this.activity = activity;
        this.page = page;
        create =
                activity.registerForActivityResult(
                        new ActivityResultContracts.StartActivityForResult(), this::created);
        open =
                activity.registerForActivityResult(
                        new ActivityResultContracts.OpenDocument(), this::opened);
    }

    void save(int id, String name, String type, String text) {
        if (saving != null || opening != null) {
            page.fail(id, "busy");
            return;
        }
        Intent intent =
                new Intent(Intent.ACTION_CREATE_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(type)
                        .putExtra(Intent.EXTRA_TITLE, name);
        saving = new Pending(page.page(), id, text, 0);
        try {
            create.launch(intent);
        } catch (ActivityNotFoundException noDocumentScreen) {
            saving = null;
            page.fail(id, "no-document-screen");
        }
    }

    void open(int id, long maxBytes) {
        if (saving != null || opening != null) {
            page.fail(id, "busy");
            return;
        }
        opening = new Pending(page.page(), id, "", maxBytes);
        try {
            // Any file: a backup sent by e-mail or chat may not be labelled as JSON. The game
            // checks what it reads.
            open.launch(new String[] {"*/*"});
        } catch (ActivityNotFoundException noDocumentScreen) {
            opening = null;
            page.fail(id, "no-document-screen");
        }
    }

    void close() {
        io.shutdown();
    }

    private void created(ActivityResult result) {
        Pending request = saving;
        saving = null;
        Intent data = result.getData();
        Uri document =
                result.getResultCode() == Activity.RESULT_OK && data != null ? data.getData() : null;
        if (request == null) {
            // The page that asked is gone (the app restarted meanwhile): leave no empty file.
            if (document != null) discard(document);
            return;
        }
        if (document == null) {
            if (page.current(request.page)) page.respond(request.id, status("cancelled"));
            return;
        }
        ContentResolver resolver = activity.getContentResolver();
        io.execute(
                () -> {
                    boolean written = write(resolver, document, request.text);
                    if (!written) discard(document);
                    activity.runOnUiThread(
                            () -> {
                                if (!page.current(request.page)) return;
                                if (written) page.respond(request.id, status("saved"));
                                else page.fail(request.id, "write-failed");
                            });
                });
    }

    private void opened(@Nullable Uri document) {
        Pending request = opening;
        opening = null;
        if (request == null) return;
        if (document == null) {
            if (page.current(request.page)) page.respond(request.id, status("cancelled"));
            return;
        }
        ContentResolver resolver = activity.getContentResolver();
        io.execute(
                () -> {
                    String text = null;
                    String problem = null;
                    try (InputStream in = resolver.openInputStream(document)) {
                        if (in == null) {
                            problem = "read-failed";
                        } else {
                            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                            byte[] buffer = new byte[16 * 1024];
                            long total = 0;
                            for (int read; (read = in.read(buffer)) != -1; ) {
                                total += read;
                                if (total > request.maxBytes) {
                                    problem = "too-large";
                                    break;
                                }
                                bytes.write(buffer, 0, read);
                            }
                            if (problem == null) {
                                text = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                            }
                        }
                    } catch (IOException | SecurityException unreadable) {
                        problem = "read-failed";
                    }
                    String content = text;
                    String failure = problem;
                    activity.runOnUiThread(
                            () -> {
                                if (!page.current(request.page)) return;
                                if (failure != null) {
                                    page.fail(request.id, failure);
                                    return;
                                }
                                try {
                                    page.respond(
                                            request.id, status("opened").put("text", content));
                                } catch (JSONException impossible) {
                                    page.fail(request.id, "read-failed");
                                }
                            });
                });
    }

    /** Writes the whole text; a provider that cannot truncate ("wt") gets plain "w". */
    private static boolean write(ContentResolver resolver, Uri document, String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        for (String mode : new String[] {"wt", "w"}) {
            try (OutputStream out = resolver.openOutputStream(document, mode)) {
                if (out == null) return false;
                out.write(bytes);
                out.flush();
                return true;
            } catch (IOException | RuntimeException failed) {
                // Try the next mode; the last failure is the answer.
            }
        }
        return false;
    }

    private void discard(Uri document) {
        try {
            DocumentsContract.deleteDocument(activity.getContentResolver(), document);
        } catch (Exception cannotDelete) {
            // The provider keeps it; it is an empty file the grown-up can delete.
        }
    }

    private static JSONObject status(String value) {
        try {
            return new JSONObject().put("status", value);
        } catch (JSONException impossible) {
            return new JSONObject();
        }
    }
}
