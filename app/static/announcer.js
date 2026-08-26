const bulletinEl = document.getElementById("bulletin");
const timestampEl = document.getElementById("timestamp");
const runnerDetailsEl = document.getElementById("runner-details");
const noticePositionEl = document.getElementById("notice-position");
const labels = window.CAD_LABELS || {};
let notices = Array.isArray(window.INITIAL_NOTICES) ? window.INITIAL_NOTICES : [];
let currentIndex = 0;
let hasRenderedOnce = false;

function parts(value) {
  return String(value || "").replaceAll("|", ",").split(",").map((item) => item.trim());
}

function athleteRows(item) {
  const bibs = parts(item?.runner_bib);
  const names = parts(item?.runner_name);
  const towns = parts(item?.runner_hometown);
  const positions = parts(item?.runner_position);
  return bibs.filter(Boolean).map((bib, index) => ({
    bib,
    name: names[index] || "",
    hometown: (towns[index] || "").trim(),
    position: (positions[index] || "").trim()
  }));
}

function athleteRowsHtml(item) {
  const rows = athleteRows(item);
  if (!rows.length) return "";
  const hasTown = rows.some((athlete) => String(athlete.hometown || "").trim());
  const hasPosition = rows.some((athlete) => String(athlete.position || "").trim());
  return `<div class="athlete-rows ${hasTown ? "has-town" : "no-town"} ${hasPosition ? "has-position" : "no-position"}">${rows.map((athlete) => `
    <div class="athlete-row">
      <span class="athlete-bib"><strong>${labels.bib_number || "Bib Number"}:</strong> ${athlete.bib}</span>
      <span class="athlete-name"><strong>${labels.runner_name || labels.display_name || "Name"}:</strong> ${athlete.name}</span>
      ${String(athlete.hometown || "").trim() ? `<span class="athlete-town"><strong>${labels.city || "City"}:</strong> ${athlete.hometown}</span>` : ""}
      ${String(athlete.position || "").trim() ? `<span class="athlete-position"><strong>${labels.athlete_position || "Position Number"}:</strong> ${athlete.position}</span>` : ""}
    </div>`).join("")}</div>`;
}

function detailHtml(item) {
  return athleteRowsHtml(item);
}

