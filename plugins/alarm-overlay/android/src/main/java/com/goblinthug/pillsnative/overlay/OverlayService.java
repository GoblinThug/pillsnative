package com.goblinthug.pillsnative.overlay;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

public class OverlayService extends Service {
    public static final String CHANNEL_ALARM = "pills-alarms-lock";
    public static final String CHANNEL_ENGINE = "pills-overlay-engine";
    private static final int ENGINE_NOTIFICATION_ID = 1102;

    private WindowManager windowManager;
    private View overlayView;
    private MediaPlayer mediaPlayer;
    private String activePillId;
    private boolean activeSnoozed;

    public static void start(Context context, String pillId, boolean snoozed) {
        Intent intent = new Intent(context, OverlayService.class);
        intent.putExtra(AlarmScheduler.EXTRA_PILL_ID, pillId);
        intent.putExtra(AlarmScheduler.EXTRA_SNOOZED, snoozed);
        AlarmReceiver.startService(context, intent);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, OverlayService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannels();
        String pillId = intent != null ? intent.getStringExtra(AlarmScheduler.EXTRA_PILL_ID) : null;
        boolean snoozed = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_SNOOZED, false);
        JSONObject pill = AlarmStore.findPill(this, pillId);
        if (pill == null) {
            startForeground(ENGINE_NOTIFICATION_ID, engineNotification("Напоминание", "Пора принять лекарство"));
            stopSelf();
            return START_NOT_STICKY;
        }

        activePillId = String.valueOf(pill.opt("id"));
        activeSnoozed = snoozed;
        String mode = AlarmStore.alertMode(this);
        boolean wantsOverlay = "overlay".equals(mode) || "both".equals(mode);
        boolean wantsNotification = "notification".equals(mode) || "both".equals(mode);
        boolean canOverlay = Settings.canDrawOverlays(this);
        boolean lockedOrOff = isLockedOrScreenOff();

        if (wantsOverlay && !canOverlay) {
            wantsNotification = true;
        }

        // Lock-screen overlay is unreliable on many OEMs — use full-screen activity instead.
        boolean showOverlayNow = wantsOverlay && canOverlay && !lockedOrOff;
        boolean useFullScreenIntent = lockedOrOff || !showOverlayNow;
        int alarmId = AlarmStore.requestCode(activePillId, snoozed);

        if (wantsNotification || lockedOrOff || useFullScreenIntent) {
            startForeground(alarmId, buildAlarmNotification(pill, snoozed, useFullScreenIntent));
        } else {
            startForeground(ENGINE_NOTIFICATION_ID, engineNotification(
                snoozed ? "Отложенное напоминание" : "Пора принять лекарство",
                pillLabel(pill)
            ));
        }

        if (lockedOrOff) {
            launchFullScreenActivity(activePillId, snoozed);
        } else if (showOverlayNow) {
            showOverlay(pill, snoozed);
        }

