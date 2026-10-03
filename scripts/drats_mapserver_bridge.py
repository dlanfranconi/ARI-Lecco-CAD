#!/usr/bin/env python3
"""Bridge D-RATS' built-in GPS Export feature to ARI Lecco CAD.

D-RATS (Settings -> GPS Export panel, "mapserver_active") pushes one JSON
object per GPS fix -- its own static position and every position fix it
hears from other stations -- over a brand new plain TCP connection to the
host/port configured there, then closes the socket. It does not write a
file and does not need to be polled.

D-RATS' JSON uses its own field names (lng not lon, station not callsign,
values as quoted strings even though numeric), e.g.:
  { "lat": "45.856600", "lng": "9.397500", "station": "IU2ABC-9",
    "comments": "altitude: 150", "timestamp": "2026-10-03 12:34:56" }

Run this script on a host reachable from the D-RATS PC, point D-RATS' GPS
Export settings at this script's --listen-host/--listen-port, and it will
translate and forward each fix to the CAD server's /api/dstar/positions.
"""
import argparse
import json
import socketserver
import urllib.request


def post_to_cad(cad_url, token, callsign, lat, lon, comment):
    payload = json.dumps({
        "callsign": callsign,
        "lat": lat,
        "lon": lon,
        "source": "d-rats",
        "comment": comment,
    }).encode("utf-8")
    request = urllib.request.Request(
        cad_url.rstrip("/") + "/api/dstar/positions",
        data=payload,
        headers={"Content-Type": "application/json", "X-D-RATS-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.read().decode("utf-8")


def make_handler(cad_url, token):
    class Handler(socketserver.BaseRequestHandler):
        def handle(self):
            chunks = []
            while True:
                chunk = self.request.recv(4096)
                if not chunk:
                    break
                chunks.append(chunk)
            raw = b"".join(chunks).decode("utf-8", "replace").strip()
            if not raw:
                return
            try:
                fix = json.loads(raw)
            except ValueError:
                print(f"ignoring unparseable push from {self.client_address}: {raw!r}")
                return

            callsign = str(fix.get("station", "")).strip()
            try:
                lat = float(fix.get("lat", 0))
                lon = float(fix.get("lng", 0))
            except (TypeError, ValueError):
                print(f"ignoring fix with bad lat/lng: {fix!r}")
                return
            if not callsign or (lat == 0 and lon == 0):
                print(f"ignoring incomplete fix: {fix!r}")
                return
            comment = str(fix.get("comments", ""))

            try:
                result = post_to_cad(cad_url, token, callsign, lat, lon, comment)
                print(f"forwarded {callsign} ({lat}, {lon}): {result}")
            except Exception as exc:
                print(f"failed to forward {callsign}: {exc}")

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen-host", default="0.0.0.0", help="Must match what D-RATS can reach")
    parser.add_argument("--listen-port", required=True, type=int, help="Must match D-RATS' mapserver_port setting")
    parser.add_argument("--cad-url", required=True, help="Example: http://192.168.1.50:8000")
    parser.add_argument("--token", default="", help="DRATS_INGEST_TOKEN from the CAD container")
    args = parser.parse_args()

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(
        (args.listen_host, args.listen_port),
        make_handler(args.cad_url, args.token),
    ) as server:
        print(f"Listening for D-RATS GPS pushes on {args.listen_host}:{args.listen_port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
