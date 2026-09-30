"""Direwolf AGW network client.

Ingests live APRS position reports heard locally over the AGWPE protocol
Direwolf exposes (default TCP port 8000), as a local-radio alternative/
complement to polling aprs.fi over the internet. The point is that this
reads positions directly off the air via Direwolf's own TNC/soundcard
decode -- it keeps working with zero internet connectivity, which matters
for a pure local packet-radio emergency net.

Only ingests packets from callsigns that already have an active
aprs_stations row, mirroring poll_aprs_once()'s own "only track what's
registered" policy in app/aprs.py -- add the station in Setup the same way
as for aprs.fi tracking, and whichever source (the aprs.fi poll or this
Direwolf feed) hears it first starts showing it on the map. Both sources
write into the same aprs_positions table, so map/trail/ticker code needs
no changes to support this.

Deliberately supports only the common uncompressed APRS position report
formats (!, =, @, /), not the compressed or Mic-E encodings -- covers
standard GPS trackers (including the LoRa_APRS_Tracker firmware already in
use in this deployment), not the full APRS spec. A report this parser
doesn't recognize is silently skipped rather than guessed at.

NOTE: this hasn't been exercised against a real Direwolf instance (no way
to do that in this environment) -- the AGW frame header format below
follows the documented AGWPE wire protocol as closely as can be verified
from spec/reference-implementation knowledge, including the 2 bytes of
struct alignment padding real AGWPE servers (Direwolf included) emit
before the two 4-byte integer fields. If positions never show up after
enabling this, the first thing to check is Direwolf's own log for
"AGW port has been enabled" and confirm the host/port Setup was given.
"""
from __future__ import annotations

import asyncio
import logging
import re
import struct
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any

from .db import connect, row

logger = logging.getLogger("uvicorn.error")

# 36-byte AGWPE frame header: 6 single-byte fields (port, 3x reserved,
# datakind, reserved), a 10-byte "from" callsign, a 10-byte "to" callsign,
# 2 bytes of alignment padding, then two little-endian uint32 fields
# (data length, user-reserved).
_HEADER_FORMAT = "<BBBBBB10s10s2xII"
_HEADER_LEN = struct.calcsize(_HEADER_FORMAT)
assert _HEADER_LEN == 36, _HEADER_LEN

_KIND_ENABLE_MONITOR = ord("k")
_KIND_UNPROTO_MONITOR = ord("U")
_MAX_REASONABLE_DATALEN = 65536
_RECONNECT_DELAY_SECONDS = 15

# Position-report data-type characters (first byte of the APRS info
# field): '!'/'=' are non-timestamped, '@'/'/' are timestamped (a fixed
# 7-character DHM/HMS timestamp follows immediately and is skipped).
_TIMESTAMPED_TYPES = "@/"
_POSITION_TYPES = "!=@/"

_POSITION_RE = re.compile(
    r"^(?P<lat_deg>\d{2})(?P<lat_min>\d{2}\.\d{2})(?P<lat_hem>[NSns])"
    r"(?P<sym_table>.)"
    r"(?P<lon_deg>\d{3})(?P<lon_min>\d{2}\.\d{2})(?P<lon_hem>[EWew])"
    r"(?P<sym_code>.)"
)


def _build_frame(datakind: int, data: bytes = b"") -> bytes:
    header = struct.pack(
        _HEADER_FORMAT,
        0, 0, 0, 0, datakind, 0,
        b"".ljust(10, b"\x00"),
        b"".ljust(10, b"\x00"),
        len(data),
        0,
    )
    return header + data


