package com.goblinthug.pillsnative.overlay;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "AlarmOverlay")
public class AlarmOverlayPlugin extends Plugin {
    void emitUpdateStatus(JSObject status) {
        notifyListeners("updateStatus", status);
    }

    @PluginMethod
    public void scheduleAll(PluginCall call) {
        try {
            JSArray pills = call.getArray("pills");
            JSObject settings = call.getObject("settings");
            AlarmStore.savePills(getContext(), pills == null ? new JSONArray() : new JSONArray(pills.toString()));
            AlarmStore.saveSettings(getContext(), settings == null ? new JSONObject() : new JSONObject(settings.toString()));
            requestNotificationsIfNeeded();
            requestFullScreenIfNeeded();
            AlarmScheduler.scheduleAll(getContext());
            KeepAliveService.start(getContext());
            call.resolve(statusObject());
        } catch (Exception error) {
            call.reject("Failed to schedule reminders", error);
        }
    }

    @PluginMethod
    public void startBackground(PluginCall call) {
        requestNotificationsIfNeeded();
        requestOverlayIfNeeded();
        requestFullScreenIfNeeded();
        KeepAliveService.start(getContext());
        AlarmScheduler.scheduleAll(getContext());
        call.resolve(statusObject());
    }

    private void requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getActivity() == null) return;
        if (NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) return;
        ActivityCompat.requestPermissions(
            getActivity(),
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            7101
        );
    }

    private void requestOverlayIfNeeded() {
        if (Settings.canDrawOverlays(getContext())) return;
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception ignored) {
            // ignore
        }
    }

    private void requestFullScreenIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return;
        try {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm == null || nm.canUseFullScreenIntent()) return;
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception ignored) {
            // ignore
        }
    }

    @PluginMethod
    public void snooze(PluginCall call) {
        String pillId = call.getString("pillId");
        Integer minutes = call.getInt("minutes", 5);
        JSONObject pill = AlarmStore.findPill(getContext(), pillId);
        OverlayService.stop(getContext());
        if (pill != null) {
            AlarmScheduler.scheduleSnooze(getContext(), pill, minutes == null ? 5 : minutes);
        }
        call.resolve();
    }

    @PluginMethod
    public void dismiss(PluginCall call) {
        OverlayService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        JSObject out = new JSObject();
        out.put("version", AppUpdater.currentVersion(getContext()));
        call.resolve(out);
    }

    @PluginMethod
    public void checkForUpdates(PluginCall call) {
        AppUpdater.check(this, call);
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        AppUpdater.download(this, call);
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        AppUpdater.install(this, call);
    }

    @PluginMethod
    public void openReleases(PluginCall call) {
        AppUpdater.openReleases(getContext());
        call.resolve();
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        try {
            String json = call.getString("json", "{}");
            DataBackup.save(getContext(), json);
            JSObject out = new JSObject();
            out.put("ok", true);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("Failed to save backup", error);
        }
    }

    @PluginMethod
    public void loadBackup(PluginCall call) {
        try {
            String json = DataBackup.load(getContext());
            JSObject out = new JSObject();
            out.put("json", json);
            out.put("found", json != null && !json.isEmpty());
            call.resolve(out);
        } catch (Exception error) {
            call.reject("Failed to load backup", error);
        }
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String kind = call.getString("kind", "overlay");
        try {
            if ("notifications".equals(kind)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getActivity() != null) {
                    ActivityCompat.requestPermissions(
                        getActivity(),
                        new String[] { Manifest.permission.POST_NOTIFICATIONS },
                        7101
                    );
                }
            } else if ("overlay".equals(kind)) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } else if ("fullscreen".equals(kind)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            } else if ("install".equals(kind)) {
                AppUpdater.requestInstallPermission(getActivity(), getContext());
            } else {
                openBackgroundSettings();
            }
            call.resolve(statusObject());
        } catch (Exception error) {
            call.reject("Failed to request permission", error);
        }
    }

    private void openBackgroundSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !AlarmScheduler.canScheduleExact(getContext())) {
                Intent exact = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                exact.setData(Uri.parse("package:" + getContext().getPackageName()));
                exact.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(exact);
                return;
            }
        } catch (Exception ignored) {
            // fall through to battery settings
        }

        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent battery = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                battery.setData(Uri.parse("package:" + getContext().getPackageName()));
                battery.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(battery);
                return;
            }
        } catch (Exception ignored) {
            // ignore
        }

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception ignored) {
            // ignore
        }
    }

    private JSObject statusObject() {
        JSObject status = new JSObject();
        status.put("platform", "android");
        status.put("overlay", Settings.canDrawOverlays(getContext()));
        status.put("notifications", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        status.put("exactAlarms", AlarmScheduler.canScheduleExact(getContext()));
        status.put("fullScreenIntent", canUseFullScreenIntent());
        status.put("installPackages", AppUpdater.canInstallPackages(getContext()));
        boolean background = true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null) {
                background = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        } catch (Exception ignored) {
            // ignore
        }
        status.put("background", background);
        return status;
    }

    private boolean canUseFullScreenIntent() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        try {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            return nm != null && nm.canUseFullScreenIntent();
        } catch (Exception error) {
            return false;
        }
    }
}
