package com.goblinthug.pillsnative.overlay;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-app updates from GitHub Releases (same source as desktop electron-updater).
 */
final class AppUpdater {
    private static final String OWNER = "GoblinThug";
    private static final String REPO = "pillsnative";
    private static final String LATEST_API =
        "https://api.github.com/repos/" + OWNER + "/" + REPO + "/releases/latest";
    private static final String RELEASES_URL =
        "https://github.com/" + OWNER + "/" + REPO + "/releases/latest";
    private static final Pattern APK_NAME =
        Pattern.compile("^PillsNative-android-(.+)\\.apk$", Pattern.CASE_INSENSITIVE);

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private AppUpdater() {}

    static String currentVersion(Context context) {
        try {
            PackageManager pm = context.getPackageManager();
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                info = pm.getPackageInfo(context.getPackageName(), PackageManager.PackageInfoFlags.of(0));
            } else {
                info = pm.getPackageInfo(context.getPackageName(), 0);
            }
            return info.versionName != null ? info.versionName : "0.0.0";
        } catch (Exception error) {
            return "0.0.0";
        }
    }

    static void check(AlarmOverlayPlugin plugin, PluginCall call) {
        EXECUTOR.execute(() -> {
            try {
                String current = currentVersion(plugin.getContext());
                JSONObject release = httpJson(LATEST_API);
                String tag = release.optString("tag_name", "");
                String remoteVersion = normalizeVersion(tag);
                JSONObject asset = findApkAsset(release.optJSONArray("assets"));
                if (asset == null) {
                    resolve(call, status("not-available", current, null, null));
                    return;
                }
                String assetVersion = apkVersionFromName(asset.optString("name", ""));
                if (assetVersion != null) remoteVersion = assetVersion;

                if (compareVersions(remoteVersion, current) <= 0) {
                    resolve(call, status("not-available", current, null, null));
                    return;
                }

                JSObject out = status("available", remoteVersion, asset.optString("browser_download_url", null), asset.optString("name", null));
                out.put("currentVersion", current);
                resolve(call, out);
            } catch (Exception error) {
                JSObject out = status("error", currentVersion(plugin.getContext()), null, null);
                out.put("code", "network");
                out.put("message", error.getMessage());
                resolve(call, out);
            }
        });
    }

    static void download(AlarmOverlayPlugin plugin, PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing APK download url");
            return;
        }
        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            try {
                emit(plugin, downloading(0));
                File apk = new File(plugin.getContext().getCacheDir(), "pillsnative-update.apk");
                if (apk.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                }

                connection = open(url);
                int code = connection.getResponseCode();
                if (code / 100 == 3) {
                    String redirect = connection.getHeaderField("Location");
                    connection.disconnect();
                    connection = open(redirect);
                    code = connection.getResponseCode();
                }
                if (code != 200) {
                    throw new IllegalStateException("HTTP " + code);
                }

                long total = connection.getContentLength();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    long modern = connection.getContentLengthLong();
                    if (modern > 0) total = modern;
                }
                try (InputStream in = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[8192];
                    long read = 0;
                    int n;
                    int lastPct = -1;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        read += n;
                        if (total > 0) {
                            int pct = (int) Math.min(100, (read * 100) / total);
                            if (pct != lastPct && (pct % 2 == 0 || pct == 100)) {
                                lastPct = pct;
                                emit(plugin, downloading(pct));
                            }
                        }
                    }
                    out.flush();
                }

                JSObject ready = status("ready", call.getString("version"), url, apk.getName());
                ready.put("path", apk.getAbsolutePath());
                ready.put("percent", 100);
                emit(plugin, ready);
                resolve(call, ready);
            } catch (Exception error) {
                JSObject out = status("error", null, url, null);
                out.put("code", "network");
                out.put("message", error.getMessage());
                emit(plugin, out);
                reject(call, "Failed to download update", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    static void install(AlarmOverlayPlugin plugin, PluginCall call) {
        Context context = plugin.getContext();
        File apk = new File(context.getCacheDir(), "pillsnative-update.apk");
        if (!apk.exists()) {
            call.reject("Update APK not found — download first");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settings.setData(Uri.parse("package:" + context.getPackageName()));
                    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settings);
                } catch (Exception ignored) {
                    // ignore
                }
                JSObject out = status("error", currentVersion(context), null, null);
                out.put("code", "permission");
                out.put("message", "Разрешите установку из этого приложения");
                call.resolve(out);
                return;
            }
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".alarmoverlay.fileprovider",
                apk
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.startActivity(intent);
            call.resolve(status("installing", currentVersion(context), null, apk.getName()));
        } catch (Exception error) {
            call.reject("Failed to start APK installer", error);
        }
    }

    static void openReleases(Context context) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(RELEASES_URL));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception ignored) {
            // ignore
        }
    }

    static boolean canInstallPackages(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return context.getPackageManager().canRequestPackageInstalls();
    }

    static void requestInstallPermission(Activity activity, Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (context.getPackageManager().canRequestPackageInstalls()) return;
        try {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            settings.setData(Uri.parse("package:" + context.getPackageName()));
            if (activity != null) {
                activity.startActivity(settings);
            } else {
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settings);
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    private static JSObject downloading(int percent) {
        JSObject out = status("downloading", null, null, null);
        out.put("percent", percent);
        return out;
    }

    private static JSObject status(String state, String version, String url, String name) {
        JSObject out = new JSObject();
        out.put("state", state);
        if (version != null) out.put("version", version);
        if (url != null) out.put("url", url);
        if (name != null) out.put("name", name);
        return out;
    }

    private static JSONObject findApkAsset(JSONArray assets) {
        if (assets == null) return null;
        for (int i = 0; i < assets.length(); i += 1) {
            JSONObject asset = assets.optJSONObject(i);
            if (asset == null) continue;
            String name = asset.optString("name", "");
            if (APK_NAME.matcher(name).matches()) return asset;
        }
        return null;
    }

    private static String apkVersionFromName(String name) {
        Matcher matcher = APK_NAME.matcher(name);
        if (!matcher.matches()) return null;
        return normalizeVersion(matcher.group(1));
    }

    private static String normalizeVersion(String raw) {
        if (raw == null) return "0.0.0";
        String value = raw.trim();
        if (value.startsWith("v") || value.startsWith("V")) value = value.substring(1);
        return value;
    }

    /** @return negative if a < b, 0 if equal, positive if a > b */
    static int compareVersions(String a, String b) {
        String[] left = normalizeVersion(a).split("[.-]");
        String[] right = normalizeVersion(b).split("[.-]");
        int n = Math.max(left.length, right.length);
        for (int i = 0; i < n; i += 1) {
            String ls = i < left.length ? left[i] : "0";
            String rs = i < right.length ? right[i] : "0";
            int cmp;
            try {
                cmp = Integer.compare(Integer.parseInt(ls), Integer.parseInt(rs));
            } catch (NumberFormatException error) {
                cmp = ls.compareToIgnoreCase(rs);
            }
            if (cmp != 0) return cmp;
        }
        return 0;
    }

    private static JSONObject httpJson(String url) throws Exception {
        HttpURLConnection connection = open(url);
        try {
            int code = connection.getResponseCode();
            InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw new IllegalStateException("HTTP " + code);
            String body = readAll(stream);
            if (code >= 400) throw new IllegalStateException("HTTP " + code + ": " + body);
            return new JSONObject(body);
        } finally {
            connection.disconnect();
        }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "PillsNative-Android-Updater");
        return connection;
    }

    private static String readAll(InputStream stream) throws Exception {
        try (BufferedInputStream in = new BufferedInputStream(stream)) {
            byte[] buffer = new byte[4096];
            StringBuilder sb = new StringBuilder();
            int n;
            while ((n = in.read(buffer)) != -1) {
                sb.append(new String(buffer, 0, n));
            }
            return sb.toString();
        }
    }

    private static void emit(AlarmOverlayPlugin plugin, JSObject status) {
        MAIN.post(() -> plugin.emitUpdateStatus(status));
    }

    private static void resolve(PluginCall call, JSObject value) {
        MAIN.post(() -> call.resolve(value));
    }

    private static void reject(PluginCall call, String message, Exception error) {
        MAIN.post(() -> call.reject(message, error));
    }
}
