import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, ArrowLeftIcon, Button, Input, KeyIcon, NumberField, PasswordInput,
  RotateCcwIcon, SaveIcon, SendIcon, Switch, useLeaveWarning,
} from 'xedonium'
import radarLoader from '../../assets/radar-loader.svg'
import { setApiKey, settingsApi } from '../api/client'

const GROUPS = [
  { id: 'scanning', title: 'Scanning',
    subtitle: 'How often DockRadar checks for new images, and which containers it watches.' },
  { id: 'email', title: 'Email notifications',
    subtitle: 'Get an email when image updates are found.' },
  { id: 'security', title: 'Security',
    subtitle: 'Protect the API when DockRadar can be reached from other devices.' },
  { id: 'server', title: 'Server',
    subtitle: 'Read when DockRadar starts, so they can\'t be changed here.' },
]

const SOURCE_LABEL = { saved: 'Saved here', env: 'From env file', default: 'Default' }

function fmt(value, kind) {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (kind === 'bool') return value ? 'On' : 'Off'
  return String(value)
}

function randomKey() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Settings page: edits the values in COMPOSE_DIR/settings.json, which take
 * priority over the env file. Everything except the Server group applies
 * immediately on the backend - no restart.
 */
export default function SettingsPage({ onBack, onSaved, onTestEmail, notify, onDirtyChange }) {
  const [data, setData]       = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [drafts, setDrafts]   = useState({})        // key → new value (secret: string, or null = remove)
  const [resets, setResets]   = useState(new Set()) // keys to stop overriding
  const [errors, setErrors]   = useState({})        // key → message from the server
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setData(await settingsApi.get())
    } catch (e) {
      setLoadError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const changeCount = Object.keys(drafts).length + resets.size
  const dirty = changeCount > 0
  useLeaveWarning(dirty)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const byGroup = useMemo(() => {
    const map = {}
    for (const s of data?.settings ?? []) (map[s.group] ??= []).push(s)
    return map
  }, [data])

  const emailDirty = (byGroup.email ?? []).some(s => s.key in drafts || resets.has(s.key))

  // ── Editing helpers ─────────────────────────────────────────────────────────
  function clearError(key) {
    setErrors(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function setValue(item, value) {
    clearError(item.key)
    setResets(prev => {
      if (!prev.has(item.key)) return prev
      const next = new Set(prev)
      next.delete(item.key)
      return next
    })
    setDrafts(prev => {
      const next = { ...prev }
      const unchanged = item.kind === 'secret' ? value === '' : value === item.value
      if (unchanged) delete next[item.key]
      else next[item.key] = value
      return next
    })
  }

  function undo(key) {
    clearError(key)
    setDrafts(prev => { const next = { ...prev }; delete next[key]; return next })
    setResets(prev => { const next = new Set(prev); next.delete(key); return next })
  }

  function reset(key) {
    clearError(key)
    setDrafts(prev => { const next = { ...prev }; delete next[key]; return next })
    setResets(prev => new Set(prev).add(key))
  }

  function discard() {
    setDrafts({})
    setResets(new Set())
    setErrors({})
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    const values = {}
    for (const [key, value] of Object.entries(drafts)) values[key] = value === null ? '' : value
    try {
      const res = await settingsApi.save(values, [...resets])
      // Keep this browser's key in step with the server so it isn't locked out.
      if ('API_KEY' in drafts) setApiKey(drafts.API_KEY || '')
      if (resets.has('API_KEY')) {
        const apiKey = res.settings.find(s => s.key === 'API_KEY')
        if (apiKey?.is_set) {
          notify?.("The API key now comes from the env file. DockRadar will ask for it if this browser's key no longer matches.", 'warning')
        } else {
          setApiKey('')
        }
      }
      setData(res)
      discard()
      notify?.(res.changed.length ? 'Settings saved.' : 'Saved - nothing changed.', 'success')
      onSaved?.(res.changed)
    } catch (e) {
      if (e.status === 422 && e.detail?.errors) {
        setErrors(e.detail.errors)
        notify?.('Some settings need fixing.', 'error')
      } else {
        notify?.(e.message, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function testEmail() {
    if (!onTestEmail || testing) return
    setTesting(true)
    try { await onTestEmail() } finally { setTesting(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-app-muted">
        {loadError ? (
          <>
            <Alert tone="danger" className="w-full max-w-lg">
              <span className="break-words">Couldn't load settings: {loadError}</span>
            </Alert>
            <Button variant="secondary" onClick={load}>Try again</Button>
          </>
        ) : (
          <>
            <img src={radarLoader} alt="" className="h-16 w-16" />
            <div>Loading settings…</div>
          </>
        )}
      </div>
    )
  }

  const envFile = data.env_file

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="flat" onClick={onBack} className="inline-flex items-center gap-1.5 !px-2">
          <ArrowLeftIcon className="h-4 w-4 shrink-0" />
          Dashboard
        </Button>
        <h1 className="text-xl font-semibold text-app-strong">Settings</h1>
      </div>

      <Alert tone="info">
        Changes apply as soon as you save, without a restart. Values saved here take priority
        over the env file; use <strong>Reset</strong> on a setting to follow the env file again.
      </Alert>

      {GROUPS.map(group => {
        const items = byGroup[group.id]
        if (!items?.length) return null
        const readOnly = group.id === 'server'
        return (
          <section key={group.id} aria-labelledby={`group-${group.id}`}
            className="overflow-hidden border border-app-border bg-app-card">
            <header className="flex flex-wrap items-start gap-3 border-b border-app-border px-4 py-3 md:px-5">
              <div className="min-w-0 flex-1">
                <h2 id={`group-${group.id}`} className="text-[15px] font-semibold text-app-strong">{group.title}</h2>
                <p className="mt-0.5 text-[13px] text-app-muted">
                  {group.subtitle}
                  {readOnly && <> Change them in {envFile ? <code className="break-all">{envFile}</code> : <>your <code>.env</code> file (or <code>docker-compose.yml</code>)</>} and restart.</>}
                </p>
              </div>
              {group.id === 'email' && onTestEmail && (
                <Button variant="secondary" onClick={testEmail} disabled={testing || emailDirty}
                  tooltip={emailDirty ? 'Save your changes first' : 'Send a test email with the saved settings'}
                  className="inline-flex shrink-0 items-center gap-2">
                  <SendIcon className="h-[13px] w-[13px] shrink-0" />
                  {testing ? 'Sending…' : 'Send test email'}
                </Button>
              )}
            </header>

            <div className="divide-y divide-app-border">
              {items.map(item => readOnly
                ? <ReadOnlyRow key={item.key} item={item} />
                : (
                  <SettingRow
                    key={item.key}
                    item={item}
                    draft={drafts[item.key]}
                    hasDraft={item.key in drafts}
                    pendingReset={resets.has(item.key)}
                    error={errors[item.key]}
                    onChange={v => setValue(item, v)}
                    onUndo={() => undo(item.key)}
                    onReset={() => reset(item.key)}
                  />
                ))}
            </div>
          </section>
        )
      })}

      <p className="text-xs text-app-muted">
        Saved settings are stored in <code className="break-all">{data.store_path}</code>.
      </p>

      {/* Save bar */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-app-border bg-app-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <span className="mr-auto text-sm text-app-muted" aria-live="polite">
            {dirty ? `${changeCount} unsaved` : <>No<span className="hidden sm:inline"> unsaved</span> changes</>}
          </span>
          <Button variant="secondary" onClick={discard} disabled={!dirty || saving} className="whitespace-nowrap">Discard</Button>
          <Button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-2 whitespace-nowrap">
            <SaveIcon className="h-4 w-4 shrink-0" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function RowShell({ item, children }) {
  const id = `setting-${item.key}`
  return (
    <div className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:px-5">
      <div className="min-w-0">
        <label htmlFor={id} id={`${id}-label`} className="text-sm font-medium text-app-text">{item.label}</label>
        <div className="font-mono text-[11px] text-app-muted">{item.key}</div>
        {item.help && <p className="mt-1 text-[13px] leading-relaxed text-app-muted">{item.help}</p>}
      </div>
      <div className="flex min-w-0 max-w-2xl flex-col gap-1.5">{children}</div>
    </div>
  )
}

function SourceTag({ source, pending }) {
  const cls = pending
    ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
    : source === 'saved'
      ? 'border-sky-500/40 text-sky-700 dark:text-sky-400'
      : 'border-app-border text-app-muted'
  return (
    <span className={`inline-flex items-center border px-1.5 py-px text-[11px] font-medium ${cls}`}>
      {pending ? 'Unsaved' : SOURCE_LABEL[source] ?? source}
    </span>
  )
}

function SettingRow({ item, draft, hasDraft, pendingReset, error, onChange, onUndo, onReset }) {
  const id = `setting-${item.key}`
  const isSecret = item.kind === 'secret'
  const value = hasDraft ? draft : pendingReset ? item.fallback : item.value
  const pending = hasDraft || pendingReset
  const fallbackLabel = item.fallback_source === 'env' ? 'env file value' : 'default'

  let control
  if (item.kind === 'int') {
    control = (
      <NumberField id={id} value={value ?? null} onChange={onChange}
        min={item.min ?? undefined} max={item.max ?? undefined}
        aria-invalid={!!error} className="w-full sm:max-w-[220px]" />
    )
  } else if (item.kind === 'bool') {
    control = (
      <Switch id={id} checked={!!value} onChange={onChange}
        aria-labelledby={`${id}-label`} label={value ? 'On' : 'Off'} />
    )
  } else if (isSecret) {
    const removing = hasDraft && draft === null
    const placeholder = removing ? 'Will be removed when you save'
      : item.is_set ? '•••••••• saved - type to replace' : 'Not set'
    control = (
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <PasswordInput id={id} value={removing ? '' : (draft ?? '')} onChange={onChange}
            placeholder={placeholder} autoComplete="new-password" aria-invalid={!!error} />
        </div>
        {item.key === 'API_KEY' && (
          <Button variant="flat" onClick={() => onChange(randomKey())}
            tooltip="Fill in a random 48-character key" className="inline-flex items-center gap-1.5">
            <KeyIcon className="h-4 w-4 shrink-0" /> Generate
          </Button>
        )}
        {item.is_set && !removing && (
          <Button variant="flat" onClick={() => onChange(null)}>Remove</Button>
        )}
      </div>
    )
  } else {
    control = (
      <Input id={id} value={value ?? ''} onChange={onChange} placeholder={item.placeholder || undefined}
        invalid={!!error} autoComplete="off" spellCheck={false}
        inputMode={item.kind === 'email' ? 'email' : item.kind === 'url' ? 'url' : undefined} />
    )
  }

  return (
    <RowShell item={item}>
      {control}
      {error && <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-muted">
        <SourceTag source={item.source} pending={pending} />
        {pendingReset && (
          <span>Reverts to the {fallbackLabel}{isSecret ? '' : `: ${fmt(item.fallback, item.kind)}`}</span>
        )}
        {!pendingReset && isSecret && <span>{item.is_set ? 'Set' : 'Not set'}</span>}
        {!pendingReset && !isSecret && item.default !== null && item.default !== undefined && (
          <span>Default: <span className="font-mono">{fmt(item.default, item.kind)}</span></span>
        )}
        <span className="flex-1" />
        {pending ? (
          <button type="button" onClick={onUndo} className="font-medium text-sky-700 hover:underline dark:text-sky-400">
            Undo
          </button>
        ) : item.source === 'saved' && (
          <button type="button" onClick={onReset}
            title={`Stop overriding and use the ${fallbackLabel}`}
            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-400">
            <RotateCcwIcon className="h-3 w-3 shrink-0" /> Reset
          </button>
        )}
      </div>
    </RowShell>
  )
}

function ReadOnlyRow({ item }) {
  return (
    <RowShell item={item}>
      <div id={`setting-${item.key}`}
        className="break-all border border-app-border bg-app-bg px-3 py-2 font-mono text-[13px] text-app-text">
        {item.value === null || item.value === '' ? <span className="text-app-muted">(Docker default)</span> : String(item.value)}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-muted">
        <SourceTag source={item.source} />
        {item.default !== null && item.default !== undefined && (
          <span>Default: <span className="break-all font-mono">{fmt(item.default, item.kind)}</span></span>
        )}
      </div>
    </RowShell>
  )
}
