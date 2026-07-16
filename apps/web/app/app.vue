<script setup lang="ts">
import { computed } from "vue";

const route = useRoute();
const config = useRuntimeConfig();

// Canonical URL on every page — the site is reachable via www and
// alternative ports, search engines must index one address.
const canonical = computed(
  () => `${config.public.siteUrl}${route.path === "/" ? "" : route.path}`,
);

// GA4 only ships in production builds — dev traffic shouldn't pollute analytics.
const gaScripts = import.meta.env.PROD
  ? [
      {
        src: `https://www.googletagmanager.com/gtag/js?id=${config.public.gaId}`,
        async: true,
      },
      {
        innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${config.public.gaId}');`,
      },
    ]
  : [];

useHead({
  link: [{ rel: "canonical", href: canonical }],
  script: [
    ...gaScripts,
    // Sitewide entity data: who publishes this site and what it is.
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Buy Crypto Dip Bot",
        url: config.public.siteUrl,
      }),
    },
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Buy Crypto Dip Bot",
        url: config.public.siteUrl,
        logo: `${config.public.siteUrl}/apple-touch-icon.png`,
      }),
    },
  ],
});

// Default social card for every page (pages can override).
useSeoMeta({
  ogImage: `${config.public.siteUrl}/og-image.png`,
  twitterImage: `${config.public.siteUrl}/og-image.png`,
});
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
