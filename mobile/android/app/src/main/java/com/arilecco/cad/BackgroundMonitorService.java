package com.arilecco.cad;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

// Keeps the app reacting to live events (new pending notice, device status
// changes) while backgrounded but not fully closed. This can't be done by
// just keeping MainActivity's process alive with a foreground service and
// letting the WebView's own JS (native-notify.js) handle it -- Android
// freezes the WebView's separate renderer process a few seconds after the
// Activity stops being visible, independent of this service's foreground
// state, so that JS simply stops running. Instead this service opens its
// own native WebSocket connections (mirroring /ws/review and /ws/network's
// message shapes -- see app/main.py) and fires notifications directly,
// bypassing the WebView entirely for this one purpose.
public class BackgroundMonitorService extends Service {
    public static final String EXTRA_HOST = "host";
    public static final String EXTRA_SCHEME = "scheme";
    public static final String EXTRA_USER_ID = "user_id";
    public static final String EXTRA_IS_ADMIN = "is_admin";
    public static final String EXTRA_IN_SPEAKER_GROUP = "in_speaker_group";
    public static final String EXTRA_PUSH_MUTED = "push_muted";

    private static final String STATUS_CHANNEL_ID = "background_monitor";
    private static final String ALERT_CHANNEL_ID = "background_alerts";
    private static final int STATUS_NOTIFICATION_ID = 1001;

    private final AtomicInteger nextAlertId = new AtomicInteger(2000);
    private OkHttpClient client;
    private WebSocket reviewSocket;
    private WebSocket networkSocket;
    private WebSocket announcerSocket;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannelsIfNeeded();
        Notification notification = new NotificationCompat.Builder(this, STATUS_CHANNEL_ID)
                .setContentTitle(getString(R.string.app_name))
                .setContentText("Monitoring active")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
        startForeground(STATUS_NOTIFICATION_ID, notification);
        client = new OkHttpClient.Builder().pingInterval(30, TimeUnit.SECONDS).build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String host = intent.getStringExtra(EXTRA_HOST);
        String scheme = intent.getStringExtra(EXTRA_SCHEME);
        int userId = intent.getIntExtra(EXTRA_USER_ID, -1);
        boolean isAdmin = intent.getBooleanExtra(EXTRA_IS_ADMIN, false);
        boolean inSpeakerGroup = intent.getBooleanExtra(EXTRA_IN_SPEAKER_GROUP, false);
        boolean pushMuted = intent.getBooleanExtra(EXTRA_PUSH_MUTED, false);
        if (host != null && scheme != null) {
            connect(host, scheme, userId, isAdmin, inSpeakerGroup, pushMuted);
        }
        return START_STICKY;
    }

    private void connect(String host, String scheme, int userId, boolean isAdmin, boolean inSpeakerGroup, boolean pushMuted) {
        closeSockets();
        String wsScheme = "https".equals(scheme) ? "wss" : "ws";

        reviewSocket = client.newWebSocket(
            new Request.Builder().url(wsScheme + "://" + host + "/ws/review").build(),
            new WebSocketListener() {
                @Override
                public void onMessage(WebSocket webSocket, String text) {
                    handleReviewMessage(text, isAdmin);
                }
            }
        );

        networkSocket = client.newWebSocket(
            new Request.Builder().url(wsScheme + "://" + host + "/ws/network").build(),
            new WebSocketListener() {
                @Override
                public void onMessage(WebSocket webSocket, String text) {
                    handleNetworkMessage(text, userId, isAdmin);
                }
            }
        );

        announcerSocket = client.newWebSocket(
            new Request.Builder().url(wsScheme + "://" + host + "/ws/announcer").build(),
            new WebSocketListener() {
                @Override
                public void onMessage(WebSocket webSocket, String text) {
                    if (!pushMuted) handleAnnouncerMessage(text, userId, inSpeakerGroup);
                }
            }
        );
    }

    private void handleReviewMessage(String text, boolean isAdmin) {
        if (!isAdmin) return;
        try {
            JSONObject payload = new JSONObject(text);
            String type = payload.optString("type");
            if ("pending_notice".equals(type) || "pending_bulletin".equals(type)) {
                JSONObject notice = payload.optJSONObject("notice");
                if (notice == null) notice = payload.optJSONObject("bulletin");
                String body = notice != null ? notice.optString("message", "") : "";
                notify("New notice pending review", body);
            } else if ("race_timer_changed".equals(type)) {
                notify("Race timer updated", "");
            }
        } catch (Exception ignored) {
            // Malformed/unexpected payload; skip rather than crash the service.
        }
    }

    private void handleNetworkMessage(String text, int userId, boolean isAdmin) {
        try {
            JSONObject payload = new JSONObject(text);
            if (!"device_status".equals(payload.optString("type"))) return;
            JSONObject device = payload.optJSONObject("device");
            if (device == null) return;

            JSONArray recipients = device.optJSONArray("recipient_user_ids");
            boolean isRecipient = false;
            if (recipients == null || recipients.length() == 0) {
                isRecipient = isAdmin;
            } else {
                for (int i = 0; i < recipients.length(); i++) {
                    if (recipients.optInt(i) == userId) {
                        isRecipient = true;
                        break;
                    }
                }
            }
            if (!isRecipient) return;

            String status = device.optString("status");
            String name = device.optString("name");
            boolean down = "down".equals(status);
            notify(down ? "Device offline" : "Device back online", name);
        } catch (Exception ignored) {
            // Malformed/unexpected payload; skip rather than crash the service.
        }
    }

    private void handleAnnouncerMessage(String text, int userId, boolean inSpeakerGroup) {
        try {
            JSONObject payload = new JSONObject(text);
            if (!"notice".equals(payload.optString("type"))) return;
            JSONObject notice = payload.optJSONObject("notice");
            if (notice == null) return;

            JSONArray recipients = notice.optJSONArray("recipient_user_ids");
            boolean isRecipient;
            if (notice.optBoolean("broadcast_all", false)) {
                isRecipient = true;
            } else if (recipients == null || recipients.length() == 0) {
                isRecipient = inSpeakerGroup;
            } else {
                isRecipient = false;
                for (int i = 0; i < recipients.length(); i++) {
                    if (recipients.optInt(i) == userId) {
                        isRecipient = true;
                        break;
                    }
                }
            }
            if (!isRecipient) return;

            notify("New announcement", notice.optString("message", ""));
        } catch (Exception ignored) {
            // Malformed/unexpected payload; skip rather than crash the service.
        }
    }

    private void notify(String title, String body) {
        Notification notification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(nextAlertId.getAndIncrement(), notification);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        closeSockets();
    }

    private void closeSockets() {
        if (reviewSocket != null) reviewSocket.close(1000, null);
        if (networkSocket != null) networkSocket.close(1000, null);
        if (announcerSocket != null) announcerSocket.close(1000, null);
    }

    private void createChannelsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(
                    STATUS_CHANNEL_ID, "Background Monitoring", NotificationManager.IMPORTANCE_LOW));
            manager.createNotificationChannel(new NotificationChannel(
                    ALERT_CHANNEL_ID, "Alerts", NotificationManager.IMPORTANCE_HIGH));
        }
    }
}
