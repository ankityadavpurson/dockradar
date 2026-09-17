"""Tests for ComposeService file storage and associations (isolated tmp dir)."""

import pytest

import app.services.compose as compose_mod
from app.services.compose import ComposeService
from app.services.docker import ContainerInfo, compose_labels

VALID_COMPOSE = """\
services:
  web:
    image: nginx:1.25
  db:
    image: postgres:16
"""


@pytest.fixture
def svc(tmp_path, monkeypatch):
    monkeypatch.setattr(compose_mod, "COMPOSE_STORE_DIR", tmp_path)
    monkeypatch.setattr(compose_mod, "ASSOCIATIONS_FILE", tmp_path / "associations.json")
    monkeypatch.setattr(compose_mod, "METADATA_FILE", tmp_path / "metadata.json")
    # Reset the process-wide compose-CLI probe cache so each test's
    # _find_compose_binary mock is honored (health checks elsewhere may have
    # cached a real result).
    monkeypatch.setattr(ComposeService, "_compose_bin_cache", False, raising=False)
    return ComposeService()


class TestSaveFile:
    def test_save_and_get(self, svc):
        cf = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        assert cf.filename == "docker-compose.yml"
        assert set(cf.services) == {"web", "db"}
        assert svc.get_file_content(cf.file_id) == VALID_COMPOSE

    def test_rejects_invalid_yaml(self, svc):
        with pytest.raises(ValueError):
            svc.save_file("bad.yml", "services: [unclosed")

    def test_rejects_missing_services_key(self, svc):
        with pytest.raises(ValueError):
            svc.save_file("bad.yml", "version: '3'\n")

    def test_duplicate_filenames_get_distinct_ids(self, svc):
        a = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        b = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        assert a.file_id != b.file_id

    def test_persists_across_reload(self, svc):
        cf = svc.save_file("docker-compose.yml", VALID_COMPOSE)
        reloaded = ComposeService()
        loaded = reloaded.get_file(cf.file_id)
        assert loaded is not None
        assert loaded.filename == "docker-compose.yml"


