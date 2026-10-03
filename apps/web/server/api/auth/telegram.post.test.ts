import type { H3Event } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  session: vi.fn(),
  source: vi.fn(),
  setHeader: vi.fn(),
}));
vi.mock("../../utils/session.js", () => ({ useAppSession: mocks.session }));
vi.mock("../../utils/auth-abuse-key.js", async (original) => ({
  ...(await original<typeof import("../../utils/auth-abuse-key.js")>()),
  telegramLoginSourcePseudonym: mocks.source,
}));
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
const { default: handler } = await import("./telegram.post.js");

beforeEach(() => {
  mocks.source.mockReturnValue("test-source-pseudonym");
  vi.stubGlobal("apiFetchForEvent", mocks.fetch);
  vi.stubGlobal("readBody", vi.fn().mockResolvedValue({ id: 123 }));
  vi.stubGlobal("logWebError", vi.fn());
  vi.stubGlobal("setResponseHeader", mocks.setHeader);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("Telegram login failure boundary", () => {
  it.each([
    {
      error: { status: 401, data: { error: "BAD_HASH" } },
      statusCode: 401,
      statusMessage: "LOGIN_REJECTED",
    },
    {
      error: { status: 503, data: { error: "TELEGRAM_LOGIN_NOT_CONFIGURED" } },
      statusCode: 503,
      statusMessage: "TELEGRAM_LOGIN_NOT_CONFIGURED",
    },
    {
      error: { status: 500 },
      statusCode: 500,
      statusMessage: "LOGIN_UNAVAILABLE",
    },
    {
      error: new Error("upstream connection failed"),
      statusCode: 502,
      statusMessage: "LOGIN_UNAVAILABLE",
    },
  ])("returns $statusCode $statusMessage without creating a session", async ({
    error,
    statusCode,
    statusMessage,
  }) => {
    mocks.fetch.mockRejectedValue(error);

    await expect(handler({} as H3Event)).rejects.toMatchObject({
      statusCode,
      statusMessage,
    });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.setHeader).not.toHaveBeenCalled();
  });

  it("reports a local configuration failure as unavailable before contacting the API", async () => {
    mocks.source.mockImplementation(() => {
      throw new Error("WEB_RUNTIME_CONFIG_INVALID:API_KEY_REQUIRED");
    });

    await expect(handler({} as H3Event)).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "LOGIN_UNAVAILABLE",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("retains the validated rate-limit status and retry delay", async () => {
    mocks.fetch.mockRejectedValue({
      status: 429,
      data: { error: "RATE_LIMITED", retryAfterSeconds: 177 },
      response: { headers: new Headers({ "retry-after": "177" }) },
    });
    const event = {} as H3Event;

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: "RATE_LIMITED",
    });
    expect(mocks.setHeader).toHaveBeenCalledWith(event, "Retry-After", 177);
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
