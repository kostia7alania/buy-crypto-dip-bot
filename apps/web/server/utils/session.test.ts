import { describe, expect, it } from "vitest";
import { getSessionCookiePolicy } from "./session.js";

describe("session cookie policy", () => {
  it("uses a __Host- cookie outside local development", () => {
    expect(getSessionCookiePolicy({ APP_RUNTIME: "non-local" })).toEqual({
      name: "__Host-dipbot_session",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("relaxes only Secure and the prefix for local HTTP development", () => {
    expect(getSessionCookiePolicy({ APP_RUNTIME: "local" })).toMatchObject({
      name: "dipbot_session",
      secure: false,
      httpOnly: true,
      path: "/",
    });
  });
});
