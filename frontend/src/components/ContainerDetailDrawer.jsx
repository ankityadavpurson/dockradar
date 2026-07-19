import {
  Box, ChevronRight, FileCode2, Globe, HardDrive,
  Info, KeyRound, Network, Tags, Terminal, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

const MUTED  = { color: '#8a8a8a' }
const VALUE  = { color: '#ccc' }
const BORDER = '1px solid #1a1a1a'

/**
 * Collapsible section. The `preview` renders inline in the header while
 * collapsed, so no information disappears — it just takes one line.
 */
function Disclosure({ icon, title, count, preview, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    // shrink-0: without it the flex column squashes cards (overflow-hidden
    // lets them shrink below content height) instead of scrolling the body.
    <div className="rounded-lg overflow-hidden shrink-0"
      style={{ border: BORDER, background: 'rgba(255,255,255,0.015)' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer">
        <ChevronRight size={12} className="shrink-0 transition-transform"
          style={{ ...MUTED, transform: open ? 'rotate(90deg)' : 'none' }} />
        {icon}
        <span className="text-[12px] font-mono uppercase tracking-wider shrink-0" style={MUTED}>
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[11px] font-mono px-1.5 rounded shrink-0"
            style={{ background: '#161616', border: BORDER, color: '#8a8a8a' }}>
            {count}
          </span>
        )}
        {!open && preview && (
          <span className="ml-auto text-[13px] font-mono truncate text-right"
            style={{ color: '#6a6a6a', maxWidth: '55%' }}>
            {preview}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 flex flex-col gap-1.5"
          style={{ borderTop: '1px solid #141414' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function KV({ k, v, title }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div className="flex gap-3 text-[13px] font-mono">
      <span className="w-24 shrink-0" style={MUTED}>{k}</span>
      <span className="break-all" style={VALUE} title={title}>{String(v)}</span>
    </div>
  )
}

function Line({ children }) {
  return <div className="text-[13px] font-mono break-all" style={VALUE}>{children}</div>
}

function formatPorts(ports) {
  const out = []
  for (const [containerPort, bindings] of Object.entries(ports || {})) {
    if (Array.isArray(bindings) && bindings.length > 0) {
      for (const b of bindings) {
        out.push(`${b.HostIp || '0.0.0.0'}:${b.HostPort} → ${containerPort}`)
      }
    } else {
      out.push(`${containerPort} (not published)`)
    }
  }
  return out
}

const shortDigest = d => (d ? d.replace('sha256:', '').slice(0, 12) : null)

export default function ContainerDetailDrawer({ name, onClose }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null); setError(null)
    api.containerDetails(name).then(setData).catch(e => setError(e.message))
  }, [name])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ports    = data ? formatPorts(data.ports) : []
  const mounts   = data?.volumes || []
  const envKeys  = data?.environment_keys || []
  const labels   = data ? Object.entries(data.labels || {}) : []
  const networks = data?.networks || []

  // Collapsed-state previews — one glance still tells the story.
  const portPreview  = ports.map(p => p.split(' → ')[0]?.split(':').pop()).filter(Boolean).join(' · ')
  const mountPreview = mounts.map(m => m.split(':')[1] || m.split(':')[0]).join(' · ')
  const envPreview   = envKeys.slice(0, 3).join(' · ') + (envKeys.length > 3 ? ' …' : '')
  const netPreview   = [data?.network_mode, data?.restart_policy?.Name].filter(Boolean).join(' · ')
  const procPreview  = [data?.entrypoint, data?.command]
    .map(v => (Array.isArray(v) ? v.join(' ') : v)).filter(Boolean).join(' ')
  const labelPreview = labels.length ? `${labels[0][0]} …` : ''

  return (
    <div className="fixed inset-0 z-[210]"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div role="dialog" aria-modal="true" aria-label={`Details for ${name}`}
        className="absolute top-0 right-0 h-full w-full max-w-[520px] flex flex-col"
        style={{ background: '#000', borderLeft: BORDER, boxShadow: '-24px 0 60px rgba(0,0,0,0.45)' }}>

        {/* Header — the essentials, nothing else */}
        <div className="flex items-start justify-between px-5 py-4 gap-3"
          style={{ borderBottom: BORDER, background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-medium truncate" style={{ color: '#ededed' }}>{name}</span>
              {data && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                  style={{
                    color: data.status === 'running' ? '#50e3c2' : '#f5a623',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid #222',
                  }}>
                  {data.status}
                </span>
              )}
            </div>
            {data && (
              <span className="text-[13px] font-mono truncate" style={MUTED}
                title={data.local_digest || undefined}>
                {data.image}
                {data.local_digest && <span style={{ color: '#5a5a5a' }}> @ {shortDigest(data.local_digest)}</span>}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close details"
            className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
            style={{ color: '#8a8a8a', border: '1px solid #222' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
          {error && (
            <div className="px-3 py-2 rounded text-[14px] font-mono shrink-0"
              style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.18)', color: '#ff4444' }}>
              {error}
            </div>
          )}

          {!data && !error && (
            <div className="text-[14px] font-mono py-8 text-center" style={MUTED}>Loading…</div>
          )}

          {data && (<>
            <Disclosure icon={<Globe size={12} style={MUTED} />} title="Ports"
              count={ports.length} preview={portPreview || 'none'} defaultOpen={ports.length > 0}>
              {ports.length === 0
                ? <Line>none published</Line>
                : ports.map((p, i) => <Line key={i}>{p}</Line>)}
            </Disclosure>

            <Disclosure icon={<HardDrive size={12} style={MUTED} />} title="Mounts"
              count={mounts.length} preview={mountPreview || 'none'} defaultOpen={mounts.length > 0}>
              {mounts.length === 0
                ? <Line>none captured</Line>
                : mounts.map((v, i) => <Line key={i}>{v}</Line>)}
            </Disclosure>

            <Disclosure icon={<KeyRound size={12} style={MUTED} />} title="Environment"
              count={envKeys.length} preview={envPreview || 'none'}>
              {envKeys.length === 0
                ? <Line>none</Line>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {envKeys.map(k => (
                      <span key={k} className="text-[12px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: '#aaa', background: 'rgba(255,255,255,0.03)', border: BORDER }}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              <span className="text-[12px]" style={MUTED}>Values are hidden — they may contain secrets.</span>
            </Disclosure>

            <Disclosure icon={<Network size={12} style={MUTED} />} title="Network"
              preview={netPreview || '—'}>
              <KV k="mode"     v={data.network_mode} />
              <KV k="networks" v={networks.join(', ')} />
              <KV k="hostname" v={data.hostname} />
              <KV k="restart"  v={data.restart_policy?.Name} />
            </Disclosure>

            {(data.command || data.entrypoint || data.user || data.working_dir) && (
              <Disclosure icon={<Terminal size={12} style={MUTED} />} title="Process"
                preview={procPreview || '—'}>
                <KV k="entrypoint" v={Array.isArray(data.entrypoint) ? data.entrypoint.join(' ') : data.entrypoint} />
                <KV k="command"    v={Array.isArray(data.command) ? data.command.join(' ') : data.command} />
                <KV k="user"       v={data.user} />
                <KV k="workdir"    v={data.working_dir} />
              </Disclosure>
            )}

            {data.compose && (
              <Disclosure icon={<FileCode2 size={12} style={MUTED} />} title="Compose"
                preview={`${data.compose.filename} / ${data.compose.service_name}`}>
                <KV k="file"    v={data.compose.filename} />
                <KV k="service" v={data.compose.service_name} />
              </Disclosure>
            )}

            <Disclosure icon={<Box size={12} style={MUTED} />} title="Image"
              preview={shortDigest(data.local_digest) || data.tag}>
              <KV k="image"  v={data.image} />
              <KV k="tag"    v={data.tag} />
              {data.latest_tag && data.latest_tag !== data.tag && <KV k="latest" v={data.latest_tag} />}
              <KV k="digest" v={data.local_digest} />
              <KV k="id"     v={data.short_id} />
            </Disclosure>

            <Disclosure icon={<Tags size={12} style={MUTED} />} title="Labels"
              count={labels.length} preview={labelPreview || 'none'}>
              {labels.length === 0
                ? <Line>none</Line>
                : labels.map(([k, v]) => (
                  <div key={k} className="text-[12px] font-mono break-all">
                    <span style={MUTED}>{k}</span>
                    {v && <span style={VALUE}> = {v}</span>}
                  </div>
                ))}
            </Disclosure>

            {/* Update-coverage note — present but quiet */}
            <Disclosure icon={<Info size={12} style={{ color: '#f5a623' }} />}
              title="Direct update coverage" preview="what survives an update?">
              <p className="text-[12px] leading-relaxed" style={{ color: '#9a9a9a' }}>
                Direct updates recreate this container from the configuration above.{' '}
                <span style={{ color: '#ccc' }}>Preserved:</span> ports, bind mounts, env vars,
                restart policy, network mode, labels, command/entrypoint.{' '}
                <span style={{ color: '#ccc' }}>Not preserved:</span> named volumes attached
                via <code>--mount</code>, multiple networks, and advanced options — use a
                compose association for containers that rely on them.
              </p>
            </Disclosure>
          </>)}
        </div>
      </div>
    </div>
  )
}
