from abc import ABC, abstractmethod
from datetime import date, timedelta

from app.analytics.types import (
    AnalyticsFilters,
    ReachResponse,
    ReachSummary,
    TimeSeriesPoint,
)

# ---- Abstract interface ----


class IAnalyticsRepository(ABC):
    @abstractmethod
    async def get_reach(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> ReachResponse: ...


# ---- Stub implementation ----
# Returns deterministic data derived from the same seeded algorithm as data.jsx.
# Replace with ExternalApiAnalyticsRepository once real APIs are available.

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Stub institution catalogue — mirrors the design's INSTITUTIONS list (seed, users).
_STUB_INSTITUTIONS: dict[str, dict] = {
    "zm01": {"seed": 11, "users": 1800},
    "zm02": {"seed": 18, "users": 950},
    "zm03": {"seed": 25, "users": 2100},
    "zm04": {"seed": 32, "users": 600},
    "zm05": {"seed": 39, "users": 2700},
}

_HISTORY_START = date(2025, 7, 1)


def _mulberry32(seed: int):
    """Port of the mulberry32 PRNG from data.jsx."""
    a = seed

    def _next() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((a ^ (a >> 15)) * (1 | a)) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return _next


def _build_daily_series(seed: int, start_cum: int, end_cum: int, start: date, end: date) -> list[dict]:
    rnd = _mulberry32(seed + 555)
    shock_rnd = _mulberry32(seed + 911)
    day_count = (end - start).days + 1

    shocks = [0.4 + shock_rnd() * 1.5 for _ in range((day_count // 30) + 2)]
    raw = []
    for k in range(day_count):
        d = start + timedelta(days=k)
        weekend = 0.5 if d.weekday() >= 5 else 1.0
        raw.append((1 + k * 0.003) * weekend * (0.6 + rnd() * 0.8) * shocks[k // 30])

    raw_sum = sum(raw) or 1
    target = max(end_cum - start_cum, day_count)
    cum = start_cum
    out = []
    rnd2 = _mulberry32(seed + 555)
    for k in range(day_count):
        d = start + timedelta(days=k)
        weekend = 0.6 if d.weekday() >= 5 else 1.0
        added = max(1, round(raw[k] / raw_sum * target))
        returning = round(added * (0.25 + rnd2() * 0.2))
        cum += added
        logins = max(added, round(cum * (0.05 + rnd2() * 0.04) * weekend))
        out.append({"date": d, "added": added, "new_users": added - returning, "returning": returning,
                    "cumulative": cum, "logins": logins})
    return out


def _rebin(daily: list[dict], start: date, end: date, granularity: str) -> list[TimeSeriesPoint]:
    in_range = [p for p in daily if start <= p["date"] <= end]
    if not in_range:
        return []

    if granularity == "day":
        return [
            TimeSeriesPoint(
                label=f"{p['date'].day} {_MONTHS[p['date'].month - 1]}",
                cumulative=p["cumulative"],
                added=p["added"],
                new_users=p["new_users"],
                returning=p["returning"],
                logins=p["logins"],
            )
            for p in in_range
        ]

    groups: dict = {}
    for p in in_range:
        d = p["date"]
        if granularity == "week":
            # Monday of the week
            key = d - timedelta(days=d.weekday())
        else:
            key = date(d.year, d.month, 1)
        groups.setdefault(key, []).append(p)

    multi_year = in_range[0]["date"].year != in_range[-1]["date"].year
    points = []
    for key in sorted(groups):
        pts = groups[key]
        first = pts[0]["date"]
        if granularity == "week":
            label = f"{first.day} {_MONTHS[first.month - 1]}"
        else:
            label = _MONTHS[first.month - 1] + (f" '{str(first.year)[2:]}" if multi_year else "")
        points.append(TimeSeriesPoint(
            label=label,
            cumulative=pts[-1]["cumulative"],
            added=sum(p["added"] for p in pts),
            new_users=sum(p["new_users"] for p in pts),
            returning=sum(p["returning"] for p in pts),
            logins=sum(p["logins"] for p in pts),
        ))
    return points


def _inst_reach(inst_seed: int, total_users: int, start: date, end: date, granularity: str) -> tuple[list[TimeSeriesPoint], int, int, int]:
    """Returns (series, total_logins, active_users_30d, avg_session_minutes) for one institution."""
    rnd = _mulberry32(inst_seed)
    # Bootstrap cumulative from a monthly growth series (12 months)
    cum = round(total_users * 0.15)
    growth = round(total_users * 0.09)
    for i in range(12):
        add = round(growth * (0.7 + rnd() * 0.7) * (1 + i * 0.06))
        cum += add
    start_cum = round(total_users * 0.15)

    daily = _build_daily_series(inst_seed, start_cum, cum, _HISTORY_START, date(2026, 7, 7))
    series = _rebin(daily, start, end, granularity)

    rnd2 = _mulberry32(inst_seed + 7)
    total_logins = round(total_users * (2.1 + rnd2() * 1.4))
    active_users_30d = round(total_users * (0.52 + rnd2() * 0.22))
    avg_session_minutes = round(6 + rnd2() * 7)
    return series, total_logins, active_users_30d, avg_session_minutes


class StubAnalyticsRepository(IAnalyticsRepository):
    """
    Deterministic stub data matching the design's data.jsx algorithm.
    Swap for ExternalApiAnalyticsRepository once real APIs are available.
    """

    async def get_reach(self, institution_ids: list[str] | None, filters: AnalyticsFilters) -> ReachResponse:
        # Resolve which institutions to include
        if institution_ids is None:
            insts = list(_STUB_INSTITUTIONS.values())
        else:
            insts = [_STUB_INSTITUTIONS[i] for i in institution_ids if i in _STUB_INSTITUTIONS]
        if not insts:
            insts = list(_STUB_INSTITUTIONS.values())

        total_users = sum(i["users"] for i in insts)
        all_series: list[list[TimeSeriesPoint]] = []
        total_logins = 0
        active_users_30d = 0
        avg_session_sum = 0

        for inst in insts:
            series, t_logins, active, avg_sess = _inst_reach(
                inst["seed"], inst["users"], filters.start_date, filters.end_date, filters.granularity
            )
            all_series.append(series)
            total_logins += t_logins
            active_users_30d += active
            avg_session_sum += avg_sess

        # Merge series across institutions by summing per-label
        merged: dict[str, TimeSeriesPoint] = {}
        for series in all_series:
            for pt in series:
                if pt.label not in merged:
                    merged[pt.label] = pt
                else:
                    existing = merged[pt.label]
                    merged[pt.label] = TimeSeriesPoint(
                        label=pt.label,
                        cumulative=existing.cumulative + pt.cumulative,
                        added=existing.added + pt.added,
                        new_users=existing.new_users + pt.new_users,
                        returning=existing.returning + pt.returning,
                        logins=existing.logins + pt.logins,
                    )

        series_out = list(merged.values())
        avg_session_minutes = round(avg_session_sum / len(insts)) if insts else 0
        avg_logins = round(total_logins / total_users, 1) if total_users else 0.0

        return ReachResponse(
            summary=ReachSummary(
                total_users=total_users,
                active_users_30d=active_users_30d,
                total_logins=total_logins,
                avg_logins_per_user=avg_logins,
                avg_session_minutes=avg_session_minutes,
            ),
            series=series_out,
        )
