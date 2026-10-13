package com.hysiac.gst;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A folder the user picked once, usually inside the Google Drive app. */
final class BackupFolder {
    private static final String PREFS = "hysiac-backup";
    private static final String KEY = "treeUri";
    private static final int KEEP_DATED = 30;

    private final Context context;

    BackupFolder(Context context) {
        Context app = context.getApplicationContext();
        this.context = app != null ? app : context;
    }

    Intent pickIntent() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        Uri current = treeUri();
        if (current != null) intent.putExtra("android.provider.extra.INITIAL_URI", current);
        return intent;
    }

    void remember(Uri uri) {
        int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        context.getContentResolver().takePersistableUriPermission(uri, flags);
        prefs().edit().putString(KEY, uri.toString()).apply();
    }

    void clear() {
        Uri uri = treeUri();
        if (uri != null) {
            int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            try {
                context.getContentResolver().releasePersistableUriPermission(uri, flags);
            } catch (SecurityException ignored) {
            }
        }
        prefs().edit().remove(KEY).apply();
    }

    boolean has() {
        Uri uri = treeUri();
        if (uri == null) return false;
        for (UriPermission permission : context.getContentResolver().getPersistedUriPermissions()) {
            if (uri.equals(permission.getUri()) && permission.isWritePermission()) return true;
        }
        return false;
    }

    String name() {
        Uri tree = treeUri();
        if (tree == null || !has()) return "";
        String id = DocumentsContract.getTreeDocumentId(tree);
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, id);
        String display = displayName(doc);
        return display.isEmpty() ? "Google Drive" : display;
    }

    boolean write(String fileName, String text) {
        Uri tree = treeUri();
        if (tree == null || !has() || fileName == null || text == null) return false;
        String safe = fileName.replaceAll("[\\\\/:*?\"<>|]", "-");
        String stem = safe.toLowerCase().endsWith(".json") ? safe.substring(0, safe.length() - 5) : safe;
        try {
            Uri parent = parentUri(tree);
            deleteMatches(tree, stem);
            Uri remembered = rememberedUri(stem);
            if (remembered != null) deleteQuiet(remembered);
            Uri created = DocumentsContract.createDocument(
                    context.getContentResolver(), parent, "application/json", stem);
            if (created == null) return false;
            Uri stored = treeDocument(tree, created);
            try (OutputStream os = context.getContentResolver().openOutputStream(stored, "w")) {
                if (os == null) return false;
                os.write(text.getBytes(StandardCharsets.UTF_8));
            }
            rememberUri(stem, stored);
            prune(tree);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    String listJson() {
        JSONArray out = new JSONArray();
        Uri tree = treeUri();
        if (tree == null || !has()) return "[]";
        for (Child child : children(tree)) {
            String lower = child.name.toLowerCase();
            if (!lower.startsWith("hysiac-gst")) continue;
            JSONObject row = new JSONObject();
            try {
                row.put("name", child.name);
                row.put("at", child.modified);
                out.put(row);
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }

    String read(String fileName) {
        Uri tree = treeUri();
        if (tree == null || !has() || fileName == null) return "";
        Uri file = findChild(tree, fileName, stripJson(fileName));
        if (file == null) return "";
        try (InputStream in = context.getContentResolver().openInputStream(file)) {
            if (in == null) return "";
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) >= 0) buf.write(chunk, 0, n);
            return buf.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return "";
        }
    }

    private void deleteMatches(Uri tree, String stem) {
        for (Child child : children(tree)) {
            if (sameBackup(child.name, stem)) deleteQuiet(child.uri);
        }
    }

    private void prune(Uri tree) {
        List<Child> dated = new ArrayList<>();
        for (Child child : children(tree)) {
            if (!child.name.toLowerCase().startsWith("hysiac-gst")) continue;
            if (sameBackup(child.name, "hysiac-gst-latest")) continue;
            dated.add(child);
        }
        Collections.sort(dated, (a, b) -> Long.compare(b.modified, a.modified));
        List<String> keptDays = new ArrayList<>();
        for (Child child : dated) {
            String day = stripJson(child.name);
            if (!contains(keptDays, day) && keptDays.size() < KEEP_DATED) {
                keptDays.add(day);
            } else {
                deleteQuiet(child.uri);
            }
        }
    }

    private static boolean contains(List<String> days, String day) {
        for (String seen : days) {
            if (seen.equals(day)) return true;
        }
        return false;
    }

    private List<Child> matches(Uri tree, String stem) {
        List<Child> out = new ArrayList<>();
        for (Child child : children(tree)) {
            if (sameBackup(child.name, stem)) out.add(child);
        }
        return out;
    }

    private static boolean sameBackup(String display, String stem) {
        String n = stripJson(display).trim().toLowerCase();
        String s = stem.toLowerCase();
        return n.equals(s) || n.startsWith(s + " (");
    }

    private static String stripJson(String name) {
        String n = name == null ? "" : name;
        while (n.toLowerCase().endsWith(".json")) n = n.substring(0, n.length() - 5);
        return n;
    }

    private void deleteQuiet(Uri uri) {
        try {
            DocumentsContract.deleteDocument(context.getContentResolver(), uri);
        } catch (Exception ignored) {
        }
    }

    private Uri findChild(Uri tree, String... names) {
        for (Child child : children(tree)) {
            for (String name : names) {
                if (child.name.equals(name)) return child.uri;
            }
        }
        return null;
    }

    private List<Child> children(Uri tree) {
        String[] cols = new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
        };
        List<Child> listed = queryChildren(tree, cols);
        if (!listed.isEmpty()) return listed;
        return queryChildren(tree, null);
    }

    private List<Child> queryChildren(Uri tree, String[] cols) {
        List<Child> out = new ArrayList<>();
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor cursor = context.getContentResolver().query(kids, cols, null, null, null)) {
            if (cursor == null) return out;
            int idCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            int mimeCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
            while (cursor.moveToNext()) {
                String id = idCol >= 0 ? cursor.getString(idCol) : null;
                String name = nameCol >= 0 ? cursor.getString(nameCol) : null;
                String mime = mimeCol >= 0 ? cursor.getString(mimeCol) : "";
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) continue;
                if (id == null || name == null || name.trim().isEmpty()) continue;
                out.add(new Child(name, 0L, DocumentsContract.buildDocumentUriUsingTree(tree, id)));
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private Uri rememberedUri(String stem) {
        try {
            JSONObject all = new JSONObject(prefs().getString("uris", "{}"));
            String raw = all.optString(stem, "");
            if (raw.isEmpty()) return null;
            return Uri.parse(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private void rememberUri(String stem, Uri uri) {
        try {
            JSONObject all = new JSONObject(prefs().getString("uris", "{}"));
            all.put(stem, uri.toString());
            prefs().edit().putString("uris", all.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static Uri treeDocument(Uri tree, Uri created) {
        try {
            String id = DocumentsContract.getDocumentId(created);
            return DocumentsContract.buildDocumentUriUsingTree(tree, id);
        } catch (Exception e) {
            return created;
        }
    }

    private String displayName(Uri doc) {
        try (Cursor cursor = context.getContentResolver().query(
                doc,
                new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},
                null,
                null,
                null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                return name == null ? "" : name;
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private static Uri parentUri(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    private Uri treeUri() {
        String raw = prefs().getString(KEY, null);
        if (raw == null || raw.isEmpty()) return null;
        return Uri.parse(raw);
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static final class Child {
        final String name;
        final long modified;
        final Uri uri;

        Child(String name, long modified, Uri uri) {
            this.name = name;
            this.modified = modified;
            this.uri = uri;
        }
    }
}
