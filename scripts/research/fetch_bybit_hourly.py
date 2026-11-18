#!/usr/bin/env python3
"""Download completed Bybit BTCUSDT spot hours and write CSV on stdout."""

import argparse
import csv
import gzip
import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ENDPOINT = "https://api.bybit.com/v5/market/kline"
HOUR_MS = 3_600_000
PAGE_SIZE = 1_000


def timestamp(day):
    return int(datetime.combine(day, time(), tzinfo=timezone.utc).timestamp()) * 1000


def candles(start, stop):
    for begin in range(start, stop, PAGE_SIZE * HOUR_MS):
        end = min(begin + PAGE_SIZE * HOUR_MS, stop)
        query = urlencode({
            "category": "spot",
            "symbol": "BTCUSDT",
            "interval": "60",
            "limit": PAGE_SIZE,
            "start": begin,
            "end": end - 1,
        })
        with urlopen(f"{ENDPOINT}?{query}", timeout=15) as response:
            payload = json.load(response)
        result = payload.get("result", {})
        if payload.get("retCode") != 0 or result.get("category") != "spot" or result.get("symbol") != "BTCUSDT":
            raise ValueError(f"Unexpected response from Bybit: {payload.get('retMsg', 'unknown error')}")
        rows = sorted(result["list"], key=lambda row: int(row[0]))
        if [int(row[0]) for row in rows] != list(range(begin, end, HOUR_MS)):
            raise ValueError(f"Bybit returned incomplete hourly coverage after {begin}")
        for ts, opened, high, low, close, volume, _ in rows:
            try:
                open_price, high_price, low_price, close_price, size = map(Decimal, (opened, high, low, close, volume))
                valid = (
                    all(value.is_finite() for value in (open_price, high_price, low_price, close_price, size))
                    and 0 < low_price <= min(open_price, close_price) <= max(open_price, close_price) <= high_price
                    and size >= 0
                )
            except (TypeError, InvalidOperation):
                valid = False
            if not valid:
                raise ValueError(f"Bybit returned invalid spot OHLCV at {ts}")
            utc = datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc)
            yield (utc.isoformat(), opened, high, low, close, volume)


def archive_candles(directory, first_day, stop_day):
    """Aggregate complete daily BTCUSDT spot trade files in publisher row order."""
    day = first_day
    while day < stop_day:
        path = directory / f"BTCUSDT_{day}.csv.gz"
        start = timestamp(day)
        hours = {}
        last_ts = None
        ids_at_timestamp = set()
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as trades:
            reader = csv.DictReader(trades)
            if not {"id", "timestamp", "price", "volume", "side"}.issubset(reader.fieldnames or ()):
                raise ValueError(f"{path.name} has no expected spot trade header")
            for row in reader:
                try:
                    ts = int(row["timestamp"])
                    price, size = Decimal(row["price"]), Decimal(row["volume"])
                    if not price.is_finite() or not size.is_finite() or min(price, size) <= 0:
                        raise ValueError("expected a finite positive price and volume")
                except (ValueError, InvalidOperation, TypeError) as error:
                    raise ValueError(f"{path.name} line {reader.line_num}: {error}") from error
                hour = (ts - start) // HOUR_MS
                if not 0 <= hour < 24 or (last_ts is not None and ts < last_ts):
                    raise ValueError(f"{path.name} line {reader.line_num}: unexpected timestamp {ts}")
                if last_ts != ts:
                    ids_at_timestamp.clear()
                if not row["id"] or row["id"] in ids_at_timestamp:
                    raise ValueError(f"{path.name} line {reader.line_num}: missing or repeated trade ID at {ts}")
                ids_at_timestamp.add(row["id"])
                last_ts = ts
                if hour in hours:
                    opened, high, low, _, total = hours[hour]
                    hours[hour] = (opened, max(high, price), min(low, price), price, total + size)
                else:
                    hours[hour] = (price, price, price, price, size)
        if len(hours) != 24:
            raise ValueError(f"{path.name}: trades cover {len(hours)} of 24 UTC hours")
        for hour, values in sorted(hours.items()):
            utc = datetime.fromtimestamp((start + hour * HOUR_MS) / 1000, tz=timezone.utc)
            yield (utc.isoformat(), *values)
        day += timedelta(days=1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("start", type=date.fromisoformat)
    parser.add_argument("end", type=date.fromisoformat, help="Exclusive UTC date")
    parser.add_argument("--archive-dir", type=Path, help="Read daily public Bybit spot .csv.gz files from this directory")
    args = parser.parse_args()
    if not args.start < args.end <= datetime.now(timezone.utc).date():
        parser.error("Expected START < END <= today's UTC date")
    try:
        if args.archive_dir is None:
            rows = list(candles(timestamp(args.start), timestamp(args.end)))
        else:
            rows = list(archive_candles(args.archive_dir, args.start, args.end))
    except (OSError, EOFError, ValueError, csv.Error) as error:
        parser.exit(1, f"Bybit data unavailable: {error}\n")
    writer = csv.writer(sys.stdout)
    writer.writerow(("timestamp", "open", "high", "low", "close", "volume"))
    writer.writerows(rows)
