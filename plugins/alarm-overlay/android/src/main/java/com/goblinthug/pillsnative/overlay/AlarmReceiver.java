package com.goblinthug.pillsnative.overlay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

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

        String pillId = intent.getStringExtra(AlarmScheduler.EXTRA_PILL_ID);
        boolean snoozed = intent.getBooleanExtra(AlarmScheduler.EXTRA_SNOOZED, false);
        JSONObject pill = AlarmStore.findPill(context, pillId);

        if (AlarmScheduler.ACTION_SNOOZE.equals(action)) {
            OverlayService.stop(context);
            if (pill != null) AlarmScheduler.scheduleSnooze(context, pill, 5);
            return;
        }

        if (AlarmScheduler.ACTION_TAKEN.equals(action)) {
            OverlayService.stop(context);
            return;
        }

        if (AlarmScheduler.ACTION_FIRE.equals(action)) {
            if (pill == null) return;
            if (pill.optBoolean("notifyDaily", false) && !snoozed) {
                AlarmScheduler.scheduleNextDaily(context, pill);
            }
            OverlayService.start(context, pillId, snoozed);
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
