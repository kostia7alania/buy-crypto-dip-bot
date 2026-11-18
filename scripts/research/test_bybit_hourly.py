"""Offline contract checks. All input prices and trades here are synthetic."""

import csv
import gzip
import io
import json
import tempfile
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import fetch_bybit_hourly as bybit


class KlineTests(unittest.TestCase):
    def test_page_boundaries_and_chronology(self):
        calls = []

        def fetch(url, timeout):
            query = parse_qs(urlsplit(url).query)
            self.assertEqual((query["category"], query["symbol"], query["interval"]), (["spot"], ["BTCUSDT"], ["60"]))
            start, end = int(query["start"][0]), int(query["end"][0])
            calls.append((start, end))
            rows = [[str(ts), "10", "11", "8", "9", "1", "9"] for ts in range(start, end + 1, bybit.HOUR_MS)]
            payload = {"retCode": 0, "result": {"category": "spot", "symbol": "BTCUSDT", "list": rows[::-1]}}
            return io.BytesIO(json.dumps(payload).encode())

        stop = 1001 * bybit.HOUR_MS
        with patch.object(bybit, "urlopen", side_effect=fetch):
            result = list(bybit.candles(0, stop))
        boundary = 1000 * bybit.HOUR_MS
        self.assertEqual(calls, [(0, boundary - 1), (boundary, stop - 1)])
        self.assertEqual(len(result), 1001)
        self.assertEqual([row[0] for row in result], sorted(row[0] for row in result))

    def test_rejects_wrong_market_missing_duplicate_or_invalid_candle(self):
        row = ["0", "10", "11", "8", "9", "1", "9"]
        for category, rows in [
            ("linear", [row]), ("spot", []), ("spot", [row, row]),
            ("spot", [["0", "10", "7", "8", "9", "1", "9"]]),
            ("spot", [["0", "NaN", "11", "8", "9", "1", "9"]]),
        ]:
            with self.subTest(category=category, rows=rows):
                payload = {"retCode": 0, "result": {"category": category, "symbol": "BTCUSDT", "list": rows}}
                with patch.object(bybit, "urlopen", return_value=io.BytesIO(json.dumps(payload).encode())):
                    with self.assertRaises(ValueError):
                        list(bybit.candles(0, bybit.HOUR_MS))


class TradeArchiveTests(unittest.TestCase):
    def setUp(self):
        self.day = date(2025, 9, 14)
        self.start = bybit.timestamp(self.day)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.path = self.directory / f"BTCUSDT_{self.day}.csv.gz"
        self.rows = [
            (hour + 1, self.start + hour * bybit.HOUR_MS, "10", "0.1", "buy")
            for hour in range(24)
        ]

    def write(self, rows, header=("id", "timestamp", "price", "volume", "side")):
        with gzip.open(self.path, "wt", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(rows)

    def read(self):
        return list(bybit.archive_candles(self.directory, self.day, self.day + timedelta(days=1)))

    def test_computes_ohlcv_in_publisher_order_on_tied_timestamps(self):
        self.rows[1:1] = [
            (25, self.start, "12", "0.2", "sell"),
            (26, self.start, "8", "0.3", "buy"),
            (27, self.start + bybit.HOUR_MS - 1, "11", "0.4", "buy"),
        ]
        self.write(self.rows)
        result = self.read()
        self.assertEqual(len(result), 24)
        self.assertEqual(result[0], ("2025-09-14T00:00:00+00:00", 10, 12, 8, 11, Decimal("1")))
        self.assertEqual(result[-1][0], "2025-09-14T23:00:00+00:00")

    def test_refuses_invalid_inputs_and_incomplete_or_truncated_files(self):
        for rows in (self.rows[:-1], self.rows + self.rows[:1], [self.rows[0], *self.rows],
                     self.rows + [(25, self.start + 24 * bybit.HOUR_MS, "10", "1", "buy")],
                     [(1, self.start, "NaN", "1", "buy"), *self.rows[1:]]):
            with self.subTest(first=rows[0], last=rows[-1], count=len(rows)):
                self.write(rows)
                with self.assertRaises(ValueError):
                    self.read()
        self.write([], header=("timestamp", "symbol", "side", "size", "price"))
        with self.assertRaisesRegex(ValueError, "spot trade header"):
            self.read()
        self.write(self.rows)
        self.path.write_bytes(self.path.read_bytes()[:-8])
        with self.assertRaises(EOFError):
            self.read()
