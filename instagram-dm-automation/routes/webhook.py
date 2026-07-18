import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from instagram import InstagramAPIError, InstagramClient
from models import Campaign, Config, ProcessedComment

logger = logging.getLogger("webhook")
router = APIRouter()


@router.get("/webhook/instagram")
def verify_webhook(request: Request):
    """Facebook calls this once, at setup time, to confirm you own the endpoint."""
    settings = get_settings()
    params = request.query_params

    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.webhook_verify_token:
        return Response(content=challenge, media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification token mismatch")


def _verify_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.split("sha256=", 1)[1]
    return hmac.compare_digest(expected, provided)


@router.post("/webhook/instagram")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    raw_body = await request.body()

    if not _verify_signature(raw_body, x_hub_signature_256, settings.facebook_app_secret):
        logger.warning("Rejected webhook payload with invalid X-Hub-Signature-256")
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()
    logger.info("Received webhook payload: %s", payload)

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "comments":
                continue
            _handle_comment_change(change.get("value", {}), db)

    return {"status": "ok"}


def _handle_comment_change(value: dict, db: Session) -> None:
    comment_id = value.get("id")
    text = value.get("text", "")
    media = value.get("media", {}) or {}
    post_id = media.get("id")
    commenter = value.get("from", {}) or {}
    commenter_id = commenter.get("id")

    if not comment_id or not post_id or not commenter_id:
        logger.info("Ignoring comment change missing id/media/from: %s", value)
        return

    already_processed = db.query(ProcessedComment).filter_by(comment_id=comment_id).first()
    if already_processed:
        logger.info("Comment %s already processed, skipping", comment_id)
        return

    campaign = (
        db.query(Campaign)
        .filter(Campaign.post_id == post_id, Campaign.active.is_(True))
        .first()
    )
    if not campaign:
        logger.info("No active campaign for post %s", post_id)
        return

    text_lower = text.lower()
    matched = any(keyword in text_lower for keyword in campaign.keyword_list())
    if not matched:
        logger.info("Comment %s on post %s did not match any keyword", comment_id, post_id)
        return

    config = db.query(Config).filter_by(id=1).first()
    if not config or not config.access_token:
        logger.error("No Instagram access token configured; cannot act on comment %s", comment_id)
        return

    client = InstagramClient(access_token=config.access_token)

    try:
        client.reply_to_comment(comment_id, campaign.comment_reply)
    except InstagramAPIError as exc:
        logger.error("Failed to reply to comment %s: %s", comment_id, exc)

    try:
        client.send_dm(commenter_id, campaign.dm_message)
    except InstagramAPIError as exc:
        logger.error("Failed to DM user %s for comment %s: %s", commenter_id, comment_id, exc)

    db.add(ProcessedComment(comment_id=comment_id, campaign_id=campaign.id))
    db.commit()
    logger.info("Processed comment %s for campaign %s", comment_id, campaign.id)
