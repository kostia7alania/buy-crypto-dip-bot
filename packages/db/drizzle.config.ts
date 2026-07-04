import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_CONNECTION_STRING ??
      "postgresql://postgres:local_password@localhost:5432/dcaguard",
  },
});
