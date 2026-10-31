import {
  ArrowUpCircleIcon, ClockIcon, EyeOffIcon, FileCode2Icon, KeyIcon, LayoutDashboardIcon,
  MailIcon, PaletteIcon, ShieldCheckIcon,
} from 'xedonium'
import Section from './Section'

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: 'Tag and digest detection',
    body: 'Catches a newer tag and an image rebuilt under the same tag. Registry checks run in parallel, so a scan stays quick.',
  },
  {
    icon: ArrowUpCircleIcon,
    title: 'One, some, or all',
    body: 'Update a single container, a hand-picked selection, or every outdated one at once. No terminal needed.',
  },
  {
    icon: FileCode2Icon,
    title: 'Compose-aware updates',
    body: 'For Compose stacks it rewrites the pinned image: tag (keeping a .bak), then runs pull and up -d from the stack’s own file.',
  },
  {
    icon: LayoutDashboardIcon,
    title: 'Per-container details',
    body: 'Ports, mounts, env keys, networks, labels and update coverage in one drawer  - plus the exact scan error when a check fails.',
  },
  {
    icon: ClockIcon,
    title: 'Background scheduler',
    body: 'Scans on a schedule you set (SCAN_INTERVAL_HOURS), and picks up where it left off after a restart.',
  },
  {
    icon: MailIcon,
    title: 'Email alerts',
    body: 'Optional SMTP notifications when a scan finds updates  - deduplicated, so the same update is only announced once.',
  },
  {
    icon: KeyIcon,
    title: 'API-key protection',
    body: 'Set API_KEY and every /api route except /api/health requires the X-Api-Key header.',
  },
  {
    icon: EyeOffIcon,
    title: 'Hide what you don’t manage',
    body: 'List containers or repositories in HIDDEN_REPOSITORY and they’re never shown, scanned or auto-updated.',
  },
  {
    icon: PaletteIcon,
    title: 'Light, dark or system',
    body: 'A responsive UI that follows your OS theme or your choice, with a card layout that works on a phone.',
  },
]

export default function Features() {
  return (
    <Section id="features" eyebrow="Features" title="Everything you need to keep images fresh."
      lede="DockRadar does one job  - keeping the containers on your host current  - and gives you control over how.">
      <div className="grid gap-px border border-app-border bg-app-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="bg-app-card p-6 transition-colors hover:bg-app-bg">
            <Icon className="mb-4 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <h3 className="mb-2 text-base font-semibold text-app-strong">{title}</h3>
            <p className="text-sm leading-relaxed text-app-muted">{body}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}
