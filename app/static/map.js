const map = L.map("map").setView([45.85, 9.39], 11);
const markers = new Map();
const trails = new Map();
let trailMinutes = 60;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Common-subset approximation of the open APRS symbol table (primary
// table "/") -- not the full ~240-symbol spec, just enough to tell common
// station types apart at a glance the way aprs.fi's own icon set does.
// Anything not covered here (or D-STAR, which has no APRS symbol at all)
// falls back to a generic marker.
const APRS_SYMBOLS = {
  ">": "\u{1F697}", // car
  "<": "\u{1F3CD}\u{FE0F}", // motorcycle
  "k": "\u{1F69A}", // truck
  "v": "\u{1F690}", // van
  "b": "\u{1F6B2}", // bicycle
  "[": "\u{1F3C3}", // jogger / person
  "-": "\u{1F3E0}", // house / HQ
  "#": "\u{1F4E1}", // digipeater
  "_": "\u{26C5}", // weather station
  "s": "\u{26F5}", // boat / ship
  "'": "\u{2708}\u{FE0F}", // small aircraft
  "j": "\u{1F699}", // jeep / 4x4
};
const DSTAR_ICON = "\u{1F4F6}";
const DEFAULT_ICON = "\u{1F4CD}";

function iconFor(item) {
  const emoji = item.source === "D-STAR" ? DSTAR_ICON : (APRS_SYMBOLS[item.symbol_code] || DEFAULT_ICON);
  return L.divIcon({
    className: "aprs-marker-icon",
    html: `<span>${emoji}</span><span class="aprs-marker-label">${item.callsign}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

async function refreshTrails() {
  const response = await fetch(`/api/map/trails?minutes=${trailMinutes}`);
  if (!response.ok) return;
  const data = await response.json();
  trails.forEach((line, key) => {
    if (!(key in data)) {
      map.removeLayer(line);
      trails.delete(key);
    }
  });
  Object.entries(data).forEach(([key, points]) => {
    if (trails.has(key)) {
      trails.get(key).setLatLngs(points);
    } else {
      trails.set(key, L.polyline(points, { color: "#2a7fd4", weight: 2, opacity: 0.6 }).addTo(map));
    }
  });
}

async function refreshMap() {
  const response = await fetch("/api/map");
  if (!response.ok) return;
  const positions = await response.json();
  const bounds = [];
  const list = document.getElementById("position-list");
  list.innerHTML = "";
  const seen = new Set();

  positions.forEach((item) => {
    const latLng = [item.lat, item.lon];
    bounds.push(latLng);
    const key = `${item.source}:${item.callsign}`;
    seen.add(key);
    const title = `${item.callsign}${item.label ? " - " + item.label : ""}`;
    const html = `<strong>${title}</strong><br>${item.source}<br>${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}<br>${item.station_time}`;
    if (markers.has(key)) {
      markers.get(key).setLatLng(latLng).setIcon(iconFor(item)).setPopupContent(html);
    } else {
      markers.set(key, L.marker(latLng, { icon: iconFor(item) }).addTo(map).bindPopup(html));
    }

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<strong>${title}</strong><p class="meta">${item.source} ${item.station_time}</p><p>${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}</p>`;
    list.appendChild(card);
  });

  // Drop markers for stations that no longer appear (disabled/removed).
  markers.forEach((marker, key) => {
    if (!seen.has(key)) {
      map.removeLayer(marker);
      markers.delete(key);
    }
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });

  const heading = document.getElementById("latest-positions-heading");
  if (heading) {
    const template = window.CAD_LABELS?.updated_at_time || "{label} (updated at {time})";
    heading.textContent = template
      .replace("{label}", heading.dataset.label || heading.textContent)
      .replace("{time}", new Date().toLocaleTimeString());
  }
}

const trailSelect = document.getElementById("trail-duration");
if (trailSelect) {
  trailMinutes = Number(trailSelect.value) || 60;
  trailSelect.addEventListener("change", () => {
    trailMinutes = Number(trailSelect.value) || 60;
    refreshTrails();
  });
}

refreshMap();
refreshTrails();
setInterval(refreshMap, 30000);
setInterval(refreshTrails, 60000);
