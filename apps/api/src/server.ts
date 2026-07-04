import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { startRunner } from "./modules/runner/runner.service.js";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);

  // Start background trading runner in dev and prod
  startRunner().catch((err) => {
    console.error("Failed to start background trading runner:", err);
  });
});
