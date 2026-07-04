<script setup lang="ts">
useSeoMeta({ title: 'Dashboard', robots: 'noindex,nofollow' });
const risk = await $fetch('/api/risk-status');
</script>
<template><section class="p-8"><h1>Risk-first dashboard</h1><pre>{{ risk }}</pre></section></template>
