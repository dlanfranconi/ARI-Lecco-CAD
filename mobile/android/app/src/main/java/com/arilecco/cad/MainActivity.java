package com.arilecco.cad;

import android.net.Uri;
import android.os.Bundle;
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
}
