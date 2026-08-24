if ("serviceWorker" in navigator) {
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
if (window.Capacitor?.isNativePlatform?.()) {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => link.removeAttribute("target"));
}
