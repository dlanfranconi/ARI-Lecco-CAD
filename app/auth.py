import hashlib
import hmac
import os

from fastapi import Request
from itsdangerous import BadSignature, URLSafeSerializer

from .config import settings

COOKIE_NAME = "cad_session"
serializer = URLSafeSerializer(settings.session_secret, salt="ari-lecco-cad")


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 120_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if not stored or "$" not in stored:
        return False
    try:
        algorithm, salt, digest = stored.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt).split("$", 2)[2]
    return hmac.compare_digest(candidate, digest)


def make_session(username: str) -> str:
    return serializer.dumps({"username": username})


def read_session(request: Request) -> str | None:
    value = request.cookies.get(COOKIE_NAME)
    if not value:
        return None
    try:
        data = serializer.loads(value)
    except BadSignature:
        return None
    return data.get("username")
