const filter = document.getElementById("user-filter");
if (filter) {
  filter.addEventListener("change", () => {
    document.querySelectorAll(".user-row").forEach((row) => {
      row.style.display = !filter.value || row.id === filter.value ? "table-row" : "none";
    });
  });
}

const runnerFilter = document.getElementById("runner-filter");
if (runnerFilter) {
  runnerFilter.addEventListener("change", () => {
    document.querySelectorAll(".runner-row").forEach((row) => {
      row.style.display = !runnerFilter.value || row.id === runnerFilter.value ? "table-row" : "none";
    });
  });
}

const tacFilter = document.getElementById("tac-filter");
if (tacFilter) {
  tacFilter.addEventListener("change", () => {
    document.querySelectorAll(".tac-row").forEach((row) => {
      row.style.display = !tacFilter.value || row.id === tacFilter.value ? "table-row" : "none";
    });
  });
}


// Archive: one dropdown to pick a snapshot instead of a card per archive,
// with a single fixed set of View/Download/Delete controls that follow
// whichever one is currently selected.
const archiveSelect = document.getElementById("archive-select");
if (archiveSelect) {
  const viewLink = document.getElementById("archive-view-link");
  const downloadLink = document.getElementById("archive-download-link");
  const deleteForm = document.getElementById("archive-delete-form");
  archiveSelect.addEventListener("change", () => {
    const id = archiveSelect.value;
    if (viewLink) viewLink.href = `/archive/${id}`;
    if (downloadLink) downloadLink.href = `/archive/${id}/download`;
    if (deleteForm) deleteForm.action = `/archive/${id}/delete`;
  });
}

// Long lists (Users, Athletes) can get very long with a busy roster -- a
// collapse toggle next to each title keeps the page scannable.
// Remembered per browser via localStorage since it's a pure viewing
// convenience, not something that needs to sync across devices/viewers.
document.querySelectorAll(".list-toggle").forEach((button) => {
  const target = document.getElementById(button.dataset.target || "");
  if (!target) return;
  const showLabel = button.dataset.showLabel || button.textContent;
  const hideLabel = button.dataset.hideLabel || button.textContent;
  const storageKey = `cad-setup-collapsed-${button.dataset.target}`;
  const applyState = (collapsed) => {
    target.hidden = collapsed;
    button.textContent = collapsed ? showLabel : hideLabel;
  };
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(storageKey) === "1";
  } catch (_) {
    // Storage unavailable; default to expanded.
  }
  applyState(collapsed);
  button.addEventListener("click", () => {
    const nextCollapsed = !target.hidden;
    applyState(nextCollapsed);
    try {
      localStorage.setItem(storageKey, nextCollapsed ? "1" : "0");
    } catch (_) {
      // Storage unavailable; state just won't persist across reloads.
    }
  });
});

document.querySelectorAll(".row-action-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    const action = form.querySelector('select[name="action"]')?.value;
    if (action === "delete" && !window.confirm(form.dataset.deleteConfirm || "Delete this item?")) {
      event.preventDefault();
    }
  });
});

// Configuration page: drag-and-drop reordering of the small settings
// boxes ("Riordina caselle" / "Salva disposizione"). The handle (not the
// whole panel) is what's draggable, so dragging never fights with
// selecting text or using the form fields inside a box.
const reorderGrid = document.getElementById("reorder-grid");
if (reorderGrid) {
  const stacks = Array.from(reorderGrid.querySelectorAll(":scope > .stack"));

  (function applyStoredOrder() {
    const order = window.CAD_SETUP_BOX_ORDER;
    if (!Array.isArray(order)) return;
    order.forEach((columnIds, columnIndex) => {
      const stack = stacks[columnIndex];
      if (!stack || !Array.isArray(columnIds)) return;
      columnIds.forEach((boxId) => {
        const box = reorderGrid.querySelector(`[data-box="${CSS.escape(boxId)}"]`);
        if (box) stack.appendChild(box);
      });
    });
  })();

  (function applyStoredFullSpan() {
    const fullSpan = window.CAD_SETUP_FULL_SPAN_BOXES;
    if (!Array.isArray(fullSpan)) return;
    reorderGrid.querySelectorAll("[data-box]").forEach((box) => {
      box.classList.toggle("full-span", fullSpan.includes(box.dataset.box));
    });
  })();

  let dragged = null;
  reorderGrid.querySelectorAll("[data-box]").forEach((box) => {
    const handle = box.querySelector(".drag-handle");
    handle?.addEventListener("dragstart", (event) => {
      dragged = box;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", box.dataset.box || "");
    });
    handle?.addEventListener("dragend", () => { dragged = null; });
  });

  // Works for both a single-column stack (compare by Y only, siblings
  // never overlap horizontally) and a two-up grid zone (nearest sibling by
  // straight-line distance, then decide before/after from which side of
  // its center the cursor landed on).
  function insertionTarget(stack, x, y, dragged) {
    const siblings = Array.from(stack.children).filter((el) => el !== dragged);
    let closest = null;
    let closestDist = Infinity;
    let before = true;
    siblings.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
        before = y < cy || (Math.abs(y - cy) < rect.height / 3 && x < cx);
      }
    });
    if (!closest) return null;
    return before ? closest : closest.nextElementSibling;
  }

  stacks.forEach((stack) => {
    stack.addEventListener("dragover", (event) => {
      if (!dragged) return;
      event.preventDefault();
      stack.insertBefore(dragged, insertionTarget(stack, event.clientX, event.clientY, dragged));
    });
  });

  reorderGrid.querySelectorAll("[data-box]").forEach((box) => {
    box.querySelector(".width-toggle")?.addEventListener("click", () => {
      box.classList.toggle("full-span");
    });
  });

  const toggleButton = document.getElementById("reorder-toggle");
  const saveButton = document.getElementById("reorder-save");
  toggleButton?.addEventListener("click", () => {
    const active = reorderGrid.toggleAttribute("data-reorder-active");
    reorderGrid.querySelectorAll(".drag-handle, .width-toggle").forEach((el) => { el.hidden = !active; });
    if (saveButton) saveButton.hidden = !active;
  });

  saveButton?.addEventListener("click", async () => {
    const columns = stacks.map((stack) => Array.from(stack.querySelectorAll(":scope > [data-box]")).map((box) => box.dataset.box));
    const fullSpan = Array.from(reorderGrid.querySelectorAll("[data-box].full-span")).map((box) => box.dataset.box);
    await fetch("/setup/box-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns, full_span: fullSpan }),
    }).catch(() => {});
    reorderGrid.removeAttribute("data-reorder-active");
    reorderGrid.querySelectorAll(".drag-handle, .width-toggle").forEach((el) => { el.hidden = true; });
    saveButton.hidden = true;
  });
}
