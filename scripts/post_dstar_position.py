#!/usr/bin/env python3
"""Post D-RATS/D-STAR GPS positions to ARI Lecco CAD.

This helper is intentionally simple: run it on the PC that can see the D-RATS
or D-STAR GPS data, passing callsign/lat/lon from whatever local source you use.
"""
import argparse
import json
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--cad-url", required=True, help="Example: http://192.168.1.50:8000")
parser.add_argument("--token", default="", help="DRATS_INGEST_TOKEN from the CAD container")
parser.add_argument("--callsign", required=True)
parser.add_argument("--lat", required=True, type=float)
parser.add_argument("--lon", required=True, type=float)
parser.add_argument("--source", default="d-rats")
parser.add_argument("--comment", default="")
args = parser.parse_args()

payload = json.dumps({
    "callsign": args.callsign,
    "lat": args.lat,
    "lon": args.lon,
    "source": args.source,
    "comment": args.comment,
}).encode("utf-8")
request = urllib.request.Request(
    args.cad_url.rstrip("/") + "/api/dstar/positions",
    data=payload,
    headers={"Content-Type": "application/json", "X-D-RATS-Token": args.token},
    method="POST",
)
with urllib.request.urlopen(request, timeout=10) as response:
    print(response.read().decode("utf-8"))
