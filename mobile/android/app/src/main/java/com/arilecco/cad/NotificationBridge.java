package com.arilecco.cad;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.webkit.JavascriptInterface;
import androidx.core.app.NotificationCompat;
import java.util.concurrent.atomic.AtomicInteger;

// Exposed to the WebView as window.AndroidNotify so the page's own JS can
// post a real Android notification while the app is in the foreground.
// Capacitor's own JS bridge (window.Capacitor) is only injected on the
// bundled connect screen's origin, not on the remote dispatch server this
// WebView actually spends its time on, so plugins like LocalNotifications
// are silently unavailable there -- this is a plain WebView JS interface
// instead, which works regardless of the page's origin. Used specifically
// so the /announcer page's active-alert sound has a real notification
// alongside it: a Web Audio/HTML5 <audio> beep always plays over Android's
// media volume stream with no way to route it through the notification
// stream from JS, but a genuine posted notification does.
public class NotificationBridge {
    private static final String ALERT_CHANNEL_ID = "background_alerts";
    private static final AtomicInteger nextId = new AtomicInteger(200001);

    private final Context context;

    public NotificationBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void postAlert(String title, String body) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager.getNotificationChannel(ALERT_CHANNEL_ID) == null) {
                manager.createNotificationChannel(new NotificationChannel(
                        ALERT_CHANNEL_ID, "Alerts", NotificationManager.IMPORTANCE_HIGH));
            }
        }
        // The WebView is already sitting on /announcer -- this only ever fires
        // from that page, right before it's backgrounded -- so tapping just
        // needs to bring the activity back to front, no deep link required.
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        int id = nextId.getAndIncrement();
        PendingIntent contentIntent = PendingIntent.getActivity(context, id, launchIntent, flags);

        Notification notification = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .build();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.notify(id, notification);
    }
}
