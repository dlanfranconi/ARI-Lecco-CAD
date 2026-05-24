import os


class Settings:
    admin_username: str = os.getenv("CAD_ADMIN_USERNAME", "dispatch")
    admin_password: str = os.getenv("CAD_ADMIN_PASSWORD", "change-me")
    session_secret: str = os.getenv("SESSION_SECRET", "dev-only-change-me")
    aprsfi_api_key: str = os.getenv("APRSFI_API_KEY", "")
    aprs_poll_seconds: int = int(os.getenv("APRS_POLL_SECONDS", "60"))
    database_path: str = os.getenv("DATABASE_PATH", "/data/cad.sqlite3")


settings = Settings()

