package com.goblinthug.pillsnative.overlay;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Shown via full-screen intent when the device is locked / screen is off.
 * This is more reliable on the lock screen than TYPE_APPLICATION_OVERLAY alone.
 */
public class AlarmFullScreenActivity extends Activity {
    private String pillId;
    private boolean snoozed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockScreen();

        pillId = getIntent() != null ? getIntent().getStringExtra(AlarmScheduler.EXTRA_PILL_ID) : null;
        snoozed = getIntent() != null && getIntent().getBooleanExtra(AlarmScheduler.EXTRA_SNOOZED, false);
        JSONObject pill = AlarmStore.findPill(this, pillId);
        if (pill == null) {
            finish();
            return;
        }

        setContentView(buildUi(pill, snoozed));
    }

    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        }
    }

    private FrameLayout buildUi(JSONObject pill, boolean snoozed) {
        boolean light = "light".equals(AlarmStore.getSettings(this).optString("theme", "dark"));
        int pageBg = light ? Color.parseColor("#E8ECF2") : Color.parseColor("#0B0B0F");
        int bg = light ? Color.parseColor("#F8F9FB") : Color.parseColor("#121216");
        int text = light ? Color.parseColor("#111827") : Color.parseColor("#F5F5F7");
        int muted = light ? Color.parseColor("#6B7280") : Color.parseColor("#A1A1AA");
        int accent = light ? Color.parseColor("#0071E3") : Color.parseColor("#0A84FF");
        int border = light ? Color.parseColor("#24101727") : Color.parseColor("#24FFFFFF");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(pageBg);
        root.setPadding(dp(20), dp(20), dp(20), dp(20));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(bg);
        cardBg.setCornerRadius(dp(18));
        cardBg.setStroke(dp(1), border);
        card.setBackground(cardBg);
        card.setElevation(dp(12));

        TextView eyebrow = new TextView(this);
        eyebrow.setText(snoozed ? "ОТЛОЖЕНО" : "ПОРА ПРИНЯТЬ");
        eyebrow.setTextColor(accent);
        eyebrow.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setLetterSpacing(0.06f);

        TextView title = new TextView(this);
        title.setText(pill.optString("drugName", "Лекарство"));
        title.setTextColor(text);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleLp.topMargin = dp(8);

        TextView meta = new TextView(this);
        String dosage = pill.optString("dosage", "");
        String time = pill.optString("time", "");
        meta.setText((dosage.isEmpty() ? "Без дозировки" : dosage) + (time.isEmpty() ? "" : "  ·  " + time));
        meta.setTextColor(muted);
        meta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams metaLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        metaLp.topMargin = dp(6);

        TextView desc = new TextView(this);
        String description = pill.optString("description", "");
        desc.setText(description.isEmpty()
            ? "Подтвердите приём. Экран разблокирован для напоминания."
            : description);
        desc.setTextColor(muted);
        desc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams descLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        descLp.topMargin = dp(12);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        actionsLp.topMargin = dp(18);

        Button snoozeBtn = makeButton("Отложить 5 мин", light ? Color.parseColor("#E8ECF2") : Color.parseColor("#24242C"), text);
        Button takenBtn = makeButton("Выпил таблетку", accent, Color.WHITE);
        LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        LinearLayout.LayoutParams takenLp = new LinearLayout.LayoutParams(0, dp(46), 1.15f);
        takenLp.leftMargin = dp(8);
        snoozeBtn.setOnClickListener(v -> sendAction(AlarmScheduler.ACTION_SNOOZE));
        takenBtn.setOnClickListener(v -> sendAction(AlarmScheduler.ACTION_TAKEN));
        actions.addView(snoozeBtn, snoozeLp);
        actions.addView(takenBtn, takenLp);

        card.addView(eyebrow);
        card.addView(title, titleLp);
        card.addView(meta, metaLp);
        card.addView(desc, descLp);
        card.addView(actions, actionsLp);

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        root.addView(card, cardLp);
        return root;
    }

    private Button makeButton(String label, int background, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(color);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(background);
        drawable.setCornerRadius(dp(10));
        button.setBackground(drawable);
        return button;
    }

    private void sendAction(String action) {
        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.setAction(action);
        intent.putExtra(AlarmScheduler.EXTRA_PILL_ID, pillId);
        intent.putExtra(AlarmScheduler.EXTRA_SNOOZED, snoozed);
        sendBroadcast(intent);
        finish();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        ));
    }
}
