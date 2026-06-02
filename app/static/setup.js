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
