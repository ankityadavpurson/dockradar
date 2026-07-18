/**
 * DockRadar API Client
 * All fetch calls to the FastAPI backend.
 */

const BASE = '/api'

// Optional API key (when the backend is started with API_KEY set).
// Store it once via: localStorage.setItem('dockradar_api_key', '<key>')
function authHeaders() {
  const key = localStorage.getItem('dockradar_api_key')
  return key ? { 'X-Api-Key': key } : {}
}

async function parseError(res) {
  const err = await res.json().catch(() => ({ detail: res.statusText }))
  const detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
  return new Error(detail || `HTTP ${res.status}`)
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
