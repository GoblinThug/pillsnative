package com.goblinthug.pillsnative.overlay;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;

final class CustomSounds {
    private static final String DIR = "custom-sounds";

    private CustomSounds() {}

    static File dir(Context context) {
        File folder = new File(context.getFilesDir(), DIR);
        if (!folder.exists()) folder.mkdirs();
        return folder;
    }

    static File fileFor(Context context, String fileName) {
        return new File(dir(context), fileName);
    }

    static JSONObject importFromUri(Context context, Uri uri) throws Exception {
        String displayName = queryDisplayName(context, uri);
        String mime = context.getContentResolver().getType(uri);
        String ext = extensionFor(displayName, mime);
        if (ext == null) {
            throw new IllegalArgumentException("Поддерживаются mp3, wav, ogg, m4a, aac, flac, webm");
        }

        String id = "custom-" + System.currentTimeMillis();
        String fileName = id + ext;
        File dest = fileFor(context, fileName);

        try (InputStream in = context.getContentResolver().openInputStream(uri);
             FileOutputStream out = new FileOutputStream(dest)) {
            if (in == null) throw new IllegalStateException("Не удалось открыть файл");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
        }

        String baseName = displayName;
        int dot = baseName.lastIndexOf('.');
        if (dot > 0) baseName = baseName.substring(0, dot);
        baseName = sanitizeName(baseName);

        JSONObject item = new JSONObject();
        item.put("id", id);
        item.put("name", baseName.isEmpty() ? "Свой звук" : baseName);
        item.put("file", fileName);
        item.put("path", dest.getAbsolutePath());
        return item;
    }

    static boolean delete(Context context, String id, String fileName) {
        boolean removed = false;
        if (fileName != null && !fileName.isEmpty()) {
            File direct = fileFor(context, fileName);
            if (direct.exists()) removed = direct.delete() || removed;
        }
        if (id != null && !id.isEmpty()) {
            File[] files = dir(context).listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.getName().startsWith(id)) {
                        removed = file.delete() || removed;
                    }
                }
            }
        }
        return removed;
    }

    static File resolvePlaybackFile(Context context, JSONObject settings) {
        String soundId = settings.optString("soundId", "soft-marimba");
        JSONArray customs = settings.optJSONArray("customSounds");
        if (customs != null) {
            for (int i = 0; i < customs.length(); i += 1) {
                JSONObject item = customs.optJSONObject(i);
                if (item == null) continue;
                if (!soundId.equals(item.optString("id"))) continue;
                String path = item.optString("path", "");
                if (!path.isEmpty()) {
                    File byPath = new File(path);
                    if (byPath.exists()) return byPath;
                }
                String file = item.optString("file", "");
                if (!file.isEmpty()) {
                    File byName = fileFor(context, file);
                    if (byName.exists()) return byName;
                }
            }
        }
        return null;
    }

    private static String queryDisplayName(Context context, Uri uri) {
        String name = "sound";
        try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && !value.trim().isEmpty()) name = value.trim();
                }
            }
        } catch (Exception ignored) {
            // ignore
        }
        return name;
    }

    private static String extensionFor(String displayName, String mime) {
        String lower = displayName == null ? "" : displayName.toLowerCase(Locale.US);
        if (lower.endsWith(".mp3")) return ".mp3";
        if (lower.endsWith(".wav")) return ".wav";
        if (lower.endsWith(".ogg")) return ".ogg";
        if (lower.endsWith(".m4a")) return ".m4a";
        if (lower.endsWith(".aac")) return ".aac";
        if (lower.endsWith(".flac")) return ".flac";
        if (lower.endsWith(".webm")) return ".webm";

        if (mime != null) {
            if (mime.contains("mpeg") || mime.contains("mp3")) return ".mp3";
            if (mime.contains("wav")) return ".wav";
            if (mime.contains("ogg")) return ".ogg";
            if (mime.contains("mp4") || mime.contains("m4a")) return ".m4a";
            if (mime.contains("aac")) return ".aac";
            if (mime.contains("flac")) return ".flac";
            if (mime.contains("webm")) return ".webm";
            String fromMime = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (fromMime != null && !fromMime.isEmpty()) return "." + fromMime;
        }
        return null;
    }

    private static String sanitizeName(String value) {
        String cleaned = value.replaceAll("[\\\\/:*?\"<>|]+", " ").trim();
        if (cleaned.length() > 48) cleaned = cleaned.substring(0, 48).trim();
        return cleaned;
    }
}
