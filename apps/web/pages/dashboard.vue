<script setup lang="ts">
useSeoMeta({ title: 'Dashboard — DCA Guard', robots: 'noindex,nofollow' });
const { data } = await useFetch('/api/status');
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12">
    <h1 class="text-3xl font-semibold">Risk-first dashboard</h1>
    <pre class="mt-6 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm">{{ data }}</pre>
  </main>
</template>
