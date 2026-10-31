import { useEffect, useState } from 'react'
import { LATEST_RELEASE_API } from './links'

const CACHE_KEY = 'dockradar_latest_version'
const CACHE_TTL_MS = 60 * 60 * 1000 // unauthenticated GitHub API: 60 req/h per IP
const SEMVER = /^\d+\.\d+\.\d+$/

function readCache() {
  try {
    const { version, at } = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') ?? {}
    return SEMVER.test(version) && Date.now() - at < CACHE_TTL_MS ? version : null
  } catch {
    return null
  }
}

function writeCache(version) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version, at: Date.now() }))
  } catch { /* storage unavailable — fine, just no cache */ }
}

/**
 * Latest published DockRadar version (e.g. "13.19.1"), or null if unknown.
 * Starts from the version baked in at build time, then upgrades to the live
 * latest release from GitHub so the page stays current between deploys.
 */
export function useLatestVersion() {
  const buildVersion = SEMVER.test(__APP_VERSION__) ? __APP_VERSION__ : null
  const [version, setVersion] = useState(() => readCache() ?? buildVersion)

  useEffect(() => {
    if (readCache()) return
    const ctrl = new AbortController()
    fetch(LATEST_RELEASE_API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(release => {
        const v = String(release.tag_name ?? '').replace(/^v/, '')
        if (SEMVER.test(v)) { setVersion(v); writeCache(v) }
      })
      .catch(() => { /* offline / rate-limited — keep the build-time version */ })
    return () => ctrl.abort()
  }, [])

  return version
}
