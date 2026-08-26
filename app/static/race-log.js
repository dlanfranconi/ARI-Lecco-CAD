const LAST_OPERATOR_KEY = "dispatch-last-operator";

// Custom dropdown instead of a native <datalist> -- Android's system WebView
// (what the Capacitor app runs on) doesn't render datalist suggestion
// popups at all, so tapping the field showed nothing there even though it
// worked fine in a real desktop/mobile browser.
function initOperatorCombobox() {
  const form = document.querySelector('form[action="/logs"]');
  const input = form?.querySelector(".operator-combobox");
  const hidden = form?.querySelector(".operator-id");
  const suggestionsList = form?.querySelector("#operator-suggestions");
  if (!input || !hidden || !suggestionsList) return;
  const options = Array.from(document.querySelectorAll("#operator-options option"));

  function matchesForValue() {
    const value = input.value.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.value.trim().toLowerCase().includes(value));
  }

  function hideSuggestions() {
    suggestionsList.classList.add("hidden");
  }

  function selectOption(option) {
    if (!option) return false;
    input.value = option.value;
    hidden.value = option.dataset.id || "";
    input.setCustomValidity("");
    hideSuggestions();
    return Boolean(hidden.value);
  }

  function renderSuggestions() {
    const matches = matchesForValue();
    suggestionsList.innerHTML = "";
    if (!matches.length) {
      hideSuggestions();
      return;
    }
    matches.slice(0, 50).forEach((option) => {
      const li = document.createElement("li");
      li.textContent = option.value;
      // mousedown (not click) fires before the input's blur, so the tap
      // registers as a selection instead of getting wiped out by blur's
      // own validation/hide first.
      li.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectOption(option);
      });
      suggestionsList.appendChild(li);
    });
    suggestionsList.classList.remove("hidden");
  }

  function syncId() {
    const value = input.value.trim().toLowerCase();
    const exact = options.find((option) => option.value.trim().toLowerCase() === value);
    if (exact) {
      hidden.value = exact.dataset.id || "";
      input.setCustomValidity("");
      return true;
    }
    hidden.value = "";
    input.setCustomValidity(!input.value.trim() ? "" : (window.CAD_LABELS?.select_operator_error || "Select a valid user/tactical callsign."));
    return false;
  }

  input.addEventListener("input", () => {
    syncId();
    renderSuggestions();
  });
  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("blur", () => {
    syncId();
    hideSuggestions();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }
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
      return;
    }
    localStorage.setItem(LAST_OPERATOR_KEY, JSON.stringify({ id: hidden.value, label: input.value }));
  });

  try {
    const saved = JSON.parse(localStorage.getItem(LAST_OPERATOR_KEY) || "null");
    if (saved?.id) {
      const match = options.find((option) => option.dataset.id === saved.id);
      if (match) selectOption(match);
    }
  } catch (_) {
    // Ignore malformed/unavailable localStorage data.
  }
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
