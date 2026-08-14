package com.goblinthug.pillsnative.overlay;

import android.Manifest;
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
    @PluginMethod
    public void scheduleAll(PluginCall call) {
        try {
            JSArray pills = call.getArray("pills");
            JSObject settings = call.getObject("settings");
            AlarmStore.savePills(getContext(), pills == null ? new JSONArray() : new JSONArray(pills.toString()));
            AlarmStore.saveSettings(getContext(), settings == null ? new JSONObject() : new JSONObject(settings.toString()));
            requestNotificationsIfNeeded();
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
}
