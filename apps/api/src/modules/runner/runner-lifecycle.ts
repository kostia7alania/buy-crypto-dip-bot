export const createRunnerLifecycle = () => {
  const controller = new AbortController();
  const active = new Set<Promise<void>>();
  let stopped: Promise<void> | undefined;

  const run = (task: () => Promise<void>): Promise<void> => {
    if (controller.signal.aborted) return Promise.resolve();
    const work = Promise.resolve().then(() => {
      if (!controller.signal.aborted) return task();
    });
    active.add(work);
    void work.then(
      () => active.delete(work),
      () => active.delete(work),
    );
    return work;
  };

  const stop = (): Promise<void> => {
    if (!stopped) {
      controller.abort();
      stopped = Promise.allSettled(active).then(() => undefined);
    }
    return stopped;
  };

  return { run, stop, signal: controller.signal };
};
