const bulletinEl = document.getElementById("bulletin");
const timestampEl = document.getElementById("timestamp");
const runnerDetailsEl = document.getElementById("runner-details");
const historyListEl = document.getElementById("notice-history-list");
const noticePositionEl = document.getElementById("notice-position");
const labels = window.CAD_LABELS || {};
let notices = Array.isArray(window.INITIAL_NOTICES) ? window.INITIAL_NOTICES : [];
let currentIndex = 0;

function parts(value) {
  return String(value || "").replaceAll("|", ",").split(",").map((item) => item.trim());
}

function athleteRows(item) {
  const bibs = parts(item?.runner_bib);
  const names = parts(item?.runner_name);
  const towns = parts(item?.runner_hometown);
  const cronos = parts(item?.crono_time);
  const positions = parts(item?.runner_position);
  return bibs.filter(Boolean).map((bib, index) => ({
    bib,
    name: names[index] || "",
    hometown: towns[index] || "",
    crono: cronos[index] || "",
    position: positions[index] || ""
  }));
}

function athleteRowsHtml(item) {
  const rows = athleteRows(item);
  if (!rows.length) return "";
  return `<div class="athlete-rows">${rows.map((athlete) => `
    <div class="athlete-row">
      <span>${labels.bib_number || "Bib Number"}: ${athlete.bib}</span>
      <span>${labels.display_name || "Name"}: ${athlete.name}</span>
      <span>${labels.city || "City"}: ${athlete.hometown}</span>
      ${athlete.crono ? `<span>${labels.crono_time || "Crono Time"}: ${athlete.crono}</span>` : ""}
      ${athlete.position ? `<span>${labels.athlete_position || "Position Number"}: ${athlete.position}</span>` : ""}
    </div>`).join("")}</div>`;
}

function detailHtml(item) {
  return athleteRowsHtml(item);
}

function renderHistory() {
  if (!historyListEl) return;
  const older = notices.filter((_, index) => index !== currentIndex).slice(0, 8);
  if (!older.length) {
    historyListEl.innerHTML = `<p>${labels.no_prior_notices || "No older notices"}</p>`;
    return;
  }
  historyListEl.innerHTML = older.map((item) => `
    <article>${item.message || ""}${athleteRowsHtml(item)}</article>
  `).join("");
}

function renderNoticeAt(index) {
  if (!notices.length) return;
  currentIndex = Math.max(0, Math.min(index, notices.length - 1));
  const item = notices[currentIndex];
  bulletinEl.textContent = item.message || labels.no_notice || "No approved notice";
  timestampEl.textContent = item.approved_at || item.created_at || "";
  const details = detailHtml(item);
  if (details) {
    runnerDetailsEl.classList.remove("hidden");
    runnerDetailsEl.innerHTML = details;
  } else {
    runnerDetailsEl.classList.add("hidden");
    runnerDetailsEl.innerHTML = "";
  }
  if (noticePositionEl) noticePositionEl.textContent = `${currentIndex + 1}/${notices.length}`;
  renderHistory();
}

function upsertNotice(item) {
  if (!item || !item.id) return;
  notices = notices.filter((notice) => notice.id !== item.id);
  notices.unshift(item);
  currentIndex = 0;
  renderNoticeAt(0);
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
  };
  socket.onclose = () => setTimeout(connectWs, 3000);
}

function showOlder() { renderNoticeAt(currentIndex + 1); }
function showNewer() { renderNoticeAt(currentIndex - 1); }

document.getElementById("older-notice")?.addEventListener("click", showOlder);
document.getElementById("newer-notice")?.addEventListener("click", showNewer);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showOlder();
  if (event.key === "ArrowRight") showNewer();
});
document.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  if (event.clientX < window.innerWidth / 2) showOlder();
  else showNewer();
});

if (notices.length) renderNoticeAt(0);
connectWs();
setInterval(pollLatest, 30000);

const contrastToggle = document.getElementById("contrast-toggle");
const savedContrast = localStorage.getItem("announcer-contrast");
if (savedContrast === "light") document.body.classList.add("light-mode");
contrastToggle?.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("announcer-contrast", document.body.classList.contains("light-mode") ? "light" : "dark");
});
