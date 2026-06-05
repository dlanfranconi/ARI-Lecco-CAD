const raceTimer = document.getElementById("race-timer");
function pad(value) { return String(value).padStart(2, "0"); }
function renderRaceTimer() {
  if (!raceTimer?.dataset.startedEpochMs && !raceTimer?.dataset.startedAt) return;
  const startMs = Number(raceTimer.dataset.startedEpochMs || new Date(raceTimer.dataset.startedAt).getTime());
  if (Number.isNaN(startMs)) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  raceTimer.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
renderRaceTimer();
setInterval(renderRaceTimer, 1000);


document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm || "Confirm")) event.preventDefault();
  });
});
