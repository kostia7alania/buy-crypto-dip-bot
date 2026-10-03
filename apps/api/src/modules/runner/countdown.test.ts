import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPendingText, getCountdownSecondsLeft } from "./countdown.js";
import { editTelegramMessage } from "./runner.service.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runner countdown", () => {
  it("reports real whole seconds remaining", () => {
    const executeAt = new Date("2026-07-13T12:00:15.000Z");

    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:00.000Z").getTime(),
      ),
    ).toBe(15);
    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:01.001Z").getTime(),
      ),
    ).toBe(14);
    expect(
      getCountdownSecondsLeft(
        executeAt,
        new Date("2026-07-13T12:00:15.001Z").getTime(),
      ),
    ).toBe(0);
  });

  it("renders the current second and deterministic price formatting", () => {
    const text = buildPendingText("BTC Dip", "BTCUSDT", 12345.5, 20, 14);

    expect(text).toContain("$12,345.5");
    expect(text).toContain("Executing in *14s*");
  });

  it.each([
    200, 503,
  ])("aborts the unread edit body after HTTP %s", async (status) => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-edit-secret");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async (_url, init) => {
        signal = init?.signal;
        return new Response("unread edit body", { status });
      }),
    );
    vi.useFakeTimers();

    await expect(
      editTelegramMessage(1, "countdown", "private-chat-a"),
    ).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    "headers",
    "body",
  ] as const)("bounds stalled edit %s and preserves the next edit's provider retry delay", async (stage) => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-edit-secret");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const waiting = Promise.withResolvers<void>();
    const signals: AbortSignal[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const signal = init?.signal;
      if (!signal) throw new Error("missing edit abort signal");
      signals.push(signal);
      if (signals.length > 1) {
        return Response.json(
          { parameters: { retry_after: 17 } },
          { status: 429 },
        );
      }
      const stalled = new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("fake-edit-secret provider body")),
          { once: true },
        );
      });
      if (stage === "headers") {
        waiting.resolve();
        return stalled;
      }
      const response = new Response(null, { status: 429 });
      vi.spyOn(response, "json").mockImplementation(() => {
        waiting.resolve();
        return stalled;
      });
      return response;
    });
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers();

    const pending = editTelegramMessage(1, "countdown", "private-chat-a");
    await waiting.promise;
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    expect(signals[0]?.aborted).toBe(true);
    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0]?.[0]).toContain(
      "TELEGRAM_MESSAGE_EDIT_TIMED_OUT",
    );
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(
      /fake-edit-secret|provider body|private-chat/,
    );

    await expect(
      editTelegramMessage(2, "countdown", "private-chat-b"),
    ).resolves.toBe(17);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
