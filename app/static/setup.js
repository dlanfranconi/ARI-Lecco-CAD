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
