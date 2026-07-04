# Task 03 — Strategy Engine

Implement pure dip strategy logic.

Rules:

- DROP_FROM_24H_HIGH
- DROP_FROM_PREVIOUS_DAILY_CLOSE
- DROP_FROM_ROLLING_HIGH
- FLASH_CRASH later

Tests:

- no signal below threshold
- signal above threshold
- exact threshold
- multiple rules
- invalid config
