import { describe, expect, it, vi } from "vitest";
import { createSingleFlightTask } from "./single-flight.js";

describe("createSingleFlightTask", () => {
  it("skips overlap and allows a later run after completion", async () => {
    let release: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const run = createSingleFlightTask(task);

    const first = run();
    expect(await run()).toBe(false);
    expect(task).toHaveBeenCalledTimes(1);

    release?.();
    expect(await first).toBe(true);

    const third = run();
    release?.();
    expect(await third).toBe(true);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("releases the guard after a failed task", async () => {
    const task = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce();
    const run = createSingleFlightTask(task);

    await expect(run()).rejects.toThrow("boom");
    await expect(run()).resolves.toBe(true);
  });
});
