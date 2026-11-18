#!/usr/bin/env python3
"""Research-only comparison of BTC/USD dip rules on historical hourly OHLC."""

import csv
import hashlib
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import NamedTuple


class Candle(NamedTuple):
    time: datetime
    open: float
    high: float
    low: float
    close: float


HOUR = timedelta(hours=1)
START_CASH = 900
ORDER = 100
FEE = 0.001
THRESHOLDS = (2, 5, 7, 10, 15)
YEARS = (2023, 2024, 2025)


def load(path):
    raw = Path(path).read_bytes()
    candles, gaps = [], []
    for row in csv.DictReader(raw.decode("utf-8").splitlines()):
        parsed = datetime.fromisoformat(row.get("Date") or row["timestamp"])
        prices = [float(row.get(name) or row[name.lower()]) for name in ("Open", "High", "Low", "Close")]
        candle = Candle(parsed, *prices)
        if parsed.utcoffset() != timedelta(0) or parsed.minute or parsed.second or parsed.microsecond:
            raise ValueError(f"Expected an hourly UTC timestamp: {parsed}")
        if not all(math.isfinite(p) and p > 0 for p in prices):
            raise ValueError(f"Nonpositive or invalid price: {parsed}")
        if candle.low > min(candle.open, candle.close) or candle.high < max(candle.open, candle.close):
            raise ValueError(f"Inconsistent OHLC: {parsed}")
        if candles:
            elapsed = parsed - candles[-1].time
            if elapsed < HOUR:
                raise ValueError(f"Duplicate or unordered hour: {parsed}")
            if elapsed > HOUR:
                gaps.append({"after": candles[-1].time.isoformat(), "hours": elapsed // HOUR - 1})
        candles.append(candle)
    return candles, gaps, hashlib.sha256(raw).hexdigest()


def drops(candles):
    high_drops, close_drops = [None] * 24, [None] * 24
    for index in range(24, len(candles)):
        if candles[index].time - candles[index - 24].time != 24 * HOUR:
            high_drops.append(None)
            close_drops.append(None)
            continue
        close = candles[index].close
        high = max(candle.high for candle in candles[index - 24:index])
        high_drops.append((1 - close / high) * 100)
        close_drops.append((1 - close / candles[index - 24].close) * 100)
    return {"prior_24h_high": high_drops, "24h_close_to_close": close_drops}


def crossings(candles, dip, threshold, first, last):
    """Signal uses t's close. Entry uses the open of t+2, a full hour later."""
    entries = set()
    previous_entry = candles[first].time - 24 * HOUR
    for index in range(first, last + 1):
        known = index - 2
        previous, current = dip[known - 1:known + 1]
        time = candles[index].time
        if current is None or previous is None or time - candles[known].time != 2 * HOUR:
            continue
        if previous < threshold <= current and time - previous_entry >= 24 * HOUR:
            entries.add(index)
            previous_entry = time
    return entries


def simulate(candles, first, last, entries, slip, order=ORDER):
    cash, btc, buys = START_CASH, 0.0, 0
    peak, max_drawdown = START_CASH, 0.0
    for index in range(first, last + 1):
        candle = candles[index]
        if index in entries and cash >= order:
            btc += order * (1 - FEE) / (candle.open * (1 + slip))
            cash -= order
            buys += 1
        value = cash + btc * candle.close
        peak = max(peak, value)
        max_drawdown = min(max_drawdown, (value / peak - 1) * 100)
    return {
        "roi_pct": (value / START_CASH - 1) * 100,
        "drawdown_pct": max_drawdown,
        "cash": cash,
        "buys": buys,
        "eligible_entries": len(entries),
    }


def compare(path):
    candles, gaps, checksum = load(path)
    indexes = {candle.time: i for i, candle in enumerate(candles)}
    dip_measures = drops(candles)
    results = {}
    for year in YEARS:
        def hour(date, time=0):
            return datetime(year, *date, time, tzinfo=timezone.utc)

        first = indexes[hour((1, 2))]
        last = indexes[hour((9, 14), 23)]
        if first < 27:
            raise ValueError("Insufficient warmup before first portfolio window")
        dca = {indexes[hour((month, 2))] for month in range(1, 10)}
        strategies = {"dca": dca, "hold": {first}}
        for measure, series in dip_measures.items():
            for threshold in THRESHOLDS:
                strategies[f"{measure}_{threshold}"] = crossings(candles, series, threshold, first, last)
        results[str(year)] = {}
        for name, entries in strategies.items():
            order = START_CASH if name == "hold" else ORDER
            entry = simulate(candles, first, last, entries, 0.001, order)
            entry["high_cost_roi_pct"] = simulate(candles, first, last, entries, 0.003, order)["roi_pct"]
            results[str(year)][name] = entry
    return {
        "sha256": checksum,
        "range": [candles[0].time.isoformat(), candles[-1].time.isoformat()],
        "rows": len(candles),
        "gaps": gaps,
        "results": results,
    }


def compare_feeds(left, right):
    left_candles, _, left_hash = load(left)
    right_candles, _, right_hash = load(right)
    right_by_time = {candle.time: candle for candle in right_candles}
    per_year = defaultdict(lambda: {"overlap": 0, "equal_ohlc": 0, "equal_close": 0})
    for left_candle in left_candles:
        right_candle = right_by_time.get(left_candle.time)
        if right_candle is None:
            continue
        sample = per_year[left_candle.time.year]
        sample["overlap"] += 1
        sample["equal_ohlc"] += left_candle == right_candle
        sample["equal_close"] += left_candle.close == right_candle.close
    return {"sha256": [left_hash, right_hash], "years": dict(per_year)}


if __name__ == "__main__":
    if len(sys.argv) == 2:
        result = compare(sys.argv[1])
    elif len(sys.argv) == 3:
        result = compare_feeds(*sys.argv[1:])
    else:
        raise SystemExit("Usage: python3 scripts/research/btc_hourly_dip.py CSV [SECOND_CSV]")
    print(json.dumps(result, indent=2))