class TestAssociations:
    def test_associate_and_get(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        assert svc.associate("my-web", cf.file_id, "web") is True
        assert svc.get_association("my-web") == (cf.file_id, "web")

    def test_associate_unknown_service_fails(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        assert svc.associate("my-web", cf.file_id, "nope") is False

    def test_associate_unknown_file_fails(self, svc):
        assert svc.associate("my-web", "missing", "web") is False

    def test_disassociate(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        svc.disassociate("my-web")
        assert svc.get_association("my-web") is None

    def test_delete_file_removes_associations(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        assert svc.delete_file(cf.file_id) is True
        assert svc.get_association("my-web") is None
        assert svc.get_file(cf.file_id) is None

    def test_associations_persist_across_reload(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("my-web", cf.file_id, "web")
        reloaded = ComposeService()
        assert reloaded.get_association("my-web") == (cf.file_id, "web")


class TestUpdateFile:
    def test_update_content(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        new_content = VALID_COMPOSE.replace("nginx:1.25", "nginx:1.27")
        updated = svc.update_file(cf.file_id, new_content)
        assert updated.service_image("web") == "nginx:1.27"

    def test_update_unknown_id_raises(self, svc):
        with pytest.raises(ValueError):
            svc.update_file("missing", VALID_COMPOSE)


class TestNameConflict:
    def test_detects_conflict_phrases(self):
        assert ComposeService._is_name_conflict('is already in use by container "abc"')
        assert ComposeService._is_name_conflict('Conflict. The container name "/web" ...')
        assert ComposeService._is_name_conflict("Error: already in use")

    def test_ignores_other_errors(self):
        assert not ComposeService._is_name_conflict("no such image: foo:bar")
        assert not ComposeService._is_name_conflict("")


class TestRunComposeStreaming:
    def test_streams_lines_and_returns_output(self, monkeypatch):
        class FakePopen:
            def __init__(self, *a, **k):
                self.stdout = iter(["Pulling web\n", "layer done\n", "\n"])
                self.returncode = 0

            def wait(self, timeout=None):
                return 0

            def kill(self):
                pass

        monkeypatch.setattr(compose_mod.subprocess, "Popen", FakePopen)
        got = []
        ok, out = ComposeService._run_compose(
            ["docker", "compose"], ["-f", "/x.yml"], ["pull", "web"], line_cb=got.append
        )
        assert ok is True
        assert got == ["Pulling web", "layer done"]   # blank line not forwarded
        assert "Pulling web" in out and "layer done" in out

    def test_nonzero_exit_is_failure(self, monkeypatch):
        class FakePopen:
            def __init__(self, *a, **k):
                self.stdout = iter(["boom\n"])
                self.returncode = 1

            def wait(self, timeout=None):
                return 1

            def kill(self):
                pass

        monkeypatch.setattr(compose_mod.subprocess, "Popen", FakePopen)
        ok, out = ComposeService._run_compose(["docker", "compose"], ["-f", "/x.yml"], ["up"])
        assert ok is False and "boom" in out

    def test_timeout_kills_and_fails(self, monkeypatch):
        killed = {}

        class FakePopen:
            def __init__(self, *a, **k):
                self.stdout = iter([])
                self.returncode = None

            def wait(self, timeout=None):
                raise compose_mod.subprocess.TimeoutExpired(cmd="x", timeout=timeout)

            def kill(self):
                killed["k"] = True

        monkeypatch.setattr(compose_mod.subprocess, "Popen", FakePopen)
        ok, out = ComposeService._run_compose(["docker", "compose"], ["-f", "/x.yml"], ["pull"], timeout=1)
        assert ok is False and "timed out" in out.lower() and killed.get("k")


class TestUpdateViaCompose:
    @pytest.fixture
    def assoc_svc(self, svc, monkeypatch):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("web", cf.file_id, "web")
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: ["docker", "compose"]))
        return svc

    def test_in_place_up_success_no_stop_rm(self, assoc_svc, monkeypatch):
        calls, removed, started = [], [], []
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, p, a, line_cb=None, timeout=300: (calls.append(a) or (True, "ok"))))
        monkeypatch.setattr(ComposeService, "_docker_stop_rm", staticmethod(lambda n: removed.append(n)))
        monkeypatch.setattr(ComposeService, "_docker_start", staticmethod(lambda n: started.append(n) or True))

        ok, msg = assoc_svc.update_via_compose("web")
        assert ok is True
        assert calls == [["pull", "web"], ["up", "-d", "--no-deps", "web"]]
        assert removed == [] and started == []   # never removed, never rolled back

    def test_name_conflict_falls_back_to_stop_rm(self, assoc_svc, monkeypatch):
        outcomes = iter([
            (True, "pulled"),
            (False, 'Conflict. The container name "/web" is already in use'),
            (True, "recreated"),
        ])
        removed = []
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, p, a, line_cb=None, timeout=300: next(outcomes)))
        monkeypatch.setattr(ComposeService, "_docker_stop_rm", staticmethod(lambda n: removed.append(n)))
        monkeypatch.setattr(ComposeService, "_docker_start", staticmethod(lambda n: True))

        ok, msg = assoc_svc.update_via_compose("web")
        assert ok is True
        assert removed == ["web"]   # fell back once

    def test_failure_restores_previous_container(self, assoc_svc, monkeypatch):
        outcomes = iter([(True, "pulled"), (False, "some config error")])
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, p, a, line_cb=None, timeout=300: next(outcomes)))
        monkeypatch.setattr(ComposeService, "_docker_stop_rm", staticmethod(lambda n: None))
        monkeypatch.setattr(ComposeService, "_docker_start", staticmethod(lambda n: True))

        ok, msg = assoc_svc.update_via_compose("web")
        assert ok is False
        assert "previous container was restarted" in msg

    def test_failure_service_down_when_restore_fails(self, assoc_svc, monkeypatch):
        outcomes = iter([(True, "pulled"), (False, "some config error")])
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, p, a, line_cb=None, timeout=300: next(outcomes)))
        monkeypatch.setattr(ComposeService, "_docker_start", staticmethod(lambda n: False))

        ok, msg = assoc_svc.update_via_compose("web")
        assert ok is False
        assert "DOWN" in msg

    def test_pull_failure_short_circuits(self, assoc_svc, monkeypatch):
        calls = []
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, p, a, line_cb=None, timeout=300: (calls.append(a) or (False, "net error"))))
        ok, msg = assoc_svc.update_via_compose("web")
        assert ok is False
        assert calls == [["pull", "web"]]   # never attempted `up`
        assert "pull failed" in msg


def _info(labels):
    return ContainerInfo(
        id="i", short_id="i", name="web", image_name="x:1",
        repository="x", tag="1", status="running", raw_config={"labels": labels},
    )


