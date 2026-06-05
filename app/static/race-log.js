function initOperatorCombobox() {
  const input = document.querySelector(".operator-combobox");
  const hidden = document.querySelector(".operator-id");
  if (!input || !hidden) return;
  const options = Array.from(document.querySelectorAll("#operator-options option"));
  function matchesForValue() {
    const value = input.value.trim().toLowerCase();
    if (!value) return [];
    return options.filter((option) => option.value.trim().toLowerCase().includes(value));
  }

  function selectOption(option) {
    if (!option) return false;
    input.value = option.value;
    hidden.value = option.dataset.id || "";
    input.setCustomValidity("");
    return Boolean(hidden.value);
  }

  function syncId() {
    const value = input.value.trim().toLowerCase();
    const exact = options.find((option) => option.value.trim().toLowerCase() === value);
    if (exact) return selectOption(exact);
    hidden.value = "";
    input.setCustomValidity(!input.value.trim() ? "" : (window.CAD_LABELS?.select_operator_error || "Select a valid user/tactical callsign."));
    return false;
  }
  input.addEventListener("input", syncId);
  input.addEventListener("change", syncId);
  input.addEventListener("blur", syncId);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (syncId()) {
      input.blur();
      return;
    }
    const matches = matchesForValue();
    if (matches.length === 1) {
      selectOption(matches[0]);
      input.blur();
      return;
    }
    if (matches.length === 0) input.reportValidity();
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
