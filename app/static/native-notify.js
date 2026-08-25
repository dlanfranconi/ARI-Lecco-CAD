// Bridges WS-driven alerts (new pending notice, device down, race timer
// changes) into real Android system notifications when the app is
// backgrounded but still running — the native MainActivity keeps a
// foreground service alive during that window so these WebSocket
// connections (which already auto-reconnect) keep receiving events. Does
// nothing outside the native app, and does nothing while the app is in the
// foreground (the existing in-page toasts/modals already cover that case).
window.CAD_NATIVE_NOTIFY = () => {};

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
  }
}
