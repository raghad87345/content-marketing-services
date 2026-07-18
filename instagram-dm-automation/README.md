# Instagram Comment-to-DM Automation

A ManyChat-style automation tool: when someone comments a tracked keyword on a chosen
Instagram post, the app **publicly replies to the comment** and **sends the commenter a
private DM** — automatically, via the official Instagram Graph API.

- **Backend:** Python + FastAPI
- **Database:** SQLite via SQLAlchemy (swap `DATABASE_URL` for Postgres later, no code changes needed)
- **Frontend:** Vanilla HTML/CSS/JS dashboard (Jinja2 templates, no build step)
- **No unofficial APIs:** only the official Meta Graph API is used — no Selenium, no
  `instagrapi`, no browser automation.

---

## 1. Instagram / Facebook Developer Setup (do this first)

Instagram automation runs through Meta's **Graph API**, which requires a Facebook
Developer App connected to your Instagram account. Follow these steps in order.

### 1.1 Convert your Instagram account to Business or Creator

1. Open the Instagram app → **Settings → Account type and tools**.
2. Choose **Switch to professional account** → pick **Business** (recommended) or **Creator**.
3. Connect it to a **Facebook Page** you manage (create one if you don't have one — it can
   be minimal, it just needs to exist to host the API connection).

### 1.2 Create a Facebook Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with the
   Facebook account that manages the Page from step 1.1.
2. **My Apps → Create App**.
3. Choose the **"Other"** use case, then app type **"Business"**.
4. Give it a name (e.g. `My IG Automation`) and create it.

### 1.3 Add the Instagram Graph API product

1. In your new app's dashboard, find **Add Product** and add **Instagram Graph API**.
2. Also add the **Webhooks** product (used in step 1.5).
3. Under **App Settings → Basic**, note your **App ID** and **App Secret** — you'll need
   the App Secret for `.env` (`FACEBOOK_APP_SECRET`).

### 1.4 Add permissions and generate a long-lived access token

1. Go to **Tools → Graph API Explorer** (linked from the top nav of the developer site).
2. Select your app from the dropdown, then click **User or Page → Generate Access Token**.
3. Add these permissions when prompted (search for them in the permissions picker):
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_read_engagement`
4. Log in and approve access to the Page connected to your Instagram Business account.
5. This gives you a **short-lived token** (valid ~1 hour). Exchange it for a **long-lived
   token** (valid ~60 days) with:

   ```bash
   curl -i -X GET "https://graph.facebook.com/v21.0/oauth/access_token?          grant_type=fb_exchange_token&          client_id=<APP_ID>&          client_secret=<APP_SECRET>&          fb_exchange_token=<SHORT_LIVED_TOKEN>"
   ```

6. Take the `access_token` from the response — this is what you paste into the dashboard's
   **Settings** page (or `INSTAGRAM_ACCESS_TOKEN` in `.env` for local testing).

**Refreshing the token before it expires (every ~60 days):** long-lived tokens can be
refreshed for another 60 days *as long as the current one hasn't expired yet*. Call:

```bash
curl -i -X GET "https://graph.facebook.com/v21.0/oauth/access_token?      grant_type=fb_exchange_token&      client_id=<APP_ID>&      client_secret=<APP_SECRET>&      fb_exchange_token=<CURRENT_LONG_LIVED_TOKEN>"
```

and update the token in the Settings page. Set yourself a recurring reminder (e.g. every
45 days) so it never lapses — if it does, you must re-run the Graph API Explorer flow
(step 1.4) to get a new token from scratch.

### 1.5 Configure the Webhook

1. In your app dashboard, go to **Webhooks**.
2. Click **Subscribe to this object** for **Instagram**.
3. Callback URL: `https://<your-deployed-domain>/webhook/instagram`
   (for local testing, use a tunnel like `ngrok http 8000` and use the ngrok URL).
4. Verify Token: any string you choose — put the same value in `.env` as
   `WEBHOOK_VERIFY_TOKEN`.
5. Click **Verify and Save**. Facebook will call `GET /webhook/instagram` with a challenge;
   this app answers it automatically (see `routes/webhook.py`).
6. Subscribe to the **`comments`** field for your Instagram Business Account under
   **Webhooks → Instagram → Manage → your Page**.

### 1.6 Getting a Post ID for a specific Instagram post/video

1. Open **Graph API Explorer** again.
2. With your access token selected, query:
   `GET /{instagram-business-account-id}/media?fields=id,caption,media_type,timestamp`
