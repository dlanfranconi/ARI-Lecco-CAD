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


settings = Settings()

