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
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

public class AlarmFullScreenActivity extends Activity {
    private String pillIds;
    private boolean snoozed;
    private View cardView;
    private float touchStartX;
    private float touchStartY;
    private float cardStartTranslationX;
    private float cardStartTranslationY;
    private boolean swiping;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockScreen();

        pillIds = getIntent() != null ? getIntent().getStringExtra(AlarmScheduler.EXTRA_PILL_IDS) : null;
        if (pillIds == null || pillIds.isEmpty()) {
            pillIds = getIntent() != null ? getIntent().getStringExtra(AlarmScheduler.EXTRA_PILL_ID) : null;
        }
        snoozed = getIntent() != null && getIntent().getBooleanExtra(AlarmScheduler.EXTRA_SNOOZED, false);
        JSONArray pills = AlarmStore.findPills(this, pillIds);
        if (pills.length() == 0) {
            finish();
            return;
        }

        setContentView(buildUi(pills, snoozed));
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

    private FrameLayout buildUi(JSONArray pills, boolean snoozed) {
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
        cardView = card;
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(bg);
        cardBg.setCornerRadius(dp(18));
        cardBg.setStroke(dp(1), border);
        card.setBackground(cardBg);
        card.setElevation(dp(12));

        TextView hint = new TextView(this);
        hint.setText("Свайпни, чтобы закрыть");
        hint.setTextColor(muted);
        hint.setGravity(Gravity.CENTER_HORIZONTAL);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);

        TextView eyebrow = new TextView(this);
        eyebrow.setText(snoozed ? "ОТЛОЖЕНО" : (pills.length() > 1 ? "ПОРА ПРИНЯТЬ (" + pills.length() + ")" : "ПОРА ПРИНЯТЬ"));
        eyebrow.setTextColor(accent);
        eyebrow.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setLetterSpacing(0.06f);
        LinearLayout.LayoutParams eyebrowLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        eyebrowLp.topMargin = dp(10);

        TextView title = new TextView(this);
        title.setText(pills.length() == 1
            ? pills.optJSONObject(0).optString("drugName", "Лекарство")
            : "Приём " + pills.length() + " препаратов");
        title.setTextColor(text);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleLp.topMargin = dp(8);

        TextView meta = new TextView(this);
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < pills.length(); i += 1) {
            JSONObject pill = pills.optJSONObject(i);
            if (pill == null) continue;
            if (body.length() > 0) body.append('\n');
            String name = pill.optString("drugName", "Лекарство");
            String dosage = pill.optString("dosage", "");
            body.append("• ").append(dosage.isEmpty() ? name : name + " — " + dosage);
        }
        meta.setText(body.toString());
        meta.setTextColor(muted);
        meta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams metaLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        metaLp.topMargin = dp(10);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        actionsLp.topMargin = dp(18);

        Button snoozeBtn = makeButton("Отложить 5 мин", light ? Color.parseColor("#E8ECF2") : Color.parseColor("#24242C"), text);
        Button takenBtn = makeButton(pills.length() > 1 ? "Выпил все" : "Выпил таблетку", accent, Color.WHITE);
        LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        LinearLayout.LayoutParams takenLp = new LinearLayout.LayoutParams(0, dp(46), 1.15f);
        takenLp.leftMargin = dp(8);
        snoozeBtn.setOnClickListener(v -> sendAction(AlarmScheduler.ACTION_SNOOZE));
        takenBtn.setOnClickListener(v -> sendAction(AlarmScheduler.ACTION_TAKEN));
        actions.addView(snoozeBtn, snoozeLp);
        actions.addView(takenBtn, takenLp);

        card.addView(hint);
        card.addView(eyebrow, eyebrowLp);
        card.addView(title, titleLp);
        card.addView(meta, metaLp);
        card.addView(actions, actionsLp);
        enableSwipeToDismiss(card);

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        root.addView(card, cardLp);
        return root;
    }

    @Override
    public void onBackPressed() {
        sendAction(AlarmScheduler.ACTION_DISMISS);
    }

    private void enableSwipeToDismiss(View card) {
        card.setOnTouchListener((v, event) -> {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    touchStartX = event.getRawX();
                    touchStartY = event.getRawY();
                    cardStartTranslationX = card.getTranslationX();
                    cardStartTranslationY = card.getTranslationY();
                    swiping = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = event.getRawX() - touchStartX;
                    float dy = event.getRawY() - touchStartY;
                    if (!swiping && (Math.abs(dx) > dp(8) || Math.abs(dy) > dp(8))) {
                        swiping = true;
                    }
                    if (!swiping) return true;
                    card.setTranslationX(cardStartTranslationX + dx);
                    card.setTranslationY(cardStartTranslationY + dy);
                    float distance = (float) Math.hypot(dx, dy);
                    card.setAlpha(Math.max(0.35f, 1f - distance / dp(240)));
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL: {
                    float dx = event.getRawX() - touchStartX;
                    float dy = event.getRawY() - touchStartY;
                    float distance = (float) Math.hypot(dx, dy);
                    if (swiping && distance > dp(90)) {
                        sendAction(AlarmScheduler.ACTION_DISMISS);
                        return true;
                    }
                    if (!swiping && event.getActionMasked() == MotionEvent.ACTION_UP) {
                        View target = findClickableChild((ViewGroup) card, event.getX(), event.getY());
                        if (target != null) target.performClick();
                    }
                    card.animate()
                        .translationX(0f)
                        .translationY(0f)
                        .alpha(1f)
                        .setDuration(160)
                        .start();
                    swiping = false;
                    return true;
                }
                default:
                    return false;
            }
        });
    }

    private View findClickableChild(ViewGroup parent, float x, float y) {
        for (int i = parent.getChildCount() - 1; i >= 0; i -= 1) {
            View child = parent.getChildAt(i);
            if (x < child.getLeft() || x > child.getRight() || y < child.getTop() || y > child.getBottom()) {
                continue;
            }
            float localX = x - child.getLeft();
            float localY = y - child.getTop();
            if (child instanceof ViewGroup) {
                View nested = findClickableChild((ViewGroup) child, localX, localY);
                if (nested != null) return nested;
            }
            if (child instanceof Button || child.isClickable()) {
                return child;
            }
        }
        return null;
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
        intent.putExtra(AlarmScheduler.EXTRA_PILL_IDS, pillIds);
        intent.putExtra(AlarmScheduler.EXTRA_PILL_ID, AlarmScheduler.firstId(pillIds));
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
