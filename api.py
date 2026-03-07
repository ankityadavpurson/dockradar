"""
DockRadar - REST API
Exposes all core DockRadar functionality as JSON endpoints via FastAPI
(which NiceGUI already runs under the hood).

Endpoints
---------
GET  /api/containers            List all containers with their scan status
GET  /api/containers/{name}     Get a single container by name
POST /api/scan                  Trigger a full scan (async background task)
GET  /api/scan/status           Get current scan/update status + progress log
POST /api/containers/{name}/update   Update a single container
POST /api/update/selected       Update a list of containers by name
POST /api/update/all            Update all outdated containers
DELETE /api/containers/{name}   Stop + remove a container (no recreate)
GET  /api/health                Health check — Docker connectivity + scheduler
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from docker_service import DockerService, ContainerInfo
from registry_service import RegistryService
from update_service import UpdateService
from scheduler_service import SchedulerService
from config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared service instances
# These are imported into app.py so they share state with the dashboard UI.
# ---------------------------------------------------------------------------

docker_svc    = DockerService()
registry_svc  = RegistryService()
update_svc    = UpdateService(docker_svc)
scheduler_svc = SchedulerService()

# ---------------------------------------------------------------------------
# In-memory task state  (shared with dashboard via api_state import)
# ---------------------------------------------------------------------------

class ApiState:
    scanning:  bool = False
    updating:  bool = False
    progress:  list[str] = []
    containers: list[ContainerInfo] = []

api_state = ApiState()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ContainerOut(BaseModel):
    id: str
    short_id: str
    name: str
    image_name: str
    repository: str
    tag: str
    status: str
    latest_tag: Optional[str] = None
    update_status: str

    @classmethod
    def from_info(cls, c: ContainerInfo) -> "ContainerOut":
        return cls(
            id=c.id,
            short_id=c.short_id,
            name=c.name,
            image_name=c.image_name,
            repository=c.repository,
            tag=c.tag,
            status=c.status,
            latest_tag=c.latest_tag,
            update_status=c.update_status,
        )


class ScanStatusOut(BaseModel):
    scanning: bool
    updating: bool
    container_count: int
    outdated_count: int
    progress: list[str]
    next_scan: Optional[str]


class UpdateRequest(BaseModel):
    names: list[str]


class UpdateResultOut(BaseModel):
    container: str
    success: bool
    steps: list[dict]
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Background workers
# ---------------------------------------------------------------------------

def _do_scan():
    """Blocking scan — run in a thread via BackgroundTasks."""
    logger.info("[API] Scan triggered via API.")
    api_state.scanning = True
    api_state.progress.clear()
    api_state.progress.append("🔍 Discovering containers...")

    containers = docker_svc.get_all_containers()
    api_state.progress.append(f"📦 Found {len(containers)} containers. Checking registries...")

    for i, c in enumerate(containers):
        api_state.progress.append(
            f"  [{i+1}/{len(containers)}] Checking {c.name} ({c.image_name})..."
        )
        latest_tag, update_status = registry_svc.get_latest_tag(c.repository, c.tag)
        c.latest_tag    = latest_tag
        c.update_status = update_status

    api_state.containers = containers
    api_state.scanning   = False
    outdated = sum(1 for c in containers if c.update_status == "update_available")
    api_state.progress.append(
        f"✅ Scan complete — {len(containers)} containers, {outdated} update(s) available."
    )
    logger.info("[API] Scan complete: %d containers, %d updates.", len(containers), outdated)


def _do_update(containers: list[ContainerInfo]):
    """Blocking update — run in a thread via BackgroundTasks."""
    api_state.updating = True
    api_state.progress.clear()

    def cb(name: str, msg: str):
        api_state.progress.append(f"[{name}] {msg}")

    update_svc.update_multiple(containers, progress_cb=cb)
    api_state.updating = False
    _do_scan()


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api", tags=["DockRadar API"])


# ── GET /api/health ──────────────────────────────────────────────────────────

@router.get("/health", summary="Health check")
def health():
    """Returns Docker connectivity status and scheduler info."""
    return {
        "status": "ok",
        "docker_connected": docker_svc.is_connected(),
        "scheduler_running": scheduler_svc.is_running(),
        "next_scan": scheduler_svc.get_next_run(),
        "scan_interval_hours": config.SCAN_INTERVAL_HOURS,
        "email_configured": config.email_configured(),
    }


# ── GET /api/containers ──────────────────────────────────────────────────────

@router.get("/containers", response_model=list[ContainerOut], summary="List all containers")
def list_containers():
    """
    Return all known containers with their current scan results.
    If no scan has been run yet, discovers containers live (without registry check).
    """
    if not api_state.containers:
        api_state.containers = docker_svc.get_all_containers()
    return [ContainerOut.from_info(c) for c in api_state.containers]


# ── GET /api/containers/{name} ───────────────────────────────────────────────

@router.get("/containers/{name}", response_model=ContainerOut, summary="Get a single container")
def get_container(name: str):
    """Return details for a single container by name."""
    # Try cached state first
    for c in api_state.containers:
        if c.name == name:
            return ContainerOut.from_info(c)

    # Fall back to live Docker query
    containers = docker_svc.get_all_containers()
    for c in containers:
        if c.name == name:
            return ContainerOut.from_info(c)

    raise HTTPException(status_code=404, detail=f"Container '{name}' not found.")


# ── POST /api/scan ───────────────────────────────────────────────────────────

@router.post("/scan", summary="Trigger a full scan")
def trigger_scan(background_tasks: BackgroundTasks):
    """
    Start a background scan of all containers against their registries.
    Returns immediately — poll GET /api/scan/status for progress.
    """
    if api_state.scanning:
        raise HTTPException(status_code=409, detail="A scan is already in progress.")
    if api_state.updating:
        raise HTTPException(status_code=409, detail="An update is in progress. Wait for it to finish.")

    background_tasks.add_task(_do_scan)
    return {"message": "Scan started.", "poll": "/api/scan/status"}


# ── GET /api/scan/status ─────────────────────────────────────────────────────

@router.get("/scan/status", response_model=ScanStatusOut, summary="Scan / update status")
def scan_status():
    """Return current scanning/updating state and the last 50 progress messages."""
    outdated = sum(1 for c in api_state.containers if c.update_status == "update_available")
    return ScanStatusOut(
        scanning=api_state.scanning,
        updating=api_state.updating,
        container_count=len(api_state.containers),
        outdated_count=outdated,
        progress=api_state.progress[-50:],
        next_scan=scheduler_svc.get_next_run(),
    )


# ── POST /api/containers/{name}/update ──────────────────────────────────────

@router.post(
    "/containers/{name}/update",
    response_model=UpdateResultOut,
    summary="Update a single container",
)
def update_container(name: str):
    """
    Synchronously pull + recreate a single container.
    Blocks until the update is complete and returns the result.
    """
    if api_state.scanning or api_state.updating:
        raise HTTPException(status_code=409, detail="A scan or update is already running.")

    # Find in cache or live
    container: Optional[ContainerInfo] = None
    for c in api_state.containers:
        if c.name == name:
            container = c
            break

    if container is None:
        live = docker_svc.get_all_containers()
        for c in live:
            if c.name == name:
                container = c
                break

    if container is None:
        raise HTTPException(status_code=404, detail=f"Container '{name}' not found.")

    # Check registry for latest tag if not already done
    if not container.latest_tag or container.latest_tag == "unknown":
        latest_tag, update_status = registry_svc.get_latest_tag(container.repository, container.tag)
        container.latest_tag    = latest_tag
        container.update_status = update_status

    messages: list[str] = []

    def progress(msg: str):
        messages.append(msg)
        logger.info("[API] [%s] %s", name, msg)

    result = update_svc.update_container(container, progress_cb=progress)

    return UpdateResultOut(
        container=result.container_name,
        success=result.success,
        steps=[{"step": s, "success": ok} for s, ok in result.steps],
        error=result.error,
    )


# ── POST /api/update/selected ────────────────────────────────────────────────

@router.post("/update/selected", summary="Update containers by name list")
def update_selected(body: UpdateRequest, background_tasks: BackgroundTasks):
    """
    Start a background update for the given container names.
    Returns immediately — poll GET /api/scan/status for progress.
    """
    if api_state.scanning or api_state.updating:
        raise HTTPException(status_code=409, detail="A scan or update is already running.")

    name_set = set(body.names)
    targets = [c for c in api_state.containers if c.name in name_set]

    missing = name_set - {c.name for c in targets}
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Containers not found in last scan: {sorted(missing)}. Run /api/scan first.",
        )

    if not targets:
        raise HTTPException(status_code=400, detail="No valid containers specified.")

    background_tasks.add_task(_do_update, targets)
    return {
        "message": f"Update started for {len(targets)} container(s).",
        "containers": [c.name for c in targets],
        "poll": "/api/scan/status",
    }


# ── POST /api/update/all ─────────────────────────────────────────────────────

@router.post("/update/all", summary="Update all outdated containers")
def update_all_outdated(background_tasks: BackgroundTasks):
    """
    Start a background update for every container with update_status == 'update_available'.
    Run /api/scan first to populate the list.
    """
    if api_state.scanning or api_state.updating:
        raise HTTPException(status_code=409, detail="A scan or update is already running.")

    targets = [c for c in api_state.containers if c.update_status == "update_available"]

    if not targets:
        return {"message": "No outdated containers found. Run /api/scan first.", "containers": []}

    background_tasks.add_task(_do_update, targets)
    return {
        "message": f"Update started for {len(targets)} outdated container(s).",
        "containers": [c.name for c in targets],
        "poll": "/api/scan/status",
    }


# ── DELETE /api/containers/{name} ────────────────────────────────────────────

@router.delete("/containers/{name}", summary="Stop and remove a container")
def delete_container(name: str):
    """
    Stop and remove a container. Does NOT pull or recreate it.
    Use the update endpoints to upgrade a container instead.
    """
    # Check it exists
    status = docker_svc.get_container_status(name)
    if status is None:
        raise HTTPException(status_code=404, detail=f"Container '{name}' not found.")

    stopped = docker_svc.stop_container(name)
    removed = docker_svc.remove_container(name)

    # Remove from cache
    api_state.containers = [c for c in api_state.containers if c.name != name]

    return {
        "container": name,
        "stopped": stopped,
        "removed": removed,
        "success": stopped and removed,
    }
