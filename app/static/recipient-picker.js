// Collapses a `.recipient-checks` checkbox list into a toggleable dropdown
// (`.recipient-picker`) with a button summarizing the current selection --
// purely presentational, the checkboxes underneath (and whatever else
// listens to their change events, e.g. notice-recipients.js) are untouched.

function summarizeRecipients(panel, fallback) {
  const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'));
  if (!checked.length) return fallback;
  // One name per line (not a comma-joined, ellipsis-truncated summary) so
  // the closed toggle reads like an actual list of who's selected.
  return checked.map((box) => box.closest("label")?.textContent.trim()).filter(Boolean).join("\n");
}

// The panel is position:fixed (see styles.css for why) so it has to be
// placed in JS from the toggle's own screen position, then nudged back
// on-screen if that would run it off the right edge or the bottom.
function positionPanel(toggle, panel) {
  const rect = toggle.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${rect.left}px`;
  const panelRect = panel.getBoundingClientRect();
  const overflowRight = panelRect.right - (window.innerWidth - 8);
  if (overflowRight > 0) panel.style.left = `${Math.max(8, rect.left - overflowRight)}px`;
  const overflowBottom = panelRect.bottom - (window.innerHeight - 8);
  if (overflowBottom > 0) panel.style.top = `${Math.max(8, rect.top - panelRect.height - 4)}px`;
}

function initRecipientPickerToggle(wrapper) {
  const toggle = wrapper.querySelector(".recipient-picker-toggle");
  const panel = wrapper.querySelector(".recipient-checks");
  if (!toggle || !panel) return;
  const fallback = toggle.textContent.trim();
  const refresh = () => {
    toggle.textContent = summarizeRecipients(panel, fallback);
  };
  // Recompute once on init too, not just on future changes -- a script
  // loaded earlier (e.g. notice-recipients.js restoring a remembered
  // selection) may have already checked boxes here without a live "change"
  // event, which the toggle's initial server-rendered text wouldn't reflect.
  refresh();
  panel.addEventListener("change", refresh);
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = panel.hidden;
    document.querySelectorAll(".recipient-picker .recipient-checks").forEach((other) => {
      if (other !== panel) other.hidden = true;
    });
    panel.hidden = !willOpen;
    if (!panel.hidden) positionPanel(toggle, panel);
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
}

function closeAllPanels() {
  document.querySelectorAll(".recipient-picker .recipient-checks").forEach((panel) => {
    panel.hidden = true;
  });
}
document.addEventListener("click", closeAllPanels);
// position:fixed panels don't track the page scrolling underneath them --
// close instead of leaving one visually detached from its toggle button.
// Scroll events are capture-only (non-bubbling), so this still sees scrolls
// from anywhere, including the panel's own internally-scrollable checkbox
// list -- skip those so scrolling through a long list doesn't close it.
window.addEventListener(
  "scroll",
  (event) => {
    document.querySelectorAll(".recipient-picker .recipient-checks").forEach((panel) => {
      if (panel.contains(event.target)) return;
      panel.hidden = true;
    });
  },
  { passive: true, capture: true }
);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".recipient-picker").forEach(initRecipientPickerToggle);
});
