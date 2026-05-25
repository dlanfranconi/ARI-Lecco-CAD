#!/usr/bin/env python3
"""Watch a CSV/text feed on a D-RATS radio PC and POST new positions to CAD.

Expected appended CSV lines by default:
  callsign,lat,lon[,comment]

This is intentionally source-neutral. Point it at any file your D-RATS/D-STAR
side can append to, or have another utility write simple CSV rows into it.
"""
import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path


def post(cad_url, token, callsign, lat, lon, comment=""):
    payload = json.dumps({
        "callsign": callsign,
        "lat": float(lat),
        "lon": float(lon),
        "source": "d-rats",
        "comment": comment,
    }).encode("utf-8")
    req = urllib.request.Request(
        cad_url.rstrip("/") + "/api/dstar/positions",
        data=payload,
        headers={"Content-Type": "application/json", "X-D-RATS-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode("utf-8")


def parse_line(line):
    row = next(csv.reader([line]))
    if len(row) < 3:
        return None
    return row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip() if len(row) > 3 else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cad-url", required=True, help="Example: http://192.168.1.50:8000")
    parser.add_argument("--token", default="")
    parser.add_argument("--file", required=True, help="CSV feed to tail: callsign,lat,lon[,comment]")
    parser.add_argument("--poll-seconds", type=float, default=1.0)
    parser.add_argument("--from-start", action="store_true")
    args = parser.parse_args()

    path = Path(args.file)
    path.touch(exist_ok=True)
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        if not args.from_start:
            handle.seek(0, 2)
        while True:
            line = handle.readline()
            if not line:
                time.sleep(args.poll_seconds)
                continue
            parsed = parse_line(line.strip())
            if not parsed:
                continue
            callsign, lat, lon, comment = parsed
            try:
                print(post(args.cad_url, args.token, callsign, lat, lon, comment), flush=True)
            except Exception as exc:
                print(f"failed to post {callsign}: {exc}", flush=True)


if __name__ == "__main__":
    main()
