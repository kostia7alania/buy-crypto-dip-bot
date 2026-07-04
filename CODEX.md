# CODEX.md

Read `AGENTS.md` first.

Then read:

- `docs/00_CONTEXT.md`
- `docs/01_PRODUCT_SPEC.md`
- `docs/02_ARCHITECTURE.md`
- `docs/04_RISK_POLICY.md`
- `docs/11_AGENT_WORKFLOW.md`
- `CODEX_TASK_0.md` for the initial scaffold task

## Local Codex rules

- Work in small steps.
- Produce a short plan before edits.
- Keep changes scoped to the task.
- Do not add legacy folders: `controllers`, `services`, `models`, `utils`, `helpers`.
- Do not enable live trading.
- Do not implement private exchange trading in the scaffold task.
- Do not introduce secrets.
- Do not add futures, leverage, martingale, withdrawals, or meme coins.
- Prefer modern 2026 stack from `AGENTS.md`.

Before finishing, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
