#!/usr/bin/env python3
"""Compare a price baseline with FOMC calendar and decision indicators."""

import json
import statistics
import sys
from datetime import date

from btc_dip_portfolio import load


# Announcement dates, not the (usually next-day) rate effective dates.
# https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
# https://www.federalreserve.gov/FOMC/fundsrate.htm
ANNOUNCEMENTS = {
    "2022-01-26": 0, "2022-03-16": 25, "2022-05-04": 50, "2022-06-15": 75,
    "2022-07-27": 75, "2022-09-21": 75, "2022-11-02": 75, "2022-12-14": 50,
    "2023-02-01": 25, "2023-03-22": 25, "2023-05-03": 25, "2023-06-14": 0,
    "2023-07-26": 25, "2023-09-20": 0, "2023-11-01": 0, "2023-12-13": 0,
    "2024-01-31": 0, "2024-03-20": 0, "2024-05-01": 0, "2024-06-12": 0,
    "2024-07-31": 0, "2024-09-18": -50, "2024-11-07": -25, "2024-12-18": -25,
    "2025-01-29": 0, "2025-03-19": 0, "2025-05-07": 0, "2025-06-18": 0,
    "2025-07-30": 0, "2025-09-17": -25, "2025-10-29": -25, "2025-12-10": -25,
}
EVENTS = {date.fromisoformat(day): change for day, change in ANNOUNCEMENTS.items()}
VALIDATION_YEARS = (2024, 2025)
MOVE = 0.03
PRIOR_OBSERVATIONS = 8


def observations(rows, days, use_decision):
    closes = [float(row["close"]) for row in rows]
    returns = [0.0] + [after / before - 1 for before, after in zip(closes, closes[1:])]
    for index in range(21 + use_decision, len(days)):
        day = days[index]
        if not 2022 <= day.year <= 2025:
            continue
        # The calendar forecast runs before the statement; the decision forecast
        # runs after the announcement day's UTC close and predicts the next day.
        last_close = index - 1
        event_day = days[last_close] if use_decision else day
        action = EVENTS.get(event_day)
        event = None if action is None else ("change" if action else "hold")
        vol = statistics.mean(abs(r) for r in returns[last_close - 19:last_close + 1])
        yield day, vol >= 0.02, event, returns[index]


def evaluate(records, use_decision, target):
    scored = []
    for year in VALIDATION_YEARS:
        training = [r for r in records if r[0].year < year]
        for day, high_vol, event, actual in records:
            if event is None or day.year != year:
                continue
            matches = [r for r in training if r[1] == high_vol]
            ordinary = [target(r[3]) for r in matches if r[0].weekday() == day.weekday()]
            if not ordinary:
                raise ValueError(f"No price baseline for {day}")
            price_only = (sum(ordinary) + 1) / (len(ordinary) + 2)
            calendar_events = [target(r[3]) for r in matches if r[2] is not None]
            calendar = (sum(calendar_events) + PRIOR_OBSERVATIONS * price_only) / (
                len(calendar_events) + PRIOR_OBSERVATIONS
            )
            comparable_events = [
                target(r[3]) for r in matches
                if r[2] == event
            ]
            decision = (sum(comparable_events) + PRIOR_OBSERVATIONS * price_only) / (
                len(comparable_events) + PRIOR_OBSERVATIONS
            )
            scored.append((year, target(actual), price_only, calendar, decision))

    def summary(sample):
        scores = {
            "days": len(sample),
            "positive_cases": sum(row[1] for row in sample),
            "price_only_brier": statistics.mean((r[1] - r[2]) ** 2 for r in sample),
            "with_calendar_brier": statistics.mean((r[1] - r[3]) ** 2 for r in sample),
        }
        if use_decision:
            scores["with_decision_brier"] = statistics.mean((r[1] - r[4]) ** 2 for r in sample)
        return scores

    return {
        str(year): summary([r for r in scored if r[0] == year])
        for year in VALIDATION_YEARS
    } | {"combined": summary(scored)}


def main(path):
    rows, days, checksum = load(path)
    missing = set(EVENTS).difference(days)
    if missing or any(date(year, 12, 31) not in days for year in range(2022, 2026)):
        raise ValueError("Incomplete price data for the FOMC comparison")
    result = {"sha256": checksum}
    for use_decision, label in [(False, "announcement_day"), (True, "day_after_decision")]:
        records = list(observations(rows, days, use_decision))
        result[label] = {
            "down_3pct": evaluate(records, use_decision, lambda r: r <= -MOVE),
            "move_3pct": evaluate(records, use_decision, lambda r: abs(r) >= MOVE),
        }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/research/btc_fomc_check.py PATH_TO_CSV")
    main(sys.argv[1])
