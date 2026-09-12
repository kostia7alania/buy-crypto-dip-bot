import { describe, expect, it } from "vitest";
import { resolveServerApiConfig } from "./runtime-config.js";

describe("web server API configuration", () => {
  it("keeps local development defaults available", () => {
    expect(resolveServerApiConfig({ APP_RUNTIME: "local" })).toEqual({
      runtime: "local",
      apiUrl: "http://localhost:8787",
      apiKey: undefined,
    });
  });

  it("requires both API_URL and API_KEY outside local development", () => {
    expect(() =>
      resolveServerApiConfig({
        APP_RUNTIME: "non-local",
        API_URL: "http://api:8787",
      }),
    ).toThrow("WEB_RUNTIME_CONFIG_INVALID:API_KEY_REQUIRED");
    expect(() =>
      resolveServerApiConfig({ APP_RUNTIME: "non-local", API_KEY: "secret" }),
    ).toThrow("WEB_RUNTIME_CONFIG_INVALID:API_URL_REQUIRED");
  });
});
