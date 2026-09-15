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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Same three-way exclusivity as notice-recipients.js's picker (Broadcast /
// Announcer / specific stations), reimplemented locally rather than shared
// since this modal is built at runtime from a WebSocket push, not a <form>
// present at page load -- keeping it self-contained avoids a load-order
// dependency on notice-recipients.js being present on every admin page.
function wireModalRecipientPicker(modal) {
  const specials = Array.from(modal.querySelectorAll(".recipient-special"));
  const individuals = Array.from(modal.querySelectorAll(".recipient-individual"));
  specials.forEach((box) => {
    box.addEventListener("change", () => {
      if (!box.checked) { box.checked = true; return; }
      specials.forEach((other) => { if (other !== box) other.checked = false; });
      individuals.forEach((other) => { other.checked = false; });
    });
  });
  const announcerBox = specials.find((box) => box.dataset.recipientMode === "announcer");
  individuals.forEach((box) => {
    box.addEventListener("change", () => {
      if (box.checked) { specials.forEach((special) => { special.checked = false; }); return; }
      if (announcerBox && !individuals.some((other) => other.checked)) announcerBox.checked = true;
    });
  });
}

function ensureModal() {
  let modal = document.getElementById("notice-review-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "notice-review-modal";
  modal.className = "modal hidden";
  const users = window.CAD_USERS_LIST || [];
  const stationBoxes = users.map((u) => `<label><input type="checkbox" class="recipient-individual" value="${u.id}"> ${escapeHtml(u.display_name)}</label>`).join("");
  modal.innerHTML = `
    <div class="modal-panel">
      <h2 id="notice-review-title"></h2>
      <p class="meta" id="notice-review-meta"></p>
      <label><span id="notice-review-message-label"></span><textarea id="notice-review-message" rows="5"></textarea></label>
      <label><span id="notice-review-recipients-label"></span>
        <div class="recipient-checks" id="notice-review-recipients">
          <label><input type="checkbox" class="recipient-special" data-recipient-mode="broadcast"> <span id="notice-review-broadcast-label"></span></label>
          <label><input type="checkbox" class="recipient-special" data-recipient-mode="announcer" checked> <span id="notice-review-announcer-label"></span></label>
          ${stationBoxes}
        </div>
      </label>
      <div class="actions">
        <button id="notice-review-approve"></button>
        <button class="danger" id="notice-review-reject"></button>
        <button class="secondary" id="notice-review-dismiss"></button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  wireModalRecipientPicker(modal);
  return modal;
}

function showNoticeModal(notice) {
  const modal = ensureModal();
  modal.dataset.id = notice.id;
  document.getElementById("notice-review-title").textContent = labels.new_notice || "New notice pending review";
  document.getElementById("notice-review-meta").textContent = `${notice.created_at_display || notice.created_at || ""} ${labels.from_label || "from"} ${notice.submitter_name || labels.unknown || "Unknown"}`;
  document.getElementById("notice-review-message-label").textContent = labels.edit_notice || "Edit Notice";
  document.getElementById("notice-review-message").value = notice.message || "";
  document.getElementById("notice-review-recipients-label").textContent = labels.notify_recipients || "Send To";
  document.getElementById("notice-review-broadcast-label").textContent = labels.send_to_broadcast_all || "Everyone (Broadcast)";
  document.getElementById("notice-review-announcer-label").textContent = labels.send_to_announcer || "Announcer (Speaker Group)";
  const recipientIds = (notice.recipient_user_ids || []).map(String);
  modal.querySelectorAll(".recipient-special").forEach((box) => {
    box.checked = box.dataset.recipientMode === "broadcast" ? !!notice.broadcast_all : (!notice.broadcast_all && !recipientIds.length);
  });
  modal.querySelectorAll(".recipient-individual").forEach((box) => {
    box.checked = !notice.broadcast_all && recipientIds.includes(String(box.value));
  });
  document.getElementById("notice-review-approve").textContent = labels.save_and_approve || labels.approve || "Approve";
  document.getElementById("notice-review-reject").textContent = labels.reject || "Reject";
  document.getElementById("notice-review-dismiss").textContent = labels.dismiss || "Dismiss";
  modal.classList.remove("hidden");
}

function modalRecipientPayload(modal) {
  const stationIds = Array.from(modal.querySelectorAll(".recipient-individual")).filter((box) => box.checked).map((box) => box.value);
  if (stationIds.length) return { broadcast_all: false, notify_user_ids: stationIds };
  const broadcastBox = modal.querySelector('.recipient-special[data-recipient-mode="broadcast"]');
  return { broadcast_all: !!broadcastBox?.checked, notify_user_ids: [] };
}

async function postAction(action) {
  const modal = ensureModal();
  const id = modal.dataset.id;
  if (!id) return;
  const payload = action === "approve" ? {
    message: document.getElementById("notice-review-message")?.value || "",
    ...modalRecipientPayload(modal)
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
      const notice = payload.notice || payload.bulletin;
      showNoticeModal(notice);
      updatePendingCount(payload.pending_count);
      window.CAD_NATIVE_NOTIFY?.(labels.new_notice || "New notice pending review", notice.message || "");
    }
    if (payload.type === "pending_count") updatePendingCount(payload.pending_count);
    if (payload.type === "race_timer_changed") {
      window.CAD_NATIVE_NOTIFY?.(labels.race_timer_update || "Race timer updated", "");
      window.location.reload();
    }
  };
  socket.onclose = () => setTimeout(connectReviewWs, 3000);
}

connectReviewWs();
