"""
DockRadar - Registry Service
Queries Docker Hub (and compatible registries) for the latest image tags.
Implements a TTL-based in-memory cache to reduce API calls.
"""

import logging
import time
from typing import Optional

import requests

from app.core.config import config

logger = logging.getLogger(__name__)

DOCKERHUB_API = "https://hub.docker.com/v2"
DOCKERHUB_TOKEN_URL = "https://auth.docker.io/token"
DOCKERHUB_REGISTRY = "https://registry-1.docker.io/v2"

# Accept header required by Docker Registry v2 to return digests
MANIFEST_ACCEPT = (
    "application/vnd.docker.distribution.manifest.v2+json,"
    "application/vnd.docker.distribution.manifest.list.v2+json,"
    "application/vnd.oci.image.manifest.v1+json,"
    "application/vnd.oci.image.index.v1+json"
)


class RegistryCache:
    """Simple TTL cache for registry results."""

    def __init__(self, ttl: int = 300):
        self._store: dict[str, tuple[float, any]] = {}
        self._ttl = ttl

    def get(self, key: str) -> Optional[any]:
        entry = self._store.get(key)
        if entry and (time.time() - entry[0]) < self._ttl:
            return entry[1]
        return None

    def set(self, key: str, value: any):
        self._store[key] = (time.time(), value)

    def invalidate(self, key: str):
        self._store.pop(key, None)

    def clear(self):
        self._store.clear()


