import { ButtonLink, GithubIcon, RocketIcon } from 'xedonium'
import logo from '../../assets/logo.svg'
import { CHANGELOG_URL, DOCKERHUB_URL, GITHUB_URL, LICENSE_URL, RELEASES_URL, SECURITY_URL } from '../links'

const LINKS = [
  { href: GITHUB_URL, label: 'GitHub' },
  { href: DOCKERHUB_URL, label: 'Docker Hub' },
  { href: RELEASES_URL, label: 'Releases' },
  { href: CHANGELOG_URL, label: 'Changelog' },
  { href: SECURITY_URL, label: 'Security' },
  { href: LICENSE_URL, label: 'MIT License' },
]

export default function Footer() {
  return (
    <>
      {/* Closing call to action */}
      <section className="border-t border-app-border bg-app-card">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center px-4 py-16 text-center md:px-6 md:py-20">
          <img src={logo} alt="" className="mb-5 h-14 w-14" />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-app-strong md:text-4xl">
            Stop guessing which containers are stale.
          </h2>
          <p className="mt-3 max-w-xl text-base text-app-soft">
            Run DockRadar next to your Docker socket and see what needs updating in under a minute.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="#install" variant="default" className="inline-flex items-center gap-2 !px-5 !py-2.5 text-[15px]">
              <RocketIcon className="h-4 w-4 shrink-0" />
              Get started
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} target="_blank" rel="noreferrer" variant="secondary"
              className="inline-flex items-center gap-2 !px-5 !py-2.5 text-[15px]">
              <GithubIcon className="h-4 w-4 shrink-0" />
              Star on GitHub
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-app-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 text-xs text-app-muted md:flex-row md:items-center md:justify-between md:px-6">
          <span className="flex items-center gap-2">
            <img src={logo} alt="" className="h-5 w-5" />
            DockRadar · MIT licensed
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                className="transition-colors hover:text-app-strong">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  )
}
