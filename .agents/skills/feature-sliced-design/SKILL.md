---
name: feature-sliced-design
description: Guidelines and architecture constraints for implementing Feature-Sliced Design (FSD-lite) in frontend applications.
---

# Feature-Sliced Design (FSD-Lite) Guidelines

This skill enforces FSD-lite architecture principles on the frontend repository, ensuring scalability, clarity, and strict dependency rules.

## Core Layers (Top to Bottom)

1. **app/** — Global entrypoint, providers, and styles.
2. **pages/** — Pages and routes. Contains only composition logic.
3. **widgets/** — Independent page sections composed of features and entities (e.g. `OrderLedgerWidget`).
4. **features/** — User interactions with business value (e.g. `ToggleStrategy`, `AddCustomPair`).
5. **entities/** — Business domain units (e.g. `StrategyCard`, `OrderRow`, `AuditItem`).
6. **shared/** — Reusable tech-agnostic pieces (e.g. UI components like `UiButton`, `UiSwitch`, API clients, config).

## The Strict Dependency Rule
* **One-Way Downward Imports:** A layer can only import from layers strictly BELOW it.
  * e.g., `features` can import from `entities` and `shared`, but NEVER from `widgets` or `pages`.
  * Cross-imports within the same layer are allowed if they are from different slices (but should be minimized).
  * Circular dependencies are strictly forbidden.

## Public API (`index.ts`)
Each slice must expose its components/logic via an `index.ts` file located at its root directory. Higher layers must ONLY import from this public API, not deep inside the slice.
* **Good:** `import { StrategyCard } from '@/entities/strategy'`
* **Bad:** `import StrategyCard from '@/entities/strategy/ui/StrategyCard.vue'`
