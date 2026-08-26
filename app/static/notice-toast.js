// Surfaces a lightweight pop-up for logged-in users anywhere on the site
// (other than the /announcer page itself, which already has its own
// flash+sound treatment) when a new broadcast or specifically-addressed
// notice lands. Speaker/Announcer-only notices (no explicit recipients,
// not a broadcast) never toast here -- those are passive-only for anyone
// but the actual speaker board, per the announcer page's own alert rules.
(function () {
  const viewer = window.CAD_CURRENT_USER;
  if (!viewer || document.getElementById("bulletin")) return;

  function shouldToast(item) {
    if (viewer.id === item.submitted_by_user_id || viewer.id === item.approved_by_user_id) return false;
    if (item.broadcast_all) return true;
    return (item.recipient_user_ids || []).includes(viewer.id);
  }

  function ensureContainer() {
    let container = document.getElementById("notice-toasts");
    if (container) return container;
    container = document.createElement("div");
    container.id = "notice-toasts";
    container.className = "notice-toasts";
    document.body.appendChild(container);
    return container;
  }

  function showToast(item) {
    const container = ensureContainer();
    const toast = document.createElement("a");
    toast.className = "notice-toast";
    toast.href = window.CAD_ANNOUNCER_URL || "/announcer";
    toast.textContent = item.message || "";
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 12000);
  }

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${proto}://${location.host}/ws/announcer`);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== "notice" && payload.type !== "bulletin") return;
      const item = payload.notice || payload.bulletin;
      if (item && shouldToast(item)) showToast(item);
    };
    socket.onclose = () => setTimeout(connect, 3000);
  }

  connect();
})();
