const raceTimer = document.getElementById("race-timer");
let raceTimerStartMs = null;
let raceTimerBaseText = raceTimer?.textContent || "00:00:00";

function pad(value) { return String(value).padStart(2, "0"); }

function setRaceTimerStart(value) {
  const next = Number(value || 0);
  raceTimerStartMs = Number.isFinite(next) && next > 0 ? next : null;
  if (raceTimer && raceTimerStartMs) raceTimer.dataset.startedEpochMs = String(raceTimerStartMs);
}

function renderRaceTimer() {
  if (!raceTimer) return;
  if (!raceTimerStartMs) {
    raceTimer.textContent = raceTimerBaseText || "00:00:00";
    return;
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - raceTimerStartMs) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  raceTimer.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

async function refreshRaceTimerState() {
  if (!raceTimer) return;
  try {
    const response = await fetch("/api/race-timer", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    raceTimerBaseText = data.current_crono || "00:00:00";
    setRaceTimerStart(data.running ? data.started_epoch_ms : "");
    renderRaceTimer();
  } catch (_) {
    // Keep the local timer running if the network briefly drops.
  }
}

setRaceTimerStart(raceTimer?.dataset.startedEpochMs || (raceTimer?.dataset.startedAt ? new Date(raceTimer.dataset.startedAt).getTime() : ""));
renderRaceTimer();
setInterval(renderRaceTimer, 1000);
refreshRaceTimerState();
setInterval(refreshRaceTimerState, 5000);

document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm || "Confirm")) event.preventDefault();
  });
});
