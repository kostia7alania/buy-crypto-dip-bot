# ADR 003 — Hono, Valibot, node:sqlite

## Decision

Use Hono for core API, Valibot for validation, and node:sqlite for MVP persistence.

## Context

We want a small, fast, modern TypeScript API without legacy framework overhead.

## Consequences

- No Express.
- No NestJS.
- No axios.
- No external SQLite driver in MVP.
