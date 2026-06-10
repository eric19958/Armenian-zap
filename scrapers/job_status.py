"""
Inch Ka · scrape job status (file-backed, for admin UI polling).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

JOBS_FILE = Path(__file__).resolve().parent / ".scrape_jobs.json"
LOG_DIR = Path(__file__).resolve().parent / ".logs"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read() -> dict:
    if not JOBS_FILE.exists():
        return {}
    try:
        return json.loads(JOBS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write(data: dict) -> None:
    JOBS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_all() -> dict:
    return _read()


def get(slug: str) -> dict | None:
    return _read().get(slug)


def log_tail(slug: str, lines: int = 25) -> list[str]:
    path = LOG_DIR / f"{slug}.log"
    if not path.exists():
        return []
    try:
        content = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return content[-lines:]
    except OSError:
        return []


def _pid_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        import os

        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _last_activity_ts(row: dict, slug: str) -> float:
    """Unix timestamp of last known scrape activity."""
    updated = row.get("updated_at") or row.get("started_at")
    if updated:
        try:
            return datetime.fromisoformat(str(updated).replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    log_path = LOG_DIR / f"{slug}.log"
    try:
        return log_path.stat().st_mtime
    except OSError:
        return 0.0


def active_scrapes() -> list[tuple[str, dict]]:
    """Return jobs that are running with a live process."""
    active: list[tuple[str, dict]] = []
    for slug, row in _read().items():
        if row.get("status") != "running":
            continue
        pid = row.get("pid")
        if pid is None or not _pid_alive(int(pid)):
            continue
        active.append((slug, row))
    return active


def reconcile_stale_jobs(max_idle_minutes: int = 45) -> None:
    """Mark running jobs stale when the process died or stopped making progress."""
    data = _read()
    changed = False
    now = datetime.now(timezone.utc).timestamp()
    for slug, row in list(data.items()):
        if row.get("status") != "running":
            continue
        pid = row.get("pid")
        if pid is not None and not _pid_alive(int(pid)):
            reason = "Scrape process stopped (crashed or was killed)"
        else:
            idle_sec = now - _last_activity_ts(row, slug)
            if idle_sec < max_idle_minutes * 60:
                continue
            reason = f"No progress for {max_idle_minutes}+ minutes (likely hung on Firecrawl)"
            if pid is not None and _pid_alive(int(pid)):
                try:
                    import os
                    os.kill(int(pid), 9)
                except OSError:
                    pass
        row.update({
            "status": "error",
            "phase": "error",
            "finished_at": _now(),
            "error": reason,
            "pid": None,
            "message": "Scrape stopped — restart from admin",
        })
        data[slug] = row
        changed = True
    if changed:
        _write(data)


def set_running(
    slug: str,
    *,
    pid: int | None = None,
    category_total: int = 0,
) -> None:
    data = _read()
    data[slug] = {
        "status": "running",
        "phase": "starting",
        "started_at": _now(),
        "finished_at": None,
        "offers": None,
        "error": None,
        "pid": pid,
        "category_index": 0,
        "category_total": category_total,
        "category_url": "",
        "page": 0,
        "raw_collected": 0,
        "upserted": 0,
        "total_offers": 0,
        "progress_pct": 0,
        "message": "Starting scrape…",
        "updated_at": _now(),
    }
    _write(data)


def update_progress(slug: str, **fields) -> None:
    data = _read()
    row = data.get(slug)
    if not row or row.get("status") != "running":
        return
    row.update(fields)
    row["updated_at"] = _now()
    data[slug] = row
    _write(data)


def set_done(slug: str, offers: int) -> None:
    data = _read()
    row = data.get(slug, {})
    row.update({
        "status": "done",
        "phase": "done",
        "finished_at": _now(),
        "offers": offers,
        "error": None,
        "pid": None,
        "progress_pct": 100,
        "message": f"Done — {offers} offers saved",
    })
    data[slug] = row
    _write(data)


def set_error(slug: str, message: str) -> None:
    data = _read()
    row = data.get(slug, {})
    row.update({
        "status": "error",
        "phase": "error",
        "finished_at": _now(),
        "error": message[:500],
        "pid": None,
        "message": message[:200],
    })
    data[slug] = row
    _write(data)
