from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/dashboard")
def dashboard_root(request: Request):
    return templates.TemplateResponse(request, "campaigns.html", {"active_page": "campaigns"})


@router.get("/dashboard/settings")
def dashboard_settings(request: Request):
    return templates.TemplateResponse(request, "settings.html", {"active_page": "settings"})


@router.get("/dashboard/campaigns")
def dashboard_campaigns(request: Request):
    return templates.TemplateResponse(request, "campaigns.html", {"active_page": "campaigns"})
