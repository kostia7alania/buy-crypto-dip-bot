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
  app: { head: { htmlAttrs: { lang: "en" }, titleTemplate: "%s · DCA Guard" } },
  vite: {
    plugins: [tailwindcss()],
  },
});
