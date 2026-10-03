import { describe, expect, it, vi } from "vitest";
import { createRunnerLifecycle } from "./runner-lifecycle.js";

describe("runner drain", () => {
  it("stops new work, signals cosmetics, and waits for committed work to finish", async () => {
    const lifecycle = createRunnerLifecycle();
    const active = Promise.withResolvers<void>();
    const completed = vi.fn();
    const lateTask = vi.fn();
    const task = lifecycle.run(async () => {
      await active.promise;
      completed();
    });
    await Promise.resolve();

    let drained = false;
    const stop = lifecycle.stop();
    void stop.then(() => {
      drained = true;
    });
    expect(lifecycle.stop()).toBe(stop);
    expect(lifecycle.signal.aborted).toBe(true);
    await lifecycle.run(lateTask);
    expect(lateTask).not.toHaveBeenCalled();
    expect(drained).toBe(false);

    active.resolve();
    await task;
    await stop;
    expect(completed).toHaveBeenCalledOnce();
    expect(drained).toBe(true);
  });

  it("does not start queued work after stop and accounts for failed active work", async () => {
    const queuedLifecycle = createRunnerLifecycle();
    const queued = vi.fn();
    const queuedRun = queuedLifecycle.run(queued);
    await queuedLifecycle.stop();
    await queuedRun;
    expect(queued).not.toHaveBeenCalled();

    const lifecycle = createRunnerLifecycle();
    const active = Promise.withResolvers<void>();
    const task = lifecycle.run(() => active.promise);
    const rejected = expect(task).rejects.toThrow("synthetic failure");
    await Promise.resolve();
    const stop = lifecycle.stop();
    active.reject(new Error("synthetic failure"));
    await rejected;
    await expect(stop).resolves.toBeUndefined();
  });
});
