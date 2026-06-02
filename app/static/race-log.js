function initOperatorCombobox() {
  const input = document.querySelector(".operator-combobox");
  const hidden = document.querySelector(".operator-id");
  if (!input || !hidden) return;
  const options = Array.from(document.querySelectorAll("#operator-options option"));
  function syncId() {
    const value = input.value.trim().toLowerCase();
    const exact = options.find((option) => option.value.trim().toLowerCase() === value);
    hidden.value = exact?.dataset.id || "";
    input.setCustomValidity(hidden.value || !input.value.trim() ? "" : (window.CAD_LABELS?.select_operator_error || "Select a valid user/tactical callsign."));
    return Boolean(hidden.value);
  }
  input.addEventListener("input", syncId);
  input.addEventListener("change", syncId);
  input.addEventListener("blur", syncId);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !syncId()) {
      event.preventDefault();
      input.reportValidity();
    }
  });
  input.closest("form")?.addEventListener("submit", (event) => {
    if (!syncId()) {
      event.preventDefault();
      input.reportValidity();
    }
  });
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
