import { ArrowUpCircleIcon, BoxIcon, RefreshCwIcon } from 'xedonium'
import Section from './Section'

const STEPS = [
  {
    icon: BoxIcon,
    title: 'Discover',
    body: 'DockRadar reads the containers on your host through the Docker socket  - running and stopped  - and works out which image and tag each one uses.',
    code: 'docker.sock → 14 containers',
  },
  {
    icon: RefreshCwIcon,
    title: 'Check',
    body: 'Each image is compared with its upstream registry by tag and by digest. Results are cached, and a scan repeats on your schedule.',
    code: 'postgres:16.3 → 16.4 available',
  },
  {
    icon: ArrowUpCircleIcon,
    title: 'Update',
    body: 'Apply an update from the dashboard. Compose-managed containers go through their compose file; the rest are recreated from their captured configuration.',
    code: 'pull → recreate → verified',
  },
]

export default function HowItWorks() {
  return (
    <Section id="how-it-works" eyebrow="How it works" title="Scan, spot, update."
      lede="No agents, no database to run, no config to write. Point it at Docker and it gets to work.">
      <ol className="grid gap-px border border-app-border bg-app-border md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body, code }, i) => (
          <li key={title} className="flex flex-col bg-app-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-sm text-app-muted">0{i + 1}</span>
              <Icon className="h-6 w-6 shrink-0 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-app-strong">{title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-app-muted">{body}</p>
            <code className="mt-auto block border border-app-border bg-app-bg px-3 py-2 font-mono text-xs text-app-soft">
              {code}
            </code>
          </li>
        ))}
      </ol>
    </Section>
  )
}
