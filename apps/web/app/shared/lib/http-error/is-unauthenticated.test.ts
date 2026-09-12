import { describe, expect, it } from "vitest";
import { isUnauthenticated } from "./is-unauthenticated.js";

describe("isUnauthenticated", () => {
  it("recognises an h3 error with statusCode 401", () => {
    expect(isUnauthenticated({ statusCode: 401 })).toBe(true);
  });

  it("recognises an ofetch error with status 401", () => {
    expect(isUnauthenticated({ status: 401 })).toBe(true);
  });

  it("does not treat a server failure as a sign-out", () => {
    // A 502 means the API is down. Showing "please sign in" then would send
    // the user off to fix something that is not broken.
    expect(isUnauthenticated({ statusCode: 502 })).toBe(false);
    expect(isUnauthenticated({ statusCode: 500 })).toBe(false);
  });

  it("does not treat a forbidden response as a sign-out", () => {
    expect(isUnauthenticated({ statusCode: 403 })).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "401"],
    ["a number", 401],
    ["an empty object", {}],
  ])("returns false for %s", (_label, value) => {
    expect(isUnauthenticated(value)).toBe(false);
  });
});
