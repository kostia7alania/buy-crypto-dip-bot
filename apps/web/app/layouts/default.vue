<template>
  <div class="app-shell">
    <header class="site-header">
      <NuxtLink class="brand" to="/">Buy Crypto Dip Bot</NuxtLink>
      <nav class="site-nav" aria-label="Primary navigation">
        <NuxtLink to="/buy-crypto-dip-bot">Dip bot</NuxtLink>
        <NuxtLink to="/crypto-risk-management-bot">Risk</NuxtLink>
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
      </nav>
    </header>
    <main class="page-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-block-size: 100dvb;
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
  color: #f8fafc;
  font-weight: 700;
  text-decoration: none;
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
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
}
</style>
