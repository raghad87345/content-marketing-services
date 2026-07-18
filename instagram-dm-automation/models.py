from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Config(Base):
    """Singleton row (id=1) holding the Instagram credentials entered from the dashboard."""

    __tablename__ = "config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    access_token: Mapped[str] = mapped_column(Text, default="")
    page_id: Mapped[str] = mapped_column(String(64), default="")
    instagram_business_account_id: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[str] = mapped_column(String(128), index=True)
    post_thumbnail_url: Mapped[str] = mapped_column(Text, default="")
    post_caption: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text)  # comma-separated
    comment_reply: Mapped[str] = mapped_column(Text)
    dm_message: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def keyword_list(self) -> list[str]:
        return [k.strip().lower() for k in self.keywords.split(",") if k.strip()]


class ProcessedComment(Base):
    __tablename__ = "processed_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    campaign_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
