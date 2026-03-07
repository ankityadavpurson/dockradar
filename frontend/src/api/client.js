/**
 * DockRadar API Client
 * All fetch calls to the FastAPI backend.
 */

const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Health
  health:           ()           => request('GET',    '/health'),

  // Containers
  listContainers:   ()           => request('GET',    '/containers'),
  getContainer:     (name)       => request('GET',    `/containers/${name}`),
  deleteContainer:  (name)       => request('DELETE', `/containers/${name}`),

  // Scan
  triggerScan:      ()           => request('POST',   '/scan'),
  scanStatus:       ()           => request('GET',    '/scan/status'),

  // Updates
  updateOne:        (name)       => request('POST',   `/containers/${name}/update`),
  updateSelected:   (names)      => request('POST',   '/update/selected', { names }),
  updateAll:        ()           => request('POST',   '/update/all'),
}