class RegistryService:
    """Service for checking Docker image versions against registries."""

    def __init__(self):
        self._cache = RegistryCache(ttl=config.REGISTRY_CACHE_TTL)
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "DockRadar/1.0"})

    def get_latest_tag(self, repository: str, current_tag: str, local_digest: Optional[str] = None) -> tuple[str, str]:
        """
        Return (latest_tag, status) where status is:
        'up_to_date' | 'update_available' | 'error'

        When current_tag is 'latest', local_digest is used to detect real
        upstream changes even when the tag name itself hasn't changed.
        """
        cache_key = f"{repository}:{current_tag}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for %s", cache_key)
            return cached

        result = self._fetch_latest_tag(repository, current_tag, local_digest)
        self._cache.set(cache_key, result)
        return result

    def _fetch_latest_tag(self, repository: str, current_tag: str, local_digest: Optional[str] = None) -> tuple[str, str]:
        """Determine the latest available tag for a repository."""
        try:
            repo = self._normalize_repo(repository)
            is_official = "/" not in repo

            if self._is_dockerhub(repository):
                return self._check_dockerhub(repo, current_tag, is_official, local_digest)
            else:
                return self._check_registry_v2(repository, current_tag, local_digest)

        except requests.RequestException as exc:
            logger.warning("Network error checking registry for %s: %s", repository, exc)
            return "unknown", "error"
        except Exception as exc:
            logger.warning("Unexpected error checking registry for %s: %s", repository, exc)
            return "unknown", "error"

    def _check_dockerhub(self, repo: str, current_tag: str, is_official: bool, local_digest: Optional[str] = None) -> tuple[str, str]:
        """Check Docker Hub for updates.

        Strategy (in order):
        1. Tag comparison  — if a newer tag exists, report update_available immediately.
        2. Digest comparison — if tags are identical, compare manifest digests to catch
                               silent image rebuilds (important for 'latest').
        3. Fallback         — if digest fetch fails, trust the tag match as up_to_date.
        """
        if is_official:
            image_path = f"library/{repo}"
        else:
            image_path = repo

        # ── Step 1: Tag comparison ────────────────────────────────────────────
        url = f"{DOCKERHUB_API}/repositories/{image_path}/tags"
        params = {"page_size": 25, "ordering": "last_updated"}

        resp = self._session.get(url, params=params, timeout=10)
        if resp.status_code == 404:
            logger.warning("Repository not found on Docker Hub: %s", repo)
            return "unknown", "error"
        resp.raise_for_status()

        data = resp.json()
        results = data.get("results", [])
        if not results:
            return "unknown", "error"

        tag_map = {t["name"]: t for t in results}

        if current_tag == "latest":
            latest_tag = "latest"
        else:
            latest_tag = self._find_latest_semver(list(tag_map.keys()), current_tag)

        if latest_tag == "unknown":
            return "unknown", "error"

        if latest_tag != current_tag:
            # A newer tag exists — no need to check digest
            logger.info("Tag update available for %s: %s → %s", repo, current_tag, latest_tag)
            return latest_tag, "update_available"

        # ── Step 2: Digest comparison (tags are identical) ────────────────────
        if local_digest:
            remote_digest = self._get_remote_digest_dockerhub(image_path, current_tag)
            if remote_digest:
                if remote_digest != local_digest:
                    logger.info(
                        "%s:%s same tag but digest mismatch — image was rebuilt\n  local : %s\n  remote: %s",
                        repo, current_tag, local_digest[:19], remote_digest[:19],
                    )
                    return current_tag, "update_available"
                else:
                    logger.info("%s:%s tag and digest both match — fully up to date", repo, current_tag)
                    return current_tag, "up_to_date"
            # Digest fetch failed — trust the tag match
            logger.debug("%s:%s digest fetch failed, trusting tag match", repo, current_tag)

        # ── Step 3: Fallback — tags matched, no digest available ──────────────
        return current_tag, "up_to_date"

    def _get_remote_digest_dockerhub(self, image_path: str, tag: str) -> Optional[str]:
        """
        Fetch the manifest digest for image_path:tag from Docker Hub registry.
        Returns the Docker-Content-Digest header value (sha256:...) or None on failure.
        """
        try:
            # Step 1: get an anonymous pull token from Docker Hub auth
            token_resp = self._session.get(
                DOCKERHUB_TOKEN_URL,
                params={
                    "service": "registry.docker.io",
                    "scope": f"repository:{image_path}:pull",
                },
                timeout=10,
            )
            token_resp.raise_for_status()
            token = token_resp.json().get("token")
            if not token:
                return None

            # Step 2: HEAD request to the registry manifest endpoint
            manifest_url = f"{DOCKERHUB_REGISTRY}/{image_path}/manifests/{tag}"
            resp = self._session.head(
                manifest_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": MANIFEST_ACCEPT,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.debug("Manifest HEAD returned %d for %s:%s", resp.status_code, image_path, tag)
                return None

            digest = resp.headers.get("Docker-Content-Digest")
            logger.debug("Remote digest for %s:%s → %s", image_path, tag, (digest or "none")[:19])
            return digest

        except Exception as exc:
            logger.debug("Could not fetch remote digest for %s:%s — %s", image_path, tag, exc)
            return None

    def _check_registry_v2(self, repository: str, current_tag: str, local_digest: Optional[str] = None) -> tuple[str, str]:
        """Check a generic Docker v2 registry (lscr.io, ghcr.io, gcr.io, etc.).

        Strategy (in order):
        1. Tag comparison  — list tags, handling Bearer auth challenges automatically.
        2. Digest comparison — if tags are identical, compare manifest digests.
        3. Digest-only fallback — if tag listing is unavailable (auth required with
           no public token), fall back to a digest-only check which many registries
           allow anonymously (e.g. lscr.io manifest endpoint with a Bearer token).
        4. Final fallback   — trust the tag match if nothing else works.
        """
        registry, name = self._split_registry(repository)

        # ── Step 1: Tag comparison (with automatic Bearer auth) ───────────────
        url = f"https://{registry}/v2/{name}/tags/list"
        resp = self._session.get(url, timeout=10)

        # Handle Bearer auth challenge (common on lscr.io, ghcr.io, etc.)
        if resp.status_code == 401:
            token = self._get_bearer_token_v2(resp, registry, name)
            if token:
                resp = self._session.get(
                    url,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10,
                )

        if resp.status_code == 200:
            tags = resp.json().get("tags", [])
            latest_tag = self._find_latest_semver(tags, current_tag)

            if latest_tag != current_tag:
                return latest_tag, "update_available"

            # ── Step 2: Digest comparison (tags are identical) ────────────────
            if local_digest:
                remote_digest = self._get_remote_digest_v2(registry, name, current_tag)
                if remote_digest:
                    if remote_digest != local_digest:
                        logger.info(
                            "%s/%s:%s same tag but digest mismatch — image was rebuilt",
                            registry, name, current_tag,
                        )
                        return current_tag, "update_available"
                    return current_tag, "up_to_date"

            return current_tag, "up_to_date"

        # ── Step 3: Tag list unavailable — try digest-only check ──────────────
        # Some registries (e.g. lscr.io with latest tag) allow manifest fetches
        # even when tag listing is restricted.
        if resp.status_code in (401, 403) and local_digest:
            logger.debug(
                "%s tag listing returned %d — falling back to digest-only check",
                registry, resp.status_code,
            )
            remote_digest = self._get_remote_digest_v2(registry, name, current_tag)
            if remote_digest:
                if remote_digest != local_digest:
                    logger.info(
                        "%s/%s:%s digest mismatch (tag list unavailable) — update available",
                        registry, name, current_tag,
                    )
                    return current_tag, "update_available"
                logger.info("%s/%s:%s digest matches — up to date", registry, name, current_tag)
                return current_tag, "up_to_date"

        # ── Step 4: Nothing worked ────────────────────────────────────────────
        if resp.status_code not in (200, 401, 403):
            logger.warning("Unexpected status %d from %s for %s", resp.status_code, registry, name)
        return "unknown", "error"

    def _get_remote_digest_v2(self, registry: str, name: str, tag: str) -> Optional[str]:
        """Fetch manifest digest from a generic v2 registry, handling Bearer auth."""
        try:
            url = f"https://{registry}/v2/{name}/manifests/{tag}"
            resp = self._session.head(
                url,
                headers={"Accept": MANIFEST_ACCEPT},
                timeout=10,
            )
            # Handle Bearer auth challenge
            if resp.status_code == 401:
                token = self._get_bearer_token_v2(resp, registry, name)
                if token:
                    resp = self._session.head(
                        url,
                        headers={"Authorization": f"Bearer {token}", "Accept": MANIFEST_ACCEPT},
                        timeout=10,
                    )
            if resp.status_code != 200:
                return None
            return resp.headers.get("Docker-Content-Digest")
        except Exception as exc:
            logger.debug("Could not fetch remote digest for %s/%s:%s — %s", registry, name, tag, exc)
            return None

    def _get_bearer_token_v2(self, challenge_resp: "requests.Response", registry: str, name: str) -> Optional[str]:
        """
        Parse a WWW-Authenticate Bearer challenge and fetch an anonymous token.

        Works for registries like lscr.io, ghcr.io, gcr.io that use the
        standard Docker token auth spec (https://distribution.github.io/distribution/spec/auth/token/).
        """
        import re as _re
        auth_header = challenge_resp.headers.get("WWW-Authenticate", "")
        if not auth_header.startswith("Bearer "):
            return None
        try:
            realm = _re.search(r'realm="([^"]+)"', auth_header)
            service = _re.search(r'service="([^"]+)"', auth_header)
            scope = _re.search(r'scope="([^"]+)"', auth_header)

            if not realm:
                return None

            params: dict = {}
            if service:
                params["service"] = service.group(1)
            if scope:
                params["scope"] = scope.group(1)
            else:
                params["scope"] = f"repository:{name}:pull"

            token_resp = self._session.get(realm.group(1), params=params, timeout=10)
            token_resp.raise_for_status()
            data = token_resp.json()
            return data.get("token") or data.get("access_token")
        except Exception as exc:
            logger.debug("Could not get Bearer token from %s: %s", registry, exc)
            return None

    @staticmethod
    def _normalize_repo(repository: str) -> str:
        """Remove registry prefix if it's Docker Hub."""
        prefixes = ("docker.io/", "index.docker.io/")
        for p in prefixes:
            if repository.startswith(p):
                return repository[len(p):]
        return repository

    @staticmethod
    def _is_dockerhub(repository: str) -> bool:
        """Return True if the image is hosted on Docker Hub."""
        if repository.startswith(("docker.io/", "index.docker.io/")):
            return True
        # Has no registry prefix (no dots before first slash or no slash)
        parts = repository.split("/")
        if len(parts) == 1:
            return True
        if len(parts) == 2 and "." not in parts[0] and ":" not in parts[0]:
            return True
        return False

    @staticmethod
    def _split_registry(repository: str) -> tuple[str, str]:
        """Split 'registry.example.com/image/name' → ('registry.example.com', 'image/name')."""
        parts = repository.split("/", 1)
        if len(parts) == 2 and ("." in parts[0] or ":" in parts[0]):
            return parts[0], parts[1]
        return "registry-1.docker.io", repository

    @staticmethod
    def _find_latest_semver(tags: list[str], current_tag: str) -> str:
        """
        From a list of tags, find the 'best' tag to compare with current_tag.
        Prefers 'latest', then tries numeric semver comparison.
        """
        if not tags:
            return "unknown"

        if "latest" in tags:
            if current_tag == "latest":
                return "latest"
            # If current is a specific version and 'latest' exists, keep current logic
            return "latest"

        # Filter tags that look like semver (digits and dots)
        import re
        semver_tags = [t for t in tags if re.match(r"^\d+(\.\d+)*$", t)]
        if not semver_tags:
            return current_tag  # Can't determine; treat as up to date

        def version_key(v: str):
            try:
                return tuple(int(x) for x in v.split("."))
            except ValueError:
                return (0,)

        latest = max(semver_tags, key=version_key)
        return latest

    def invalidate_cache(self, repository: str = None):
        """Invalidate cache for a specific repository or all entries."""
        if repository:
            for tag in ("latest", "main", "stable"):
                self._cache.invalidate(f"{repository}:{tag}")
        else:
            self._cache.clear()
            logger.info("Registry cache cleared.")
