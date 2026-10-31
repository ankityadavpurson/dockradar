import { ButtonLink, ShieldAlertIcon } from 'xedonium'
import Section from './Section'
import { SECURITY_URL } from '../links'

const POINTS = [
  {
    title: 'It’s a privileged service',
    body: 'DockRadar controls Docker on its host and has no user accounts or roles. Anyone who can reach an unprotected API can effectively control the host.',
  },
  {
    title: 'Set an API key',
    body: 'Define API_KEY and every /api route except /api/health requires an X-Api-Key header.',
  },
  {
    title: 'Keep it off the open internet',
    body: 'If it must be reachable from other machines, put it behind a reverse proxy with authentication and TLS.',
  },
  {
    title: 'Local by default on macOS',
    body: 'The macOS install listens on 127.0.0.1 only. Set HOST and API_KEY deliberately to change that.',
  },
]

export default function Security() {
  return (
    <Section id="security" eyebrow="Security" title="Built to be run carefully."
      lede="Access to the Docker socket is powerful. Here’s how to run DockRadar responsibly.">
      <div className="grid gap-px border border-app-border bg-app-border md:grid-cols-2">
        {POINTS.map(p => (
          <div key={p.title} className="bg-app-card p-6">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-app-strong">
              <ShieldAlertIcon className="h-4 w-4 shrink-0 text-amber-500" />
              {p.title}
            </h3>
            <p className="text-sm leading-relaxed text-app-muted">{p.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <ButtonLink href={SECURITY_URL} target="_blank" rel="noreferrer" variant="secondary"
          className="inline-flex items-center gap-2">
          Read the security policy
        </ButtonLink>
      </div>
    </Section>
  )
}
