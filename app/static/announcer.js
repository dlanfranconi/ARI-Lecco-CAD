const bulletinEl = document.getElementById("bulletin");
const timestampEl = document.getElementById("timestamp");
const runnerDetailsEl = document.getElementById("runner-details");
const labels = window.CAD_LABELS || {};

function renderNotice(item) {
  if (!item || !item.message) return;
  bulletinEl.textContent = item.message;
  timestampEl.textContent = item.approved_at || item.created_at || "";
  if (item.runner_bib) {
    runnerDetailsEl.classList.remove("hidden");
    runnerDetailsEl.innerHTML = `
      <span>${labels.bib_number || "Bib Number"}: ${item.runner_bib}</span>
      <span>${labels.runner_name || "Runner Name"}: ${item.runner_name || ""}</span>
      <span>${labels.hometown || "Home Town"}: ${item.runner_hometown || ""}</span>`;
  } else {
    runnerDetailsEl.classList.add("hidden");
    runnerDetailsEl.innerHTML = "";
  }
}

async function pollLatest() {
  const response = await fetch("/api/notices/latest");
  if (response.ok) renderNotice(await response.json());
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/announcer`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "notice" || payload.type === "bulletin") renderNotice(payload.notice || payload.bulletin);
  };
  socket.onclose = () => setTimeout(connectWs, 3000);
}

connectWs();
setInterval(pollLatest, 30000);
