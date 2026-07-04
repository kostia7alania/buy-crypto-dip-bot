import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-04",
  devtools: { enabled: true },
  typescript: { strict: true },
  css: ["~/assets/css/main.css"],
  app: { head: { htmlAttrs: { lang: "en" }, titleTemplate: "%s · DCA Guard" } },
  vite: {
    plugins: [tailwindcss()],
  },
});
