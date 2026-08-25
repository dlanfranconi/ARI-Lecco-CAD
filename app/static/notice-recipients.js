// Remembers the last-picked notice recipients across submit/approve forms so
// back-to-back alerts to the same station don't require re-picking every
// time. Only applies as a default when a form has nothing pre-checked --
// never overrides an explicit selection already loaded from the server
// (e.g. a pending item's own submitter-chosen recipients).
const RECIPIENT_MEMORY_KEY = "cad-notice-last-recipients";

function initRecipientMemory() {
  document.querySelectorAll("form[data-recipients]").forEach((form) => {
    const boxes = form.querySelectorAll('input[name="notify_user_ids"]');
    if (!boxes.length) return;
    const anyChecked = Array.from(boxes).some((box) => box.checked);
    if (!anyChecked) {
      let remembered = [];
      try {
        remembered = JSON.parse(localStorage.getItem(RECIPIENT_MEMORY_KEY) || "[]");
      } catch (_) {
        remembered = [];
      }
      boxes.forEach((box) => {
        if (remembered.includes(box.value)) box.checked = true;
      });
    }
    form.addEventListener("submit", () => {
      const selected = Array.from(boxes).filter((box) => box.checked).map((box) => box.value);
      try {
        localStorage.setItem(RECIPIENT_MEMORY_KEY, JSON.stringify(selected));
      } catch (_) {
        // Storage unavailable; nothing to remember, fail silently.
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initRecipientMemory);
