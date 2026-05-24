from fastapi import Request
from itsdangerous import BadSignature, URLSafeSerializer

from .config import settings


COOKIE_NAME = "cad_session"
serializer = URLSafeSerializer(settings.session_secret, salt="ari-lecco-cad")


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


def is_dispatch(request: Request) -> bool:
    return read_session(request) == settings.admin_username

