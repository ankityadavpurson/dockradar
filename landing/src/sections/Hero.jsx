import { Badge, ButtonLink, GithubIcon, RocketIcon } from 'xedonium'
import { GITHUB_URL, RELEASES_URL } from '../links'
import { useLatestVersion } from '../useLatestVersion'
import MockDashboard from './MockDashboard'
import RadarBackdrop from './RadarBackdrop'

const FACTS = ['Self-hosted', 'Open source · MIT', 'One container']

export default function Hero() {
  const version = useLatestVersion()

  return (
    <section id="top" className="relative isolate overflow-hidden">
      <RadarBackdrop />

      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade_up mb-6 flex flex-wrap items-center justify-center gap-2">
            {version && (
              <a href={RELEASES_URL} target="_blank" rel="noreferrer"
                title="View the latest release notes"
                className="inline-flex h-5 shrink-0 items-center gap-1.5 border border-emerald-600/40 bg-emerald-500/10 px-2 font-mono leading-none text-[11px] tracking-wide text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:border-emerald-400/40 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                v{version}
              </a>
            )}
            {FACTS.map(f => (
              <Badge key={f} color="secondary"
                badgeContent={<span className="px-1.5 text-[11px] uppercase tracking-widest">{f}</span>} />
            ))}
          </div>

          <h1 className="animate-fade_up font-display text-4xl font-semibold leading-[1.1] tracking-tight text-app-strong [animation-delay:60ms] sm:text-5xl md:text-6xl">
            Know when your containers are{' '}
            <span className="text-emerald-600 dark:text-emerald-400">out of date.</span>
          </h1>

          <p className="animate-fade_up mx-auto mt-5 max-w-2xl text-base leading-relaxed text-app-soft [animation-delay:120ms] md:text-lg">
            DockRadar is a self-hosted dashboard that checks every Docker image on your host
            against its registry  - and lets you update one container, a few, or all of them in one click.
          </p>

          <div className="animate-fade_up mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:180ms]">
            <ButtonLink href="#install" variant="default"
              className="inline-flex items-center gap-2 !px-5 !py-2.5 text-[15px]">
              <RocketIcon className="h-4 w-4 shrink-0" />
              Get started
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} target="_blank" rel="noreferrer" variant="secondary"
              className="inline-flex items-center gap-2 !px-5 !py-2.5 text-[15px]">
              <GithubIcon className="h-4 w-4 shrink-0" />
              View on GitHub
            </ButtonLink>
          </div>
        </div>

        <div className="animate-fade_up mx-auto mt-14 max-w-[1040px] [animation-delay:260ms] md:mt-16">
          <MockDashboard />
        </div>
      </div>
    </section>
  )
}
