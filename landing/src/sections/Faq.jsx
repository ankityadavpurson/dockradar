import { Accordion } from 'xedonium'
import Section from './Section'

const FAQS = [
  {
    key: 'preserve',
    title: 'What does a direct update preserve?',
    body: <>The direct (non-compose) flow recreates a container from a captured subset of its configuration. It keeps ports, bind mounts, environment variables, restart policy, network mode, labels, command and entrypoint, hostname, user and working dir.</>,
  },
  {
    key: 'not-preserved',
    title: 'What is not preserved  - and what should I do about it?',
    body: <>Named volumes attached via <code className="font-mono text-app-text">--mount</code>, membership in multiple networks, network aliases, and advanced options (cap_add, devices, resource limits, healthchecks). For containers that rely on those, link them to a compose file and use the compose update  - <code className="font-mono text-app-text">docker compose</code> recreates the container from its full definition.</>,
  },
  {
    key: 'compose',
    title: 'How do compose updates work?',
    body: <>DockRadar finds the stack’s compose file from its <code className="font-mono text-app-text">com.docker.compose.*</code> labels, rewrites a pinned <code className="font-mono text-app-text">image:</code> tag to the newer one (keeping a <code className="font-mono text-app-text">.bak</code>), then runs <code className="font-mono text-app-text">docker compose pull</code> and <code className="font-mono text-app-text">up -d</code>. It needs the compose CLI, read-write access to the file at its labelled path, and the Docker socket.</>,
  },
  {
    key: 'registries',
    title: 'Which registries are supported?',
    body: <>Docker Hub, plus any Docker v2 registry that allows anonymous pulls  - such as ghcr.io, lscr.io and gcr.io. DockRadar fetches an anonymous token for each check, so images that need credentials to read their tags can’t be verified. They show an Error status with the reason instead of failing silently.</>,
  },
  {
    key: 'scan',
    title: 'How often does it scan?',
    body: <>Every <code className="font-mono text-app-text">SCAN_INTERVAL_HOURS</code> hours, and whenever you press Scan. Results are persisted and restored on startup, and when SMTP is configured, a scan that finds new updates sends an email  - the same update is only announced once.</>,
  },
  {
    key: 'free',
    title: 'Is it free?',
    body: <>Yes. DockRadar is open source under the MIT license.</>,
  },
]

export default function Faq() {
  const items = FAQS.map(f => ({
    key: f.key,
    title: f.title,
    content: <p className="pb-1 text-sm leading-relaxed text-app-muted">{f.body}</p>,
  }))

  return (
    <Section id="faq" eyebrow="FAQ" title="Good to know before you update.">
      <Accordion items={items} defaultValue={['preserve']} gap="sm" />
    </Section>
  )
}
