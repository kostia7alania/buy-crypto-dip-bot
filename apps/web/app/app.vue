<script setup lang="ts">
import { computed } from "vue";

const route = useRoute();
const config = useRuntimeConfig();

// Canonical URL on every page — the site is reachable via www and
// alternative ports, search engines must index one address.
const canonical = computed(
  () => `${config.public.siteUrl}${route.path === "/" ? "" : route.path}`,
);

useHead({
  link: [{ rel: "canonical", href: canonical }],
});
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
