const filter = document.getElementById("user-filter");
if (filter) {
  filter.addEventListener("change", () => {
    document.querySelectorAll(".user-row").forEach((row) => {
      row.style.display = !filter.value || row.id === filter.value ? "table-row" : "none";
    });
  });
}
