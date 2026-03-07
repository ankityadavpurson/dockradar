"""
DockRadar - Registry Service
Queries Docker Hub (and compatible registries) for the latest image tags.
Implements a TTL-based in-memory cache to reduce API calls.
"""

import logging
import time
from typing import Optional

import requests

from config import config

logger = logging.getLogger(__name__)

DOCKERHUB_API = "https://hub.docker.com/v2"
DOCKERHUB_TOKEN_URL = "https://auth.docker.io/token"
DOCKERHUB_REGISTRY = "https://registry-1.docker.io/v2"


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

    def get_latest_tag(self, repository: str, current_tag: str) -> tuple[str, str]:
        """
        Return (latest_tag, status) where status is:
        'up_to_date' | 'update_available' | 'error'
        """
        cache_key = f"{repository}:{current_tag}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for %s", cache_key)
            return cached

        result = self._fetch_latest_tag(repository, current_tag)
        self._cache.set(cache_key, result)
        return result

    def _fetch_latest_tag(self, repository: str, current_tag: str) -> tuple[str, str]:
        """Determine the latest available tag for a repository."""
        try:
            # Normalize repository
            repo = self._normalize_repo(repository)
            is_official = "/" not in repo

            # Only check Docker Hub for now
            if self._is_dockerhub(repository):
                return self._check_dockerhub(repo, current_tag, is_official)
            else:
                # For private / non-Hub registries, attempt registry v2 API
                return self._check_registry_v2(repository, current_tag)

        except requests.RequestException as exc:
            logger.warning("Network error checking registry for %s: %s", repository, exc)
            return "unknown", "error"
        except Exception as exc:
            logger.warning("Unexpected error checking registry for %s: %s", repository, exc)
            return "unknown", "error"

    def _check_dockerhub(self, repo: str, current_tag: str, is_official: bool) -> tuple[str, str]:
        """Check Docker Hub for the latest tag."""
        # For 'latest' tag, check if the digest has changed via tag list
        namespace = "library" if is_official else repo.split("/")[0]
        image = repo if "/" in repo else repo
        if is_official:
            image_path = f"library/{repo}"
        else:
            image_path = repo

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

        # Find current tag in results
        tag_map = {t["name"]: t for t in results}

        # Determine the "best" latest tag to compare against
        if current_tag == "latest":
            latest_entry = tag_map.get("latest")
            if latest_entry:
                latest_tag = "latest"
            else:
                latest_tag = results[0]["name"] if results else "unknown"
        else:
            # Try to find a newer semantic version
            latest_tag = self._find_latest_semver(list(tag_map.keys()), current_tag)

        if latest_tag == "unknown":
            return "unknown", "error"

        if latest_tag == current_tag:
            logger.info("%s is up to date (tag: %s)", repo, current_tag)
            return current_tag, "up_to_date"
        else:
            logger.info("Update available for %s: %s → %s", repo, current_tag, latest_tag)
            return latest_tag, "update_available"

    def _check_registry_v2(self, repository: str, current_tag: str) -> tuple[str, str]:
        """Check a generic Docker v2 registry."""
        registry, name = self._split_registry(repository)
        url = f"https://{registry}/v2/{name}/tags/list"
        resp = self._session.get(url, timeout=10)
        if resp.status_code in (401, 403):
            return "unknown", "error"
        resp.raise_for_status()
        tags = resp.json().get("tags", [])
        latest = self._find_latest_semver(tags, current_tag)
        if latest == current_tag:
            return current_tag, "up_to_date"
        return latest, "update_available"

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
