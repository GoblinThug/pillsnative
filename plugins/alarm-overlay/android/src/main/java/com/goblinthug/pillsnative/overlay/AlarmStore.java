package com.goblinthug.pillsnative.overlay;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AlarmStore {
    private static final String PREFS = "pillsnative.overlay";
    private static final String KEY_PILLS = "pills";
    private static final String KEY_SETTINGS = "settings";
    private static final String KEY_IDS = "scheduledIds";

    private AlarmStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void savePills(Context context, JSONArray pills) {
        prefs(context).edit().putString(KEY_PILLS, pills == null ? "[]" : pills.toString()).apply();
    }

    public static JSONArray getPills(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_PILLS, "[]"));
        } catch (Exception error) {
            return new JSONArray();
        }
    }

    public static void saveSettings(Context context, JSONObject settings) {
        prefs(context).edit().putString(KEY_SETTINGS, settings == null ? "{}" : settings.toString()).apply();
    }

    public static JSONObject getSettings(Context context) {
        try {
            JSONObject parsed = new JSONObject(prefs(context).getString(KEY_SETTINGS, "{}"));
            if (!parsed.has("alertMode")) parsed.put("alertMode", "both");
            if (!parsed.has("theme")) parsed.put("theme", "dark");
            if (!parsed.has("soundId")) parsed.put("soundId", "soft-marimba");
            return parsed;
        } catch (Exception error) {
            JSONObject fallback = new JSONObject();
            try {
                fallback.put("alertMode", "both");
                fallback.put("theme", "dark");
                fallback.put("soundId", "soft-marimba");
            } catch (Exception ignored) {
                // ignore
            }
            return fallback;
        }
    }

    public static String alertMode(Context context) {
        String mode = getSettings(context).optString("alertMode", "both");
        if ("overlay".equals(mode) || "notification".equals(mode) || "both".equals(mode)) {
            return mode;
        }
        return "both";
    }

    public static JSONObject findPill(Context context, String pillId) {
        JSONArray pills = getPills(context);
        for (int i = 0; i < pills.length(); i += 1) {
            JSONObject pill = pills.optJSONObject(i);
            if (pill != null && String.valueOf(pill.opt("id")).equals(String.valueOf(pillId))) {
                return pill;
            }
        }
        return null;
    }

    public static void saveScheduledIds(Context context, JSONArray ids) {
        prefs(context).edit().putString(KEY_IDS, ids == null ? "[]" : ids.toString()).apply();
    }

    public static JSONArray getScheduledIds(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_IDS, "[]"));
        } catch (Exception error) {
            return new JSONArray();
        }
    }

    public static int requestCode(String pillId, boolean snoozed) {
        int hash = String.valueOf(pillId).hashCode();
        int base = Math.abs(hash % 2000000000) + 1;
        return snoozed ? base + 17 : base;
    }
}
