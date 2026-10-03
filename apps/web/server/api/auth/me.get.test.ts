import type { H3Event } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { upstreamError } from "../../utils/api-fetch.js";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("../../utils/session.js", () => ({ useAppSession: mocks.session }));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
const { default: handler } = await import("./me.get.js");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("authoritative sign-in status", () => {
  it("preserves an unavailable session for retry and signs out only on upstream 401", async () => {
    const user = {
      id: "test-user",
      telegramUserId: "123",
      username: null,
      firstName: null,
    };
    const session = {
      data: { user, apiSessionToken: "opaque-test-session" },
      clear: vi.fn(),
      update: vi.fn(),
    };
    mocks.session.mockResolvedValue(session);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ user })
      .mockRejectedValueOnce({ status: 401 });
    vi.stubGlobal("apiFetchAsForEvent", fetch);
    vi.stubGlobal("logWebError", vi.fn());
    vi.stubGlobal("upstreamError", upstreamError);
    vi.stubGlobal(
      "createError",
      (options: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(options.statusMessage), options),
    );
    const event = {} as H3Event;

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 503 });
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.update).not.toHaveBeenCalled();

    await expect(handler(event)).resolves.toEqual({ user });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      event,
      "opaque-test-session",
      "/auth/me",
    );
    expect(session.clear).not.toHaveBeenCalled();

    await expect(handler(event)).resolves.toEqual({ user: null });
    expect(session.clear).toHaveBeenCalledOnce();
  });
});
