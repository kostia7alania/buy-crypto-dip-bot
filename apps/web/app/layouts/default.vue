<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="site-header">
      <div class="site-header__brand-group">
        <NuxtLink class="brand" to="/">
          <img src="/favicon.svg" alt="" class="brand__mark" width="24" height="24" />
          Buy Crypto Dip Bot
        </NuxtLink>
        <span class="site-header__trust-cue">
          <span class="site-header__trust-dot" aria-hidden="true"></span>
          Dry-run first
        </span>
      </div>
      <nav class="site-nav" aria-label="Primary">
        <NuxtLink to="/buy-crypto-dip-bot">Dip bot</NuxtLink>
        <NuxtLink to="/crypto-risk-management-bot">Risk</NuxtLink>
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
      </nav>
    </header>
    <main id="main-content" class="page-content" tabindex="-1">
      <slot />
    </main>

    <!-- Footer: internal links are how crawlers (and users) discover every
         page — keyword-rich anchors, one link per landing page. -->
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__col site-footer__col--brand">
          <NuxtLink class="brand" to="/">
            <img src="/favicon.svg" alt="" class="brand__mark" width="24" height="24" />
            Buy Crypto Dip Bot
          </NuxtLink>
          <p class="site-footer__tagline">
            Self-hosted DRY_RUN crypto DCA evidence with optional Telegram
            delivery. No exchange keys or live orders.
          </p>
        </div>

        <nav class="site-footer__col" aria-label="DCA bots">
          <h2 class="site-footer__heading">DCA Bots</h2>
          <NuxtLink to="/crypto-dca-bot">Crypto DCA Bot</NuxtLink>
          <NuxtLink to="/bitcoin-dca-bot">Bitcoin DCA Bot</NuxtLink>
          <NuxtLink to="/bybit-dca-bot">Bybit DCA Bot</NuxtLink>
          <NuxtLink to="/dca-bot-vs-grid-bot">DCA Bot vs Grid Bot</NuxtLink>
        </nav>

        <nav class="site-footer__col" aria-label="Dip buying">
          <h2 class="site-footer__heading">Dip Buying</h2>
          <NuxtLink to="/buy-crypto-dip-bot">Buy Crypto Dip Bot</NuxtLink>
          <NuxtLink to="/crypto-dip-buying-bot">Crypto Dip Buying Bot</NuxtLink>
          <NuxtLink to="/flash-crash-crypto-bot">Flash Crash Crypto Bot</NuxtLink>
        </nav>

        <nav class="site-footer__col" aria-label="Safety">
          <h2 class="site-footer__heading">Safety First</h2>
          <NuxtLink to="/crypto-risk-management-bot">Crypto Risk Management Bot</NuxtLink>
          <NuxtLink to="/crypto-paper-trading-bot">Crypto Paper Trading Bot</NuxtLink>
          <NuxtLink to="/dashboard">Safety Console</NuxtLink>
          <NuxtLink to="/privacy">Privacy & retention</NuxtLink>
          <NuxtLink to="/support">Support & security</NuxtLink>
        </nav>
      </div>

      <div class="site-footer__legal">
        <p>
          Not financial advice. Crypto trading involves significant risk. The
          current product is DRY_RUN-only and simulated results do not predict
          live execution.
        </p>
        <p>© {{ new Date().getFullYear() }} Buy Crypto Dip Bot</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-block-size: 100dvb;
  display: flex;
  flex-direction: column;
  color: var(--color-text-primary);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--primitive-periwinkle-500) 8%, transparent),
      transparent 23rem
    ),
    var(--color-canvas);
}

.skip-link {
  position: fixed;
  z-index: 100;
  inset-inline-start: var(--space-4);
  inset-block-start: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-focus);
  border-radius: var(--radius-sm);
  background: var(--color-canvas-deep);
  color: var(--color-text-primary);
  font-weight: 700;
  text-decoration: none;
  transform: translateY(calc(-100% - var(--space-8)));
}

.skip-link:focus-visible {
  transform: translateY(0);
}

.site-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: safe center;
  justify-content: space-between;
  inline-size: min(100% - var(--space-8), var(--content-max));
  margin-inline: auto;
  padding-block: var(--space-5);
  border-block-end: 1px solid var(--color-border-subtle);
}

.site-header__brand-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-primary);
  font-weight: 700;
  letter-spacing: -0.015em;
  text-decoration: none;
}

.brand__mark {
  display: block;
  border-radius: var(--radius-sm);
}

.site-header__trust-cue {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: 1.75rem;
  padding-inline: var(--space-3);
  border: 1px solid var(--color-simulation-border);
  border-radius: var(--radius-pill);
  color: var(--color-simulation);
  background: var(--color-simulation-soft);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.025em;
}

.site-header__trust-dot {
  inline-size: 0.375rem;
  block-size: 0.375rem;
  border-radius: 50%;
  background: currentColor;
}

.site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.site-nav :deep(a) {
  min-block-size: var(--control-height-compact);
  display: inline-flex;
  align-items: center;
  padding-inline: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--text-small);
  font-weight: 650;
  text-decoration: none;
  transition:
    color var(--duration-fast) var(--ease-standard),
    background var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.site-nav :deep(a:hover) {
  color: var(--color-text-primary);
  background: var(--color-surface-raised);
}

.site-nav :deep(a[aria-current="page"]) {
  color: var(--color-action);
  background: var(--color-action-soft);
  border-color: var(--color-action-border);
}

.page-content {
  flex: 1;
  inline-size: min(100% - var(--space-8), var(--content-max));
  margin-inline: auto;
}

.site-footer {
  margin-block-start: var(--space-16);
  border-block-start: 1px solid var(--color-border-subtle);
  background: var(--color-canvas-deep);
}

.site-footer__inner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  gap: var(--space-8);
  inline-size: min(100% - var(--space-8), var(--content-max));
  margin-inline: auto;
  padding-block: var(--space-10);
}

.site-footer__col {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.site-footer__col--brand {
  gap: var(--space-3);
}

.site-footer__tagline {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: var(--text-small);
  line-height: var(--line-body);
  max-inline-size: 18rem;
}

.site-footer__heading {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.site-footer__col :deep(a) {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-small);
}

.site-footer__col :deep(a:hover) {
  color: var(--color-action);
}

.site-footer__legal {
  border-block-start: 1px solid var(--color-border-subtle);
  padding-block: var(--space-5);
}

.site-footer__legal p {
  inline-size: min(100% - var(--space-8), var(--content-max));
  margin: var(--space-1) auto;
  color: var(--color-text-subtle);
  font-size: var(--text-caption);
  line-height: var(--line-body);
}

@media (max-width: 38rem) {
  .site-header {
    align-items: stretch;
  }

  .site-header__brand-group,
  .site-nav {
    justify-content: space-between;
  }

  .site-nav {
    inline-size: 100%;
  }

  .site-nav :deep(a) {
    flex: 1;
    justify-content: center;
  }
}
</style>
