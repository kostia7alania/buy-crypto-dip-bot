#!/usr/bin/env python3
"""Exploratory annual BTC portfolio comparisons; no live execution."""

import csv
import hashlib
import json
import math
import statistics
import sys
from datetime import date, timedelta

BUDGET = 1200.0
ORDER = 100.0
FEE = 0.001  # illustrative, not an exchange fee quote
SLIPPAGE = 0.001  # adverse execution price, not a measured order-book spread
YEARS = range(2020, 2026)
THRESHOLDS = (0.02, 0.05, 0.07, 0.10, 0.15)


def load(path):
    raw = open(path, 'rb').read()
    digest = hashlib.sha256(raw).hexdigest()
    rows = list(csv.DictReader(raw.decode('utf-8').splitlines()))
    days = [date.fromisoformat(row['date_utc']) for row in rows]
    if any(b - a != timedelta(days=1) for a, b in zip(days, days[1:])):
        raise ValueError('Missing, duplicate, or unordered days')
    for row in rows:
        o, h, lo, c = (float(row[k]) for k in ('open', 'high', 'low', 'close'))
        if not all(math.isfinite(v) for v in (o, h, lo, c)) or min(o, h, lo, c) <= 0 or h < max(o, lo, c) or lo > min(o, h, c):
            raise ValueError('Invalid OHLC')
    return rows, days, digest


def signal(rows, index, kind, threshold):
    # Called at t+1: all rows used are closed by the preceding midnight.
    t = index - 1
    if t < 1:
        return False
    close = float(rows[t]['close'])
    if kind == 'one_day':
        return close <= float(rows[t - 1]['close']) * (1 - threshold)
    if t < 31:
        return False
    # Crossing down the threshold relative to the previous 30 closed prices,
    # evaluated independently at t and t-1 to avoid repeat buying every day.
    prior_peak = max(float(r['close']) for r in rows[t - 30:t])
    prev_peak = max(float(r['close']) for r in rows[t - 31:t - 1])
    prev_close = float(rows[t - 1]['close'])
    return close / prior_peak <= 1 - threshold and prev_close / prev_peak > 1 - threshold


def simulate(rows, days, year, kind, threshold=None, execution='open'):
    cash, btc, trades, blocked = BUDGET, 0.0, 0, 0
    top, worst_dd = BUDGET, 0.0
    year_indexes = [i for i, d in enumerate(days) if d.year == year]
    if len(year_indexes) != (date(year + 1, 1, 1) - date(year, 1, 1)).days:
        raise ValueError(f'Incomplete year {year}')
    for i in year_indexes:
        d, row = days[i], rows[i]
        buy = (kind == 'hold' and d.month == 1 and d.day == 1) or (
            kind == 'dca' and d.day == 1
        ) or (kind in ('one_day', 'cross_30d') and signal(rows, i, kind, threshold))
        if buy:
            amount = BUDGET if kind == 'hold' else ORDER
            if cash >= amount:
                # Entry after signal; the close sensitivity enters a full day later.
                price = float(row[execution]) * (1 + SLIPPAGE)
                btc += amount * (1 - FEE) / price
                cash -= amount
                trades += 1
            else:
                blocked += 1
        nav = cash + btc * float(row['close'])
        top = max(top, nav)
        worst_dd = min(worst_dd, nav / top - 1)
    end_value = cash + btc * float(rows[year_indexes[-1]]['close'])
    return {'roi_pct': (end_value / BUDGET - 1) * 100,
            'end_usd': end_value, 'cash_usd': cash, 'trades': trades,
            'blocked_signals': blocked, 'max_daily_dd_pct': worst_dd * 100}


def main(path):
    rows, days, sha = load(path)
    variants = [('hold', None), ('dca', None)] + [
        (kind, threshold) for kind in ('one_day', 'cross_30d') for threshold in THRESHOLDS
    ]
    results = {}
    for kind, threshold in variants:
        name = kind if threshold is None else f'{kind}_{int(threshold * 100):02d}'
        results[name] = {str(y): simulate(rows, days, y, kind, threshold) for y in YEARS}
    candidate_names = [n for n in results if n not in ('hold', 'dca')]
    walk_forward = {}
    for test_year in (2023, 2024, 2025):
        train = range(test_year - 3, test_year)
        # Equal weight to annual ROI; deterministic name ordering breaks ties.
        ranked = sorted(candidate_names, key=lambda n: (
            -statistics.mean(results[n][str(y)]['roi_pct'] for y in train), n
        ))
        winner = ranked[0]
        kind, number = winner.rsplit('_', 1)
        walk_forward[str(test_year)] = {
            'train_years': list(train), 'selected': winner,
            'train_mean_roi_pct': statistics.mean(results[winner][str(y)]['roi_pct'] for y in train),
            'test': results[winner][str(test_year)],
            'test_later_close_sensitivity': simulate(rows, days, test_year, kind, int(number) / 100, 'close'),
        }
    print(json.dumps({'sha256': sha, 'walk_forward': walk_forward, 'results': results},
                     indent=2, sort_keys=True))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/research/btc_dip_portfolio.py PATH_TO_CSV')
    main(sys.argv[1])
