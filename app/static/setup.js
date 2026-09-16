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

  stacks.forEach((stack) => {
    stack.addEventListener("dragover", (event) => {
      if (!dragged) return;
      event.preventDefault();
      const siblings = Array.from(stack.children).filter((el) => el !== dragged);
      const after = siblings.find((el) => event.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);
      stack.insertBefore(dragged, after || null);
    });
  });

  const toggleButton = document.getElementById("reorder-toggle");
  const saveButton = document.getElementById("reorder-save");
  toggleButton?.addEventListener("click", () => {
    const active = reorderGrid.toggleAttribute("data-reorder-active");
    reorderGrid.querySelectorAll(".drag-handle").forEach((handle) => { handle.hidden = !active; });
    if (saveButton) saveButton.hidden = !active;
  });

  saveButton?.addEventListener("click", async () => {
    const columns = stacks.map((stack) => Array.from(stack.querySelectorAll(":scope > [data-box]")).map((box) => box.dataset.box));
    await fetch("/setup/box-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns }),
    }).catch(() => {});
    reorderGrid.removeAttribute("data-reorder-active");
    reorderGrid.querySelectorAll(".drag-handle").forEach((handle) => { handle.hidden = true; });
    saveButton.hidden = true;
  });
}
