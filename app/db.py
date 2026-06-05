import sqlite3
from pathlib import Path
from typing import Any

from .auth import hash_password, verify_password
from .config import settings


def connect() -> sqlite3.Connection:
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL,
                operator_callsign TEXT DEFAULT '',
                tactical_callsign TEXT DEFAULT '',
                default_location TEXT DEFAULT '',
                aprs_station_id INTEGER,
                dstar_callsign TEXT DEFAULT '',
                username TEXT UNIQUE,
                password_hash TEXT DEFAULT '',
                role TEXT NOT NULL DEFAULT 'user',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tactical_callsigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                location_preposition TEXT DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS runners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bib_number TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                first_name TEXT DEFAULT '',
                last_name TEXT DEFAULT '',
                hometown TEXT DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS race_archives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                race_name TEXT NOT NULL,
                archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reason TEXT DEFAULT '',
                snapshot_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS aprs_stations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign TEXT NOT NULL UNIQUE,
                label TEXT DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS aprs_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id INTEGER NOT NULL,
                callsign TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                speed REAL,
                course REAL,
                altitude REAL,
                comment TEXT DEFAULT '',
                aprs_time TEXT DEFAULT '',
                fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(station_id) REFERENCES aprs_stations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS dstar_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                source TEXT NOT NULL DEFAULT 'd-rats',
                speed REAL,
                course REAL,
                altitude REAL,
                comment TEXT DEFAULT '',
                radio_time TEXT DEFAULT '',
                fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS log_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_label TEXT NOT NULL,
                status TEXT NOT NULL,
                location TEXT DEFAULT '',
                message TEXT NOT NULL,
                runner_bib TEXT DEFAULT '',
                runner_name TEXT DEFAULT '',
                runner_hometown TEXT DEFAULT '',
                runner_position TEXT DEFAULT '',
                checkpoint TEXT DEFAULT '',
                crono_time TEXT DEFAULT '',
                created_by_username TEXT DEFAULT '',
                created_by_name TEXT DEFAULT '',
                bulletin_requested INTEGER NOT NULL DEFAULT 0,
                bulletin_id INTEGER,
                aprs_station TEXT DEFAULT '',
                lat REAL,
                lon REAL,
                hidden_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bulletins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL DEFAULT 'dispatch',
                submitter_name TEXT DEFAULT '',
                message TEXT NOT NULL,
                runner_bib TEXT DEFAULT '',
                runner_name TEXT DEFAULT '',
                runner_hometown TEXT DEFAULT '',
                runner_position TEXT DEFAULT '',
                checkpoint TEXT DEFAULT '',
                crono_time TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                hidden_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                approved_at TEXT,
                approved_by TEXT DEFAULT ''
            );
            """
        )
        _migrate(conn)
        _seed_admin(conn)


def _migrate(conn: sqlite3.Connection) -> None:
    user_cols = {item[1] for item in conn.execute("PRAGMA table_info(users)")}
    for column, sql in {
        "dstar_callsign": "ALTER TABLE users ADD COLUMN dstar_callsign TEXT DEFAULT ''",
        "username": "ALTER TABLE users ADD COLUMN username TEXT",
        "password_hash": "ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''",
        "role": "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    }.items():
        if column not in user_cols:
            conn.execute(sql)

    tac_cols = {item[1] for item in conn.execute("PRAGMA table_info(tactical_callsigns)")}
    if "location_preposition" not in tac_cols:
        conn.execute("ALTER TABLE tactical_callsigns ADD COLUMN location_preposition TEXT DEFAULT ''")

    runner_cols = {item[1] for item in conn.execute("PRAGMA table_info(runners)")}
    if "first_name" not in runner_cols:
        conn.execute("ALTER TABLE runners ADD COLUMN first_name TEXT DEFAULT ''")
        conn.execute("UPDATE runners SET first_name = CASE WHEN instr(name, ' ') > 0 THEN substr(name, 1, instr(name, ' ') - 1) ELSE name END WHERE first_name = ''")
    if "last_name" not in runner_cols:
        conn.execute("ALTER TABLE runners ADD COLUMN last_name TEXT DEFAULT ''")
        conn.execute("UPDATE runners SET last_name = CASE WHEN instr(name, ' ') > 0 THEN substr(name, instr(name, ' ') + 1) ELSE '' END WHERE last_name = ''")

    log_cols = {item[1] for item in conn.execute("PRAGMA table_info(log_entries)")}
    for column, sql in {
        "runner_bib": "ALTER TABLE log_entries ADD COLUMN runner_bib TEXT DEFAULT ''",
        "runner_name": "ALTER TABLE log_entries ADD COLUMN runner_name TEXT DEFAULT ''",
        "runner_hometown": "ALTER TABLE log_entries ADD COLUMN runner_hometown TEXT DEFAULT ''",
        "runner_position": "ALTER TABLE log_entries ADD COLUMN runner_position TEXT DEFAULT ''",
        "checkpoint": "ALTER TABLE log_entries ADD COLUMN checkpoint TEXT DEFAULT ''",
        "crono_time": "ALTER TABLE log_entries ADD COLUMN crono_time TEXT DEFAULT ''",
        "created_by_username": "ALTER TABLE log_entries ADD COLUMN created_by_username TEXT DEFAULT ''",
        "created_by_name": "ALTER TABLE log_entries ADD COLUMN created_by_name TEXT DEFAULT ''",
        "hidden_at": "ALTER TABLE log_entries ADD COLUMN hidden_at TEXT",
    }.items():
        if column not in log_cols:
            conn.execute(sql)

    bulletin_cols = {item[1] for item in conn.execute("PRAGMA table_info(bulletins)")}
    for column, sql in {
        "runner_bib": "ALTER TABLE bulletins ADD COLUMN runner_bib TEXT DEFAULT ''",
        "runner_name": "ALTER TABLE bulletins ADD COLUMN runner_name TEXT DEFAULT ''",
        "runner_hometown": "ALTER TABLE bulletins ADD COLUMN runner_hometown TEXT DEFAULT ''",
        "runner_position": "ALTER TABLE bulletins ADD COLUMN runner_position TEXT DEFAULT ''",
        "checkpoint": "ALTER TABLE bulletins ADD COLUMN checkpoint TEXT DEFAULT ''",
        "crono_time": "ALTER TABLE bulletins ADD COLUMN crono_time TEXT DEFAULT ''",
        "hidden_at": "ALTER TABLE bulletins ADD COLUMN hidden_at TEXT",
    }.items():
        if column not in bulletin_cols:
            conn.execute(sql)

    for tac in conn.execute("SELECT DISTINCT tactical_callsign FROM users WHERE tactical_callsign != ''"):
        conn.execute("INSERT OR IGNORE INTO tactical_callsigns (name) VALUES (?)", (tac["tactical_callsign"],))


def _seed_admin(conn: sqlite3.Connection) -> None:
    user_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if user_count == 0:
        conn.execute(
            "INSERT INTO users (display_name, username, password_hash, role, active) VALUES ('dispatch', 'dispatch', ?, 'admin', 1)",
            (hash_password("dispatch"),),
        )
        return

    legacy = conn.execute("SELECT id, password_hash FROM users WHERE username = 'dispatch' AND role = 'admin' LIMIT 1").fetchone()
    if legacy and verify_password("change-me", legacy["password_hash"]) and not verify_password("dispatch", legacy["password_hash"]):
        conn.execute("UPDATE users SET password_hash = ?, active = 1 WHERE id = ?", (hash_password("dispatch"), legacy["id"]))


def rows(sql: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute(sql, params).fetchall()


def row(sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(sql, params).fetchone()
