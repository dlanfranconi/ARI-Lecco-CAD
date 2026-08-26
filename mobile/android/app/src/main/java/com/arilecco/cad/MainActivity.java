package com.arilecco.cad;

import android.app.DownloadManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long EXIT_WINDOW_MS = 2000;
    private long lastBackPressTime = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Apps targeting API 35+ get edge-to-edge by default, which lets the
        // WebView draw its content underneath the status bar / camera cutout
        // instead of below it. Restoring the pre-35 fitting behavior here is
        // simpler and more reliable than trying to replicate it with
        // safe-area-inset CSS alone (the WebView doesn't always report those
        // insets correctly without this).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // Stock WebView has no idea what to do with a navigation that
        // resolves to a file download (CSV/GeoJSON exports, race archives)
        // -- without this listener it just silently does nothing, no error,
        // no file, no feedback. Hand those off to the system DownloadManager
        // instead, forwarding the session cookie so the authenticated
        // request actually succeeds.
        WebView downloadWebView = getBridge() != null ? getBridge().getWebView() : null;
        if (downloadWebView != null) {
            downloadWebView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) request.addRequestHeader("Cookie", cookie);
                    request.addRequestHeader("User-Agent", userAgent);
                    String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setMimeType(mimeType);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    DownloadManager downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    downloadManager.enqueue(request);
                    Toast.makeText(MainActivity.this, "Downloading " + filename, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // Overriding the deprecated Activity.onBackPressed() is unreliable on
        // modern Android: with predictive back (API 33+, which this app's
        // targetSdk enables by default), the system can handle the back
        // gesture entirely through OnBackInvokedCallback without ever calling
        // that method — which is exactly why the previous version of this fix
        // didn't actually take effect. OnBackPressedCallback via the
        // activity's own dispatcher is the API guaranteed to be consulted on
        // every Android version.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                String currentUrl = webView != null ? webView.getUrl() : null;

                if (currentUrl != null) {
                    Uri uri = Uri.parse(currentUrl);
                    // Capacitor serves the bundled connect screen from https://localhost/... —
                    // the real dispatch server is never actually named "localhost", so this
                    // reliably tells the two apart.
                    boolean onConnectScreen = "localhost".equals(uri.getHost());
                    String path = uri.getPath();
                    boolean atHome = onConnectScreen || path == null || path.isEmpty() || "/".equals(path);

                    if (!atHome) {
                        webView.loadUrl(uri.getScheme() + "://" + uri.getAuthority() + "/");
                        return;
                    }
                }

                long now = System.currentTimeMillis();
                if (now - lastBackPressTime < EXIT_WINDOW_MS) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                } else {
                    lastBackPressTime = now;
                    Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private boolean isConnectedToServer() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        String currentUrl = webView != null ? webView.getUrl() : null;
        if (currentUrl == null) return false;
        return !"localhost".equals(Uri.parse(currentUrl).getHost());
    }

    @Override
    public void onPause() {
        super.onPause();
        // Only worth keeping alive in the background once actually connected
        // to a dispatch server — nothing to monitor from the connect screen.
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null || !isConnectedToServer()) return;

        Uri uri = Uri.parse(webView.getUrl());
        String host = uri.getAuthority();
        String scheme = uri.getScheme();

        // Start the foreground service synchronously, right here, rather
        // than waiting on the async JS read below — Android restricts apps
        // from starting foreground services once they've actually dropped
        // out of the foreground, and that read's callback could land just
        // late enough to cross that line. It reconnects moments later once
        // the real user info comes back; the brief default-filtered window
        // in between is harmless.
        startBackgroundMonitor(host, scheme, -1, false, false, false);

        // The WebView renderer process gets frozen by Android a few seconds
        // after backgrounding, independent of this activity's own foreground
        // service — so BackgroundMonitorService can't rely on this page's JS
        // to still be running once it needs to react to anything. It opens
        // its own native WebSocket connections instead; this is just a
        // last read of who's logged in before that JS stops executing.
        // inSpeakerGroup/pushMuted come from window.CAD_CURRENT_USER and the
        // announcer page's own mute toggle (localStorage) respectively --
        // both are only meaningful on the announcer page, and default to
        // false/unmuted everywhere else.
        webView.evaluateJavascript(
            "(function(){var u=window.CAD_CURRENT_USER||{};var muted=false;try{muted=localStorage.getItem('announcer-push-muted')==='1';}catch(e){}return JSON.stringify({userId:u.id||-1,isAdmin:!!u.isAdmin,inSpeakerGroup:!!u.inSpeakerGroup,pushMuted:muted});})()",
            (value) -> {
                int userId = -1;
                boolean isAdmin = false;
                boolean inSpeakerGroup = false;
                boolean pushMuted = false;
                try {
                    // evaluateJavascript wraps whatever the script returns in
                    // an extra layer of JSON encoding — our script already
                    // returns a JSON string itself, so `value` here is that
                    // string, quoted and escaped. Unwrap the outer layer first.
                    String json = (String) new org.json.JSONTokener(value).nextValue();
                    org.json.JSONObject obj = new org.json.JSONObject(json);
                    userId = obj.optInt("userId", -1);
                    isAdmin = obj.optBoolean("isAdmin", false);
                    inSpeakerGroup = obj.optBoolean("inSpeakerGroup", false);
                    pushMuted = obj.optBoolean("pushMuted", false);
                } catch (Exception ignored) {
                    // Fall back to the already-running "no alerts" defaults.
                    return;
                }
                startBackgroundMonitor(host, scheme, userId, isAdmin, inSpeakerGroup, pushMuted);
            }
        );
    }

    private void startBackgroundMonitor(String host, String scheme, int userId, boolean isAdmin, boolean inSpeakerGroup, boolean pushMuted) {
        Intent serviceIntent = new Intent(this, BackgroundMonitorService.class);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_HOST, host);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_SCHEME, scheme);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_USER_ID, userId);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_IS_ADMIN, isAdmin);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_IN_SPEAKER_GROUP, inSpeakerGroup);
        serviceIntent.putExtra(BackgroundMonitorService.EXTRA_PUSH_MUTED, pushMuted);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        stopService(new Intent(this, BackgroundMonitorService.class));
    }
}
