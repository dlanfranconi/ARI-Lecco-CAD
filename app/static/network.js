const networkLabels = window.CAD_LABELS || {};

function ensureToastContainer() {
  let container = document.getElementById("network-toasts");
  if (container) return container;
  container = document.createElement("div");
  container.id = "network-toasts";
  container.className = "network-toasts";
  document.body.appendChild(container);
  return container;
}

function showToast(message, status) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `network-toast status-${status}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function updateDeviceRow(device) {
  const row = document.getElementById(`device-${device.id}`);
  if (!row) return;
  const statusEl = row.querySelector(".device-status");
  if (statusEl) {
    statusEl.textContent = networkLabels[device.status] || device.status;
    statusEl.className = `device-status status-${device.status}`;
  }
  const checkedEl = row.querySelector(".device-last-checked");
  if (checkedEl && device.checked_at_display) checkedEl.textContent = device.checked_at_display;
}

function prependEvent(device) {
  const body = document.getElementById("events-body");
  if (!body) return;
  const emptyRow = body.querySelector("td[colspan]");
  if (emptyRow) emptyRow.closest("tr").remove();
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${device.created_at_display || ""}</td><td>${device.name}</td><td><span class="device-status status-${device.status}">${networkLabels[device.status] || device.status}</span></td>`;
  body.insertBefore(tr, body.firstChild);
  while (body.children.length > 30) body.removeChild(body.lastChild);
}

function connectNetworkWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/network`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type !== "device_status") return;
    const device = payload.device;
    updateDeviceRow(device);
    prependEvent(device);
    const recipients = device.recipient_user_ids || [];
    const currentUser = window.CAD_CURRENT_USER;
    const isRecipient = currentUser && (recipients.includes(currentUser.id) || (recipients.length === 0 && currentUser.isAdmin));
    if (!isRecipient) return;
    const template = device.status === "down" ? (networkLabels.device_down_alert || "{name} went offline") : (networkLabels.device_up_alert || "{name} is back online");
    showToast(template.replace("{name}", device.name), device.status);
  };
  socket.onclose = () => setTimeout(connectNetworkWs, 3000);
}

async function runIperfTest(button) {
  const targetId = button.dataset.targetId;
  const row = document.getElementById(`iperf-${targetId}`);
  const resultCell = row?.querySelector(".iperf-latest");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = networkLabels.testing || "Testing...";
  try {
    const response = await fetch(`/api/network/iperf-targets/${targetId}/test`, { method: "POST" });
    const result = await response.json();
    if (resultCell) {
      resultCell.innerHTML = result.ok
        ? `${result.mbps} Mbps`
        : `<span class="error">${result.error || (networkLabels.test_failed || "Test failed")}</span>`;
    }
  } catch (err) {
    if (resultCell) resultCell.innerHTML = `<span class="error">${networkLabels.test_failed || "Test failed"}</span>`;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.querySelectorAll(".iperf-test-button").forEach((button) => {
  button.addEventListener("click", () => runIperfTest(button));
});

connectNetworkWs();
