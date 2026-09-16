import base64
import json
import logging

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid01
from pywebpush import WebPushException, webpush

from .db import connect, rows, save_setting, setting

logger = logging.getLogger("ari_cad.webpush")

# No real mailto/contact is required by the spec for this to work -- it's
# only used by push services to reach out if they need to flag abuse, which
# doesn't apply to a private LAN dispatch tool with a handful of
# subscribers.
VAPID_SUBJECT = "mailto:ari-lecco-cad@example.invalid"


def _vapid() -> Vapid01:
    # Generated once on first use and persisted like any other app_settings
    # value -- every subscription is bound to this keypair, so losing it
    # (rather than just rotating it deliberately) would silently invalidate
    # every existing browser subscription.
    private_pem = setting("vapid_private_key", "")
    if private_pem:
        return Vapid01.from_pem(private_pem.encode())
    vapid = Vapid01()
    vapid.generate_keys()
    save_setting("vapid_private_key", vapid.private_pem().decode())
    return vapid


def vapid_public_key_b64() -> str:
    raw = _vapid().public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _send_one(sub_row: dict, payload: dict) -> None:
    vapid = _vapid()
    subscription_info = {
        "endpoint": sub_row["endpoint"],
        "keys": {"p256dh": sub_row["p256dh"], "auth": sub_row["auth"]},
    }
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            # Passing the Vapid01 instance directly avoids pywebpush's
            # string-format guessing (it otherwise expects either a
            # filesystem path or a raw/DER key base64url-encoded WITHOUT
            # PEM headers -- private_pem() includes those headers and
            # standard, not urlsafe, base64, so passing that string
            # directly fails deserialization inside py_vapid).
            vapid_private_key=vapid,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            # The browser/OS dropped this subscription (uninstalled,
            # cleared site data, expired) -- the push service will never
            # accept it again, so stop trying.
            with connect() as conn:
                conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (sub_row["id"],))
        else:
            logger.warning("Web push failed for subscription %s: %s", sub_row["id"], exc)


def push_to_admins(payload: dict) -> None:
    subs = rows(
        "SELECT ps.* FROM push_subscriptions ps INNER JOIN users u ON u.id = ps.user_id WHERE u.role = 'admin' AND u.active = 1"
    )
    for sub in subs:
        _send_one(sub, payload)


def push_to_announcer_audience(payload: dict, recipient_user_ids: list[int], broadcast_all: bool) -> None:
    # Mirrors announcer_audience_clause() in main.py: broadcast reaches
    # every subscription; specific recipients reach only those users;
    # otherwise (the Announcer/speaker-group default) it reaches anonymous
    # subscribers (the public board) plus logged-in speaker-group members.
    if broadcast_all:
        subs = rows("SELECT * FROM push_subscriptions")
    elif recipient_user_ids:
        placeholders = ",".join("?" for _ in recipient_user_ids)
        subs = rows(f"SELECT * FROM push_subscriptions WHERE user_id IN ({placeholders})", tuple(recipient_user_ids))
    else:
        subs = rows(
            "SELECT ps.* FROM push_subscriptions ps LEFT JOIN users u ON u.id = ps.user_id "
            "WHERE ps.user_id IS NULL OR u.in_speaker_group = 1"
        )
    for sub in subs:
        _send_one(sub, payload)
