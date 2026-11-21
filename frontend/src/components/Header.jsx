import Button from 'xedonium/Button'
import Divider from 'xedonium/Divider'
import SettingsIcon from 'xedonium/icons/Settings'
import TextLink from 'xedonium/TextLink'
import ThemeToggle from 'xedonium/ThemeToggle'
import Container from 'xedonium/Container'
import Flex from 'xedonium/Flex'
import logo from '../../assets/logo.svg'

export default function Header({ health, containers, page, onOpenSettings, onOpenHome }) {
  const total = containers.length
  const running = containers.filter(c => c.status === 'running').length
  const outdated = containers.filter(c => c.update_status === 'update_available').length

  const connected = !!health?.docker_connected

  const divider = (cls = '') => <Divider orientation="vertical" className={`!h-5 !self-center ${cls}`} />

  return (
    <header className="sticky top-0 z-40 border-b border-app-border bg-app-bg/95 backdrop-blur">
      <Container as={Flex} maxWidth="max-w-[1400px]" align="center" gap={3} className="h-14 md:gap-5">

        {/* Logo */}
        <TextLink href="#/" onClick={e => { if (onOpenHome) { e.preventDefault(); onOpenHome() } }}
          className="flex shrink-0 items-center gap-2 !no-underline sm:gap-2.5" aria-label="DockRadar dashboard">
          <img src={logo} alt="" className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="text-[15px] font-semibold text-app-strong sm:text-base">DockRadar</span>
        </TextLink>

        {divider('hidden sm:block')}

        {/* Stat chips - "running" hides on mobile to save space */}
        <Flex align="center" gap={3} className="shrink-0 whitespace-nowrap text-sm sm:gap-5">
          <StatChip label="containers" value={total} />
          <StatChip label="running" value={running} className="hidden sm:flex" />
          {outdated > 0 && <StatChip label="outdated" value={outdated} warn />}
        </Flex>

        <div className="flex-1" />

        <Flex as="span" align="center" gap={2} className="shrink-0 text-[13px]"
          title={connected ? 'Docker connected' : 'Docker offline'}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`hidden sm:inline ${connected ? 'text-app-soft' : 'text-red-500'}`}>
            {connected ? 'Docker connected' : 'Docker offline'}
          </span>
        </Flex>

        {divider('hidden sm:block')}

        {onOpenSettings && (
          <Button variant="flat" onClick={onOpenSettings}
            aria-label="Settings" aria-current={page === 'settings' ? 'page' : undefined}
            tooltip="Settings"
            className={`!p-2 ${page === 'settings'
              ? '!bg-app-text/10 !text-app-text'
              : '!text-app-muted hover:!text-app-text'}`}>
            <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
          </Button>
        )}

        <ThemeToggle variant="toolbar" />
      </Container>
    </header>
  )
}

function StatChip({ label, value, warn, className = '' }) {
  return (
    <Flex as="span" align="center" gap={2} className={className}>
      <span className={`font-semibold tabular-nums ${warn ? 'text-amber-500' : 'text-app-text'}`}>{value}</span>
      <span className="text-app-muted whitespace-nowrap">{label}</span>
    </Flex>
  )
}
