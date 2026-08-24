import asyncio
import json

from .config import settings
from .db import connect


async def run_iperf_client(host: str, port: int) -> dict:
    try:
        proc = await asyncio.create_subprocess_exec(
            "iperf3", "-c", host, "-p", str(port), "-t", str(settings.iperf_test_seconds), "-J",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=settings.iperf_test_seconds + 15)
    except FileNotFoundError:
        return {"ok": False, "mbps": None, "jitter_ms": None, "loss_percent": None, "error": "iperf3 not installed in this image"}
    except asyncio.TimeoutError:
        return {"ok": False, "mbps": None, "jitter_ms": None, "loss_percent": None, "error": "Test timed out"}

    try:
        payload = json.loads(stdout.decode() or "{}")
    except json.JSONDecodeError:
        return {"ok": False, "mbps": None, "jitter_ms": None, "loss_percent": None, "error": stderr.decode().strip() or "Could not parse iperf3 output"}

    if payload.get("error"):
        return {"ok": False, "mbps": None, "jitter_ms": None, "loss_percent": None, "error": str(payload["error"])}

    end = payload.get("end", {})
    received = end.get("sum_received") or end.get("sum") or {}
    bits_per_second = received.get("bits_per_second")
    if bits_per_second is None:
        return {"ok": False, "mbps": None, "jitter_ms": None, "loss_percent": None, "error": "No throughput in iperf3 result"}

    sum_block = end.get("sum", {})
    return {
        "ok": True,
        "mbps": round(bits_per_second / 1_000_000, 2),
        "jitter_ms": sum_block.get("jitter_ms"),
        "loss_percent": sum_block.get("lost_percent"),
        "error": "",
    }


async def run_and_store(target_id: int, target_name: str, host: str, port: int) -> dict:
    result = await run_iperf_client(host, port)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO iperf_results (target_id, target_name, ok, mbps, jitter_ms, loss_percent, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (target_id, target_name, 1 if result["ok"] else 0, result["mbps"], result["jitter_ms"], result["loss_percent"], result["error"]),
        )
    return result
