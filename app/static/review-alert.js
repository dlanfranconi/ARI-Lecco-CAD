const labels = window.CAD_LABELS || {};

function ensureModal() {
  let modal = document.getElementById("bulletin-review-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "bulletin-review-modal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-panel">
      <h2 id="bulletin-review-title"></h2>
      <p class="meta" id="bulletin-review-meta"></p>
      <p class="bulletin-text" id="bulletin-review-message"></p>
      <div class="actions">
        <button id="bulletin-review-approve"></button>
        <button class="danger" id="bulletin-review-reject"></button>
        <button class="secondary" id="bulletin-review-dismiss"></button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function showBulletinModal(bulletin) {
  const modal = ensureModal();
  modal.dataset.id = bulletin.id;
  document.getElementById("bulletin-review-title").textContent = labels.new_bulletin || "New bulletin pending dispatch review";
  document.getElementById("bulletin-review-meta").textContent = `${bulletin.created_at || ""} from ${bulletin.submitter_name || "Unknown"}`;
  document.getElementById("bulletin-review-message").textContent = bulletin.message || "";
  document.getElementById("bulletin-review-approve").textContent = labels.approve || "Approve";
  document.getElementById("bulletin-review-reject").textContent = labels.reject || "Reject";
  document.getElementById("bulletin-review-dismiss").textContent = labels.dismiss || "Dismiss";
  modal.classList.remove("hidden");
}

async function postAction(action) {
  const modal = ensureModal();
  const id = modal.dataset.id;
  if (!id) return;
  const response = await fetch(`/api/bulletins/${id}/${action}`, { method: "POST" });
  if (response.ok) modal.classList.add("hidden");
}

document.addEventListener("click", (event) => {
  if (event.target?.id === "bulletin-review-approve") postAction("approve");
  if (event.target?.id === "bulletin-review-reject") postAction("reject");
  if (event.target?.id === "bulletin-review-dismiss") ensureModal().classList.add("hidden");
});

function connectReviewWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/review`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "pending_bulletin" && payload.bulletin) showBulletinModal(payload.bulletin);
  };
  socket.onclose = () => setTimeout(connectReviewWs, 3000);
}

connectReviewWs();
