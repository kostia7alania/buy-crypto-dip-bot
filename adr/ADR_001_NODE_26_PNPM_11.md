# ADR 001 — Node 26.4.0 and pnpm 11

## Decision

Use Node.js 26.4.0 and pnpm 11.

## Context

The project is AI-first and should start on the latest checked Node Current version.

## Consequences

- Modern runtime features.
- `node:sqlite` available for MVP.
- Agents must use `.node-version` / `.nvmrc`.
- No downgrade notes in project docs.
