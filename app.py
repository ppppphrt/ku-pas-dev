"""Vercel demo: same-origin API and React frontend, with browser-only timetables."""

import sys
from contextlib import asynccontextmanager
from importlib import import_module
from pathlib import Path

from fastapi import FastAPI

ROOT = Path(__file__).resolve().parent
# The original backend remains runnable with `uvicorn main:app` from backend/.
sys.path.insert(0, str(ROOT / "backend"))
create_app = import_module("main").create_app

api = create_app(semantic=False, demo=True)


@asynccontextmanager
async def lifespan(app):
    # Mounted FastAPI apps do not run their own lifespan automatically.
    async with api.router.lifespan_context(api):
        yield


app = FastAPI(title="KU-PAS public demo", lifespan=lifespan, docs_url=None, redoc_url=None)
app.mount("/api", api)
# Vercel promotes this frontend to its CDN and preserves BrowserRouter deep links.
app.frontend("/", directory=ROOT / "frontend/dist", fallback="index.html")
