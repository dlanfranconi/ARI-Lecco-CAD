function isEditingNotice() {
  const active = document.activeElement;
  return Boolean(active && active.closest(".notice-edit-form"));
}

let pendingRefresh = false;

function refreshNoticesPage() {
  if (isEditingNotice()) {
    pendingRefresh = true;
    return;
  }
  window.location.reload();
}

document.addEventListener(
  "focusout",
  () => {
    if (pendingRefresh && !isEditingNotice()) {
      pendingRefresh = false;
      window.location.reload();
    }
  },
  true
);

function connectNoticesWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/review`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "pending_notice" || payload.type === "pending_count") refreshNoticesPage();
  };
  socket.onclose = () => setTimeout(connectNoticesWs, 3000);
}

connectNoticesWs();
