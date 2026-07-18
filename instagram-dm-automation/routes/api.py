import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from instagram import InstagramAPIError, InstagramClient
from models import Campaign, Config

logger = logging.getLogger("api")
router = APIRouter(prefix="/api")


# ---------- Config ----------

class ConfigIn(BaseModel):
    access_token: str | None = None
    page_id: str = ""
    instagram_business_account_id: str = ""


def _mask(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 4:
        return "*" * len(token)
    return "*" * (len(token) - 4) + token[-4:]


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    config = db.query(Config).filter_by(id=1).first()
    if not config:
        return {"page_id": "", "instagram_business_account_id": "", "access_token_masked": "", "has_token": False}
    return {
        "page_id": config.page_id,
        "instagram_business_account_id": config.instagram_business_account_id,
        "access_token_masked": _mask(config.access_token),
        "has_token": bool(config.access_token),
    }


@router.post("/config")
def save_config(body: ConfigIn, db: Session = Depends(get_db)):
    config = db.query(Config).filter_by(id=1).first()
    if not config:
        config = Config(id=1)
        db.add(config)

    if body.access_token:
        config.access_token = body.access_token
    config.page_id = body.page_id
    config.instagram_business_account_id = body.instagram_business_account_id
    db.commit()
    return {"status": "saved"}


# ---------- Campaigns ----------

class CampaignIn(BaseModel):
    post_id: str
    keywords: str
    comment_reply: str
    dm_message: str
    active: bool = True


class CampaignOut(BaseModel):
    id: int
    post_id: str
    post_thumbnail_url: str
    post_caption: str
    keywords: str
    comment_reply: str
    dm_message: str
    active: bool

    model_config = {"from_attributes": True}


@router.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.post("/campaigns", response_model=CampaignOut)
def create_campaign(body: CampaignIn, db: Session = Depends(get_db)):
    thumbnail_url, caption = _fetch_preview(body.post_id, db)
    campaign = Campaign(
        post_id=body.post_id,
        post_thumbnail_url=thumbnail_url,
        post_caption=caption,
        keywords=body.keywords,
        comment_reply=body.comment_reply,
        dm_message=body.dm_message,
        active=body.active,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.put("/campaigns/{campaign_id}", response_model=CampaignOut)
def update_campaign(campaign_id: int, body: CampaignIn, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.post_id != body.post_id:
        thumbnail_url, caption = _fetch_preview(body.post_id, db)
        campaign.post_thumbnail_url = thumbnail_url
        campaign.post_caption = caption

    campaign.post_id = body.post_id
    campaign.keywords = body.keywords
    campaign.comment_reply = body.comment_reply
    campaign.dm_message = body.dm_message
    campaign.active = body.active
    db.commit()
    db.refresh(campaign)
    return campaign


@router.patch("/campaigns/{campaign_id}/toggle", response_model=CampaignOut)
def toggle_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.active = not campaign.active
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"status": "deleted"}


# ---------- Post preview ----------

@router.get("/posts/{post_id}/preview")
def preview_post(post_id: str, db: Session = Depends(get_db)):
    thumbnail_url, caption = _fetch_preview(post_id, db)
    return {"post_id": post_id, "thumbnail_url": thumbnail_url, "caption": caption}


def _fetch_preview(post_id: str, db: Session) -> tuple[str, str]:
    config = db.query(Config).filter_by(id=1).first()
    if not config or not config.access_token:
        return "", ""
    client = InstagramClient(access_token=config.access_token)
    try:
        details = client.get_post_details(post_id)
        return details.get("thumbnail_url", ""), details.get("caption", "")
    except InstagramAPIError as exc:
        logger.warning("Could not fetch preview for post %s: %s", post_id, exc)
        return "", ""