class TestComposeLabels:
    def test_extracts_when_present(self):
        cl = compose_labels(_info({
            "com.docker.compose.project": "proj",
            "com.docker.compose.service": "web",
            "com.docker.compose.project.config_files": "/a/dc.yml,/a/override.yml",
            "com.docker.compose.project.working_dir": "/a",
        }))
        assert cl["project"] == "proj" and cl["service"] == "web"
        assert cl["config_files"] == ["/a/dc.yml", "/a/override.yml"]
        assert cl["working_dir"] == "/a"

    def test_none_when_not_compose(self):
        assert compose_labels(_info({"foo": "bar"})) is None
        assert compose_labels(_info({})) is None


class TestResolveTarget:
    def test_label_mode_when_files_readable(self, svc, tmp_path):
        f = tmp_path / "docker-compose.yml"
        f.write_text(VALID_COMPOSE, encoding="utf-8")
        labels = {"project": "myproj", "service": "web",
                  "config_files": [str(f)], "working_dir": str(tmp_path)}
        t = svc.resolve_target("web", labels)
        assert t["mode"] == "labels" and t["service"] == "web"
        assert t["flags"][:2] == ["-p", "myproj"]
        assert "--project-directory" in t["flags"]
        assert t["flags"][-2:] == ["-f", str(f)]

    def test_falls_back_to_stored_when_label_file_missing(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("web", cf.file_id, "web")
        labels = {"project": "p", "service": "web",
                  "config_files": ["/no/such/file.yml"], "working_dir": ""}
        t = svc.resolve_target("web", labels)
        assert t["mode"] == "stored"
        assert t["flags"] == ["-f", str(cf.path.resolve())]

    def test_stored_when_no_labels(self, svc):
        cf = svc.save_file("c.yml", VALID_COMPOSE)
        svc.associate("web", cf.file_id, "web")
        assert svc.resolve_target("web", None)["mode"] == "stored"

    def test_none_when_neither(self, svc):
        assert svc.resolve_target("web", None) is None

    def test_label_mode_update_uses_project_flags(self, svc, tmp_path, monkeypatch):
        f = tmp_path / "dc.yml"
        f.write_text(VALID_COMPOSE, encoding="utf-8")
        labels = {"project": "proj", "service": "web",
                  "config_files": [str(f)], "working_dir": str(tmp_path)}
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: ["docker", "compose"]))
        seen = []
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, flags, a, line_cb=None, timeout=300: (seen.append((flags, a)) or (True, "ok"))))
        monkeypatch.setattr(ComposeService, "_docker_current_image", staticmethod(lambda n: (None, None)))
        ok, msg = svc.update_via_compose("web", labels=labels)
        assert ok is True and "labels" in msg
        assert all("-p" in flags and "proj" in flags for flags, _ in seen)
        assert seen[0][1] == ["pull", "web"]


# ── P4: scoped, format-preserving image edit ────────────────────────────────

COMMENTED_COMPOSE = """\
services:
  web:
    image: nginx:1.25   # pinned on purpose
    ports:
      - "80:80"
  db:
    image: nginx:1.25   # shares the same image as web
"""


class TestSetServiceImage:
    def test_changes_only_target_service(self):
        out, changed = ComposeService._set_service_image(COMMENTED_COMPOSE, "web", "nginx:1.27")
        assert changed is True
        assert "image: nginx:1.27" in out          # web updated
        assert out.count("nginx:1.25") == 1         # db untouched (was 2 occurrences)
        assert "# pinned on purpose" in out         # comment preserved
        assert '"80:80"' in out                     # quoting preserved

    def test_noop_when_already_target(self):
        out, changed = ComposeService._set_service_image(COMMENTED_COMPOSE, "web", "nginx:1.25")
        assert changed is False and out == COMMENTED_COMPOSE

    def test_noop_for_unknown_service(self):
        out, changed = ComposeService._set_service_image(COMMENTED_COMPOSE, "nope", "x:1")
        assert changed is False

    def test_preserves_sequence_indentation(self):
        # Standard 2-space compose with an indented list — only the image line
        # may change; sequences must keep their original indentation.
        src = (
            "services:\n"
            "  it-tools:\n"
            "    image: corentinth/it-tools:2023.8.21-6f93cba\n"
            "    ports:\n"
            "      - 8080:80\n"
            "    networks:\n"
            "      - web\n"
            "    restart: unless-stopped\n"
        )
        out, changed = ComposeService._set_service_image(src, "it-tools", "corentinth/it-tools:latest")
        assert changed is True
        assert out == src.replace("2023.8.21-6f93cba", "latest")   # nothing else moved
        assert "      - 8080:80" in out and "      - web" in out


