// Manages the "Send To" recipient picker on the notice submit and approve
// forms: Announcer/Broadcast are mutually exclusive special modes, specific
// stations are a multi-select that's mutually exclusive with both of those.
// Also remembers the last-used selection (mode + stations) across submits so
// back-to-back alerts to the same target don't require re-picking every
// time -- restored only on the fresh submit form, never on an approve form
// (those already reflect the real, already-chosen state of that notice).
const RECIPIENT_MEMORY_KEY = "cad-notice-last-recipients";

function recipientState(form) {
  const specials = form.querySelectorAll(".recipient-special");
  const individuals = Array.from(form.querySelectorAll(".recipient-individual"));
  const stationIds = individuals.filter((box) => box.checked).map((box) => box.value);
  if (stationIds.length) return { mode: "specific", stationIds };
  let mode = "announcer";
  specials.forEach((box) => {
    if (box.checked) mode = box.dataset.recipientMode;
  });
  return { mode, stationIds: [] };
}

function applyRecipientState(form, state) {
  const specials = form.querySelectorAll(".recipient-special");
  const individuals = form.querySelectorAll(".recipient-individual");
  specials.forEach((box) => {
    box.checked = box.dataset.recipientMode === state.mode;
  });
  individuals.forEach((box) => {
    box.checked = state.mode === "specific" && state.stationIds.includes(box.value);
  });
}

function initRecipientPicker(form) {
  const specials = Array.from(form.querySelectorAll(".recipient-special"));
  const individuals = Array.from(form.querySelectorAll(".recipient-individual"));
  if (!specials.length && !individuals.length) return;

  specials.forEach((box) => {
    box.addEventListener("change", () => {
      if (!box.checked) {
        box.checked = true; // specials act like a radio group -- always exactly one selected
        return;
      }
      specials.forEach((other) => { if (other !== box) other.checked = false; });
      individuals.forEach((other) => { other.checked = false; });
    });
  });
  const announcerBox = specials.find((box) => box.dataset.recipientMode === "announcer");
  individuals.forEach((box) => {
    box.addEventListener("change", () => {
      if (box.checked) {
        specials.forEach((special) => { special.checked = false; });
        return;
      }
      // Nothing left selected at all -- fall back to the Announcer default
      // rather than leaving an ambiguous, all-unchecked state.
      if (announcerBox && !individuals.some((other) => other.checked)) announcerBox.checked = true;
    });
  });

  if (form.hasAttribute("data-recipients-restore")) {
    const currentlyExplicit = individuals.some((box) => box.checked) || specials.some((box) => box.checked && box.dataset.recipientMode !== "announcer");
    if (!currentlyExplicit) {
      try {
        const remembered = JSON.parse(localStorage.getItem(RECIPIENT_MEMORY_KEY) || "null");
        if (remembered) applyRecipientState(form, remembered);
      } catch (_) {
        // Storage unavailable or corrupt; keep the Announcer default.
      }
    }
  }

  form.addEventListener("submit", () => {
    try {
      localStorage.setItem(RECIPIENT_MEMORY_KEY, JSON.stringify(recipientState(form)));
    } catch (_) {
      // Storage unavailable; nothing to remember, fail silently.
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form[data-recipients]").forEach(initRecipientPicker);
});
