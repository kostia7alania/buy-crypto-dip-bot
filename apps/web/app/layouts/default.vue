<template>
  <div class="app-shell">
    <header class="site-header">
      <NuxtLink class="brand" to="/">
        <img src="/favicon.svg" alt="" class="brand__mark" width="24" height="24" />
        Buy Crypto Dip Bot
      </NuxtLink>
      <nav class="site-nav" aria-label="Primary navigation">
        <NuxtLink to="/buy-crypto-dip-bot">Dip bot</NuxtLink>
        <NuxtLink to="/crypto-risk-management-bot">Risk</NuxtLink>
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
      </nav>
    </header>
    <main class="page-content">
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
            Risk-first crypto DCA bot. Dry-run first, Telegram-native, free.
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
          <NuxtLink to="/dashboard">Live Dashboard</NuxtLink>
        </nav>
      </div>

      <div class="site-footer__legal">
        <p>
          Not financial advice. Crypto trading involves significant risk — never
          invest more than you can afford to lose. The bot runs in dry-run
          (simulation) mode by default.
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
  color: #f5f5f0;
  background:
    linear-gradient(180deg, rgba(21, 94, 117, 0.24), transparent 22rem),
    #101214;
}

.site-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: safe center;
  justify-content: space-between;
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
  padding-block: 1.25rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #f8fafc;
  font-weight: 700;
  text-decoration: none;
}

.brand__mark {
  display: block;
  border-radius: 6px;
}

.site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.site-nav a {
  color: #cbd5e1;
  text-decoration: none;
}

.site-nav a:hover,
.site-nav a:focus-visible {
  color: #f8fafc;
}

.page-content {
  flex: 1;
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
}

.site-footer {
  margin-top: 4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 12, 14, 0.6);
}

.site-footer__inner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  gap: 2rem;
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
  padding-block: 2.5rem;
}

.site-footer__col {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.site-footer__col--brand {
  gap: 0.75rem;
}

.site-footer__tagline {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.5;
  max-inline-size: 18rem;
}

.site-footer__heading {
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.site-footer__col a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.9rem;
}

.site-footer__col a:hover,
.site-footer__col a:focus-visible {
  color: #67e8f9;
}

.site-footer__legal {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-block: 1.25rem;
}

.site-footer__legal p {
  inline-size: min(100% - 2rem, 72rem);
  margin: 0.25rem auto;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.5;
}
</style>
