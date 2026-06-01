const raceTimer = document.getElementById("race-timer");
function pad(value) { return String(value).padStart(2, "0"); }
function renderRaceTimer() {
  if (!raceTimer?.dataset.startedAt) return;
  const start = new Date(raceTimer.dataset.startedAt);
  if (Number.isNaN(start.getTime())) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  raceTimer.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
renderRaceTimer();
setInterval(renderRaceTimer, 1000);
