const bib = document.getElementById("runner-bib");
const checkpoint = document.getElementById("checkpoint");
const message = document.getElementById("notice-message");
const refBib = document.getElementById("runner-ref-bib");
const refName = document.getElementById("runner-ref-name");
const refTown = document.getElementById("runner-ref-town");
let currentRunner = null;

async function lookupRunner() {
  const value = bib.value.trim();
  if (!value) return;
  const response = await fetch(`/api/runners/${encodeURIComponent(value)}`);
  if (!response.ok) return;
  currentRunner = await response.json();
  refBib.textContent = currentRunner.bib_number || "";
  refName.textContent = currentRunner.name || "";
  refTown.textContent = currentRunner.hometown || "";
  composeMessage();
}

function composeMessage() {
  if (!currentRunner?.name || !checkpoint.value) return;
  const template = window.CAD_LABELS?.arrival_template || "Runner {name} is arriving to {checkpoint}.";
  message.value = template.replace("{name}", currentRunner.name).replace("{checkpoint}", checkpoint.value);
}

bib?.addEventListener("change", lookupRunner);
bib?.addEventListener("blur", lookupRunner);
checkpoint?.addEventListener("change", composeMessage);
