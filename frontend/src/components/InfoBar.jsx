import ClockIcon from 'xedonium/icons/Clock'
import Divider from 'xedonium/Divider'
import Flex from 'xedonium/Flex'
import HistoryIcon from 'xedonium/icons/History'
import TimerIcon from 'xedonium/icons/Timer'

/** "3m ago" style age for a past ISO timestamp; null → 'never'. */
function timeAgo(iso) {
  if (!iso) return 'never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'never'
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** "in 5h 12m" style countdown to a future date. */
function timeUntil(date) {
  const mins = Math.round((date.getTime() - Date.now()) / 60000)
  if (mins <= 0) return 'soon'
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return mins % 60 ? `in ${hours}h ${mins % 60}m` : `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

export default function InfoBar({ health, scanStatus }) {
  if (!health) return null

  const lastScan = timeAgo(health.last_scan)

  // scanStatus only exists once a scan has been polled - fall back to the
  // health endpoint, which also reports the next scheduled run.
  const nextRaw = scanStatus?.next_scan ?? health.next_scan
  const nextScan = nextRaw ? new Date(nextRaw) : null
  const showNext = !!health.docker_connected && nextScan && !Number.isNaN(nextScan.getTime())

  return (
    <Flex align="center" wrap gap={1} className="mb-3 gap-x-4 px-4 py-2 text-[13px] text-app-muted">

      <Flex as="span" align="center" gap={2}>
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        Scans every <span className="font-semibold text-app-text">{health.scan_interval_hours}h</span>
      </Flex>

      <Divider orientation="vertical" className="hidden !h-4 !self-center sm:block" />

      <Flex as="span" align="center" gap={2}
        title={health.last_scan ? new Date(health.last_scan).toLocaleString() : undefined}>
        <HistoryIcon className="h-3.5 w-3.5 shrink-0" />
        Last scan{' '}
        <span className={`font-semibold ${health.last_scan ? 'text-app-text' : 'text-app-muted'}`}>{lastScan}</span>
      </Flex>

      {showNext && (<>
        <Divider orientation="vertical" className="hidden !h-4 !self-center sm:block" />

        <Flex as="span" align="center" gap={2} title={nextScan.toLocaleString()}>
          <TimerIcon className="h-3.5 w-3.5 shrink-0" />
          Next scan <span className="font-semibold text-app-text">{timeUntil(nextScan)}</span>
        </Flex>
      </>)}
    </Flex>
  )
}
