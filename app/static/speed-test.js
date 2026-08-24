const speedLabels = window.CAD_LABELS || {};
const DOWNLOAD_BYTES = 5_000_000;
const UPLOAD_BYTES = 3_000_000;

const runButton = document.getElementById("speedtest-run");
const downloadEl = document.getElementById("speedtest-download");
const uploadEl = document.getElementById("speedtest-upload");
const latencyEl = document.getElementById("speedtest-latency");
const errorEl = document.getElementById("speedtest-error");

function mbps(bytes, seconds) {
  return ((bytes * 8) / 1_000_000 / seconds).toFixed(1);
}

async function measureLatency() {
  const start = performance.now();
  await fetch("/api/network/speedtest-download?size=1", { cache: "no-store" });
  return performance.now() - start;
}

async function measureDownload() {
  const start = performance.now();
  const response = await fetch(`/api/network/speedtest-download?size=${DOWNLOAD_BYTES}`, { cache: "no-store" });
  const blob = await response.blob();
  const seconds = (performance.now() - start) / 1000;
  return mbps(blob.size, seconds);
}

async function measureUpload() {
  const payload = new Blob([new Uint8Array(UPLOAD_BYTES)]);
  const start = performance.now();
  await fetch("/api/network/speedtest-upload", { method: "POST", body: payload });
  const seconds = (performance.now() - start) / 1000;
  return mbps(UPLOAD_BYTES, seconds);
}

runButton?.addEventListener("click", async () => {
  errorEl.textContent = "";
  downloadEl.textContent = "…";
  uploadEl.textContent = "…";
  latencyEl.textContent = "…";
  runButton.disabled = true;
  runButton.textContent = speedLabels.testing || "Testing...";
  try {
    latencyEl.textContent = `${Math.round(await measureLatency())} ms`;
    downloadEl.textContent = `${await measureDownload()} Mbps`;
    uploadEl.textContent = `${await measureUpload()} Mbps`;
  } catch (err) {
    errorEl.textContent = speedLabels.test_failed || "Test failed";
  } finally {
    runButton.disabled = false;
    runButton.textContent = speedLabels.run_test || "Run Test";
  }
});
