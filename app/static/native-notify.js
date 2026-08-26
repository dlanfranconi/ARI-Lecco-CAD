// Bridges WS-driven alerts (new pending notice, device down, race timer
// changes) into real Android system notifications when the app is
// backgrounded but still running — the native MainActivity keeps a
// foreground service alive during that window so these WebSocket
// connections (which already auto-reconnect) keep receiving events. Does
// nothing outside the native app, and does nothing while the app is in the
// foreground (the existing in-page toasts/modals already cover that case).
window.CAD_NATIVE_NOTIFY = () => {};

// Always fires (foreground or background), unlike CAD_NATIVE_NOTIFY above.
// Used specifically for the announcer page's own active-alert sound: a
// Web Audio/HTML5 <audio> beep in a WebView always plays over Android's
// media volume stream, with no way from JS to route it through the
// notification volume stream instead. Posting a real Android notification
// does play through the notification stream (and shows a proper push),
// so announcer.js uses this in place of its in-page beep on native
// platforms rather than alongside it.
window.CAD_NATIVE_ALERT = () => {};

if (window.Capacitor?.isNativePlatform?.()) {
  const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
  if (LocalNotifications) {
    LocalNotifications.requestPermissions().catch(() => {});

    let nextId = 1;
    window.CAD_NATIVE_NOTIFY = (title, body) => {
      if (!document.hidden) return;
      LocalNotifications.schedule({
        notifications: [{ id: nextId++, title, body: body || "", schedule: { at: new Date(Date.now() + 100) } }],
      }).catch(() => {});
    };

    let nextAlertId = 100001;
    window.CAD_NATIVE_ALERT = (title, body) => {
      LocalNotifications.schedule({
        notifications: [{ id: nextAlertId++, title, body: body || "", schedule: { at: new Date(Date.now() + 100) } }],
      }).catch(() => {});
    };
  }
}
