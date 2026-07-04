import { Hono } from "hono";

export const versionRoutes = new Hono().get("/", (c) =>
  c.json({
    name: "buy-crypto-dip-bot",
    runtime: process.version,
  }),
);
