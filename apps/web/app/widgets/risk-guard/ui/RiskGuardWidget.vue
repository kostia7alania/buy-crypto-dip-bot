<template>
  <section class="risk-guard">
    <header class="risk-guard__header">
      <div>
        <p class="risk-guard__kicker">Policy rules</p>
        <h2 class="risk-guard__title">What RiskGuard checks</h2>
      </div>
      <span class="risk-guard__note">Before every order</span>
    </header>
    <dl class="risk-guard__grid">
      <div class="risk-guard__rule">
        <dt>Spend caps</dt>
        <dd>Daily and weekly</dd>
        <span>Rejects an order when it would exceed the strategy budget.</span>
      </div>
      <div class="risk-guard__rule">
        <dt>Cooldown</dt>
        <dd>Between buys</dd>
        <span>Blocks repeated buys inside the configured cooldown window.</span>
      </div>
      <div class="risk-guard__rule">
        <dt>Decision record</dt>
        <dd>Reason attached</dd>
        <span>Records why a signal was approved or rejected.</span>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.risk-guard {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.risk-guard__header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: var(--space-4);
}

.risk-guard__kicker {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.risk-guard__title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-panel-title);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.risk-guard__note {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.risk-guard__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-block: 1px solid var(--color-border-subtle);
}

.risk-guard__rule {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
}

.risk-guard__rule:not(:last-child) {
  border-inline-end: 1px solid var(--color-border-subtle);
}

.risk-guard__rule dt {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
}

.risk-guard__rule dd {
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-small);
  font-weight: 700;
}

.risk-guard__rule span {
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  line-height: 1.5;
}

@media (max-width: 44rem) {
  .risk-guard__grid {
    grid-template-columns: 1fr;
  }

  .risk-guard__rule:not(:last-child) {
    border-inline-end: 0;
    border-block-end: 1px solid var(--color-border-subtle);
  }
}

@media (max-width: 36rem) {
  .risk-guard__header {
    align-items: start;
    flex-direction: column;
  }
}
</style>
