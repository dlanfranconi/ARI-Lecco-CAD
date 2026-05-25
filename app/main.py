import asyncio
import csv
import io
import json
from contextlib import suppress
from datetime import datetime
from typing import Any

from fastapi import Body, Depends, FastAPI, Form, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .aprs import poll_aprs_once
from .auth import COOKIE_NAME, hash_password, make_session, read_session, verify_password
from .config import settings
from .db import connect, init_db, row, rows
from .i18n import TRANSLATIONS, normalize_language

app = FastAPI(title="ARI Lecco CAD")
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

bulletin_clients: set[WebSocket] = set()
review_clients: set[WebSocket] = set()


@app.on_event("startup")
async def startup() -> None:
    init_db()
    app.state.aprs_task = asyncio.create_task(aprs_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    task = getattr(app.state, "aprs_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


async def aprs_loop() -> None:
    while True:
        with suppress(Exception):
            await poll_aprs_once()
        await asyncio.sleep(max(settings.aprs_poll_seconds, 30))


def setting(key: str, default: str = "") -> str:
    item = row("SELECT value FROM app_settings WHERE key = ?", (key,))
    return item["value"] if item else default


def save_setting(key: str, value: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def current_language() -> str:
    return normalize_language(setting("language", "en"))


def format_dt(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return value
    if current_language() == "it":
        return parsed.strftime("%d/%m/%Y %H:%M")
    return parsed.strftime("%B %d, %Y %H:%M")


def current_user(request: Request) -> Any | None:
    username = read_session(request)
    if not username:
        return None
    return row("SELECT * FROM users WHERE username = ? AND active = 1", (username,))


def require_login(request: Request) -> Any:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=303, headers={"Location": "/login"})
    return user


def require_admin(request: Request) -> Any:
    user = require_login(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_user_or_admin(request: Request) -> Any:
    user = require_login(request)
    if user["role"] not in {"admin", "user"}:
        raise HTTPException(status_code=403, detail="User access required")
    return user


def require_notice_view(request: Request) -> Any:
    user = require_login(request)
    if user["role"] not in {"admin", "user", "announcer"}:
        raise HTTPException(status_code=403, detail="Notice access required")
    return user


def page(request: Request, name: str, **context: object) -> HTMLResponse:
    lang = current_language()
    user = current_user(request)
    context.setdefault("current_user", user)
    context.setdefault("dispatch_user", user["username"] if user else None)
    context.setdefault("is_admin", bool(user and user["role"] == "admin"))
    context.setdefault("lang", lang)
    context.setdefault("t", TRANSLATIONS[lang])
    context.setdefault("format_dt", format_dt)
    return templates.TemplateResponse(request, name, context)


def latest_position_for_user(user: Any) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = []
    if user["aprs_station_id"]:
        latest = row(
            "SELECT callsign, lat, lon, fetched_at, 'APRS' AS source FROM aprs_positions WHERE station_id = ? ORDER BY id DESC LIMIT 1",
            (user["aprs_station_id"],),
        )
        if latest:
            candidates.append(dict(latest))
    if user["dstar_callsign"]:
        latest = row(
            "SELECT callsign, lat, lon, fetched_at, 'D-STAR' AS source FROM dstar_positions WHERE UPPER(callsign) = UPPER(?) ORDER BY id DESC LIMIT 1",
            (user["dstar_callsign"],),
        )
        if latest:
            candidates.append(dict(latest))
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: str(item.get("fetched_at", "")), reverse=True)[0]


def user_label(user: Any, location: str) -> str:
    label_parts = [part for part in [user["tactical_callsign"], location or user["default_location"]] if part]
    tactical_label = "/".join(label_parts) if label_parts else user["display_name"]
    label = f"{tactical_label} - {user['display_name']}"
    if user["operator_callsign"]:
        label += f" ({user['operator_callsign']})"
    return label


@app.get("/", response_class=HTMLResponse)
async def index(request: Request, user: Any = Depends(require_user_or_admin)) -> HTMLResponse:
    users = rows(
        """
        SELECT users.*, aprs_stations.callsign AS aprs_callsign
        FROM users
        LEFT JOIN aprs_stations ON aprs_stations.id = users.aprs_station_id
        WHERE users.active = 1
        ORDER BY tactical_callsign, display_name
        """
    )
    logs = rows("SELECT * FROM log_entries ORDER BY id DESC LIMIT 100")
    pending_count = row("SELECT COUNT(*) AS count FROM bulletins WHERE status = 'pending'")["count"]
    return page(request, "index.html", users=users, logs=logs, pending_count=pending_count, user=user)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    return page(request, "login.html", error="")


@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = row("SELECT * FROM users WHERE username = ? AND active = 1", (username,))
    if not user or not verify_password(password, user["password_hash"]):
        return page(request, "login.html", error="Invalid username or password.")
    target = "/announcer" if user["role"] == "announcer" else "/"
    response = RedirectResponse(target, status_code=303)
    response.set_cookie(COOKIE_NAME, make_session(username), httponly=True, samesite="lax")
    return response


@app.post("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response


@app.post("/logs")
async def create_log(
    user_id: int = Form(...),
    status: str = Form(...),
    location: str = Form(""),
    message: str = Form(...),
    forward_bulletin: str | None = Form(None),
    admin: Any = Depends(require_admin),
) -> RedirectResponse:
    user = row(
        """
        SELECT users.*, aprs_stations.callsign AS aprs_callsign
        FROM users
        LEFT JOIN aprs_stations ON aprs_stations.id = users.aprs_station_id
        WHERE users.id = ?
        """,
        (user_id,),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    latest = latest_position_for_user(user)
    label = user_label(user, location)
    notice_id = None
    with connect() as conn:
        if forward_bulletin:
            cur = conn.execute(
                "INSERT INTO bulletins (source, submitter_name, message, status, approved_at, approved_by) VALUES (?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?)",
                ("dispatch", label, message, admin["username"]),
            )
            notice_id = cur.lastrowid
        conn.execute(
            """
            INSERT INTO log_entries
                (user_id, user_label, status, location, message, bulletin_requested, bulletin_id, aprs_station, lat, lon)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                label,
                status,
                location,
                message,
                1 if forward_bulletin else 0,
                notice_id,
                latest["callsign"] if latest else (user["aprs_callsign"] or user["dstar_callsign"] or ""),
                latest["lat"] if latest else None,
                latest["lon"] if latest else None,
            ),
        )

    if notice_id:
        await broadcast_approved_bulletin(notice_id)
    return RedirectResponse("/", status_code=303)


@app.post("/notices/direct")
async def direct_notice(message: str = Form(...), admin: Any = Depends(require_admin)) -> RedirectResponse:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO bulletins (source, submitter_name, message, status, approved_at, approved_by) VALUES ('dispatch', ?, ?, 'approved', CURRENT_TIMESTAMP, ?)",
            (admin["display_name"], message, admin["username"]),
        )
        notice_id = cur.lastrowid
    await broadcast_approved_bulletin(notice_id)
    return RedirectResponse("/", status_code=303)


@app.post("/bulletins/direct")
async def direct_bulletin_alias(message: str = Form(...), admin: Any = Depends(require_admin)) -> RedirectResponse:
    return await direct_notice(message, admin)


@app.get("/setup", response_class=HTMLResponse)
async def setup(request: Request, _: Any = Depends(require_admin)) -> HTMLResponse:
    users = rows(
        """
        SELECT users.*, aprs_stations.callsign AS aprs_callsign
        FROM users
        LEFT JOIN aprs_stations ON aprs_stations.id = users.aprs_station_id
        ORDER BY users.active DESC, users.role, users.display_name
        """
    )
    stations = rows("SELECT * FROM aprs_stations ORDER BY active DESC, callsign")
    return page(request, "setup.html", users=users, stations=stations)


@app.post("/setup/settings")
async def update_settings(language: str = Form("en"), _: Any = Depends(require_admin)) -> RedirectResponse:
    save_setting("language", normalize_language(language))
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/users")
async def add_user(
    display_name: str = Form(...),
    operator_callsign: str = Form(""),
    tactical_callsign: str = Form(""),
    default_location: str = Form(""),
    aprs_station_id: str = Form(""),
    dstar_callsign: str = Form(""),
    username: str = Form(""),
    password: str = Form(""),
    role: str = Form("user"),
    _: Any = Depends(require_admin),
) -> RedirectResponse:
    station_id = int(aprs_station_id) if aprs_station_id else None
    clean_username = username.strip() or None
    password_hash = hash_password(password) if password else ""
    role = role if role in {"admin", "user", "announcer"} else "user"
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (display_name, operator_callsign, tactical_callsign, default_location, aprs_station_id, dstar_callsign, username, password_hash, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (display_name, operator_callsign, tactical_callsign, default_location, station_id, dstar_callsign.strip().upper(), clean_username, password_hash, role),
        )
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/users/{user_id}/toggle")
async def toggle_user(user_id: int, _: Any = Depends(require_admin)) -> RedirectResponse:
    with connect() as conn:
        conn.execute("UPDATE users SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?", (user_id,))
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/users/{user_id}")
async def update_user(
    user_id: int,
    display_name: str = Form(...),
    operator_callsign: str = Form(""),
    tactical_callsign: str = Form(""),
    default_location: str = Form(""),
    aprs_station_id: str = Form(""),
    dstar_callsign: str = Form(""),
    username: str = Form(""),
    password: str = Form(""),
    role: str = Form("user"),
    _: Any = Depends(require_admin),
) -> RedirectResponse:
    station_id = int(aprs_station_id) if aprs_station_id else None
    clean_username = username.strip() or None
    role = role if role in {"admin", "user", "announcer"} else "user"
    with connect() as conn:
        conn.execute(
            """
            UPDATE users
            SET display_name = ?, operator_callsign = ?, tactical_callsign = ?,
                default_location = ?, aprs_station_id = ?, dstar_callsign = ?, username = ?, role = ?
            WHERE id = ?
            """,
            (display_name, operator_callsign, tactical_callsign, default_location, station_id, dstar_callsign.strip().upper(), clean_username, role, user_id),
        )
        if password:
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user_id))
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/stations")
async def add_station(callsign: str = Form(...), label: str = Form(""), _: Any = Depends(require_admin)) -> RedirectResponse:
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO aprs_stations (callsign, label) VALUES (?, ?)", (callsign.strip().upper(), label))
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/stations/{station_id}/toggle")
async def toggle_station(station_id: int, _: Any = Depends(require_admin)) -> RedirectResponse:
    with connect() as conn:
        conn.execute("UPDATE aprs_stations SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?", (station_id,))
    return RedirectResponse("/setup", status_code=303)


@app.post("/setup/stations/{station_id}")
async def update_station(station_id: int, callsign: str = Form(...), label: str = Form(""), _: Any = Depends(require_admin)) -> RedirectResponse:
    with connect() as conn:
        conn.execute("UPDATE aprs_stations SET callsign = ?, label = ? WHERE id = ?", (callsign.strip().upper(), label, station_id))
    return RedirectResponse("/setup", status_code=303)


@app.post("/aprs/poll")
async def manual_aprs_poll(_: Any = Depends(require_admin)) -> RedirectResponse:
    await poll_aprs_once()
    return RedirectResponse("/map", status_code=303)


@app.post("/api/dstar/positions")
async def ingest_dstar_position(payload: dict[str, Any] = Body(...), authorization: str | None = Header(None), x_drats_token: str | None = Header(None, alias="X-D-RATS-Token")) -> dict[str, Any]:
    if settings.drats_ingest_token:
        bearer = authorization.removeprefix("Bearer ").strip() if authorization else ""
        if x_drats_token != settings.drats_ingest_token and bearer != settings.drats_ingest_token:
            raise HTTPException(status_code=401, detail="Invalid D-RATS ingest token")
    callsign = str(payload.get("callsign", "")).strip().upper()
    if not callsign:
        raise HTTPException(status_code=400, detail="callsign is required")
    try:
        lat = float(payload["lat"])
        lon = float(payload["lon"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="lat and lon are required numeric values") from exc
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO dstar_positions (callsign, lat, lon, source, speed, course, altitude, comment, radio_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (callsign, lat, lon, str(payload.get("source", "d-rats")), _float_or_none(payload.get("speed")), _float_or_none(payload.get("course")), _float_or_none(payload.get("altitude")), str(payload.get("comment", "")), str(payload.get("time", payload.get("radio_time", ""))),),
        )
    return {"ok": True, "id": cur.lastrowid}


def _float_or_none(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@app.get("/map", response_class=HTMLResponse)
async def aprs_map(request: Request, _: Any = Depends(require_user_or_admin)) -> HTMLResponse:
    return page(request, "map.html", aprs_enabled=bool(settings.aprsfi_api_key))


@app.get("/api/map")
async def api_map(_: Any = Depends(require_user_or_admin)) -> list[dict[str, object]]:
    return combined_latest_positions()


def combined_latest_positions() -> list[dict[str, object]]:
    aprs_latest = rows(
        """
        SELECT p.callsign, p.lat, p.lon, p.speed, p.course, p.altitude, p.comment, p.fetched_at, s.label, 'APRS' AS source
        FROM aprs_positions p
        JOIN (SELECT station_id, MAX(id) AS id FROM aprs_positions GROUP BY station_id) latest ON latest.id = p.id
        LEFT JOIN aprs_stations s ON s.id = p.station_id
        """
    )
    dstar_latest = rows(
        """
        SELECT p.callsign, p.lat, p.lon, p.speed, p.course, p.altitude, p.comment, p.fetched_at, '' AS label, 'D-STAR' AS source
        FROM dstar_positions p
        JOIN (SELECT UPPER(callsign) AS callsign_key, MAX(id) AS id FROM dstar_positions GROUP BY UPPER(callsign)) latest ON latest.id = p.id
        """
    )
    return [dict(item) for item in [*aprs_latest, *dstar_latest]]


@app.get("/notices", response_class=HTMLResponse)
async def notices(request: Request, user: Any = Depends(require_notice_view)) -> HTMLResponse:
    pending = rows("SELECT * FROM bulletins WHERE status = 'pending' ORDER BY id DESC") if user["role"] == "admin" else []
    approved = rows("SELECT * FROM bulletins WHERE status = 'approved' ORDER BY id DESC LIMIT 50")
    return page(request, "notices.html", pending=pending, approved=approved)


@app.get("/bulletins", response_class=HTMLResponse)
async def bulletins_alias() -> RedirectResponse:
    return RedirectResponse("/notices", status_code=303)


@app.get("/submit-notification", response_class=HTMLResponse)
@app.get("/invia-notizia", response_class=HTMLResponse)
async def notice_submit_page(request: Request, _: Any = Depends(require_user_or_admin)) -> HTMLResponse:
    return page(request, "notice_submit.html")


@app.get("/bulletin-submit", response_class=HTMLResponse)
async def old_bulletin_submit_alias() -> RedirectResponse:
    return RedirectResponse("/submit-notification", status_code=303)


@app.post("/submit-notification")
@app.post("/invia-notizia")
async def notice_submit(message: str = Form(...), user: Any = Depends(require_user_or_admin)) -> RedirectResponse:
    with connect() as conn:
        cur = conn.execute("INSERT INTO bulletins (source, submitter_name, message, status) VALUES ('user', ?, ?, 'pending')", (user["display_name"], message))
        notice_id = cur.lastrowid
    await broadcast_review_notice(notice_id)
    return RedirectResponse("/submit-notification?sent=1", status_code=303)


@app.post("/bulletin-submit")
async def old_bulletin_submit_post(message: str = Form(...), user: Any = Depends(require_user_or_admin)) -> RedirectResponse:
    return await notice_submit(message, user)


@app.get("/api/notices/{notice_id}")
@app.get("/api/bulletins/{notice_id}")
async def api_notice(notice_id: int, _: Any = Depends(require_admin)) -> dict[str, object]:
    notice = row("SELECT * FROM bulletins WHERE id = ?", (notice_id,))
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    return dict(notice)


@app.post("/notices/{notice_id}/approve")
@app.post("/bulletins/{notice_id}/approve")
async def approve_notice(notice_id: int, _: Any = Depends(require_admin)) -> RedirectResponse:
    await approve_notice_id(notice_id)
    return RedirectResponse("/notices", status_code=303)


@app.post("/api/notices/{notice_id}/approve")
@app.post("/api/bulletins/{notice_id}/approve")
async def api_approve_notice(notice_id: int, _: Any = Depends(require_admin)) -> dict[str, object]:
    notice = await approve_notice_id(notice_id)
    return {"ok": True, "notice": notice}


async def approve_notice_id(notice_id: int) -> dict[str, object]:
    with connect() as conn:
        conn.execute("UPDATE bulletins SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?", (settings.admin_username, notice_id))
    await broadcast_approved_bulletin(notice_id)
    notice = row("SELECT * FROM bulletins WHERE id = ?", (notice_id,))
    return dict(notice) if notice else {}


@app.post("/notices/{notice_id}/reject")
@app.post("/bulletins/{notice_id}/reject")
async def reject_notice(notice_id: int, _: Any = Depends(require_admin)) -> RedirectResponse:
    reject_notice_id(notice_id)
    return RedirectResponse("/notices", status_code=303)


@app.post("/api/notices/{notice_id}/reject")
@app.post("/api/bulletins/{notice_id}/reject")
async def api_reject_notice(notice_id: int, _: Any = Depends(require_admin)) -> dict[str, object]:
    reject_notice_id(notice_id)
    return {"ok": True}


def reject_notice_id(notice_id: int) -> None:
    with connect() as conn:
        conn.execute("UPDATE bulletins SET status = 'rejected' WHERE id = ?", (notice_id,))


@app.get("/announcer", response_class=HTMLResponse)
async def announcer(request: Request, _: Any = Depends(require_notice_view)) -> HTMLResponse:
    latest = row("SELECT * FROM bulletins WHERE status = 'approved' ORDER BY id DESC LIMIT 1")
    return page(request, "announcer.html", latest=latest)


@app.get("/api/notices/latest")
@app.get("/api/bulletins/latest")
async def latest_notice(_: Any = Depends(require_notice_view)) -> dict[str, object]:
    latest = row("SELECT * FROM bulletins WHERE status = 'approved' ORDER BY id DESC LIMIT 1")
    return dict(latest) if latest else {}


@app.websocket("/ws/announcer")
async def ws_announcer(websocket: WebSocket) -> None:
    await websocket.accept()
    bulletin_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        bulletin_clients.discard(websocket)


@app.websocket("/ws/review")
async def ws_review(websocket: WebSocket) -> None:
    await websocket.accept()
    review_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        review_clients.discard(websocket)


async def broadcast_approved_bulletin(notice_id: int) -> None:
    notice = row("SELECT * FROM bulletins WHERE id = ?", (notice_id,))
    if not notice:
        return
    payload = json.dumps({"type": "notice", "notice": dict(notice), "bulletin": dict(notice)})
    await _broadcast(bulletin_clients, payload)


async def broadcast_review_notice(notice_id: int) -> None:
    notice = row("SELECT * FROM bulletins WHERE id = ?", (notice_id,))
    if not notice:
        return
    payload = json.dumps({"type": "pending_notice", "notice": dict(notice), "labels": TRANSLATIONS[current_language()]})
    await _broadcast(review_clients, payload)


async def _broadcast(clients: set[WebSocket], payload: str) -> None:
    stale = []
    for client in clients:
        try:
            await client.send_text(payload)
        except Exception:
            stale.append(client)
    for client in stale:
        clients.discard(client)


@app.get("/export/logs.csv")
async def export_logs(_: Any = Depends(require_admin)) -> StreamingResponse:
    return csv_response("logs.csv", rows("SELECT * FROM log_entries ORDER BY id"))


@app.get("/export/aprs.csv")
async def export_aprs(_: Any = Depends(require_admin)) -> StreamingResponse:
    return csv_response("aprs_waypoints.csv", rows("SELECT * FROM aprs_positions ORDER BY station_id, id"))


@app.get("/export/dstar.csv")
async def export_dstar(_: Any = Depends(require_admin)) -> StreamingResponse:
    return csv_response("dstar_waypoints.csv", rows("SELECT * FROM dstar_positions ORDER BY callsign, id"))


@app.get("/export/aprs.geojson")
async def export_aprs_geojson(_: Any = Depends(require_admin)) -> StreamingResponse:
    return geojson_response("aprs_waypoints.geojson", rows("SELECT *, 'APRS' AS source FROM aprs_positions ORDER BY station_id, id"))


@app.get("/export/dstar.geojson")
async def export_dstar_geojson(_: Any = Depends(require_admin)) -> StreamingResponse:
    return geojson_response("dstar_waypoints.geojson", rows("SELECT *, 'D-STAR' AS source FROM dstar_positions ORDER BY callsign, id"))


def geojson_response(filename: str, data: list[Any]) -> StreamingResponse:
    features = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [item["lon"], item["lat"]]}, "properties": {key: item[key] for key in item.keys() if key not in {"lat", "lon"}}} for item in data]
    return StreamingResponse(io.StringIO(json.dumps({"type": "FeatureCollection", "features": features}, indent=2)), media_type="application/geo+json", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def csv_response(filename: str, data: list[Any]) -> StreamingResponse:
    output = io.StringIO()
    if data:
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        for item in data:
            writer.writerow(dict(item))
    return StreamingResponse(io.StringIO(output.getvalue()), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/clear-race")
async def clear_race(confirm: str = Form(""), _: Any = Depends(require_admin)) -> RedirectResponse:
    if confirm != "CLEAR":
        raise HTTPException(status_code=400, detail="Type CLEAR to clear race data")
    with connect() as conn:
        conn.execute("DELETE FROM log_entries")
        conn.execute("DELETE FROM bulletins")
        conn.execute("DELETE FROM aprs_positions")
        conn.execute("DELETE FROM dstar_positions")
    return RedirectResponse("/", status_code=303)
