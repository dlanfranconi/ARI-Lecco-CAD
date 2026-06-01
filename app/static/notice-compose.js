function initRunnerComposer(root) {
  const bib = root.querySelector(".runner-bib") || document.getElementById("runner-bib");
  const checkpoint = root.querySelector(".checkpoint") || document.getElementById("checkpoint");
  const message = root.querySelector(".notice-message") || document.getElementById("notice-message");
  const crono = root.querySelector(".crono-input");
  const refBib = root.querySelector(".runner-ref-bib") || document.getElementById("runner-ref-bib");
  const refName = root.querySelector(".runner-ref-name") || document.getElementById("runner-ref-name");
  const refTown = root.querySelector(".runner-ref-town") || document.getElementById("runner-ref-town");
  let runnerList = root.querySelector(".runner-list");
  let currentRunners = [];

  if (!bib || !checkpoint || !message) return;

  if (!runnerList) {
    runnerList = document.createElement("div");
    runnerList.className = "runner-list hidden";
    const reference = root.querySelector("[data-runner-reference]");
    if (reference) reference.insertAdjacentElement("afterend", runnerList);
    else bib.closest("label")?.insertAdjacentElement("afterend", runnerList);
  }

  function splitBibs() {
    const seen = new Set();
    return bib.value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean).filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  async function fetchRunner(value) {
    const response = await fetch(`/api/runners/${encodeURIComponent(value)}`);
    if (!response.ok) return { bib_number: value, name: "", hometown: "" };
    const data = await response.json();
    return data.bib_number ? data : { bib_number: value, name: "", hometown: "" };
  }

  async function lookupRunner() {
    const bibs = splitBibs();
    if (!bibs.length) {
      currentRunners = [];
      renderRunnerList();
      return;
    }
    currentRunners = await Promise.all(bibs.map(fetchRunner));
    const first = currentRunners[0] || {};
    if (refBib) refBib.textContent = first.bib_number || "";
    if (refName) refName.textContent = first.name || "";
    if (refTown) refTown.textContent = first.hometown || "";
    renderRunnerList();
    composeMessage();
  }

  function selectedPreposition() {
    const option = checkpoint.selectedOptions?.[0];
    if (option?.dataset.preposition) return option.dataset.preposition;
    return (window.CAD_LABELS?.language === "Lingua") ? "a" : "to";
  }

  function fallbackCrono() {
    return crono?.value || document.getElementById("race-timer")?.textContent?.trim() || "";
  }

  function runnerLine(runner, index) {
    const currentCrono = runnerList.querySelectorAll(".runner-crono")[index]?.value || fallbackCrono();
    if (window.CAD_LABELS?.language === "Lingua") {
      return `Atleta numero ${runner.bib_number || ""}${runner.name ? `, ${runner.name}` : ""}${currentCrono ? ` alle ${currentCrono}` : ""}`;
    }
    return `Runner ${runner.bib_number || ""}${runner.name ? ` ${runner.name}` : ""}${currentCrono ? ` at ${currentCrono}` : ""}`;
  }

  function composeMessage() {
    if (!currentRunners.length || !checkpoint.value) return;
    const template = window.CAD_LABELS?.group_arrival_template || "At {checkpoint}, the following athletes are passing: {runners}.";
    message.value = template
      .replaceAll("{checkpoint}", checkpoint.value)
      .replaceAll("{prep}", selectedPreposition())
      .replaceAll("{runners}", currentRunners.slice(0, 4).map(runnerLine).join("; "));
  }

  function renderRunnerList() {
    if (!currentRunners.length) {
      runnerList.classList.add("hidden");
      runnerList.innerHTML = "";
      return;
    }
    runnerList.classList.remove("hidden");
    const title = window.CAD_LABELS?.runner_list || "Athlete List";
    const cronoLabel = window.CAD_LABELS?.runner_crono || "Runner Crono";
    const positionLabel = window.CAD_LABELS?.athlete_position || "Athlete Position";
    runnerList.innerHTML = `<strong>${title}</strong>` + currentRunners.map((runner) => `
      <div class="runner-list-row">
        <span>${runner.bib_number || ""}${runner.name ? ` - ${runner.name}` : ""}${runner.hometown ? ` (${runner.hometown})` : ""}</span>
        <label>${positionLabel}<input class="runner-position" name="runner_position" placeholder="#"></label>
        <label>${cronoLabel}<input class="runner-crono" name="runner_crono" value="${fallbackCrono()}" placeholder="HH:MM:SS"></label>
      </div>`).join("");
    runnerList.querySelectorAll(".runner-crono, .runner-position").forEach((input) => input.addEventListener("input", composeMessage));
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
  crono?.addEventListener("input", () => {
    runnerList.querySelectorAll(".runner-crono").forEach((input) => {
      if (!input.value) input.value = crono.value;
    });
    composeMessage();
  });
}

document.querySelectorAll("[data-runner-compose]").forEach(initRunnerComposer);
if (!document.querySelector("[data-runner-compose]") && document.getElementById("runner-bib")) {
  initRunnerComposer(document);
}
