package com.arilecco.cad;

import android.net.Uri;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long EXIT_WINDOW_MS = 2000;
    private long lastBackPressTime = 0;

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
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
            super.onBackPressed();
        } else {
            lastBackPressTime = now;
            Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
        }
    }
}
