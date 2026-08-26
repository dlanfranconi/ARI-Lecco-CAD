// Manages the "Send To" recipient picker on the notice submit and approve
// forms: Announcer/Broadcast are mutually exclusive special modes, specific
// stations are a multi-select that's mutually exclusive with both of those.
// Also remembers the last-used selection (mode + stations) across submits so
// back-to-back alerts to the same target don't require re-picking every
// time -- restored only on the fresh submit form, never on an approve form
// (those already reflect the real, already-chosen state of that notice).
const RECIPIENT_MEMORY_KEY = "cad-notice-last-recipients";
const STATION_MRU_KEY = "cad-notice-station-mru";
const STATION_MRU_LIMIT = 25;

// Moves recently-selected stations towards the top of the individual-station
// list (below the fixed Broadcast/Announcer pair), most-recent first.
// Stations never selected keep their original (alphabetical) relative order,
// appended after the MRU ones.
function reorderStations(form) {
  const container = form.querySelector(".recipient-checks");
  if (!container) return;
  let mru;
  try {
    mru = JSON.parse(localStorage.getItem(STATION_MRU_KEY) || "[]");
    if (!Array.isArray(mru)) mru = [];
  } catch (_) {
    mru = [];
  }
  if (!mru.length) return;

  const originalLabels = Array.from(container.querySelectorAll(".recipient-individual")).map((box) => box.closest("label"));
  const byValue = new Map(originalLabels.map((label) => [label.querySelector(".recipient-individual").value, label]));

  const seen = new Set();
  const ordered = [];
  mru.forEach((id) => {
    const label = byValue.get(id);
    if (label && !seen.has(id)) {
      ordered.push(label);
      seen.add(id);
    }
  });
  originalLabels.forEach((label) => {
    const value = label.querySelector(".recipient-individual").value;
    if (!seen.has(value)) {
      ordered.push(label);
      seen.add(value);
    }
  });

  ordered.forEach((label) => container.appendChild(label));
}

function updateStationMru(stationIds) {
  if (!stationIds.length) return;
  try {
    let mru = JSON.parse(localStorage.getItem(STATION_MRU_KEY) || "[]");
    if (!Array.isArray(mru)) mru = [];
    mru = mru.filter((id) => !stationIds.includes(id));
    mru = [...stationIds, ...mru].slice(0, STATION_MRU_LIMIT);
    localStorage.setItem(STATION_MRU_KEY, JSON.stringify(mru));
  } catch (_) {
    // Storage unavailable; nothing to remember, fail silently.
  }
}

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
  reorderStations(form);

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
        // Guard against a stale value from before this mode/stationIds shape
        // existed (an older build stored a flat array here) -- fall back to
        // the Announcer default rather than end up with nothing checked.
        if (remembered && typeof remembered === "object" && !Array.isArray(remembered) && typeof remembered.mode === "string") {
          applyRecipientState(form, remembered);
        }
      } catch (_) {
        // Storage unavailable or corrupt; keep the Announcer default.
      }
    }
  }

  form.addEventListener("submit", () => {
    const state = recipientState(form);
    try {
      localStorage.setItem(RECIPIENT_MEMORY_KEY, JSON.stringify(state));
    } catch (_) {
      // Storage unavailable; nothing to remember, fail silently.
    }
    if (state.mode === "specific") updateStationMru(state.stationIds);
  });
}

// "Forward as approved notice" on the race-log entry form has its own
// recipient picker tucked into a popup, only relevant once that checkbox
// is actually checked -- rather than permanently taking up space in an
// already-busy form.
function initForwardRecipientsModal() {
  const checkbox = document.getElementById("forward-bulletin-check");
  const modal = document.getElementById("forward-recipients-modal");
  if (!checkbox || !modal) return;
  checkbox.addEventListener("change", () => {
    modal.classList.toggle("hidden", !checkbox.checked);
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
  document.getElementById("forward-recipients-close")?.addEventListener("click", () => modal.classList.add("hidden"));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form[data-recipients]").forEach(initRecipientPicker);
  initForwardRecipientsModal();
});
