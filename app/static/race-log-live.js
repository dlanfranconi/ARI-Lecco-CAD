function isComposingLog() {
  const active = document.activeElement;
  return Boolean(active && active.closest("[data-runner-compose]"));
}

let raceLogPendingRefresh = false;

function refreshRaceLogPage() {
  if (isComposingLog()) {
    raceLogPendingRefresh = true;
    return;
  }
  window.location.reload();
}

document.addEventListener(
  "focusout",
  () => {
    if (raceLogPendingRefresh && !isComposingLog()) {
      raceLogPendingRefresh = false;
      window.location.reload();
    }
  },
  true
);

function connectRaceLogWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/race-log`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "race_log_created") refreshRaceLogPage();
  };
  socket.onclose = () => setTimeout(connectRaceLogWs, 3000);
}

connectRaceLogWs();
