#!/usr/bin/env python3
"""Exploratory daily close study; no claim of profit or forecast skill."""
import csv
import hashlib
import statistics
import sys
from collections import defaultdict
from datetime import date, timedelta

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/research/btc_daily_dip.py PATH_TO_CSV')
path = sys.argv[1]
with open(path, 'rb') as f:
    data = f.read()
print('SHA256:', hashlib.sha256(data).hexdigest())
rows = list(csv.DictReader(data.decode('utf-8').splitlines()))
days = [date.fromisoformat(row['date_utc']) for row in rows]
assert all(b - a == timedelta(days=1) for a, b in zip(days, days[1:]))
for row in rows:
    o, h, l, c = (float(row[k]) for k in ('open', 'high', 'low', 'close'))
    assert min(o, h, l, c) > 0 and h >= max(o, l, c) and l <= min(o, h, c)
values = defaultdict(lambda: [[], []])
for i in range(1, len(rows) - 1):
    year = days[i].year
    if not 2020 <= year <= 2025:
        continue
    previous, current, following = (float(rows[j]['close']) for j in (i - 1, i, i + 1))
    next_return = (following / current - 1) * 100
    values[year][0].append(next_return)
    if current / previous - 1 <= -0.05:
        values[year][1].append(next_return)
print('year,all_n,all_mean_pct,all_median_pct,dip_n,dip_mean_pct,dip_median_pct')
for year, (all_days, dip_days) in sorted(values.items()):
    print(f'{year},{len(all_days)},{statistics.mean(all_days):.6f},{statistics.median(all_days):.6f},'
          f'{len(dip_days)},{statistics.mean(dip_days):.6f},{statistics.median(dip_days):.6f}')
