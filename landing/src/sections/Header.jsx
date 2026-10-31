import { ButtonLink, GithubIcon, ThemeToggle } from 'xedonium'
import logo from '../../assets/logo.svg'
import { GITHUB_URL } from '../links'

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#install', label: 'Install' },
  { href: '#faq', label: 'FAQ' },
]

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-app-border bg-app-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 md:gap-5 md:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <img src={logo} alt="" className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="text-[15px] font-semibold text-app-strong sm:text-base">DockRadar</span>
        </a>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-5 text-[13px] md:flex">
          {NAV.map(n => (
            <a key={n.href} href={n.href} className="text-app-muted transition-colors hover:text-app-strong">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        <ButtonLink href={GITHUB_URL} target="_blank" rel="noreferrer" variant="secondary"
          className="inline-flex items-center gap-1.5 !px-2.5 !py-1.5">
          <GithubIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">GitHub</span>
        </ButtonLink>
        <ThemeToggle variant="toolbar" />
      </div>
    </header>
  )
}
