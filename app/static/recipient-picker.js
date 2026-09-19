// Collapses a `.recipient-checks` checkbox list into a toggleable dropdown
// (`.recipient-picker`) with a button summarizing the current selection --
// purely presentational, the checkboxes underneath (and whatever else
// listens to their change events, e.g. notice-recipients.js) are untouched.
const recipientPickerLabels = window.CAD_LABELS || {};

function summarizeRecipients(panel, fallback) {
  const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'));
  if (!checked.length) return fallback;
  const names = checked.map((box) => box.closest("label")?.textContent.trim()).filter(Boolean);
  if (names.length > 3) return (recipientPickerLabels.recipients_selected_count || "{n} selected").replace("{n}", names.length);
  return names.join(", ");
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
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
}

document.addEventListener("click", () => {
  document.querySelectorAll(".recipient-picker .recipient-checks").forEach((panel) => {
    panel.hidden = true;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".recipient-picker").forEach(initRecipientPickerToggle);
});
