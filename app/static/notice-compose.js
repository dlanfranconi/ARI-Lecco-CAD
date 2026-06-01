function initRunnerComposer(root) {
  const bib = root.querySelector(".runner-bib") || document.getElementById("runner-bib");
  const checkpoint = root.querySelector(".checkpoint") || document.getElementById("checkpoint");
  const message = root.querySelector(".notice-message") || document.getElementById("notice-message");
  const crono = root.querySelector(".crono-input");
  const refBib = root.querySelector(".runner-ref-bib") || document.getElementById("runner-ref-bib");
  const refName = root.querySelector(".runner-ref-name") || document.getElementById("runner-ref-name");
  const refTown = root.querySelector(".runner-ref-town") || document.getElementById("runner-ref-town");
  let currentRunner = null;

  if (!bib || !checkpoint || !message) return;

  async function lookupRunner() {
    const value = bib.value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean)[0] || "";
    if (!value) return;
    const response = await fetch(`/api/runners/${encodeURIComponent(value)}`);
    if (!response.ok) return;
    currentRunner = await response.json();
    if (refBib) refBib.textContent = currentRunner.bib_number || "";
    if (refName) refName.textContent = currentRunner.name || "";
    if (refTown) refTown.textContent = currentRunner.hometown || "";
    composeMessage();
  }

  function selectedPreposition() {
    const option = checkpoint.selectedOptions?.[0];
    if (option?.dataset.preposition) return option.dataset.preposition;
    return (window.CAD_LABELS?.language === "Lingua") ? "a" : "to";
  }

  function composeMessage() {
    if (!currentRunner?.name || !checkpoint.value) return;
    const template = window.CAD_LABELS?.arrival_template || "Runner {name} is arriving {prep} {checkpoint}.";
    message.value = template
      .replaceAll("{bib}", currentRunner.bib_number || bib.value.trim())
      .replaceAll("{name}", currentRunner.name)
      .replaceAll("{checkpoint}", checkpoint.value)
      .replaceAll("{prep}", selectedPreposition());
  }

  bib.addEventListener("change", lookupRunner);
  bib.addEventListener("blur", lookupRunner);
  checkpoint.addEventListener("change", composeMessage);
  bib.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      bib.blur();
      lookupRunner();
    }
  });
  message.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      message.blur();
    }
  });
  crono?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      crono.blur();
    }
  });
}

document.querySelectorAll("[data-runner-compose]").forEach(initRunnerComposer);
if (!document.querySelector("[data-runner-compose]") && document.getElementById("runner-bib")) {
  initRunnerComposer(document);
}
