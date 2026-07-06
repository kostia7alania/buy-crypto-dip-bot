const SITE_URL =
  process.env.NUXT_PUBLIC_SITE_URL ?? "https://buy-crypto-dip-bot.com";

export default defineEventHandler((event) => {
  setResponseHeader(event, "Content-Type", "text/plain");
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
});
