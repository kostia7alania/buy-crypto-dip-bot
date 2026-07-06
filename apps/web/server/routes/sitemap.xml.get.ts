import { seoRoutes } from "@buy-crypto-dip-bot/seo-keywords";

const SITE_URL =
  process.env.NUXT_PUBLIC_SITE_URL ?? "https://buy-crypto-dip-bot.com";

export default defineEventHandler((event) => {
  setResponseHeader(event, "Content-Type", "application/xml");
  const urls = seoRoutes
    .map(
      (route) =>
        `  <url><loc>${SITE_URL}${route === "/" ? "" : route}</loc></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
});
