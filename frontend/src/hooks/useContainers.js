import { useState, useEffect, useCallback, useRef } from 'react'
import { api, composeApi } from '../api/client'

/**
 * Central data hook.
 * Manages container list, scan state, selected rows, and polling.
 */
export function useContainers() {
  const [containers, setContainers]   = useState([])
  const [scanStatus, setScanStatus]   = useState(null)   // { scanning, updating, progress, ... }
  const [health, setHealth]           = useState(null)
  const [selected, setSelected]       = useState(new Set())
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [toast, setToast]             = useState(null)   // { msg, type }
  // compose associations: { container_name -> { file_id, service_name, filename } }
  const [associations, setAssociations]   = useState({})
  const pollRef                        = useRef(null)

  // ── Toast helper ──────────────────────────────────────────────────────────
  const notify = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Fetch health ──────────────────────────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setHealth(h)
    } catch {
      setHealth(null)
    }
  }, [])

  // ── Fetch containers ──────────────────────────────────────────────────────
  const fetchContainers = useCallback(async () => {
    try {
      const data = await api.listContainers()
      setContainers(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])


  // ── Fetch compose associations ────────────────────────────────────────────
  const fetchAssociations = useCallback(async () => {
    try {
      const list = await composeApi.associations()
      const map = {}
      for (const a of list) map[a.container_name] = a
      setAssociations(map)
    } catch { /* ignore */ }
  }, [])

  // ── Poll scan status while busy ───────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.scanStatus()
        setScanStatus(s)
        if (!s.scanning && !s.updating) {
          clearInterval(pollRef.current)
          pollRef.current = null
          await fetchContainers()
          await fetchHealth()
        }
      } catch { /* ignore */ }
    }, 1500)
  }, [fetchContainers, fetchHealth])

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchHealth()
    fetchContainers()
    fetchAssociations()
    // Refresh health every 30s
    const hInterval = setInterval(fetchHealth, 30_000)
    return () => {
      clearInterval(hInterval)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchHealth, fetchContainers, fetchAssociations])

  // ── Actions ───────────────────────────────────────────────────────────────
  const triggerScan = useCallback(async () => {
    try {
      setLoading(true)
      await api.triggerScan()
      notify('Scan started…', 'info')
      startPolling()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [notify, startPolling])

  const updateOne = useCallback(async (name) => {
    try {
      notify(`Updating ${name}…`, 'info')
      const result = await api.updateOne(name)
      if (result.success) {
        notify(`✓ ${name} updated successfully`, 'success')
      } else {
        notify(`✗ ${name}: ${result.error}`, 'error')
      }
      await fetchContainers()
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [notify, fetchContainers])

  const updateSelected = useCallback(async () => {
    if (selected.size === 0) { notify('No containers selected', 'warning'); return }
    try {
      await api.updateSelected([...selected])
      notify(`Updating ${selected.size} container(s)…`, 'info')
      setSelected(new Set())
      startPolling()
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [selected, notify, startPolling])

  const updateAll = useCallback(async () => {
    try {
      const res = await api.updateAll()
      if (res.containers?.length === 0) {
        notify('No outdated containers found', 'info')
        return
      }
      notify(`Updating ${res.containers.length} container(s)…`, 'info')
      startPolling()
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [notify, startPolling])

  const composeUpdateOne = useCallback(async (name) => {
    try {
      notify(`Starting compose update for ${name}…`, 'info')
      await composeApi.updateViaCompose(name)
      startPolling()
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [notify, startPolling])

  const deleteContainer = useCallback(async (name) => {
    try {
      await api.deleteContainer(name)
      notify(`${name} removed`, 'success')
      await fetchContainers()
    } catch (e) {
      notify(e.message, 'error')
    }
  }, [notify, fetchContainers])

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((visibleContainers) => {
    setSelected(new Set(visibleContainers.map(c => c.id)))
  }, [])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isBusy = scanStatus?.scanning || scanStatus?.updating || loading

  return {
    containers,
    scanStatus,
    health,
    selected,
    loading,
    isBusy,
    error,
    toast,
    // actions
    triggerScan,
    updateOne,
    updateSelected,
    updateAll,
    deleteContainer,
    toggleSelect,
    selectAll,
    clearSelection,
    fetchContainers,
    associations,
    fetchAssociations,
    composeUpdateOne,
  }
}
