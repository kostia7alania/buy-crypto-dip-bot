import type { H3Event } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  caller: vi.fn(),
  fetch: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../../utils/session.js", () => ({ requireCaller: mocks.caller }));
vi.mock("../../utils/api-fetch.js", async (original) => ({
  ...(await original<typeof import("../../utils/api-fetch.js")>()),
  apiFetchAsForEvent: mocks.fetch,
}));
vi.mock("../../utils/operational-log.js", () => ({ logWebError: mocks.log }));
const createError = (options: { statusCode: number; statusMessage?: string }) =>
  Object.assign(new Error(options.statusMessage), options);
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal(
  "setResponseHeader",
  (event: H3Event, key: string, value: string) =>
    event.node.res.setHeader(key, value),
);
vi.stubGlobal("createError", createError);
const { default: handler } = await import("./snapshot.get.js");

const event = () =>
  ({
    context: {},
    node: { res: { setHeader: vi.fn() } },
  }) as unknown as H3Event;
afterEach(() => {
  vi.resetAllMocks();
});

describe("dashboard BFF contract", () => {
  it("does not contact the API without a sealed caller session", async () => {
    mocks.caller.mockRejectedValue(createError({ statusCode: 401 }));
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("forwards the opaque session and prevents caching the private response", async () => {
    mocks.caller.mockResolvedValue({ apiSessionToken: "opaque-test-session" });
    mocks.fetch.mockResolvedValue({
      schemaVersion: 1,
      strategies: [{ id: "owned" }],
      risk: { mode: "DRY_RUN" },
    });
    const request = event();
    const result = await handler(request);
    expect(mocks.fetch).toHaveBeenCalledWith(
      request,
      "opaque-test-session",
      "/dashboard/snapshot",
    );
    expect(request.node.res.setHeader).toHaveBeenCalledWith(
      "cache-control",
      "private, no-store",
    );
    expect(request.node.res.setHeader).toHaveBeenCalledWith("vary", "Cookie");
    expect(result).toMatchObject({
      strategies: [{ id: "owned" }],
      risk: { mode: "DRY_RUN", apiReachable: true },
    });
  });
  it("preserves an upstream outage instead of reporting an empty successful portfolio", async () => {
    vi.stubGlobal("createError", createError);
    mocks.caller.mockResolvedValue({ apiSessionToken: "opaque-test-session" });
    mocks.fetch.mockRejectedValue({ status: 503 });
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.log).toHaveBeenCalledOnce();
  });
});
