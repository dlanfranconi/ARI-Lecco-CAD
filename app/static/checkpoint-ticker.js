// Bottom ticker on the Announcer page: continuously-scrolling strip showing
// the top male and female runners logged at the checkpoint currently being
// worked (the one behind the most recent Log Gara entry), so the top of the
// field stays visible at a glance without interrupting the main bulletin --
// refreshed periodically as new entries come in.
const TICKER_PIXELS_PER_SECOND = 60;
const tickerEl = document.getElementById("checkpoint-ticker");
const trackEl = document.getElementById("checkpoint-ticker-track");
const tickerLabels = window.CAD_LABELS || {};

function tickerGroupHtml(genderLabel, genderClass, entries) {
  if (!entries.length) return "";
  const items = entries
    .map((entry, index) => {
      const name = String(entry.name || "").trim();
      const who = name ? `${entry.bib} ${name}` : `${tickerLabels.bib_number || "Bib"} ${entry.bib}`;
      return `<span class="checkpoint-ticker-entry ${genderClass}"><span class="rank">${index + 1}.</span>${who}</span>`;
    })
    .join(" &nbsp; ");
  return `<span class="checkpoint-ticker-group"><strong class="${genderClass}">${genderLabel}</strong>${items}</span>`;
}

async function refreshCheckpointTicker() {
  if (!tickerEl || !trackEl) return;
  const response = await fetch("/api/checkpoint-leaderboard");
  if (!response.ok) return;
  const data = await response.json();
  const male = data.male || [];
  const female = data.female || [];
  const unspecified = data.unspecified || [];
  if (!data.checkpoint || (!male.length && !female.length && !unspecified.length)) {
    tickerEl.hidden = true;
    trackEl.style.animation = "none";
    return;
  }
  const html =
    `<span class="checkpoint-ticker-group"><strong>${data.checkpoint}</strong></span>` +
    tickerGroupHtml(tickerLabels.male || "M", "gender-m", male) +
    tickerGroupHtml(tickerLabels.female || "F", "gender-f", female) +
    tickerGroupHtml(tickerLabels.gender_unspecified || "?", "", unspecified);
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
