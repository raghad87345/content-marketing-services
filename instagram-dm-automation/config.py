from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    instagram_access_token: str = ""
    instagram_business_account_id: str = ""
    facebook_app_secret: str = ""
    webhook_verify_token: str = ""
    database_url: str = "sqlite:///./app.db"
    graph_api_version: str = "v21.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
