package com.goblinthug.pillsnative.overlay;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Backup pills/settings to shared Downloads/PillsNative so data survives reinstall.
 */
final class DataBackup {
    private static final String FOLDER = "PillsNative";
    private static final String FILE_NAME = "pillsnative-backup.json";

    private DataBackup() {}

    static void save(Context context, String json) throws Exception {
        if (json == null) json = "{}";
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveMediaStore(context, bytes);
        } else {
            saveLegacy(bytes);
        }
        // Also keep a copy in app external files (survives update, not uninstall).
        File local = new File(context.getExternalFilesDir(null), FILE_NAME);
        try (FileOutputStream out = new FileOutputStream(local)) {
            out.write(bytes);
        }
    }

    static String load(Context context) throws Exception {
        String fromShared = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? loadMediaStore(context)
            : loadLegacy();
        if (fromShared != null && !fromShared.isEmpty()) return fromShared;

        File local = new File(context.getExternalFilesDir(null), FILE_NAME);
        if (!local.exists()) return null;
        try (FileInputStream in = new FileInputStream(local)) {
            return readAll(in);
        }
    }

    private static void saveMediaStore(Context context, byte[] bytes) throws Exception {
        ContentResolver resolver = context.getContentResolver();
        Uri existing = findDownloadUri(resolver);
        if (existing != null) {
            try (OutputStream out = resolver.openOutputStream(existing, "wt")) {
                if (out == null) throw new IllegalStateException("Cannot open backup for write");
                out.write(bytes);
            }
            return;
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, FILE_NAME);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("Cannot create backup file");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("Cannot open new backup");
            out.write(bytes);
        }
    }

    private static String loadMediaStore(Context context) throws Exception {
        ContentResolver resolver = context.getContentResolver();
        Uri uri = findDownloadUri(resolver);
        if (uri == null) return null;
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) return null;
            return readAll(in);
        }
    }

    private static Uri findDownloadUri(ContentResolver resolver) {
        String[] projection = new String[] { MediaStore.MediaColumns._ID };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND "
            + MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?";
        String[] args = new String[] { FILE_NAME, "%" + FOLDER + "%" };
        try (Cursor cursor = resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            args,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                long id = cursor.getLong(0);
                return Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, String.valueOf(id));
            }
        } catch (Exception ignored) {
            // ignore
        }
        return null;
    }

    private static void saveLegacy(byte[] bytes) throws Exception {
        File dir = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            FOLDER
        );
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Cannot create backup folder");
        }
        try (FileOutputStream out = new FileOutputStream(new File(dir, FILE_NAME))) {
            out.write(bytes);
        }
    }

    private static String loadLegacy() throws Exception {
        File file = new File(
            new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                FOLDER
            ),
            FILE_NAME
        );
        if (!file.exists()) return null;
        try (FileInputStream in = new FileInputStream(file)) {
            return readAll(in);
        }
    }

    private static String readAll(InputStream in) throws Exception {
        byte[] buffer = new byte[8192];
        StringBuilder sb = new StringBuilder();
        int n;
        while ((n = in.read(buffer)) != -1) {
            sb.append(new String(buffer, 0, n, StandardCharsets.UTF_8));
        }
        return sb.toString();
    }
}
