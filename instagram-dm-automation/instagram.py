"""Thin client around the Instagram Graph API.

Only official endpoints are used here (no unofficial/private APIs, no browser
automation). Every call logs the response and retries with exponential
backoff when Instagram/Facebook returns a rate-limit error.
"""

import logging
import time
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger("instagram")

GRAPH_BASE = "https://graph.facebook.com"

# Graph API error subcodes/codes that indicate throttling. See:
# https://developers.facebook.com/docs/graph-api/guides/error-handling
RATE_LIMIT_CODES = {4, 17, 32, 613}

MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 2


class InstagramAPIError(Exception):
    def __init__(self, message: str, response: httpx.Response | None = None):
        super().__init__(message)
        self.response = response


class InstagramClient:
    """Talks to the Instagram Graph API on behalf of one connected IG Business account."""

    def __init__(self, access_token: str, api_version: str | None = None):
        self.access_token = access_token
        self.api_version = api_version or get_settings().graph_api_version

    def _url(self, path: str) -> str:
        return f"{GRAPH_BASE}/{self.api_version}/{path}"

    def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        params = kwargs.pop("params", {}) or {}
        params["access_token"] = self.access_token
        url = self._url(path)

        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=15) as client:
                    response = client.request(method, url, params=params, **kwargs)
                logger.info("Instagram API %s %s -> %s", method, path, response.status_code)

                if response.status_code == 200:
                    return response.json()

                body = self._safe_json(response)
                error = body.get("error", {}) if isinstance(body, dict) else {}
                code = error.get("code")

                if code in RATE_LIMIT_CODES and attempt < MAX_RETRIES:
                    backoff = BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
                    logger.warning(
                        "Instagram API rate limited (code=%s), retrying in %ss (attempt %s/%s)",
                        code, backoff, attempt, MAX_RETRIES,
                    )
                    time.sleep(backoff)
                    continue

                logger.error("Instagram API error: %s", body)
                raise InstagramAPIError(
                    error.get("message", f"Graph API error (status {response.status_code})"),
                    response,
                )
            except httpx.RequestError as exc:
                last_error = exc
                logger.warning("Instagram API network error (attempt %s/%s): %s", attempt, MAX_RETRIES, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
                    continue

        raise InstagramAPIError(f"Request failed after {MAX_RETRIES} attempts: {last_error}")

    @staticmethod
    def _safe_json(response: httpx.Response) -> dict:
        try:
            return response.json()
        except ValueError:
            return {"error": {"message": response.text}}

    def reply_to_comment(self, comment_id: str, message: str) -> dict:
        """Post a public reply to an Instagram comment."""
        return self._request("POST", f"{comment_id}/replies", data={"message": message})

    def send_dm(self, instagram_user_id: str, message: str) -> dict:
        """Send a private DM to an Instagram user via the Send API.

        Note: this only succeeds if the 24-hour messaging window is open
        (the user has messaged/commented recently) or your app has the
        approved instagram_manage_messages use case. See README for details.
        """
        ig_business_id = get_settings().instagram_business_account_id
        payload = {
            "recipient": {"id": instagram_user_id},
            "message": {"text": message},
        }
        return self._request(
            "POST",
            f"{ig_business_id}/messages",
            json=payload,
        )

    def get_post_details(self, post_id: str) -> dict:
        """Fetch a media object's thumbnail URL + caption for the dashboard preview."""
        data = self._request(
            "GET",
            post_id,
            params={"fields": "id,caption,media_type,media_url,thumbnail_url,permalink"},
        )
        thumbnail = data.get("thumbnail_url") or data.get("media_url", "")
        return {
            "id": data.get("id", post_id),
            "caption": data.get("caption", ""),
            "thumbnail_url": thumbnail,
            "permalink": data.get("permalink", ""),
            "media_type": data.get("media_type", ""),
        }
