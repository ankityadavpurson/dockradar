import {
  Box, ChevronDown, ChevronRight, FileCode2, Globe,
  HardDrive, KeyRound, Network, Tags, Terminal, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

const MUTED  = { color: '#8a8a8a' }
const VALUE  = { color: '#ccc' }
const BORDER = '1px solid #1a1a1a'

function Section({ icon, title, count, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider" style={MUTED}>
        {icon}
        {title}
        {count !== undefined && (
          <span className="px-1.5 rounded" style={{ background: '#161616', border: BORDER }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function KV({ k, v }) {
  if (v === null || v === undefined || v === '' ) return null
  return (
    <div className="flex gap-3 text-[14px] font-mono">
      <span className="w-28 shrink-0" style={MUTED}>{k}</span>
      <span className="break-all" style={VALUE}>{String(v)}</span>
    </div>
  )
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

export default function ContainerDetailDrawer({ name, onClose }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(null)
  const [showLabels, setShowLabels] = useState(false)

  useEffect(() => {
    setData(null); setError(null); setShowLabels(false)
    api.containerDetails(name).then(setData).catch(e => setError(e.message))
  }, [name])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ports  = data ? formatPorts(data.ports) : []
  const labels = data ? Object.entries(data.labels || {}) : []

  return (
    <div className="fixed inset-0 z-[210]"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div role="dialog" aria-modal="true" aria-label={`Details for ${name}`}
        className="absolute top-0 right-0 h-full w-full max-w-[520px] flex flex-col"
        style={{ background: '#0a0a0a', borderLeft: BORDER, boxShadow: '-24px 0 60px rgba(0,0,0,0.45)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: BORDER, background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Box size={14} style={MUTED} />
            <span className="text-[16px] font-medium truncate" style={{ color: '#ededed' }}>{name}</span>
            {data && (
              <span className="text-[12px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                style={{
                  color: data.status === 'running' ? '#50e3c2' : '#f5a623',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid #222',
                }}>
                {data.status}
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
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {error && (
            <div className="px-3 py-2 rounded text-[14px] font-mono"
              style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.18)', color: '#ff4444' }}>
              {error}
            </div>
          )}

          {!data && !error && (
            <div className="text-[14px] font-mono py-8 text-center" style={MUTED}>Loading…</div>
          )}

          {data && (<>
            <Section icon={<Box size={11} />} title="Image">
              <KV k="image"  v={data.image} />
              <KV k="tag"    v={data.tag} />
              {data.latest_tag && data.latest_tag !== data.tag && <KV k="latest" v={data.latest_tag} />}
              <KV k="digest" v={data.local_digest} />
              <KV k="id"     v={data.short_id} />
            </Section>

            <Section icon={<Globe size={11} />} title="Ports" count={ports.length}>
              {ports.length === 0
                ? <span className="text-[14px] font-mono" style={MUTED}>none published</span>
                : ports.map((p, i) => <div key={i} className="text-[14px] font-mono" style={VALUE}>{p}</div>)}
            </Section>

            <Section icon={<HardDrive size={11} />} title="Bind mounts" count={(data.volumes || []).length}>
              {(data.volumes || []).length === 0
                ? <span className="text-[14px] font-mono" style={MUTED}>none captured</span>
                : data.volumes.map((v, i) => <div key={i} className="text-[14px] font-mono break-all" style={VALUE}>{v}</div>)}
            </Section>

            <Section icon={<KeyRound size={11} />} title="Environment" count={(data.environment_keys || []).length}>
              {(data.environment_keys || []).length === 0
                ? <span className="text-[14px] font-mono" style={MUTED}>none</span>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {data.environment_keys.map(k => (
                      <span key={k} className="text-[13px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: '#aaa', background: 'rgba(255,255,255,0.03)', border: BORDER }}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              <span className="text-[13px]" style={MUTED}>Values are hidden — they may contain secrets.</span>
            </Section>

            <Section icon={<Network size={11} />} title="Network">
              <KV k="mode"     v={data.network_mode} />
              <KV k="networks" v={(data.networks || []).join(', ')} />
              <KV k="hostname" v={data.hostname} />
              <KV k="restart"  v={data.restart_policy?.Name} />
              <KV k="user"     v={data.user} />
              <KV k="workdir"  v={data.working_dir} />
            </Section>

            {(data.command || data.entrypoint) && (
              <Section icon={<Terminal size={11} />} title="Process">
                <KV k="entrypoint" v={Array.isArray(data.entrypoint) ? data.entrypoint.join(' ') : data.entrypoint} />
                <KV k="command"    v={Array.isArray(data.command) ? data.command.join(' ') : data.command} />
              </Section>
            )}

            {data.compose && (
              <Section icon={<FileCode2 size={11} />} title="Compose">
                <KV k="file"    v={data.compose.filename} />
                <KV k="service" v={data.compose.service_name} />
              </Section>
            )}

            <Section icon={<Tags size={11} />} title="Labels" count={labels.length}>
              {labels.length === 0
                ? <span className="text-[14px] font-mono" style={MUTED}>none</span>
                : (
                  <>
                    <button type="button" onClick={() => setShowLabels(s => !s)}
                      className="flex items-center gap-1 text-[14px] font-mono w-fit"
                      style={MUTED} aria-expanded={showLabels}>
                      {showLabels ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      {showLabels ? 'hide' : 'show'} {labels.length} label{labels.length !== 1 ? 's' : ''}
                    </button>
                    {showLabels && labels.map(([k, v]) => (
                      <div key={k} className="text-[13px] font-mono break-all">
                        <span style={MUTED}>{k}</span>
                        {v && <span style={VALUE}> = {v}</span>}
                      </div>
                    ))}
                  </>
                )}
            </Section>

            {/* Update-preservation note */}
            <div className="px-3 py-2.5 rounded text-[13px] leading-relaxed"
              style={{ background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.15)', color: '#9a9a9a' }}>
              <span style={{ color: '#f5a623' }}>Direct updates</span> recreate this container from the
              configuration above. Preserved: ports, bind mounts, env vars, restart policy, network mode,
              labels, command/entrypoint. <span style={{ color: '#ccc' }}>Not preserved:</span> named volumes
              attached via <code>--mount</code>, multiple networks, and advanced options — use a compose
              association for containers that rely on them.
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
