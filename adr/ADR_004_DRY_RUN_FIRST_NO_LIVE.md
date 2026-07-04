# ADR 004 — Dry-run first, no live trading in MVP

## Decision

MVP creates dry-run orders only.

## Context

Trading automation can amplify bad decisions. Safety must be proven before touching money.

## Consequences

- RiskGuard rejects live trading by default.
- No private exchange integration in Task 0.
- No live order endpoint in Task 0.
