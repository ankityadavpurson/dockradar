"""Unit tests for DockerService image-reference parsing."""

from app.services.docker import DockerService


class TestSplitImage:
    def test_repo_and_tag(self):
        assert DockerService._split_image("nginx:1.25") == ("nginx", "1.25")

    def test_repo_without_tag_defaults_latest(self):
        assert DockerService._split_image("nginx") == ("nginx", "latest")

    def test_namespaced_repo(self):
        assert DockerService._split_image("linuxserver/plex:latest") == ("linuxserver/plex", "latest")

    def test_registry_with_port_no_tag(self):
        assert DockerService._split_image("localhost:5000/app") == ("localhost:5000/app", "latest")

    def test_registry_with_port_and_tag(self):
        assert DockerService._split_image("localhost:5000/app:2.0") == ("localhost:5000/app", "2.0")

    def test_digest_pinned(self):
        repo, tag = DockerService._split_image("nginx@sha256:abc123")
        assert repo == "nginx"
        assert tag == "sha256:abc123"

    def test_tag_and_digest(self):
        assert DockerService._split_image("ghcr.io/owner/app:2.0@sha256:def") == ("ghcr.io/owner/app", "2.0")
