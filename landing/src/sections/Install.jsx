import { CodeDisplay, Tabs } from 'xedonium'
import Section from './Section'

const COMPOSE = `services:
  dockradar:
    image: ankityadavpurson/dockradar:latest
    ports:
      - "8086:8086"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./compose_files:/app/backend/compose_files
    environment:
      HOST: 0.0.0.0
      PORT: 8086
      SCAN_INTERVAL_HOURS: 6
    restart: unless-stopped`

const RUN = `docker run -d --name dockradar -p 8086:8086 \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -v "$(pwd)/compose_files:/app/backend/compose_files" \\
  --restart unless-stopped \\
  ankityadavpurson/dockradar:latest`

const LINUX = `curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | sudo bash`

const MAC = `curl -fsSL https://github.com/ankityadavpurson/dockradar/releases/latest/download/install.sh | bash`

const PANELS = [
  {
    key: 'compose',
    label: 'Docker Compose',
    lang: 'yaml',
    title: 'docker-compose.yml',
    code: COMPOSE,
    note: <>Save as <code className="font-mono text-app-text">docker-compose.yml</code>, run <code className="font-mono text-app-text">docker compose up -d</code>. Also published on GHCR as <code className="font-mono text-app-text">ghcr.io/ankityadavpurson/dockradar</code>.</>,
  },
  {
    key: 'run',
    label: 'Docker run',
    lang: 'bash',
    title: 'terminal',
    code: RUN,
    note: <>A single container next to your Docker socket  - nothing else to set up.</>,
  },
  {
    key: 'linux',
    label: 'Linux',
    lang: 'bash',
    title: 'terminal',
    code: LINUX,
    note: <>Native install as a systemd service. Needs systemd, Python 3.10+ with <code className="font-mono text-app-text">venv</code>, and Docker Engine. Re-run the same command to upgrade  - config and data are kept.</>,
  },
  {
    key: 'macos',
    label: 'macOS',
    lang: 'bash',
    title: 'terminal',
    code: MAC,
    note: <>A per-user LaunchAgent that starts at login. Run it as your normal user, <strong className="font-semibold text-app-text">not with sudo</strong>. Needs Python 3.10+ and Docker Desktop, OrbStack or Colima.</>,
  },
]

export default function Install() {
  const items = PANELS.map(p => ({
    key: p.key,
    label: p.label,
    content: (
      <div className="pt-5">
        <CodeDisplay code={p.code} language={p.lang} title={p.title} copyable wrap />
        <p className="mt-4 text-sm leading-relaxed text-app-muted">{p.note}</p>
      </div>
    ),
  }))

  return (
    <Section id="install" eyebrow="Install" title="Up and running in a minute."
      lede="Run it as a container or natively. Then open http://localhost:8086 and hit Scan.">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="min-w-0 border border-app-border bg-app-card p-4 md:p-6">
          <Tabs items={items} defaultValue="compose" />
        </div>

        <aside className="space-y-6 text-sm">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-app-muted">Requirements</h3>
            <ul className="space-y-1.5 text-app-soft">
              <li>Access to a Docker daemon (local socket, SSH or TCP)</li>
              <li>Docker Engine with the compose plugin for compose-based updates</li>
              <li>Python 3.10+ for native installs</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-app-muted">Optional settings</h3>
            <ul className="space-y-1.5 text-app-soft">
              <li><code className="font-mono text-app-text">API_KEY</code>  - require a key on every API route</li>
              <li><code className="font-mono text-app-text">SMTP_*</code>, <code className="font-mono text-app-text">EMAIL_TO</code>  - update alerts</li>
              <li><code className="font-mono text-app-text">HIDDEN_REPOSITORY</code>  - leave containers out</li>
              <li><code className="font-mono text-app-text">SCAN_INTERVAL_HOURS</code>  - scan frequency</li>
            </ul>
          </div>
        </aside>
      </div>
    </Section>
  )
}
