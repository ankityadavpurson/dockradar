/**
 * DockRadar API Client
 * All fetch calls to the FastAPI backend.
 */

const BASE = '/api'

// Optional API key (when the backend has API_KEY set). The UI asks for it on
// the first 401 (ApiKeyPrompt) and keeps it in this browser's localStorage.
const API_KEY_STORAGE = 'dockradar_api_key'

/** Fired on window whenever the API answers 401 (missing or wrong key). */
export const AUTH_REQUIRED_EVENT = 'dockradar:auth-required'

export function getApiKey() {
  try { return localStorage.getItem(API_KEY_STORAGE) || '' } catch { return '' }
}

export function setApiKey(value) {
  try {
    if (value) localStorage.setItem(API_KEY_STORAGE, value)
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch { /* storage blocked: the key only lasts until the page reloads */ }
}

function authHeaders() {
  const key = getApiKey()
  return key ? { 'X-Api-Key': key } : {}
}

/** True when `key` is accepted by the API (checked against a guarded route). */
export async function verifyApiKey(key) {
  const res = await fetch(`${BASE}/scan/status`, { headers: { 'X-Api-Key': key } })
  if (res.status === 401) return false
  if (!res.ok) throw await parseError(res)
  return true
}

async function parseError(res) {
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { hadKey: !!getApiKey() } }))
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }))
  const detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
  const error = new Error(detail || `HTTP ${res.status}`)
  error.status = res.status
  error.detail = err.detail   // structured detail, e.g. { errors: { KEY: msg } }
  return error
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export const api = {
  // Health
  health:           ()           => request('GET',    '/health'),
  testEmail:        ()           => request('POST',   '/email/test'),

  // Containers
  listContainers:   ()           => request('GET',    '/containers'),
  getContainer:     (name)       => request('GET',    `/containers/${name}`),
  containerDetails: (name)       => request('GET',    `/containers/${name}/details`),
  deleteContainer:  (name)       => request('DELETE', `/containers/${name}`),

  // Scan
  triggerScan:      ()           => request('POST',   '/scan'),
  scanStatus:       ()           => request('GET',    '/scan/status'),

  // Updates
  updateOne:        (name)       => request('POST',   `/containers/${name}/update`),
  updateSelected:   (names)      => request('POST',   '/update/selected', { names }),
  updateAll:        ()           => request('POST',   '/update/all'),
}

// Settings (values saved here override the env file)
export const settingsApi = {
  get:  ()                    => request('GET', '/settings'),
  save: (values, reset = [])  => request('PUT', '/settings', { values, reset }),
}

// Compose
export const composeApi = {
  list:          ()                              => request('GET',    '/compose'),
  upload:        async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/compose`, { method: 'POST', body: fd, headers: authHeaders() })
    if (!res.ok) throw await parseError(res)
    return res.json()
  },
  deleteFile:    (fileId)                        => request('DELETE', `/compose/${fileId}`),
  associations:  ()                              => request('GET',    '/compose/associations'),
  associate:     (containerName, fileId, svc)    => request('POST',   '/compose/associate', { container_name: containerName, file_id: fileId, service_name: svc }),
  disassociate:  (containerName)                 => request('DELETE', `/compose/associate/${containerName}`),
  updateViaCompose: (name)                       => request('POST',   `/containers/${name}/compose-update`),
  getContent:        (fileId)                        => request('GET',    `/compose/${fileId}/content`),
  updateContent:     (fileId, text)                  => request('PUT',    `/compose/${fileId}`, { content: text }),
  diff:              (containerName)                 => request('GET',    `/containers/${containerName}/compose-diff`),
}
