import { useEffect, useState } from 'react'
import { Accordion, Alert, ArrowUpCircleIcon, Badge, BoxIcon, Button, Drawer, EditIcon, FileCode2Icon, GlobeIcon, HardDriveIcon, InfoIcon, KeyRoundIcon, LinkIcon, Loader, NetworkIcon, TagsIcon, TerminalIcon } from 'xedonium'
import { api } from '../api/client'

const ICON = { className: 'h-4 w-4 shrink-0 text-app-soft' }

function KV({ k, v, title }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div className="flex gap-3 font-mono text-[13px]">
      <span className="w-24 shrink-0 font-sans text-app-muted">{k}</span>
      <span className="break-all text-app-soft" title={title}>{v}</span>
    </div>
  )
}

function Line({ children }) {
  return <div className="break-all font-mono text-[13px] text-app-soft">{children}</div>
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

export default function ContainerDetailDrawer({
  name, onClose, container, association, composeCli, isBusy,
  onDirectUpdate, onComposeUpdate, onLinkCompose, onEditCompose,
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Action availability — driven by the list container (label compose +
  // update_status) and the stored association, not the details fetch.
  const updateAvailable = container?.update_status === 'update_available'
  const hasCompose = !!association || !!container?.compose
  const composeUnavailable = composeCli === false
  const isLinked = !!association

  useEffect(() => {
    setData(null); setError(null)
    api.containerDetails(name).then(setData).catch(e => setError(e.message))
  }, [name])

  const ports = data ? formatPorts(data.ports) : []
  const mounts = data?.volumes || []
  const envKeys = data?.environment_keys || []
  const labels = data ? Object.entries(data.labels || {}) : []
  const networks = data?.networks || []

  // Collapsed-state previews — one glance still tells the story.
  const portPreview = ports.map(p => p.split(' → ')[0]?.split(':').pop()).filter(Boolean).join(' · ')
  const mountPreview = mounts.map(m => m.split(':')[1] || m.split(':')[0]).join(' · ')
  const envPreview = envKeys.slice(0, 3).join(' · ') + (envKeys.length > 3 ? ' …' : '')
  const netPreview = [data?.network_mode, data?.restart_policy?.Name].filter(Boolean).join(' · ')
  const procPreview = [data?.entrypoint, data?.command]
    .map(v => (Array.isArray(v) ? v.join(' ') : v)).filter(Boolean).join(' ')
  const labelPreview = labels.length ? `${labels[0][0]} …` : ''

  // Sections open by default when they have something to show; the collapsed
  // header carries a one-line `preview` so nothing disappears.
  const [openKeys, setOpenKeys] = useState([])
  useEffect(() => {
    if (!data) return
    setOpenKeys([ports.length > 0 && 'ports', mounts.length > 0 && 'mounts'].filter(Boolean))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const section = (key, icon, label, { count, preview, content }) => ({
    key,
    title: (
      <span className="flex w-full min-w-0 items-center gap-2">
        {icon}
        <span className="shrink-0 font-normal">{label}</span>
        {count > 0 && <Badge badgeContent={count} color="secondary" className="shrink-0" />}
        {!openKeys.includes(key) && preview && (
          <span className="ml-auto min-w-0 max-w-[55%] truncate text-right font-mono text-xs font-normal text-app-muted">
            {preview}
          </span>
        )}
      </span>
    ),
    content: <div className="flex flex-col gap-1.5 pt-2">{content}</div>,
  })

  const accordionItems = !data ? [] : [
    section('ports', <GlobeIcon {...ICON} />, 'Ports', {
      count: ports.length, preview: portPreview || 'none',
      content: ports.length === 0 ? <Line>none published</Line> : ports.map((p, i) => <Line key={i}>{p}</Line>),
    }),
    section('mounts', <HardDriveIcon {...ICON} />, 'Mounts', {
      count: mounts.length, preview: mountPreview || 'none',
      content: mounts.length === 0 ? <Line>none captured</Line> : mounts.map((v, i) => <Line key={i}>{v}</Line>),
    }),
    section('env', <KeyRoundIcon {...ICON} />, 'Environment', {
      count: envKeys.length, preview: envPreview || 'none',
      content: (<>
        {envKeys.length === 0
          ? <Line>none</Line>
          : (
            <div className="flex flex-wrap gap-1.5">
              {envKeys.map(k => (
                <span key={k} className="border border-app-border bg-app-card px-1.5 py-0.5 font-mono text-xs text-app-soft">{k}</span>
              ))}
            </div>
          )}
        <span className="text-xs text-app-muted">Values are hidden — they may contain secrets.</span>
      </>),
    }),
    section('network', <NetworkIcon {...ICON} />, 'Network', {
      preview: netPreview || '—',
      content: (<>
        <KV k="mode" v={data.network_mode} />
        <KV k="networks" v={networks.join(', ')} />
        <KV k="hostname" v={data.hostname} />
        <KV k="restart" v={data.restart_policy?.Name} />
      </>),
    }),
    (data.command || data.entrypoint || data.user || data.working_dir) && section('process', <TerminalIcon {...ICON} />, 'Process', {
      preview: procPreview || '—',
      content: (<>
        <KV k="entrypoint" v={Array.isArray(data.entrypoint) ? data.entrypoint.join(' ') : data.entrypoint} />
        <KV k="command" v={Array.isArray(data.command) ? data.command.join(' ') : data.command} />
        <KV k="user" v={data.user} />
        <KV k="workdir" v={data.working_dir} />
      </>),
    }),
    data.compose
      ? section('compose', <FileCode2Icon {...ICON} />, 'Compose', {
        preview: `${data.compose.filename} / ${data.compose.service_name}`,
        content: (<>
          <KV k="file" v={data.compose.filename} />
          <KV k="service" v={data.compose.service_name} />
          {isLinked && onEditCompose && (
            <div className="mt-2">
              <Button variant="secondary" className="inline-flex items-center gap-2"
                onClick={onEditCompose} tooltip="Edit the linked compose file">
                <EditIcon className="h-3.5 w-3.5 shrink-0" />
                Edit compose file
              </Button>
            </div>
          )}
        </>),
      })
      : section('compose', <FileCode2Icon {...ICON} />, 'Compose', {
        preview: 'no compose file linked',
        content: onLinkCompose && (
          <div>
            <Button variant="secondary" className="inline-flex items-center gap-2"
              onClick={onLinkCompose} tooltip="Link this container to a compose file">
              <LinkIcon className="h-3.5 w-3.5 shrink-0" />
              Link compose file
            </Button>
          </div>
        ),
      }),
    section('image', <BoxIcon {...ICON} />, 'Image', {
      preview: shortDigest(data.local_digest) || data.tag,
      content: (<>
        <KV k="image" v={data.image} />
        <KV k="tag" v={data.tag} />
        {data.latest_tag && data.latest_tag !== data.tag && <KV k="latest" v={data.latest_tag} />}
        <KV k="digest" v={data.local_digest} />
        <KV k="id" v={data.short_id} />
      </>),
    }),
    section('labels', <TagsIcon {...ICON} />, 'Labels', {
      count: labels.length, preview: labelPreview || 'none',
      content: labels.length === 0
        ? <Line>none</Line>
        : labels.map(([k, v]) => (
          <div key={k} className="break-all font-mono text-xs">
            <span className="text-app-muted">{k}</span>
            {v && <span className="text-app-soft"> = {v}</span>}
          </div>
        )),
    }),
    section('coverage', <InfoIcon className="h-4 w-4 shrink-0 text-amber-500" />, 'Direct update coverage', {
      preview: 'what survives an update?',
      content: (
        <p className="text-xs leading-relaxed text-app-muted">
          Direct updates recreate this container from the configuration above.{' '}
          <span className="text-app-soft">Preserved:</span> ports, bind mounts, env vars,
          restart policy, network mode, labels, command/entrypoint.{' '}
          <span className="text-app-soft">Not preserved:</span> named volumes attached
          via <code>--mount</code>, multiple networks, and advanced options — use a
          compose association for containers that rely on them.
        </p>
      ),
    }),
  ].filter(Boolean)

  const title = (
    <span className="flex min-w-0 items-center gap-2 normal-case tracking-normal">
      <span className="truncate text-base font-semibold">{name}</span>
      {data && (
        <Badge color={data.status === 'running' ? 'success' : 'warning'} badgeContent={data.status}
          className="shrink-0 capitalize" />
      )}
    </span>
  )

  return (
    <Drawer open onClose={onClose} title={title} width="max-w-[520px]" padded={false}>
      <div className="flex h-full flex-col">
        {data && (
          <span className="truncate px-6 pb-3 pt-4 font-mono text-xs text-app-muted"
            title={data.local_digest || undefined}>
            {data.image}
            {data.local_digest && <span className="opacity-70"> @ {shortDigest(data.local_digest)}</span>}
          </span>
        )}

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 pb-6">
          {/* Actions — update (direct / compose) and compose file link/edit */}
          {container && (onDirectUpdate || onLinkCompose) && (
            <div className="mb-1 flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
              {updateAvailable && hasCompose && onComposeUpdate && (
                <Button variant="secondary" className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                  disabled={isBusy || composeUnavailable}
                  onClick={() => onComposeUpdate(container)}
                  tooltip={composeUnavailable
                    ? 'Compose CLI not available in this deployment'
                    : 'Preview and update via docker compose'}>
                  <FileCode2Icon className="h-3.5 w-3.5 shrink-0" />
                  Update via compose
                </Button>
              )}
              {updateAvailable && onDirectUpdate && (
                <Button variant="warning" className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                  disabled={isBusy}
                  onClick={() => onDirectUpdate(container)}
                  tooltip="Stop, remove, and recreate with the latest image">
                  <ArrowUpCircleIcon className="h-3.5 w-3.5 shrink-0" />
                  Update (pull + recreate)
                </Button>
              )}
            </div>
          )}

          {error && (
            <Alert tone="danger" className="shrink-0"><span className="break-words">{error}</span></Alert>
          )}

          {!data && !error && (
            <Loader variant="inline" label="Loading…" className="justify-center py-8" />
          )}

          {data && (
            <Accordion
              multiple
              gap='sm'
              items={accordionItems}
              value={openKeys}
              onChange={setOpenKeys}
              className="shrink-0 bg-app-card [&_h3_button>span:first-child]:flex-1"
            />
          )}
        </div>
      </div>
    </Drawer>
  )
}
