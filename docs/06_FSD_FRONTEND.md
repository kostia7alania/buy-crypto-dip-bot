# Frontend structure

Nuxt 4 application code lives in `apps/web/app`: pages compose widgets;
features implement user actions; entities hold domain contracts; shared holds
reusable technical/UI pieces. Higher layers import lower layers through each
slice's `index.ts`. Follow `.agents/skills/feature-sliced-design/SKILL.md`.

Use Vue Composition API and `<script setup lang="ts">`. Capture `defineProps`
as `props` and `defineEmits` as `emit`, and access both explicitly. Preserve
Safety Ledger tokens and semantic loading/error/unknown states.

The recovery fixes private cache clearing in TelegramLoginWidget and remounts
account-owned dashboard content by authoritative identity. Remote main uses
one dashboard snapshot; its integration must keep the same isolation behavior.
See [architecture](02_ARCHITECTURE.md) and [design system](15_DESIGN_SYSTEM.md).
