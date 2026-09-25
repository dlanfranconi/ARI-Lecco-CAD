// Bottom ticker on the Announcer page: continuously-scrolling strip showing
// the first few runners logged at each checkpoint, so the top of the field
// stays visible at a glance without having to interrupt the main bulletin
// display -- refreshed periodically as new Log Gara entries come in.
const TICKER_PIXELS_PER_SECOND = 60;
const tickerEl = document.getElementById("checkpoint-ticker");
const trackEl = document.getElementById("checkpoint-ticker-track");
const tickerLabels = window.CAD_LABELS || {};

function tickerGroupHtml(checkpoint, entries) {
  const items = entries
    .map((entry, index) => {
      const name = String(entry.name || "").trim();
      const who = name ? `${entry.bib} ${name}` : `${tickerLabels.bib_number || "Bib"} ${entry.bib}`;
      return `<span class="checkpoint-ticker-entry"><span class="rank">${index + 1}.</span>${who}</span>`;
    })
    .join(" &nbsp; ");
  return `<span class="checkpoint-ticker-group"><strong>${checkpoint}</strong>${items}</span>`;
}

async function refreshCheckpointTicker() {
  if (!tickerEl || !trackEl) return;
  const response = await fetch("/api/checkpoint-leaderboard");
  if (!response.ok) return;
  const data = await response.json();
  const checkpoints = Object.keys(data).filter((checkpoint) => (data[checkpoint] || []).length);
  if (!checkpoints.length) {
    tickerEl.hidden = true;
    trackEl.style.animation = "none";
    return;
  }
  const html = checkpoints.map((checkpoint) => tickerGroupHtml(checkpoint, data[checkpoint])).join("");
  // Duplicated once so translateX(-50%) loops seamlessly with no visible seam.
  trackEl.innerHTML = html + html;
  tickerEl.hidden = false;
  trackEl.style.animation = "none";
  // Force reflow before measuring so the browser has laid out the new content.
  void trackEl.offsetWidth;
  const halfWidth = trackEl.scrollWidth / 2;
  const duration = Math.max(halfWidth / TICKER_PIXELS_PER_SECOND, 8);
  trackEl.style.animation = `checkpoint-ticker-scroll ${duration}s linear infinite`;
}

if (tickerEl && trackEl) {
  refreshCheckpointTicker();
  setInterval(refreshCheckpointTicker, 30000);
}
