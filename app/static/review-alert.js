const labels = window.CAD_LABELS || {};

function ensureModal() {
  let modal = document.getElementById("notice-review-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "notice-review-modal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-panel">
      <h2 id="notice-review-title"></h2>
      <p class="meta" id="notice-review-meta"></p>
      <p class="bulletin-text" id="notice-review-message"></p>
      <div class="actions">
        <button id="notice-review-approve"></button>
        <button class="danger" id="notice-review-reject"></button>
        <button class="secondary" id="notice-review-dismiss"></button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function showNoticeModal(notice) {
  const modal = ensureModal();
  modal.dataset.id = notice.id;
  document.getElementById("notice-review-title").textContent = labels.new_notice || "New notice pending review";
  document.getElementById("notice-review-meta").textContent = `${notice.created_at || ""} ${labels.from_label || "from"} ${notice.submitter_name || labels.unknown || "Unknown"}`;
  document.getElementById("notice-review-message").textContent = notice.message || "";
  document.getElementById("notice-review-approve").textContent = labels.approve || "Approve";
  document.getElementById("notice-review-reject").textContent = labels.reject || "Reject";
  document.getElementById("notice-review-dismiss").textContent = labels.dismiss || "Dismiss";
  modal.classList.remove("hidden");
}

async function postAction(action) {
  const modal = ensureModal();
  const id = modal.dataset.id;
  if (!id) return;
  const response = await fetch(`/api/notices/${id}/${action}`, { method: "POST" });
  if (response.ok) modal.classList.add("hidden");
}

document.addEventListener("click", (event) => {
  if (event.target?.id === "notice-review-approve") postAction("approve");
  if (event.target?.id === "notice-review-reject") postAction("reject");
  if (event.target?.id === "notice-review-dismiss") ensureModal().classList.add("hidden");
});

function connectReviewWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/review`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if ((payload.type === "pending_notice" || payload.type === "pending_bulletin") && (payload.notice || payload.bulletin)) {
      showNoticeModal(payload.notice || payload.bulletin);
    }
  };
  socket.onclose = () => setTimeout(connectReviewWs, 3000);
}

connectReviewWs();
