import asyncio

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


async def poll_devices_once() -> list[dict]:
    devices = rows("SELECT * FROM monitored_devices WHERE active = 1")
    if not devices:
        return []

    results = await asyncio.gather(*(ping_host(device["ip_address"]) for device in devices))

    changed: list[dict] = []
    with connect() as conn:
        for device, is_up in zip(devices, results):
            new_status = "up" if is_up else "down"
            conn.execute(
                "UPDATE monitored_devices SET last_status = ?, last_checked_at = CURRENT_TIMESTAMP"
                + (", last_changed_at = CURRENT_TIMESTAMP" if device["last_status"] != new_status else "")
                + " WHERE id = ?",
                (new_status, device["id"]),
            )
            if device["last_status"] != new_status:
                conn.execute(
                    "INSERT INTO device_status_events (device_id, device_name, status) VALUES (?, ?, ?)",
                    (device["id"], device["name"], new_status),
                )
                changed.append({
                    "id": device["id"],
                    "name": device["name"],
                    "ip_address": device["ip_address"],
                    "status": new_status,
                    "notify_user_id": device["notify_user_id"],
                })
    return changed
