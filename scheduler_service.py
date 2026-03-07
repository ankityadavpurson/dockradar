"""
DockRadar - Scheduler Service
Manages periodic background scans using APScheduler.
"""

import logging
from typing import Callable, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import config

logger = logging.getLogger(__name__)

JOB_ID = "dockradar_scan"


class SchedulerService:
    """Manages the periodic scan schedule."""

    def __init__(self):
        self._scheduler = BackgroundScheduler(
            job_defaults={"coalesce": True, "max_instances": 1}
        )
        self._scan_callback: Optional[Callable] = None

    def start(self, scan_callback: Callable):
        """Start the scheduler with the given scan callback."""
        self._scan_callback = scan_callback

        self._scheduler.add_job(
            func=self._run_scan,
            trigger=IntervalTrigger(hours=config.SCAN_INTERVAL_HOURS),
            id=JOB_ID,
            replace_existing=True,
            name="DockRadar Periodic Scan",
        )

        self._scheduler.start()
        logger.info(
            "Scheduler started — scanning every %d hour(s).",
            config.SCAN_INTERVAL_HOURS,
        )

    def stop(self):
        """Stop the scheduler gracefully."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("Scheduler stopped.")

    def update_interval(self, hours: int):
        """Dynamically update the scan interval."""
        if hours < 1:
            hours = 1
        self._scheduler.reschedule_job(
            JOB_ID, trigger=IntervalTrigger(hours=hours)
        )
        logger.info("Scan interval updated to %d hour(s).", hours)

    def get_next_run(self) -> Optional[str]:
        """Return the next scheduled run time as a formatted string."""
        try:
            job = self._scheduler.get_job(JOB_ID)
            if job and job.next_run_time:
                return job.next_run_time.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
        return None

    def is_running(self) -> bool:
        return self._scheduler.running

    def _run_scan(self):
        """Internal wrapper that calls the registered scan callback."""
        logger.info("Scheduled scan triggered.")
        if self._scan_callback:
            try:
                self._scan_callback()
            except Exception as exc:
                logger.error("Error during scheduled scan: %s", exc)