def parse_position(info_field: str) -> dict[str, Any] | None:
    """Parse an uncompressed APRS position report's info field. Returns
    None for anything else (status/message/telemetry/compressed/Mic-E)."""
    if not info_field or info_field[0] not in _POSITION_TYPES:
        return None
    body = info_field[1:]
    if info_field[0] in _TIMESTAMPED_TYPES:
        body = body[7:]
    if not body or body[0] == "!":
        # A compressed-format or weather-report variant -- not handled.
        return None
    match = _POSITION_RE.match(body)
    if not match:
        return None
    try:
        lat = int(match["lat_deg"]) + float(match["lat_min"]) / 60
        lon = int(match["lon_deg"]) + float(match["lon_min"]) / 60
    except ValueError:
        return None
    if match["lat_hem"].upper() == "S":
        lat = -lat
    if match["lon_hem"].upper() == "W":
        lon = -lon
    return {
        "lat": lat,
        "lon": lon,
        "symbol_table": match["sym_table"],
        "symbol_code": match["sym_code"],
        "comment": body[match.end():].strip(),
    }


def parse_monitor_frame(data: bytes) -> tuple[str, str] | None:
    """A 'U' (unproto monitor) frame's payload is a printable header line
    (source/dest callsigns, digipeater path, frame info) terminated by
    \\r, then the raw APRS info field, then a trailing NUL. Returns
    (source_callsign, info_field) or None if it doesn't look like that."""
    text = data.decode("ascii", errors="replace")
    header_end = text.find("\r")
    if header_end == -1:
        return None
    header_line = text[:header_end]
    info_field = text[header_end + 1:].rstrip("\x00").strip("\r\n")
    match = re.search(r"\bFm\s+([A-Z0-9\-]+)\s+To\b", header_line, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).upper(), info_field


def store_position(callsign: str, position: dict[str, Any]) -> bool:
    """Writes the position for `callsign` if (and only if) it matches an
    active aprs_stations row. Returns whether it was stored."""
    station = row("SELECT id FROM aprs_stations WHERE UPPER(callsign) = ? AND active = 1", (callsign.upper(),))
    if not station:
        return False
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO aprs_positions
                (station_id, callsign, lat, lon, comment, aprs_time, symbol_table, symbol_code, feed_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'direwolf')
            """,
            (
                station["id"],
                callsign,
                position["lat"],
                position["lon"],
                position.get("comment", ""),
                str(int(datetime.now(timezone.utc).timestamp())),
                position.get("symbol_table", ""),
                position.get("symbol_code", ""),
            ),
        )
    return True


async def _read_exact(reader: asyncio.StreamReader, size: int) -> bytes:
    data = b""
    while len(data) < size:
        chunk = await reader.read(size - len(data))
        if not chunk:
            raise ConnectionError("Direwolf AGW connection closed by peer")
        data += chunk
    return data


async def _run_connection(host: str, port: int) -> None:
    reader, writer = await asyncio.open_connection(host, port)
    try:
        writer.write(_build_frame(_KIND_ENABLE_MONITOR))
        await writer.drain()
        logger.info("Direwolf AGW: connected to %s:%s, monitoring enabled", host, port)
        while True:
            header = await _read_exact(reader, _HEADER_LEN)
            _port, _r1, _r2, _r3, datakind, _r4, _call_from, _call_to, datalen, _user = struct.unpack(_HEADER_FORMAT, header)
            if not (0 <= datalen <= _MAX_REASONABLE_DATALEN):
                raise ValueError(f"implausible AGW frame length {datalen}, resyncing via reconnect")
            data = await _read_exact(reader, datalen) if datalen else b""
            if datakind != _KIND_UNPROTO_MONITOR:
                continue
            parsed = parse_monitor_frame(data)
            if not parsed:
                continue
            callsign, info_field = parsed
            position = parse_position(info_field)
            if position:
                store_position(callsign, position)
    finally:
        writer.close()
        with suppress(Exception):
            await writer.wait_closed()


async def direwolf_agw_loop(host: str, port: int) -> None:
    while True:
        try:
            await _run_connection(host, port)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("Direwolf AGW: connection to %s:%s failed, retrying in %ss", host, port, _RECONNECT_DELAY_SECONDS, exc_info=True)
        await asyncio.sleep(_RECONNECT_DELAY_SECONDS)
