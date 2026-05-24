const bulletinEl = document.getElementById("bulletin");
const timestampEl = document.getElementById("timestamp");

function renderBulletin(item) {
  if (!item || !item.message) return;
  bulletinEl.textContent = item.message;
  timestampEl.textContent = item.approved_at || item.created_at || "";
}

async function pollLatest() {
  const response = await fetch("/api/bulletins/latest");
  if (response.ok) renderBulletin(await response.json());
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/announcer`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "bulletin") renderBulletin(payload.bulletin);
  };
  socket.onclose = () => setTimeout(connectWs, 3000);
}

connectWs();
setInterval(pollLatest, 30000);

