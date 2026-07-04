import { describe, expect, it } from "vitest";
import {
  createPostgresAdapterPlaceholder,
  createSqliteDevAdapterPlaceholder,
  schema,
} from "./index.js";

describe("database scaffold", () => {
  it("exports Postgres-first Drizzle tables", () => {
    expect(schema).toHaveProperty("strategies");
    expect(schema).toHaveProperty("auditEvents");
    expect(schema).toHaveProperty("orders");
  });

  it("requires a Postgres connection string for production adapter wiring", () => {
    expect(() =>
      createPostgresAdapterPlaceholder({ runtime: "production" }),
    ).toThrow("POSTGRES_CONNECTION_STRING_REQUIRED");
  });

  it("keeps SQLite limited to local and test placeholders", () => {
    expect(
      createSqliteDevAdapterPlaceholder({ runtime: "test" }),
    ).toMatchObject({
      dialect: "sqlite",
      runtime: "test",
      connectionTarget: ":memory:",
      ready: false,
    });
  });
});
