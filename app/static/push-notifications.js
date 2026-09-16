// Browser push notifications -- for anyone using a plain browser instead of
// the native app (desktop, Android Chrome, or an iPhone that's added the
// site to its Home Screen). The native app already has its own background
// alert mechanism (native-notify.js / BackgroundMonitorService), so this
// stays inert there to avoid double notifications.
function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined" && !window.Capacitor?.isNativePlatform?.();
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function currentPushSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function isPushEnabled() {
  if (!pushSupported()) return false;
  return Boolean(await currentPushSubscription());
}

async function enablePushNotifications() {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { key } = await fetch("/push/vapid-public-key").then((response) => response.json());
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await fetch("/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  return true;
}

async function disablePushNotifications() {
  if (!pushSupported()) return;
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await fetch("/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}

window.CAD_PUSH = {
  supported: pushSupported,
  isEnabled: isPushEnabled,
  enable: enablePushNotifications,
  disable: disablePushNotifications,
};
