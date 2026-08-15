package com.goblinthug.pillsnative.overlay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AlarmScheduler.scheduleAll(context);
            KeepAliveService.start(context);
            return;
        }

        String pillIds = intent.getStringExtra(AlarmScheduler.EXTRA_PILL_IDS);
        if (pillIds == null || pillIds.isEmpty()) {
            pillIds = intent.getStringExtra(AlarmScheduler.EXTRA_PILL_ID);
        }
        boolean snoozed = intent.getBooleanExtra(AlarmScheduler.EXTRA_SNOOZED, false);
        JSONArray pills = AlarmStore.findPills(context, pillIds);

        if (AlarmScheduler.ACTION_SNOOZE.equals(action)) {
            OverlayService.stop(context);
            if (pills.length() > 0) AlarmScheduler.scheduleSnooze(context, pillIds, 5);
            return;
        }

        if (AlarmScheduler.ACTION_TAKEN.equals(action)
            || AlarmScheduler.ACTION_DISMISS.equals(action)) {
            OverlayService.stop(context);
            return;
        }

        if (AlarmScheduler.ACTION_FIRE.equals(action)) {
            if (pills.length() == 0) return;
            wakeScreen(context);
            if (!snoozed) {
                for (int i = 0; i < pills.length(); i += 1) {
                    JSONObject pill = pills.optJSONObject(i);
                    if (pill != null && pill.optBoolean("notifyDaily", false)) {
                        AlarmScheduler.scheduleNextDaily(context, pill);
                    }
                }
            }
            OverlayService.start(context, pillIds, snoozed);
        }
    }

    private static void wakeScreen(Context context) {
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock lock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK
                    | PowerManager.ACQUIRE_CAUSES_WAKEUP
                    | PowerManager.ON_AFTER_RELEASE,
                "pillsnative:alarm"
            );
            lock.acquire(15000L);
        } catch (Exception ignored) {
            // ignore
        }
    }

    static void startService(Context context, Intent intent) {
        intent.setPackage(context.getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }
}
