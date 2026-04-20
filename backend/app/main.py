"""
DockRadar - Application Entry Point

Run from the backend/ directory:
    python -m app.main
    # or
    uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

API docs: http://localhost:8080/docs
Frontend: http://localhost:5173  (Vite dev server)
          http://localhost:8080  (production build served from frontend/dist)
"""

from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router, scheduler_svc, _do_scan
from app.core.config import config
from app.core.logging import setup_logging

__version__ = "2.0.0"

import logging
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — start / stop the background scheduler
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    """Start the scheduler on startup, stop it cleanly on shutdown."""
    logger.info("=" * 60)
    logger.info("  DockRadar v%s", __version__)
    logger.info("  API  : http://%s:%d/api", config.HOST, config.PORT)
    logger.info("  Docs : http://%s:%d/docs", config.HOST, config.PORT)
    logger.info("  UI   : http://localhost:5173  (npm run dev)")
    logger.info("=" * 60)
    scheduler_svc.start(_do_scan)
    yield
    scheduler_svc.stop()


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DockRadar API",
    description="Docker image monitoring and update dashboard.",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


# ---------------------------------------------------------------------------
# Serve built React frontend in production
# ---------------------------------------------------------------------------

# frontend/dist is two levels up from backend/app/
DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        index = DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        return {"error": "Frontend not built. Run: cd frontend && yarn build"}
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "message": "DockRadar API is running.",
            "docs": "/docs",
            "frontend": "Run `cd frontend && yarn install && yarn dev` for the UI.",
        }



# ---------------------------------------------------------------------------
# Direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="warning",
    )
