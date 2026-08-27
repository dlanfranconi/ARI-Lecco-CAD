package com.arilecco.cad;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import java.util.concurrent.atomic.AtomicInteger;

// Exposed to the WebView as window.AndroidNotify so the page's own JS can
// reach a few native capabilities regardless of what origin it's currently
// showing. Capacitor's own JS bridge (window.Capacitor) is only injected on
// the bundled connect screen's origin, not on the remote dispatch server
// this WebView actually spends its time on, so plugins like
// LocalNotifications are silently unavailable there -- this plain WebView
// JS interface works regardless of the page's origin instead.
public class NotificationBridge {
    private static final String ALERT_CHANNEL_ID = "background_alerts";
    private static final AtomicInteger nextId = new AtomicInteger(200001);

    private final Context context;
    private final WebView webView;

    public NotificationBridge(Context context, WebView webView) {
        this.context = context.getApplicationContext();
        this.webView = webView;
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

    // The connect screen's own "remembered host" logic lives in localStorage
    // under the bundled https://localhost origin -- once the WebView has
    // navigated to the remote dispatch server, page JS there has no access
    // to that storage to clear it, so a plain reload of localhost would just
    // silently auto-reconnect right back to the same host. The ?change=1
    // flag tells mobile/www/index.html to skip that auto-connect and let the
    // user edit/replace the saved host instead.
    @JavascriptInterface
    public void changeServer() {
        webView.post(() -> webView.loadUrl("https://localhost/index.html?change=1"));
    }
}
