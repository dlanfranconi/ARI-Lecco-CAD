const labels = window.CAD_LABELS || {};

function updatePendingCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) return;
  const countEl = document.getElementById("pending-count");
  const pill = document.getElementById("pending-count-pill");
  if (countEl) countEl.textContent = String(value);
  if (pill && pill.dataset.label) pill.textContent = `${value} ${pill.dataset.label}`;
}

async function refreshPendingCount() {
  const response = await fetch("/api/notices/pending-count");
  if (response.ok) {
    const data = await response.json();
    updatePendingCount(data.pending_count);
  }
}

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
      <label><span id="notice-review-message-label"></span><textarea id="notice-review-message" rows="5"></textarea></label>
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
  document.getElementById("notice-review-meta").textContent = `${notice.created_at_display || notice.created_at || ""} ${labels.from_label || "from"} ${notice.submitter_name || labels.unknown || "Unknown"}`;
  document.getElementById("notice-review-message-label").textContent = labels.edit_notice || "Edit Notice";
  document.getElementById("notice-review-message").value = notice.message || "";
  document.getElementById("notice-review-approve").textContent = labels.save_and_approve || labels.approve || "Approve";
  document.getElementById("notice-review-reject").textContent = labels.reject || "Reject";
  document.getElementById("notice-review-dismiss").textContent = labels.dismiss || "Dismiss";
  modal.classList.remove("hidden");
}

async function postAction(action) {
  const modal = ensureModal();
  const id = modal.dataset.id;
  if (!id) return;
  const payload = action === "approve" ? {
    message: document.getElementById("notice-review-message")?.value || ""
  } : null;
  const response = await fetch(`/api/notices/${id}/${action}`, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (response.ok) {
    modal.classList.add("hidden");
    refreshPendingCount();
  }
}

document.addEventListener("click", (event) => {
  if (event.target?.id === "notice-review-approve") postAction("approve");
  if (event.target?.id === "notice-review-reject") postAction("reject");
  if (event.target?.id === "notice-review-dismiss") {
    ensureModal().classList.add("hidden");
    refreshPendingCount();
  }
});

function connectReviewWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/review`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if ((payload.type === "pending_notice" || payload.type === "pending_bulletin") && (payload.notice || payload.bulletin)) {
      showNoticeModal(payload.notice || payload.bulletin);
      updatePendingCount(payload.pending_count);
    }
    if (payload.type === "pending_count") updatePendingCount(payload.pending_count);
  };
  socket.onclose = () => setTimeout(connectReviewWs, 3000);
}

connectReviewWs();
