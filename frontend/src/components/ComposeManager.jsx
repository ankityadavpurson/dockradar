import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileCode2,
  Link,
  Link2Off,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const BASE = "/api";

async function apiFetch(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/compose`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Small toast-like inline status message */
function StatusMsg({ msg, isError, onDismiss }) {
  if (!msg) return null;
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded text-[12px] font-mono"
      style={
        isError
          ? {
              background: "rgba(255,107,107,0.10)",
              border: "1px solid rgba(255,107,107,0.25)",
              color: "#ff6b6b",
            }
          : {
              background: "rgba(81,207,102,0.08)",
              border: "1px solid rgba(81,207,102,0.20)",
              color: "#51cf66",
            }
      }
    >
      {isError ? (
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
      )}
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100">
        <X size={11} />
      </button>
    </div>
  );
}

/** Dropdown to pick a service from a compose file */
function ServicePicker({
  composeFiles,
  selectedFileId,
  selectedService,
  onChange,
}) {
  const file = composeFiles.find((f) => f.file_id === selectedFileId);
  const services = file?.services || [];

  return (
    <div className="flex gap-2">
      {/* File picker */}
      <div className="relative flex-1">
        <select
          value={selectedFileId}
          onChange={(e) => onChange(e.target.value, "")}
          className="w-full appearance-none pl-2 pr-6 py-1.5 rounded text-[12px] font-mono cursor-pointer"
          style={{
            background: "#0d1b2a",
            border: "1px solid #1c2a3a",
            color: selectedFileId ? "#e2e8f0" : "#4a6280",
          }}
        >
          <option value="">— select file —</option>
          {composeFiles.map((f) => (
            <option key={f.file_id} value={f.file_id}>
              {f.filename}
            </option>
          ))}
        </select>
        <ChevronDown
          size={11}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted"
        />
      </div>

      {/* Service picker */}
      <div className="relative flex-1">
        <select
          value={selectedService}
          onChange={(e) => onChange(selectedFileId, e.target.value)}
          disabled={!selectedFileId}
          className="w-full appearance-none pl-2 pr-6 py-1.5 rounded text-[12px] font-mono cursor-pointer disabled:opacity-40"
          style={{
            background: "#0d1b2a",
            border: "1px solid #1c2a3a",
            color: selectedService ? "#e2e8f0" : "#4a6280",
          }}
        >
          <option value="">— select service —</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ChevronDown
          size={11}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted"
        />
      </div>
    </div>
  );
}

/** Single container row in the association panel */
function ContainerRow({
  container,
  association,
  composeFiles,
  onAssociate,
  onDisassociate,
}) {
  const [fileId, setFileId] = useState(association?.file_id || "");
  const [service, setService] = useState(association?.service_name || "");
  const [saving, setSaving] = useState(false);

  // Sync if parent association changes
  useEffect(() => {
    setFileId(association?.file_id || "");
    setService(association?.service_name || "");
  }, [association]);

  const hasAssociation = !!association;
  const canSave =
    fileId &&
    service &&
    (fileId !== association?.file_id || service !== association?.service_name);

  async function handleSave() {
    setSaving(true);
    try {
      await onAssociate(container.name, fileId, service);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="grid gap-2 px-3 py-2.5 rounded"
      style={{
        gridTemplateColumns: "1fr 2fr auto",
        background: hasAssociation
          ? "rgba(0,212,255,0.03)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${hasAssociation ? "rgba(0,212,255,0.12)" : "#1c2a3a"}`,
      }}
    >
      {/* Container name + status dot */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: container.status === "running" ? "#51cf66" : "#ff6b6b",
          }}
        />
        <span
          className="font-mono text-[12px] text-ink-primary truncate"
          title={container.name}
        >
          {container.name}
        </span>
      </div>

      {/* Service picker */}
      <ServicePicker
        composeFiles={composeFiles}
        selectedFileId={fileId}
        selectedService={service}
        onChange={(fid, svc) => {
          setFileId(fid);
          setService(svc);
        }}
      />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {canSave && (
          <button
            onClick={handleSave}
            disabled={saving}
            title="Save association"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-opacity disabled:opacity-50"
            style={{
              background: "rgba(0,212,255,0.10)",
              color: "#00d4ff",
              border: "1px solid rgba(0,212,255,0.2)",
            }}
          >
            <Link size={10} />
            {saving ? "…" : "Link"}
          </button>
        )}
        {hasAssociation && !canSave && (
          <button
            onClick={() => onDisassociate(container.name)}
            title="Remove association"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono opacity-50 hover:opacity-100 transition-opacity"
            style={{
              background: "rgba(255,107,107,0.08)",
              color: "#ff6b6b",
              border: "1px solid rgba(255,107,107,0.15)",
            }}
          >
            <Link2Off size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ComposeManager
 * Props:
 *   containers    — array of ContainerOut from useContainers
 *   onClose       — called when the panel should close
 */
export default function ComposeManager({ containers, onClose }) {
  const [composeFiles, setComposeFiles] = useState([]);
  const [associations, setAssociations] = useState({}); // container_name → {file_id, service_name, filename}
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef();

  function notify(msg, error = false) {
    setStatusMsg(msg);
    setIsError(error);
  }

  async function refresh() {
    try {
      const [files, assocList] = await Promise.all([
        apiFetch("GET", "/compose"),
        apiFetch("GET", "/compose/associations"),
      ]);
      setComposeFiles(files);
      // Convert association list to map keyed by container_name
      const map = {};
      for (const a of assocList) map[a.container_name] = a;
      setAssociations(map);
    } catch (e) {
      notify(`Failed to load compose data: ${e.message}`, true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFiles(files) {
    const yamlFiles = [...files].filter(
      (f) => f.name.endsWith(".yml") || f.name.endsWith(".yaml"),
    );
    if (yamlFiles.length === 0) {
      notify("Only .yml / .yaml files are accepted.", true);
      return;
    }
    setUploading(true);
    let uploaded = 0;
    for (const f of yamlFiles) {
      try {
        await uploadFile(f);
        uploaded++;
      } catch (e) {
        notify(`Failed to upload ${f.name}: ${e.message}`, true);
      }
    }
    setUploading(false);
    if (uploaded > 0)
      notify(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}.`);
    await refresh();
  }

  async function handleDeleteFile(fileId) {
    try {
      await apiFetch("DELETE", `/compose/${fileId}`);
      notify("Compose file deleted.");
      await refresh();
    } catch (e) {
      notify(`Delete failed: ${e.message}`, true);
    }
  }

  async function handleAssociate(containerName, fileId, serviceName) {
    try {
      await apiFetch("POST", "/compose/associate", {
        container_name: containerName,
        file_id: fileId,
        service_name: serviceName,
      });
      notify(`Linked ${containerName} → ${serviceName}`);
      await refresh();
    } catch (e) {
      notify(`Association failed: ${e.message}`, true);
    }
  }

  async function handleDisassociate(containerName) {
    try {
      await apiFetch("DELETE", `/compose/associate/${containerName}`);
      notify(`Removed association for ${containerName}.`);
      await refresh();
    } catch (e) {
      notify(`Remove failed: ${e.message}`, true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col rounded-xl w-full max-w-3xl mx-4 overflow-hidden"
        style={{
          background: "#0b1622",
          border: "1px solid #1c2a3a",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #1c2a3a" }}
        >
          <div className="flex items-center gap-2">
            <FileCode2 size={16} style={{ color: "#00d4ff" }} />
            <span className="font-semibold text-ink-primary text-[14px]">
              Compose Files
            </span>
            {composeFiles.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{
                  background: "rgba(0,212,255,0.10)",
                  color: "#00d4ff",
                  border: "1px solid rgba(0,212,255,0.2)",
                }}
              >
                {composeFiles.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Status message */}
          <StatusMsg
            msg={statusMsg}
            isError={isError}
            onDismiss={() => setStatusMsg(null)}
          />

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragging ? "#00d4ff" : "#1c2a3a"}`,
              background: dragging
                ? "rgba(0,212,255,0.04)"
                : "rgba(255,255,255,0.01)",
            }}
          >
            <Upload
              size={20}
              style={{ color: dragging ? "#00d4ff" : "#4a6280" }}
            />
            <span
              className="text-[12px] font-mono"
              style={{ color: dragging ? "#00d4ff" : "#4a6280" }}
            >
              {uploading
                ? "Uploading…"
                : "Drop compose files here, or click to browse"}
            </span>
            <span className="text-[10px] text-ink-muted">
              .yml / .yaml only
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yml,.yaml"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Stored files */}
          {composeFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                Stored files
              </span>
              {composeFiles.map((f) => (
                <div
                  key={f.file_id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid #1c2a3a",
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode2
                      size={13}
                      style={{ color: "#00d4ff", shrink: 0 }}
                    />
                    <span className="font-mono text-[12px] text-ink-primary truncate">
                      {f.filename}
                    </span>
                    <span className="text-[11px] text-ink-muted shrink-0">
                      {f.services.length} service
                      {f.services.length !== 1 ? "s" : ""}:{" "}
                      {f.services.slice(0, 4).join(", ")}
                      {f.services.length > 4 ? "…" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(f.file_id)}
                    title="Delete file"
                    className="text-ink-muted hover:text-red-400 transition-colors ml-2 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Container associations */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Container associations
            </span>
            {composeFiles.length === 0 ? (
              <p className="text-[12px] text-ink-muted font-mono py-2">
                Upload a compose file above to start linking containers.
              </p>
            ) : containers.length === 0 ? (
              <p className="text-[12px] text-ink-muted font-mono py-2">
                No containers found. Run a scan first.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {containers.map((c) => (
                  <ContainerRow
                    key={c.name}
                    container={c}
                    association={associations[c.name]}
                    composeFiles={composeFiles}
                    onAssociate={handleAssociate}
                    onDisassociate={handleDisassociate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 text-[11px] text-ink-muted font-mono"
          style={{ borderTop: "1px solid #1c2a3a" }}
        >
          <span>
            {Object.keys(associations).length} container
            {Object.keys(associations).length !== 1 ? "s" : ""} linked
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-[11px] font-mono transition-colors hover:text-ink-primary"
            style={{ border: "1px solid #1c2a3a" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
