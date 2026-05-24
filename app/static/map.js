const map = L.map("map").setView([45.85, 9.39], 11);
const markers = new Map();

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

async function refreshMap() {
  const response = await fetch("/api/map");
  if (!response.ok) return;
  const positions = await response.json();
  const bounds = [];
  const list = document.getElementById("position-list");
  list.innerHTML = "";

  positions.forEach((item) => {
    const latLng = [item.lat, item.lon];
    bounds.push(latLng);
    const title = `${item.callsign}${item.label ? " - " + item.label : ""}`;
    const html = `<strong>${title}</strong><br>${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}<br>${item.fetched_at}`;
    if (markers.has(item.callsign)) {
      markers.get(item.callsign).setLatLng(latLng).setPopupContent(html);
    } else {
      markers.set(item.callsign, L.marker(latLng).addTo(map).bindPopup(html));
    }

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<strong>${title}</strong><p class="meta">${item.fetched_at}</p><p>${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}</p>`;
    list.appendChild(card);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
}

refreshMap();
setInterval(refreshMap, 30000);

