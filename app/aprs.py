import httpx

from .config import settings
from .db import connect, rows, setting


def current_aprsfi_api_key() -> str:
    # DB setting (from the Configuration page) takes precedence once set;
    # the env var only matters as the initial value before anyone's saved
    # one there -- see api_key handling in main.py's update_settings().
    return setting("aprsfi_api_key", settings.aprsfi_api_key)


async def poll_aprs_once() -> int:
    api_key = current_aprsfi_api_key()
    if not api_key:
        return 0

    stations = rows("SELECT id, callsign FROM aprs_stations WHERE active = 1 ORDER BY callsign")
    if not stations:
        return 0

    names = ",".join(station["callsign"] for station in stations)
    station_ids = {station["callsign"].upper(): station["id"] for station in stations}
    params = {
        "name": names,
        "what": "loc",
        "apikey": api_key,
        "format": "json",
    }

    headers = {"User-Agent": "ARI-Lecco-CAD/1.7 (+https://github.com/dlanfranconi/ARI-Lecco-CAD)"}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.aprs.fi/api/get", params=params, headers=headers)
        response.raise_for_status()
        payload = response.json()

    if payload.get("result") != "ok":
        return 0

    count = 0
    with connect() as conn:
        for entry in payload.get("entries", []):
            callsign = str(entry.get("name", "")).upper()
            station_id = station_ids.get(callsign)
            if not station_id or "lat" not in entry or "lng" not in entry:
                continue
            # aprs.fi's "symbol" field is a plain 2-character string: APRS
            # symbol table (e.g. "/") followed by the symbol code (e.g. ">"
            # for a car) -- the same open standard every APRS client, aprs.fi
            # included, renders its station icons from. Saving it lets the
            # map draw a matching icon per station type instead of one
            # generic pin.
            symbol = str(entry.get("symbol") or "")
            conn.execute(
                """
                INSERT INTO aprs_positions
                    (station_id, callsign, lat, lon, speed, course, altitude, comment, aprs_time, symbol_table, symbol_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    station_id,
                    callsign,
                    float(entry["lat"]),
                    float(entry["lng"]),
                    _float_or_none(entry.get("speed")),
                    _float_or_none(entry.get("course")),
                    _float_or_none(entry.get("altitude")),
                    entry.get("comment", ""),
                    entry.get("time", ""),
                    symbol[:1],
                    symbol[1:2],
                ),
            )
            count += 1
    return count


def _float_or_none(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

