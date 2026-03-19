"""
DockRadar - REST API
Exposes all core DockRadar functionality as JSON endpoints via FastAPI.

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

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.services.docker import DockerService, ContainerInfo
from app.services.registry import RegistryService
from app.services.update import UpdateService
from app.services.scheduler import SchedulerService
from app.services.compose import ComposeService
from app.core.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared service instances
# These are imported into app.py so they share state with the dashboard UI.
# ---------------------------------------------------------------------------

docker_svc    = DockerService()
registry_svc  = RegistryService()
update_svc    = UpdateService(docker_svc)
compose_svc   = ComposeService()
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
    local_digest: Optional[str] = None

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
            local_digest=c.local_digest,
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



class AssociateRequest(BaseModel):
    container_name: str
    file_id: str
    service_name: str


class AssociationOut(BaseModel):
    container_name: str
    file_id: str
    service_name: str
    filename: str

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
        latest_tag, update_status = registry_svc.get_latest_tag(c.repository, c.tag, c.local_digest)
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
        latest_tag, update_status = registry_svc.get_latest_tag(container.repository, container.tag, container.local_digest)
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


# ── POST /api/compose ────────────────────────────────────────────────────────

@router.post("/compose", summary="Upload a docker-compose file")
async def upload_compose_file(file: UploadFile = File(...)):
    """
    Upload and store a docker-compose YAML file.
    The file is validated and saved to disk. Existing files with the same
    name are overwritten.
    """
    if not file.filename.endswith((".yml", ".yaml")):
        raise HTTPException(status_code=400, detail="Only .yml / .yaml files are accepted.")

    content = (await file.read()).decode("utf-8")

    try:
        cf = compose_svc.save_file(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {"message": "Compose file saved.", "compose_file": cf.to_dict()}


# ── GET /api/compose ─────────────────────────────────────────────────────────

@router.get("/compose", summary="List stored compose files")
def list_compose_files():
    """Return all stored compose files and their service names."""
    return compose_svc.list_files()


# ── DELETE /api/compose/{file_id} ────────────────────────────────────────────

@router.delete("/compose/{file_id}", summary="Delete a stored compose file")
def delete_compose_file(file_id: str):
    """Delete a stored compose file and remove all its container associations."""
    ok = compose_svc.delete_file(file_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Compose file '{file_id}' not found.")
    return {"message": f"Compose file '{file_id}' deleted."}




# ── GET /api/compose/{file_id}/content ───────────────────────────────────────

@router.get("/compose/{file_id}/content", summary="Get raw content of a compose file")
def get_compose_file_content(file_id: str):
    """Return the raw YAML text of a stored compose file for editing."""
    content = compose_svc.get_file_content(file_id)
    if content is None:
        raise HTTPException(status_code=404, detail=f"Compose file '{file_id}' not found.")
    cf = compose_svc.get_file(file_id)
    return {"file_id": file_id, "filename": cf.filename, "content": content}


# ── PUT /api/compose/{file_id} ───────────────────────────────────────────────

class UpdateComposeBody(BaseModel):
    content: str

@router.put("/compose/{file_id}", summary="Update content of a stored compose file")
def update_compose_file(file_id: str, body: UpdateComposeBody):
    """Overwrite the YAML content of an existing compose file."""
    try:
        cf = compose_svc.update_file(file_id, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"message": "Compose file updated.", "compose_file": cf.to_dict()}


# ── GET /api/compose/{file_id}/download ──────────────────────────────────────

from fastapi.responses import PlainTextResponse

@router.get("/compose/{file_id}/download", summary="Download a compose file")
def download_compose_file(file_id: str):
    """Return the raw YAML content as a downloadable file attachment."""
    content = compose_svc.get_file_content(file_id)
    if content is None:
        raise HTTPException(status_code=404, detail=f"Compose file '{file_id}' not found.")
    cf = compose_svc.get_file(file_id)
    return PlainTextResponse(
        content=content,
        media_type="text/yaml",
        headers={"Content-Disposition": f'attachment; filename="{cf.filename}"'},
    )

# ── GET /api/compose/associations ────────────────────────────────────────────

@router.get("/compose/associations", summary="List all container–service associations")
def list_associations():
    """Return all container → compose service mappings."""
    raw = compose_svc.all_associations()
    result = []
    for container_name, assoc in raw.items():
        cf = compose_svc.get_file(assoc["file_id"])
        result.append({
            "container_name": container_name,
            "file_id":        assoc["file_id"],
            "service_name":   assoc["service_name"],
            "filename":       cf.filename if cf else "unknown",
        })
    return result


# ── POST /api/compose/associate ──────────────────────────────────────────────

@router.post("/compose/associate", summary="Associate a container with a compose service")
def associate_container(body: AssociateRequest):
    """
    Link a container name to a service inside a stored compose file.
    This tells DockRadar to use `docker compose` for updates on this container.
    """
    ok = compose_svc.associate(body.container_name, body.file_id, body.service_name)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail=f"File '{body.file_id}' or service '{body.service_name}' not found.",
        )
    return {
        "message": f"Associated '{body.container_name}' with {body.file_id}/{body.service_name}."
    }


# ── DELETE /api/compose/associate/{name} ─────────────────────────────────────

@router.delete("/compose/associate/{name}", summary="Remove a container's compose association")
def disassociate_container(name: str):
    """Remove the compose service link for a container."""
    compose_svc.disassociate(name)
    return {"message": f"Association removed for '{name}'."}


# ── POST /api/containers/{name}/compose-update ───────────────────────────────

@router.post(
    "/containers/{name}/compose-update",
    summary="Update a container via docker compose",
)
def compose_update_container(name: str, background_tasks: BackgroundTasks):
    """
    Run `docker compose pull <service>` + `docker compose up -d <service>`
    for the compose service associated with this container.
    Returns immediately and runs in the background.
    Poll GET /api/scan/status for progress.
    """
    if api_state.scanning or api_state.updating:
        raise HTTPException(status_code=409, detail="A scan or update is already running.")

    if compose_svc.get_association(name) is None:
        raise HTTPException(
            status_code=400,
            detail=f"No compose file associated with '{name}'. Use /api/compose/associate first.",
        )

    def _run():
        api_state.updating = True
        api_state.progress.clear()

        def cb(msg: str):
            api_state.progress.append(f"[{name}] {msg}")
            logger.info("[API] [%s] %s", name, msg)

        success, message = compose_svc.update_via_compose(name, progress_cb=cb)
        api_state.updating = False

        if success:
            api_state.progress.append(f"[{name}] \u2713 Compose update complete.")
            # Invalidate the registry cache for this container so the
            # post-update re-scan fetches fresh digest/tag data instead of
            # returning the stale "update_available" result from before.
            container = next((c for c in api_state.containers if c.name == name), None)
            if container:
                registry_svc.invalidate_cache(container.repository)
        else:
            api_state.progress.append(f"[{name}] \u2717 Compose update failed: {message}")

        # Re-scan so the UI reflects the new state
        _do_scan()

    background_tasks.add_task(_run)
    return {
        "message": f"Compose update started for '{name}'.",
        "poll": "/api/scan/status",
    }