        if (showOverlayNow || lockedOrOff || !wantsNotification) {
            playSound(AlarmStore.getSettings(this).optString("soundId", "soft-marimba"));
        }
        vibrate();
        return START_STICKY;
    }

    private boolean isLockedOrScreenOff() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) return true;
        } catch (Exception ignored) {
            // ignore
        }
        try {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) return true;
        } catch (Exception ignored) {
            // ignore
        }
        return false;
    }

    private void launchFullScreenActivity(String pillId, boolean snoozed) {
        try {
            Intent launch = new Intent(this, AlarmFullScreenActivity.class);
            launch.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_NO_USER_ACTION
            );
            launch.putExtra(AlarmScheduler.EXTRA_PILL_ID, pillId);
            launch.putExtra(AlarmScheduler.EXTRA_SNOOZED, snoozed);
            startActivity(launch);
        } catch (Exception ignored) {
            // Full-screen intent notification remains as fallback.
        }
    }

    @Override
    public void onDestroy() {
        removeOverlay();
        stopSound();
        super.onDestroy();
    }

    private void showOverlay(JSONObject pill, boolean snoozed) {
        removeOverlay();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) return;

        boolean light = "light".equals(AlarmStore.getSettings(this).optString("theme", "dark"));
        int bg = light ? Color.parseColor("#F8F9FB") : Color.parseColor("#121216");
        int text = light ? Color.parseColor("#111827") : Color.parseColor("#F5F5F7");
        int muted = light ? Color.parseColor("#6B7280") : Color.parseColor("#A1A1AA");
        int accent = light ? Color.parseColor("#0071E3") : Color.parseColor("#0A84FF");
        int border = light ? Color.parseColor("#24101727") : Color.parseColor("#24FFFFFF");

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        int cardPad = dp(16);
        card.setPadding(cardPad, cardPad, cardPad, cardPad);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(bg);
        cardBg.setCornerRadius(dp(18));
        cardBg.setStroke(dp(1), border);
        card.setBackground(cardBg);
        card.setElevation(dp(18));

        TextView eyebrow = new TextView(this);
        eyebrow.setText(snoozed ? "ОТЛОЖЕНО" : "ПОРА ПРИНЯТЬ");
        eyebrow.setTextColor(accent);
        eyebrow.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setLetterSpacing(0.06f);

        TextView title = new TextView(this);
        title.setText(pill.optString("drugName", "Лекарство"));
        title.setTextColor(text);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleLp.topMargin = dp(6);

        TextView meta = new TextView(this);
        String dosage = pill.optString("dosage", "");
        String time = pill.optString("time", "");
        meta.setText((dosage.isEmpty() ? "Без дозировки" : dosage) + (time.isEmpty() ? "" : "  ·  " + time));
        meta.setTextColor(muted);
        meta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams metaLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        metaLp.topMargin = dp(4);

        TextView desc = new TextView(this);
        String description = pill.optString("description", "");
        desc.setText(description.isEmpty() ? "Подтвердите приём, когда выпьете препарат." : description);
        desc.setTextColor(muted);
        desc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        LinearLayout.LayoutParams descLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        descLp.topMargin = dp(10);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actionsLp.topMargin = dp(14);

        Button snooze = makeButton("Отложить 5 мин", light ? Color.parseColor("#E8ECF2") : Color.parseColor("#24242C"), text);
        Button taken = makeButton("Выпил таблетку", accent, Color.WHITE);
        LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(0, dp(42), 1f);
        LinearLayout.LayoutParams takenLp = new LinearLayout.LayoutParams(0, dp(42), 1.15f);
        takenLp.leftMargin = dp(8);
        snooze.setOnClickListener(v -> handleAction(AlarmScheduler.ACTION_SNOOZE));
        taken.setOnClickListener(v -> handleAction(AlarmScheduler.ACTION_TAKEN));
        actions.addView(snooze, snoozeLp);
        actions.addView(taken, takenLp);

        card.addView(eyebrow);
        card.addView(title, titleLp);
        card.addView(meta, metaLp);
        card.addView(desc, descLp);
        card.addView(actions, actionsLp);

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int width = Math.min(dp(360), Math.max(dp(280), screenWidth - dp(32)));
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_INSET_DECOR
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.CENTER;
        params.x = 0;
        params.y = 0;

        try {
            windowManager.addView(card, params);
            overlayView = card;
        } catch (Exception error) {
            overlayView = null;
        }
    }

    private Button makeButton(String label, int background, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(color);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(background);
        drawable.setCornerRadius(dp(10));
        button.setBackground(drawable);
        return button;
    }

    private Notification buildAlarmNotification(JSONObject pill, boolean snoozed, boolean fullScreen) {
        String title = snoozed ? "Отложенное напоминание" : "Пора принять лекарство";
        String body = pillLabel(pill);
        int id = AlarmStore.requestCode(String.valueOf(pill.opt("id")), snoozed);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, "Отложить 5 мин", actionPending(AlarmScheduler.ACTION_SNOOZE, pill, snoozed, id + 3))
            .addAction(0, "Выпил таблетку", actionPending(AlarmScheduler.ACTION_TAKEN, pill, snoozed, id + 4));

        Intent contentLaunch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

        if (contentLaunch != null) {
            contentLaunch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            contentLaunch.putExtra(AlarmScheduler.EXTRA_PILL_ID, String.valueOf(pill.opt("id")));
            builder.setContentIntent(PendingIntent.getActivity(this, id + 5, contentLaunch, flags));
        }

        if (fullScreen) {
            Intent full = new Intent(this, AlarmFullScreenActivity.class);
            full.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_NO_USER_ACTION
            );
            full.putExtra(AlarmScheduler.EXTRA_PILL_ID, String.valueOf(pill.opt("id")));
            full.putExtra(AlarmScheduler.EXTRA_SNOOZED, snoozed);
            builder.setFullScreenIntent(PendingIntent.getActivity(this, id + 6, full, flags), true);
        }

        return builder.build();
    }

    private PendingIntent actionPending(String action, JSONObject pill, boolean snoozed, int requestCode) {
        return AlarmScheduler.pending(this, action, String.valueOf(pill.opt("id")), snoozed, requestCode);
    }

    private void handleAction(String action) {
        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.setAction(action);
        intent.putExtra(AlarmScheduler.EXTRA_PILL_ID, activePillId);
        intent.putExtra(AlarmScheduler.EXTRA_SNOOZED, activeSnoozed);
        sendBroadcast(intent);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null && activePillId != null) {
            manager.cancel(AlarmStore.requestCode(activePillId, activeSnoozed));
            manager.cancel(ENGINE_NOTIFICATION_ID);
        }
        stopSelf();
    }

    private void playSound(String soundId) {
        stopSound();
        String file = soundFile(soundId);
        try {
            mediaPlayer = new MediaPlayer();
            AssetFileDescriptor afd = getAssets().openFd("public/assets/sounds/" + file);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            }
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception error) {
            stopSound();
        }
    }

    private void stopSound() {
        if (mediaPlayer == null) return;
        try {
            mediaPlayer.stop();
        } catch (Exception ignored) {
            // ignore
        }
        mediaPlayer.release();
        mediaPlayer = null;
    }

    private void vibrate() {
        long[] pattern = new long[] { 0, 400, 180, 400, 180, 520 };
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
                if (manager != null) {
                    manager.getDefaultVibrator().vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            } else {
                Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator == null) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    private void removeOverlay() {
        if (windowManager != null && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
                // already detached
            }
        }
        overlayView = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
                if (manager != null) manager.getDefaultVibrator().cancel();
            } else {
                Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null) vibrator.cancel();
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ALARM) == null) {
            NotificationChannel alarm = new NotificationChannel(
                CHANNEL_ALARM,
                "Напоминания о лекарствах",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarm.setDescription("Показывается на экране блокировки и поверх других приложений");
            alarm.enableVibration(true);
            alarm.setVibrationPattern(new long[] { 0, 400, 180, 400, 180, 520 });
            alarm.enableLights(true);
            alarm.setLightColor(Color.parseColor("#0A84FF"));
            alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alarm.setBypassDnd(true);
            alarm.setShowBadge(true);
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                alarm.setSound(sound, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            } else {
                alarm.setSound(sound, null);
            }
            manager.createNotificationChannel(alarm);
        }
        if (manager.getNotificationChannel(CHANNEL_ENGINE) == null) {
            NotificationChannel engine = new NotificationChannel(
                CHANNEL_ENGINE,
                "Окно напоминания",
                NotificationManager.IMPORTANCE_MIN
            );
            engine.setDescription("Служебный канал для окна поверх приложений");
            engine.setShowBadge(false);
            manager.createNotificationChannel(engine);
        }
    }

    private Notification engineNotification(String title, String body) {
        return new NotificationCompat.Builder(this, CHANNEL_ENGINE)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();
    }

    private static String pillLabel(JSONObject pill) {
        String name = pill.optString("drugName", "Лекарство");
        String dosage = pill.optString("dosage", "");
        return dosage.isEmpty() ? name : name + " — " + dosage;
    }

    private static String soundFile(String soundId) {
        if (soundId == null || soundId.isEmpty()) return "soft-marimba.wav";
        return soundId + ".wav";
    }

    private int overlayType() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        }
        return WindowManager.LayoutParams.TYPE_PHONE;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        ));
    }
}
