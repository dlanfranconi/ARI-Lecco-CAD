const raceTimer = document.getElementById("race-timer");
const raceTimerControls = document.getElementById("race-timer-controls");
const raceTimerLabels = window.CAD_LABELS || {};
let raceTimerStartMs = null;
let raceTimerBaseText = raceTimer?.textContent || "00:00:00";
let raceTimerState = raceTimerControls?.dataset.state || null;

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

// The Start/Stop/Reset button was server-rendered once at page load and never
// updated again — so if the race was started or stopped from another device
// or tab, this page kept showing the wrong button indefinitely even though the
// clock itself (renderRaceTimer, polled separately) was ticking correctly.
// This mirrors the same three-way branch base.html uses server-side, driven
// by the same poll that already updates the clock every 5s.
function renderRaceTimerControls(state) {
  if (!raceTimerControls || !state || state === raceTimerState) return;
  raceTimerState = state;
  if (state === "running") {
    raceTimerControls.innerHTML = `<form method="post" action="/race-timer/stop" data-confirm="${raceTimerLabels.stop_timer_confirm || ""}"><button class="danger compact-button">${raceTimerLabels.stop_timer || "Stop Timer"}</button></form>`;
  } else if (state === "stopped") {
    raceTimerControls.innerHTML = `<form method="post" action="/race-timer/reset" data-confirm="${raceTimerLabels.reset_timer_confirm || ""}"><button class="danger compact-button">${raceTimerLabels.reset_timer || "Reset Crono"}</button></form>`;
  } else {
    raceTimerControls.innerHTML = `<form method="post" action="/race-timer/start"><button class="start-button compact-button">${raceTimerLabels.start_timer || "Start Timer"}</button></form>`;
  }
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
    renderRaceTimerControls(data.state);
  } catch (_) {
    // Keep the local timer running if the network briefly drops.
  }
}

setRaceTimerStart(raceTimer?.dataset.startedEpochMs || (raceTimer?.dataset.startedAt ? new Date(raceTimer.dataset.startedAt).getTime() : ""));
renderRaceTimer();
setInterval(renderRaceTimer, 1000);
refreshRaceTimerState();
setInterval(refreshRaceTimerState, 5000);

// Delegated (not per-form) so dynamically-swapped-in forms — like the timer
// controls above — get the same confirm behavior without needing to
// re-attach a listener every time the DOM changes.
document.addEventListener("submit", (event) => {
  const confirmMsg = event.target?.dataset?.confirm;
  if (confirmMsg && !window.confirm(confirmMsg)) event.preventDefault();
});
