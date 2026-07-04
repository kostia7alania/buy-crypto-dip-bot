export default defineNuxtConfig({
  compatibilityDate: '2026-07-04',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/': { prerender: true },
    '/crypto-dca-bot': { prerender: true },
    '/buy-crypto-dip-bot': { prerender: true },
    '/bitcoin-dca-bot': { prerender: true },
    '/crypto-dip-buying-bot': { prerender: true },
    '/bybit-dca-bot': { prerender: true },
    '/flash-crash-crypto-bot': { prerender: true },
    '/crypto-risk-management-bot': { prerender: true },
  },
});
