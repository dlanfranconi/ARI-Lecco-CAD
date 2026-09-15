import asyncio
from datetime import datetime, timedelta

from .db import connect, rows


async def ping_host(ip_address: str, timeout: int = 1) -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(timeout), ip_address,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        return await proc.wait() == 0
    except FileNotFoundError:
        return False


def _seconds_since(timestamp: str | None) -> float:
    if not timestamp:
        return 0.0
    try:
        return (datetime.utcnow() - datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")).total_seconds()
    except ValueError:
        return 0.0


async def poll_devices_once(alert_after_seconds: int = 0) -> list[dict]:
    # Alerts intentionally wait alert_after_seconds past the point a device
    # flips status before firing, so a single dropped ping on an otherwise
    # fine link doesn't page anyone -- device_status_events still logs every
    # raw flip immediately for the history view, only the push/live alert
    # is delayed (and skipped entirely if the device recovers first).
    devices = rows("SELECT * FROM monitored_devices WHERE active = 1")
    if not devices:
        return []

    results = await asyncio.gather(*(ping_host(device["ip_address"]) for device in devices))

    changed: list[dict] = []
    with connect() as conn:
        for device, is_up in zip(devices, results):
            new_status = "up" if is_up else "down"
            status_changed = device["last_status"] != new_status
            if status_changed:
                conn.execute(
                    "UPDATE monitored_devices SET last_status = ?, last_checked_at = CURRENT_TIMESTAMP, last_changed_at = CURRENT_TIMESTAMP, alert_sent = 0 WHERE id = ?",
                    (new_status, device["id"]),
                )
                conn.execute(
                    "INSERT INTO device_status_events (device_id, device_name, status) VALUES (?, ?, ?)",
                    (device["id"], device["name"], new_status),
                )
            else:
                conn.execute("UPDATE monitored_devices SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?", (device["id"],))

            down_seconds = 0.0 if status_changed else _seconds_since(device["last_changed_at"])
            should_alert = False
            if new_status == "down" and not device["alert_sent"] and down_seconds >= alert_after_seconds:
                should_alert = True
            elif new_status == "up" and status_changed and device["alert_sent"]:
                # Only announce recovery if a down alert actually fired --
                # a blip that never crossed the threshold never "recovers".
                should_alert = True

            if should_alert:
                conn.execute("UPDATE monitored_devices SET alert_sent = 1 WHERE id = ?", (device["id"],))
                recipient_ids = [
                    row["user_id"]
                    for row in conn.execute("SELECT user_id FROM device_alert_recipients WHERE device_id = ?", (device["id"],))
                ]
                changed.append({
                    "id": device["id"],
                    "name": device["name"],
                    "ip_address": device["ip_address"],
                    "status": new_status,
                    "recipient_user_ids": recipient_ids,
                })
    return changed
