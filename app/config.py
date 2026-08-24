import os


class Settings:
    admin_username: str = os.getenv("CAD_ADMIN_USERNAME", "dispatch")
    admin_password: str = os.getenv("CAD_ADMIN_PASSWORD", "dispatch")
    session_secret: str = os.getenv("SESSION_SECRET", "dev-only-change-me")
    aprsfi_api_key: str = os.getenv("APRSFI_API_KEY", "")
    aprs_poll_seconds: int = int(os.getenv("APRS_POLL_SECONDS", "60"))
    database_path: str = os.getenv("DATABASE_PATH", "/data/cad.sqlite3")
    drats_ingest_token: str = os.getenv("DRATS_INGEST_TOKEN", "")
    app_timezone: str = os.getenv("TZ", os.getenv("APP_TIMEZONE", "Europe/Rome"))
    app_locale: str = os.getenv("LANG", os.getenv("APP_LOCALE", "it_IT.UTF-8"))
    ntp_server: str = os.getenv("NTP_SERVER", "pool.ntp.org")
    mdns_hostname: str = os.getenv("MDNS_HOSTNAME", "ari-cad")
    mdns_enabled: bool = os.getenv("MDNS_ENABLED", "true").lower() not in {"0", "false", "no"}
    port: int = int(os.getenv("PORT", "80"))
    https_enabled: bool = os.getenv("HTTPS_ENABLED", "false").lower() not in {"0", "false", "no"}
    https_port: int = int(os.getenv("HTTPS_PORT", "443"))
    cert_dir: str = os.getenv("CERT_DIR", "/data/certs")
    is_https_child: bool = os.getenv("ARI_CAD_HTTPS_CHILD") == "1"
    network_monitor_enabled: bool = os.getenv("NETWORK_MONITOR_ENABLED", "true").lower() not in {"0", "false", "no"}
    network_monitor_poll_seconds: int = int(os.getenv("NETWORK_MONITOR_POLL_SECONDS", "30"))
    iperf_test_seconds: int = int(os.getenv("IPERF_TEST_SECONDS", "5"))
    app_version: str = (
        "dev" if os.getenv("APP_GIT_SHA", "dev") == "dev"
        else f"{os.getenv('APP_GIT_REF', 'local')}@{os.getenv('APP_GIT_SHA')[:7]}"
    )


settings = Settings()

