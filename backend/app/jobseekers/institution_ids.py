import base64
import logging

logger = logging.getLogger(__name__)


def encode_institution_id(institution_name: str) -> str:
    return base64.urlsafe_b64encode(institution_name.encode("utf-8")).decode("ascii").rstrip("=")


def decode_institution_id(institution_id: str) -> str | None:
    padding = -len(institution_id) % 4
    try:
        return base64.urlsafe_b64decode(institution_id + "=" * padding).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        logger.warning("Could not decode institution id %r.", institution_id)
        return None
