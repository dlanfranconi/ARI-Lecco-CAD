import os
import secrets
from pathlib import Path


def _read_version() -> str:
    version_path = os.path.join(os.path.dirname(__file__), "..", "VERSION")
    try:
        with open(version_path, encoding="utf-8") as f:
            return f.read().strip() or "0.0.0"
    except OSError:
        return "0.0.0"


# Placeholder values that mean "nobody actually set this" -- both the
# in-code fallback and docker-compose.yml's own unset-env-var default, kept
# here rather than a real secret so a forgotten override doesn't silently
# leave every session signed with a value anyone can read in this repo.
_UNSET_SESSION_SECRETS = {"", "dev-only-change-me", "replace-with-a-long-random-string"}


def _resolve_session_secret() -> str:
    env_value = os.getenv("SESSION_SECRET", "").strip()
    if env_value not in _UNSET_SESSION_SECRETS:
        return env_value
    # No real secret was configured -- generate one and persist it next to
    # the database (same volume, so it survives restarts/redeploys) instead
    # of requiring a manual step. This is what makes a from-scratch headless
    # Pi boot end up with a real per-install secret with no operator input.
    data_dir = Path(os.getenv("DATABASE_PATH", "/data/cad.sqlite3")).parent
    secret_path = data_dir / ".session_secret"
    try:
        existing = secret_path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    except OSError:
        pass
    generated = secrets.token_urlsafe(32)
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        secret_path.write_text(generated, encoding="utf-8")
    except OSError:
        pass
    return generated


class Settings:
    admin_username: str = os.getenv("CAD_ADMIN_USERNAME", "dispatch")
    admin_password: str = os.getenv("CAD_ADMIN_PASSWORD", "dispatch")
    session_secret: str = _resolve_session_secret()
    aprsfi_api_key: str = os.getenv("APRSFI_API_KEY", "")
    aprs_poll_seconds: int = int(os.getenv("APRS_POLL_SECONDS", "60"))
    database_path: str = os.getenv("DATABASE_PATH", "/data/cad.sqlite3")
    drats_ingest_token: str = os.getenv("DRATS_INGEST_TOKEN", "")
    app_timezone: str = os.getenv("TZ", os.getenv("APP_TIMEZONE", "Europe/Rome"))
    app_locale: str = os.getenv("LANG", os.getenv("APP_LOCALE", "it_IT.UTF-8"))
    ntp_server: str = os.getenv("NTP_SERVER", "pool.ntp.org")
    mdns_hostname: str = os.getenv("MDNS_HOSTNAME", "cad-server")
    mdns_enabled: bool = os.getenv("MDNS_ENABLED", "true").lower() not in {"0", "false", "no"}
    port: int = int(os.getenv("PORT", "80"))
    https_enabled: bool = os.getenv("HTTPS_ENABLED", "false").lower() not in {"0", "false", "no"}
    https_port: int = int(os.getenv("HTTPS_PORT", "443"))
    cert_dir: str = os.getenv("CERT_DIR", "/data/certs")
    is_https_child: bool = os.getenv("ARI_CAD_HTTPS_CHILD") == "1"
    network_monitor_enabled: bool = os.getenv("NETWORK_MONITOR_ENABLED", "true").lower() not in {"0", "false", "no"}
    network_monitor_poll_seconds: int = int(os.getenv("NETWORK_MONITOR_POLL_SECONDS", "30"))
    iperf_test_seconds: int = int(os.getenv("IPERF_TEST_SECONDS", "5"))
    app_version: str = _read_version()
    app_build: str = (
        "dev" if os.getenv("APP_GIT_SHA", "dev") == "dev"
        else f"{os.getenv('APP_GIT_REF', 'local')}@{os.getenv('APP_GIT_SHA')[:7]}"
    )


settings = Settings()

