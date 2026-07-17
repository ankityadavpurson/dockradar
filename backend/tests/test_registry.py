"""Unit tests for RegistryService parsing/comparison helpers."""

import pytest

from app.services.registry import RegistryCache, RegistryService


class TestFindLatestSemver:
    def test_prefers_latest_when_present(self):
        assert RegistryService._find_latest_semver(["1.0", "latest", "2.0"], "1.0") == "latest"

    def test_latest_matches_latest(self):
        assert RegistryService._find_latest_semver(["latest", "1.0"], "latest") == "latest"

    def test_numeric_semver_comparison(self):
        tags = ["1.2.3", "1.10.0", "1.9.9"]
        assert RegistryService._find_latest_semver(tags, "1.2.3") == "1.10.0"

    def test_no_semver_tags_returns_current(self):
        assert RegistryService._find_latest_semver(["alpine", "edge"], "alpine") == "alpine"

    def test_empty_tag_list(self):
        assert RegistryService._find_latest_semver([], "1.0") == "unknown"

    def test_mixed_tags_ignores_non_numeric(self):
        tags = ["1.0", "2.0", "beta", "rc-1"]
        assert RegistryService._find_latest_semver(tags, "1.0") == "2.0"


class TestIsDockerhub:
    def test_bare_image(self):
        assert RegistryService._is_dockerhub("nginx") is True

    def test_namespaced_image(self):
        assert RegistryService._is_dockerhub("linuxserver/plex") is True

    def test_docker_io_prefix(self):
        assert RegistryService._is_dockerhub("docker.io/library/nginx") is True

    def test_other_registry(self):
        assert RegistryService._is_dockerhub("ghcr.io/owner/app") is False

    def test_registry_with_port(self):
        assert RegistryService._is_dockerhub("localhost:5000/app") is False


class TestSplitRegistry:
    def test_custom_registry(self):
        assert RegistryService._split_registry("ghcr.io/owner/app") == ("ghcr.io", "owner/app")

    def test_registry_with_port(self):
        assert RegistryService._split_registry("localhost:5000/app") == ("localhost:5000", "app")

    def test_no_registry_defaults_to_dockerhub(self):
        assert RegistryService._split_registry("owner/app") == ("registry-1.docker.io", "owner/app")


class TestNormalizeRepo:
    def test_strips_docker_io(self):
        assert RegistryService._normalize_repo("docker.io/nginx") == "nginx"

    def test_strips_index_docker_io(self):
        assert RegistryService._normalize_repo("index.docker.io/nginx") == "nginx"

    def test_leaves_others_alone(self):
        assert RegistryService._normalize_repo("ghcr.io/owner/app") == "ghcr.io/owner/app"


class TestRegistryCache:
    def test_set_get(self):
        cache = RegistryCache(ttl=300)
        cache.set("nginx:latest", ("latest", "up_to_date"))
        assert cache.get("nginx:latest") == ("latest", "up_to_date")

    def test_expiry(self):
        cache = RegistryCache(ttl=0)
        cache.set("nginx:latest", "x")
        assert cache.get("nginx:latest") is None

    def test_invalidate_prefix_removes_all_repo_tags(self):
        cache = RegistryCache(ttl=300)
        cache.set("nginx:latest", "a")
        cache.set("nginx:1.25", "b")
        cache.set("nginx-exporter:latest", "c")
        cache.invalidate_prefix("nginx:")
        assert cache.get("nginx:latest") is None
        assert cache.get("nginx:1.25") is None
        assert cache.get("nginx-exporter:latest") == "c"
