package com.goblinthug.pillsnative.overlay;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public final class AlarmScheduler {
    public static final String ACTION_FIRE = "com.goblinthug.pillsnative.ALARM_FIRE";
    public static final String ACTION_TAKEN = "com.goblinthug.pillsnative.ALARM_TAKEN";
    public static final String ACTION_SNOOZE = "com.goblinthug.pillsnative.ALARM_SNOOZE";
    public static final String EXTRA_PILL_ID = "pillId";
    public static final String EXTRA_SNOOZED = "snoozed";

    private AlarmScheduler() {}

    public static void scheduleAll(Context context) {
        cancelAll(context);
        JSONArray pills = AlarmStore.getPills(context);
        JSONArray scheduled = new JSONArray();
        for (int i = 0; i < pills.length(); i += 1) {
            JSONObject pill = pills.optJSONObject(i);
            if (pill == null) continue;
            long when = nextTriggerMillis(pill, false);
            if (when <= 0) continue;
            int code = AlarmStore.requestCode(String.valueOf(pill.opt("id")), false);
            setExact(context, when, String.valueOf(pill.opt("id")), false, code);
            scheduled.put(code);
        }
        AlarmStore.saveScheduledIds(context, scheduled);
    }

    public static void scheduleSnooze(Context context, JSONObject pill, int minutes) {
        if (pill == null) return;
        String pillId = String.valueOf(pill.opt("id"));
        int code = AlarmStore.requestCode(pillId, true);
        long when = System.currentTimeMillis() + Math.max(1, minutes) * 60_000L;
        setExact(context, when, pillId, true, code);
    }

    public static void scheduleNextDaily(Context context, JSONObject pill) {
        if (pill == null || !pill.optBoolean("notifyDaily", false)) return;
        long when = nextTriggerMillis(pill, true);
        if (when <= 0) return;
        int code = AlarmStore.requestCode(String.valueOf(pill.opt("id")), false);
        setExact(context, when, String.valueOf(pill.opt("id")), false, code);
    }

    public static void cancelAll(Context context) {
        JSONArray ids = AlarmStore.getScheduledIds(context);
        for (int i = 0; i < ids.length(); i += 1) {
            cancel(context, ids.optInt(i, 0));
        }
        JSONArray pills = AlarmStore.getPills(context);
        for (int i = 0; i < pills.length(); i += 1) {
            JSONObject pill = pills.optJSONObject(i);
            if (pill == null) continue;
            String id = String.valueOf(pill.opt("id"));
            cancel(context, AlarmStore.requestCode(id, false));
            cancel(context, AlarmStore.requestCode(id, true));
        }
        AlarmStore.saveScheduledIds(context, new JSONArray());
    }

    public static boolean canScheduleExact(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return manager.canScheduleExactAlarms();
        }
        return true;
    }

    static long nextTriggerMillis(JSONObject pill, boolean skipTodayIfNow) {
        String time = pill.optString("time", "");
        if (time.length() < 4 || !time.contains(":")) return -1;
        String[] parts = time.split(":");
        int hour;
        int minute;
        try {
            hour = Integer.parseInt(parts[0]);
            minute = Integer.parseInt(parts[1]);
        } catch (Exception error) {
            return -1;
        }

        Calendar calendar = Calendar.getInstance();
        long now = System.currentTimeMillis();

        if (pill.optBoolean("notifyDaily", false)) {
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            if (calendar.getTimeInMillis() <= now || skipTodayIfNow) {
                calendar.add(Calendar.DAY_OF_YEAR, 1);
            }
            return calendar.getTimeInMillis();
        }

        String date = pill.optString("date", "");
        if (date.length() < 8) return -1;
        String[] dateParts = date.split("-");
        if (dateParts.length != 3) return -1;
        try {
            calendar.set(Calendar.YEAR, Integer.parseInt(dateParts[0]));
            calendar.set(Calendar.MONTH, Integer.parseInt(dateParts[1]) - 1);
            calendar.set(Calendar.DAY_OF_MONTH, Integer.parseInt(dateParts[2]));
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
        } catch (Exception error) {
            return -1;
        }
        if (calendar.getTimeInMillis() <= now) return -1;
        return calendar.getTimeInMillis();
    }

    private static void setExact(Context context, long when, String pillId, boolean snoozed, int requestCode) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        PendingIntent pending = pending(context, ACTION_FIRE, pillId, snoozed, requestCode);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
            } else {
                manager.setExact(AlarmManager.RTC_WAKEUP, when, pending);
            }
        } catch (SecurityException error) {
            manager.set(AlarmManager.RTC_WAKEUP, when, pending);
        }
    }

    static PendingIntent pending(Context context, String action, String pillId, boolean snoozed, int requestCode) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_PILL_ID, pillId);
        intent.putExtra(EXTRA_SNOOZED, snoozed);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }

    private static void cancel(Context context, int requestCode) {
        if (requestCode <= 0) return;
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        manager.cancel(pending(context, ACTION_FIRE, "cancel", false, requestCode));
    }
}