3. Find the post you want in the returned list and copy its `id` — that's the **Post ID**
   to paste into the campaign's "Instagram Post ID" field in the dashboard.
4. Alternatively, query a single post directly if you already have its ID:
   `GET /{post-id}?fields=id,caption,media_type,media_url,thumbnail_url,permalink`

---

## 2. Running locally

```bash
cd instagram-dm-automation
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with your values from section 1
uvicorn main:app --reload
```

- Dashboard: http://localhost:8000/dashboard
- Health check: http://localhost:8000/health
- Webhook endpoint: http://localhost:8000/webhook/instagram (expose via ngrok for Meta to reach it)

## 3. Deploying

### Docker

```bash
docker build -t ig-dm-automation .
docker run -p 8000:8000 --env-file .env ig-dm-automation
```

### Railway

Push this directory to a repo and connect it in Railway — `railway.toml` is already
configured to build from the `Dockerfile` and hit `/health` for its health check. Set the
four secrets (`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`,
`FACEBOOK_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`) as Railway environment variables.

### Render

`render.yaml` defines a Docker web service with a persistent disk for the SQLite file.
Set the same four secrets in the Render dashboard (they're marked `sync: false` so Render
prompts for them rather than storing defaults in the repo).

---

## 4. Project structure

```
instagram-dm-automation/
├── main.py              # FastAPI app entry point
├── instagram.py         # Instagram Graph API client (reply, DM, post lookup)
├── models.py             # SQLAlchemy models: Config, Campaign, ProcessedComment
├── database.py           # DB engine/session setup
├── config.py             # Environment-based settings (pydantic-settings)
├── routes/
│   ├── webhook.py         # GET/POST /webhook/instagram
│   ├── dashboard.py       # HTML dashboard routes
│   └── api.py              # REST API for campaigns/config
├── static/                 # CSS + JS for the dashboard
├── templates/               # Jinja2 HTML templates
├── .env.example
├── Dockerfile
├── railway.toml
├── render.yaml
├── requirements.txt
└── README.md
```

## 5. How matching works

1. Meta POSTs a `comments` change event to `/webhook/instagram`.
2. The request's `X-Hub-Signature-256` header is validated (HMAC-SHA256 over the raw body,
   keyed with `FACEBOOK_APP_SECRET`) — anything that doesn't match is rejected with 403.
3. The comment's `id` is checked against `ProcessedComment` — already-handled comments are
   skipped, so retried webhook deliveries never double-fire.
4. The comment's media/post ID is matched against active `Campaign` rows.
5. The comment text is matched case-insensitively (substring match) against the campaign's
   comma-separated keyword list.
6. On a match: `reply_to_comment()` posts the public reply, `send_dm()` sends the private
   message, and the comment ID is recorded in `ProcessedComment`.

## 6. IMPORTANT: Instagram DM limitations

Instagram's Graph API **Send API** only allows messaging a user if one of the following is true:

- The user has messaged your Instagram Business account within the last **24 hours**
  (the standard messaging window), **or**
- Your app has been granted the `instagram_manage_messages` permission under an
  **approved use case** in App Review, which allows messaging users who commented on your
  posts even outside the 24-hour window (this is the "comment-to-DM" use case Meta added
  specifically for tools like this one).

**In practice:** while your app is in development mode, DMs will only succeed for
Instagram test users you've added to your app's roles, or users who've recently messaged
you. To use this in production for real commenters, you must submit your app for **App
Review** and request the `instagram_manage_messages` permission, describing the
comment-to-DM automation use case. Go to **App Review → Permissions and Features** in your
app dashboard, request `instagram_manage_messages`, and provide a screen recording showing
the exact flow (comment → reply → DM) as your use case demonstration.

Until that's approved, expect `send_dm()` calls to fail with a Graph API error for users
outside the messaging window — this is logged, not silently swallowed, so you'll see it in
the server logs.

## 7. Security notes

- `FACEBOOK_APP_SECRET` and `WEBHOOK_VERIFY_TOKEN` live only in `.env` / deployment
  environment variables — never in the database and never sent to the frontend.
- Every webhook POST is signature-verified before any processing happens.
- The Instagram access token is stored in the database (edited from the Settings page)
  and is never rendered in full in the frontend — the Settings page only shows a masked
  version (`****1234`) of the currently saved token.
- Rate-limited Graph API responses are retried with exponential backoff (see `instagram.py`);
  persistent failures are logged rather than crashing the webhook handler.