function ensureHistoryModal() {
  let modal = document.getElementById("history-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "history-modal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-panel">
      <h2>${labels.older_notices || "Older Notices"}</h2>
      <div id="notice-history-list" class="notice-history-list"></div>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
  document.body.appendChild(modal);
  return modal;
}

function renderHistoryModalList() {
  const listEl = document.getElementById("notice-history-list");
  if (!listEl) return;
  if (!notices.length) {
    listEl.innerHTML = `<p>${labels.no_prior_notices || "No older notices"}</p>`;
    return;
  }
  listEl.innerHTML = notices.map((item, index) => `
    <article data-index="${index}">${item.message || ""}<span class="meta">${item.approved_at_display || item.created_at_display || ""}</span>${athleteRowsHtml(item)}</article>
  `).join("");
  listEl.querySelectorAll("article[data-index]").forEach((article) => {
    article.addEventListener("click", () => {
      renderNoticeAt(Number(article.dataset.index));
      ensureHistoryModal().classList.add("hidden");
    });
  });
}

function showHistoryModal() {
  ensureHistoryModal().classList.remove("hidden");
  renderHistoryModalList();
}

function renderNoticeAt(index) {
  if (!notices.length) return;
  currentIndex = Math.max(0, Math.min(index, notices.length - 1));
  const item = notices[currentIndex];
  bulletinEl.textContent = item.message || labels.no_notice || "No approved notice";
  timestampEl.textContent = item.approved_at_display || item.created_at_display || item.approved_at || item.created_at || "";
  const details = detailHtml(item);
  if (details) {
    runnerDetailsEl.classList.remove("hidden");
    runnerDetailsEl.innerHTML = details;
  } else {
    runnerDetailsEl.classList.add("hidden");
    runnerDetailsEl.innerHTML = "";
  }
  if (noticePositionEl) noticePositionEl.textContent = `${currentIndex + 1}/${notices.length}`;
}

function flashBulletin() {
  bulletinEl.classList.remove("flash");
  // Force reflow so the animation restarts if it's still mid-run.
  void bulletinEl.offsetWidth;
  bulletinEl.classList.add("flash");
}

function isVisibleToViewer(item) {
  if (item?.broadcast_all) return true;
  const viewer = window.CAD_CURRENT_USER;
  const recipients = item?.recipient_user_ids || [];
  if (!viewer) return recipients.length === 0;
  return recipients.includes(viewer.id) || (recipients.length === 0 && viewer.inSpeakerGroup);
}

// Being visible on this viewer's feed doesn't always mean this viewer
// should get the active sound+flash treatment. Broadcast and
// specifically-addressed notices alert everyone in their audience (minus
// whoever sent or approved that particular notice). Speaker/Announcer
// notices (no explicit recipients, not a broadcast) only alert the actual
// public/no-login speaker board -- any logged-in viewer just sees it show
// up passively (still updates the on-screen bulletin and archive, no
// sound/flash) since that's not the physical announcer device.
function shouldActivelyAlert(item) {
  const viewer = window.CAD_CURRENT_USER;
  if (viewer && (viewer.id === item.submitted_by_user_id || viewer.id === item.approved_by_user_id)) return false;
  if (item.broadcast_all) return true;
  if ((item.recipient_user_ids || []).length) return true;
  return !viewer;
}

function alertsMuted() {
  return localStorage.getItem("announcer-push-muted") === "1";
}

function upsertNotice(item) {
  if (!item || !item.id || !isVisibleToViewer(item)) return;
  const isNew = hasRenderedOnce && !notices.some((notice) => notice.id === item.id);
  notices = notices.filter((notice) => notice.id !== item.id);
  notices.unshift(item);
  currentIndex = 0;
  renderNoticeAt(0);
  if (isNew && !alertsMuted() && shouldActivelyAlert(item)) {
    flashBulletin();
    if (!document.hidden) {
      playNotificationSound();
    } else if (!item.broadcast_all && !(item.recipient_user_ids || []).length) {
      // Hidden (backgrounded or about to be): normally the native
      // BackgroundMonitorService takes over from here and pushes
      // broadcast/specific notices reliably on its own -- calling
      // window.AndroidNotify too would just double the notification.
      // Speaker/Announcer notices are the one case it never covers
      // (deliberately, since that's passive-only for a logged-in
      // viewer, and the real speaker board isn't meant to be
      // backgrounded) -- for those this is the only path, covering the
      // few seconds before Android freezes this page's JS entirely.
      window.AndroidNotify?.postAlert(labels.new_announcement || "New announcement", item.message || "");
    }
  }
}

async function pollLatest() {
  const response = await fetch("/api/notices/recent");
  if (response.ok) {
    notices = await response.json();
    renderNoticeAt(Math.min(currentIndex, notices.length - 1));
  }
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws/announcer`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "notice" || payload.type === "bulletin") upsertNotice(payload.notice || payload.bulletin);
    if (payload.type === "notice_deleted") {
      notices = notices.filter((notice) => String(notice.id) !== String(payload.id));
      if (notices.length) renderNoticeAt(Math.min(currentIndex, notices.length - 1));
      else window.location.reload();
    }
    if (payload.type === "race_timer_changed") window.location.reload();
  };
  socket.onclose = () => setTimeout(connectWs, 3000);
}

function showOlder() { renderNoticeAt(currentIndex + 1); }
function showNewer() { renderNoticeAt(currentIndex - 1); }

document.getElementById("older-notice")?.addEventListener("click", showOlder);
document.getElementById("newer-notice")?.addEventListener("click", showNewer);
document.getElementById("history-open")?.addEventListener("click", showHistoryModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showOlder();
  if (event.key === "ArrowRight") showNewer();
});
document.addEventListener("click", (event) => {
  if (event.target.closest("button, .announcer-clock, .modal-panel")) return;
  if (event.target.closest(".modal")) return;
  if (event.clientX < window.innerWidth / 2) showOlder();
  else showNewer();
});

if (notices.length) renderNoticeAt(0);
hasRenderedOnce = true;
connectWs();
setInterval(pollLatest, 30000);

const contrastToggle = document.getElementById("contrast-toggle");
const savedContrast = localStorage.getItem("announcer-contrast");
if (savedContrast === "light") document.body.classList.add("light-mode");
contrastToggle?.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("announcer-contrast", document.body.classList.contains("light-mode") ? "light" : "dark");
});

const SOUND_PRESETS = {
  none: null,
  soft: [{ freq: 660, duration: 0.18 }],
  chime: [{ freq: 523, duration: 0.14 }, { freq: 784, duration: 0.22 }],
  alert: [{ freq: 880, duration: 0.1 }, { freq: 880, duration: 0.1, delay: 0.16 }, { freq: 880, duration: 0.16, delay: 0.32 }]
};

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

let customAudio = null;
function playCustomSound(volume) {
  const url = window.CAD_NOTIFICATION_SOUND_URL;
  if (!url) return;
  if (!customAudio || customAudio.src.indexOf(url) === -1) customAudio = new Audio(url);
  customAudio.currentTime = 0;
  customAudio.volume = Math.max(0, Math.min(1, volume));
  customAudio.play().catch(() => {
    // Autoplay blocked until the user interacts with the page; ignore.
  });
}

function soundPrefs() {
  return {
    preset: localStorage.getItem("announcer-sound-preset") || "chime",
    volume: Number(localStorage.getItem("announcer-sound-volume") ?? 0.6)
  };
}

function playTone(ctx, startAt, { freq, duration, delay = 0 }, volume) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  const start = startAt + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNotificationSound() {
  const { preset, volume } = soundPrefs();
  if (volume <= 0) return;
  if (preset === "custom") {
    playCustomSound(volume);
    return;
  }
  const tones = SOUND_PRESETS[preset];
  if (!tones) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    tones.forEach((tone) => playTone(ctx, now, tone, volume));
  } catch (_) {
    // Audio unsupported/blocked; fail silently.
  }
}

function ensureSoundModal() {
  let modal = document.getElementById("sound-modal");
  if (modal) return modal;
  const { preset, volume } = soundPrefs();
  modal = document.createElement("div");
  modal.id = "sound-modal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modal-panel">
      <h2>${labels.notification_sound || "Notification Sound"}</h2>
      <div class="sound-settings-panel">
        <label>${labels.sound_preset || "Sound"}
          <select id="sound-preset-select">
            <option value="none">${labels.sound_none || "None"}</option>
            <option value="soft">${labels.sound_soft || "Soft"}</option>
            <option value="chime">${labels.sound_chime || "Chime"}</option>
            <option value="alert">${labels.sound_alert || "Alert"}</option>
            ${window.CAD_NOTIFICATION_SOUND_URL ? `<option value="custom">${labels.sound_custom || "Custom"}</option>` : ""}
          </select>
        </label>
        <label>${labels.sound_volume || "Volume"}
          <input id="sound-volume-range" type="range" min="0" max="1" step="0.05" value="${volume}">
        </label>
        <label class="checkbox-row">
          <input type="checkbox" id="sound-mute-toggle">
          ${labels.mute_alerts || "Mute push alerts and sounds on this device"}
        </label>
        <div class="actions">
          <button type="button" id="sound-test">${labels.sound_test || "Test"}</button>
          <button type="button" class="secondary" id="sound-close">${labels.dismiss || "Close"}</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
  document.body.appendChild(modal);
  const select = modal.querySelector("#sound-preset-select");
  select.value = preset;
  select.addEventListener("change", () => localStorage.setItem("announcer-sound-preset", select.value));
  const range = modal.querySelector("#sound-volume-range");
  range.addEventListener("input", () => localStorage.setItem("announcer-sound-volume", range.value));
  const muteToggle = modal.querySelector("#sound-mute-toggle");
  muteToggle.checked = alertsMuted();
  muteToggle.addEventListener("change", () => localStorage.setItem("announcer-push-muted", muteToggle.checked ? "1" : "0"));
  modal.querySelector("#sound-test")?.addEventListener("click", playNotificationSound);
  modal.querySelector("#sound-close")?.addEventListener("click", () => modal.classList.add("hidden"));
  return modal;
}

document.getElementById("sound-toggle")?.addEventListener("click", () => {
  ensureSoundModal().classList.remove("hidden");
});
