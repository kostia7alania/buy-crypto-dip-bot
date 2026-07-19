import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-04",
  devtools: { enabled: true },
  typescript: { strict: true },
  components: [
    { path: "~/widgets", pattern: "**/ui/**", pathPrefix: false },
    { path: "~/entities", pattern: "**/ui/**", pathPrefix: false },
    { path: "~/shared/ui", pathPrefix: false },
  ],
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      // Overridable via NUXT_PUBLIC_SITE_URL
      siteUrl: "https://buy-crypto-dip-bot.com",
      // GA4 Measurement ID. Overridable via NUXT_PUBLIC_GA_ID.
      // Placeholder until a real ID is set — replace before relying on analytics.
      // Only loaded in production builds — see app/app.vue.
      gaId: "G-XXXXXXXXXX",
      // Bot username (without @) for the Telegram Login Widget on the
      // dashboard. Overridable via NUXT_PUBLIC_TELEGRAM_BOT_USERNAME.
      // Empty = the login button is hidden. The widget also requires
      // /setdomain to be configured in BotFather for the site domain.
      telegramBotUsername: "",
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Buy Crypto Dip Bot",
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "48x48",
          href: "/favicon-48.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      ],
      meta: [{ name: "theme-color", content: "#101214" }],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
