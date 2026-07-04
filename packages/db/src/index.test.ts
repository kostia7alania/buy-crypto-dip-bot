import { describe, expect, it } from "vitest";
import { createPostgresConnection, schema } from "./index.js";

describe("database schema and connection", () => {
  it("exports Drizzle tables", () => {
    expect(schema).toHaveProperty("strategies");
    expect(schema).toHaveProperty("auditEvents");
    expect(schema).toHaveProperty("orders");
  });

  it("requires a connection string", () => {
    expect(() => createPostgresConnection("")).toThrow(
      "POSTGRES_CONNECTION_STRING_REQUIRED",
    );
  });
});
