function initOperatorCombobox() {
  const input = document.querySelector(".operator-combobox");
  const hidden = document.querySelector(".operator-id");
  if (!input || !hidden) return;
  const options = Array.from(document.querySelectorAll("#operator-options option"));
  function syncId() {
    const value = input.value.trim().toLowerCase();
    const exact = options.find((option) => option.value.trim().toLowerCase() === value);
    hidden.value = exact?.dataset.id || "";
  }
  input.addEventListener("input", syncId);
  input.addEventListener("change", syncId);
  input.addEventListener("blur", syncId);
}

function initStatusLocation() {
  document.querySelectorAll(".status-select").forEach((select) => {
    const container = select.closest("form") || document;
    const field = container.querySelector(".location-field");
    const input = field?.querySelector("input");
    const update = () => {
      const inTransit = select.selectedIndex === 2;
      field?.classList.toggle("hidden", !inTransit);
      if (!inTransit && input) input.value = "";
    };
    select.addEventListener("change", update);
    update();
  });
}

initOperatorCombobox();
initStatusLocation();
