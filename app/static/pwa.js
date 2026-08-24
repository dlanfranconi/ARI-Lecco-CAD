const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());

if (isNativeApp) {
  // The app is already an installed native shell — it gets none of the benefit a
  // service worker gives a browser tab (installability, offline caching of a
  // page you might revisit), and it caused a real bug: the WebView's SW storage
  // is entirely separate from any desktop browser, so once registered here it
  // kept serving whatever static JS/CSS was cached at install time indefinitely,
  // with no way to know it was even happening from the app side. Actively clean
  // up anything already registered from before this fix, then never register
  // one again in this context.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister()));
  }
  if ("caches" in window) {
    caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
  }
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a bonus, not a requirement — ignore registration failures.
    });
  });
}

// target="_blank" opens a real second tab on desktop, which is useful (keep the
// dispatch view open while watching the announcer screen). Inside the Android/iOS
// app there's no such thing as a second tab — the WebView has no tab UI to land
// on, and Capacitor's back-button handling only knows about the one WebView
// instance it's tracking, not any window this might have tried to open. Strip
// the attribute so these links just navigate in place instead.
if (isNativeApp) {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => link.removeAttribute("target"));
}