class TestApplyImageEdit:
    def test_edits_file_and_writes_backup(self, svc, tmp_path):
        f = tmp_path / "docker-compose.yml"
        f.write_text(COMMENTED_COMPOSE, encoding="utf-8")
        logs = []
        changed = svc._apply_image_edit([str(f)], "web", "nginx:1.27", logs.append)
        assert changed is True
        assert "image: nginx:1.27" in f.read_text(encoding="utf-8")
        bak = tmp_path / "docker-compose.yml.bak"
        assert bak.exists() and bak.read_text(encoding="utf-8") == COMMENTED_COMPOSE
        assert any("backup" in m for m in logs)

    def test_no_backup_when_nothing_changes(self, svc, tmp_path):
        f = tmp_path / "docker-compose.yml"
        f.write_text(COMMENTED_COMPOSE, encoding="utf-8")
        changed = svc._apply_image_edit([str(f)], "web", "nginx:1.25", lambda m: None)
        assert changed is False
        assert not (tmp_path / "docker-compose.yml.bak").exists()

    def test_label_update_rewrites_pinned_tag(self, svc, tmp_path, monkeypatch):
        f = tmp_path / "dc.yml"
        f.write_text(COMMENTED_COMPOSE, encoding="utf-8")
        labels = {"project": "proj", "service": "web",
                  "config_files": [str(f)], "working_dir": str(tmp_path)}
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: ["docker", "compose"]))
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, flags, a, line_cb=None, timeout=300: (True, "ok")))
        monkeypatch.setattr(ComposeService, "_docker_current_image", staticmethod(lambda n: ("nginx:1.27", "sha256:" + "b" * 64)))
        ok, msg = svc.update_via_compose("web", labels=labels, target_image="nginx:1.27")
        assert ok is True
        # the real file was rewritten to the new tag before pull+up
        assert "image: nginx:1.27" in f.read_text(encoding="utf-8")

    def test_stored_mode_does_not_auto_edit(self, svc, tmp_path, monkeypatch):
        # target_image is ignored in stored mode (the dialog edits the copy).
        cf = svc.save_file("c.yml", COMMENTED_COMPOSE)
        svc.associate("web", cf.file_id, "web")
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: ["docker", "compose"]))
        monkeypatch.setattr(ComposeService, "_run_compose",
                            staticmethod(lambda b, flags, a, line_cb=None, timeout=300: (True, "ok")))
        monkeypatch.setattr(ComposeService, "_docker_current_image", staticmethod(lambda n: (None, None)))
        ok, msg = svc.update_via_compose("web", labels=None, target_image="nginx:1.27")
        assert ok is True
        # stored file untouched by the backend (no auto-edit in stored mode)
        assert "image: nginx:1.25" in cf.path.read_text(encoding="utf-8")


class TestComposeCliCache:
    def test_true_when_binary_found(self, svc, monkeypatch):
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: ["docker", "compose"]))
        assert ComposeService.compose_cli_available() is True

    def test_false_when_absent(self, svc, monkeypatch):
        monkeypatch.setattr(ComposeService, "_find_compose_binary", staticmethod(lambda: None))
        assert ComposeService.compose_cli_available() is False


class TestContainerOutCompose:
    def _labels(self, config_files, working_dir=""):
        return {
            "com.docker.compose.project": "proj",
            "com.docker.compose.service": "web",
            "com.docker.compose.project.config_files": config_files,
            "com.docker.compose.project.working_dir": working_dir,
        }

    def test_reachable_and_writable(self, tmp_path):
        from app.api.routes import ContainerOut
        f = tmp_path / "docker-compose.yml"
        f.write_text(VALID_COMPOSE, encoding="utf-8")
        out = ContainerOut.from_info(_info(self._labels(str(f), str(tmp_path))))
        assert out.compose["reachable"] is True
        assert out.compose["writable"] is True

    def test_unreachable_is_not_writable(self):
        from app.api.routes import ContainerOut
        out = ContainerOut.from_info(_info(self._labels("/no/such/file.yml")))
        assert out.compose["reachable"] is False
        assert out.compose["writable"] is False

    def test_none_for_non_compose_container(self):
        from app.api.routes import ContainerOut
        assert ContainerOut.from_info(_info({"foo": "bar"})).compose is None
