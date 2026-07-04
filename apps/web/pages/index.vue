<script setup lang="ts">
useSeoMeta({
  title: 'DCA Guard — AI Crypto DCA Bot for Buying the Dip',
  description: 'Automate crypto dip buying with dry-run mode, strict risk limits, audit logs, Telegram alerts, and spot-only execution.',
});
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-16">
    <p class="text-sm uppercase tracking-[0.3em] text-amber-300">DCA Guard</p>
    <h1 class="mt-4 text-5xl font-semibold leading-tight">AI Crypto DCA Bot for Buying the Dip Safely</h1>
    <p class="mt-6 max-w-2xl text-lg text-slate-300">
      Risk-first automation for Bitcoin dip buying. Dry-run first, strict limits always, no leverage, no futures, no casino UI.
    </p>
    <section class="mt-10 grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 class="font-semibold">Dry-run first</h2>
        <p class="mt-2 text-slate-400">Every signal can be tested before real orders exist.</p>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 class="font-semibold">RiskGuard</h2>
        <p class="mt-2 text-slate-400">Daily limits, weekly limits, allowlists, cooldowns, audit logs.</p>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 class="font-semibold">Spot only</h2>
        <p class="mt-2 text-slate-400">No futures, no leverage, no martingale, no withdrawal API.</p>
      </div>
    </section>
  </main>
</template>
