import { computed, onMounted, onUnmounted } from "vue";
import {
  type DashboardSnapshot,
  fetchDashboardSnapshot,
} from "~/entities/dashboard-snapshot";

const REFRESH_DELAY_MS = 30_000;
const PENDING_ORDER_REFRESH_DELAY_MS = 3_000;

export const useDashboardRefresh = () => {
  const {
    clear,
    data: snapshot,
    error,
    refresh,
    status,
  } = useAsyncData<DashboardSnapshot>(
    "dashboard-snapshot",
    (_nuxtApp, { signal }) => fetchDashboardSnapshot(signal),
    {
      deep: false,
      immediate: false,
      server: false,
    },
  );

  const hasPendingOrder = computed(
    () =>
      snapshot.value?.orders.some((order) => order.status === "PENDING") ??
      false,
  );

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshController: AbortController | null = null;
  let activeRequest: Promise<void> | null = null;
  let refreshQueued = false;
  let lastSuccessfulRefreshAt = 0;
  let disposed = false;
  let authPaused = false;

  const isPageVisible = () =>
    import.meta.client && document.visibilityState === "visible";

  const clearRefreshTimer = () => {
    if (refreshTimer === null) return;
    clearTimeout(refreshTimer);
    refreshTimer = null;
  };

  const isSnapshotStale = () => {
    const generatedAt = Date.parse(snapshot.value?.generatedAt ?? "");
    const snapshotAt = Math.max(
      Number.isFinite(generatedAt) ? generatedAt : 0,
      lastSuccessfulRefreshAt,
    );

    return snapshotAt === 0 || Date.now() - snapshotAt >= REFRESH_DELAY_MS;
  };

  const scheduleNextRefresh = () => {
    clearRefreshTimer();
    if (disposed || authPaused || !isPageVisible() || activeRequest !== null) {
      return;
    }

    const delay = hasPendingOrder.value
      ? PENDING_ORDER_REFRESH_DELAY_MS
      : REFRESH_DELAY_MS;

    refreshTimer = setTimeout(() => {
      void refreshDashboard();
    }, delay);
  };

  async function refreshDashboard(): Promise<void> {
    clearRefreshTimer();
    if (disposed || authPaused || !isPageVisible()) return;

    if (activeRequest !== null) {
      refreshQueued = true;
      await activeRequest;
      return;
    }

    const controller = new AbortController();
    refreshController = controller;
    const request = refresh({ dedupe: "cancel", signal: controller.signal });
    activeRequest = request;
    let shouldRefreshAgain = false;

    try {
      await request;
      if (!controller.signal.aborted && status.value === "success") {
        lastSuccessfulRefreshAt = Date.now();
      }
    } catch {
      // useAsyncData keeps the request failure in its error ref.
    } finally {
      if (refreshController === controller) refreshController = null;
      if (activeRequest === request) activeRequest = null;

      shouldRefreshAgain = refreshQueued;
      refreshQueued = false;
    }

    if (disposed || !isPageVisible()) return;
    if (shouldRefreshAgain) {
      await refreshDashboard();
      return;
    }

    scheduleNextRefresh();
  }

  const handleVisibilityChange = () => {
    clearRefreshTimer();

    if (!isPageVisible()) {
      refreshQueued = false;
      refreshController?.abort();
      return;
    }

    if (isSnapshotStale()) {
      void refreshDashboard();
      return;
    }

    scheduleNextRefresh();
  };

  const setDashboardAuthenticated = (authenticated: boolean) => {
    authPaused = !authenticated;
    if (authenticated) {
      void refreshDashboard();
      return;
    }

    clearRefreshTimer();
    refreshQueued = false;
    refreshController?.abort();
    clear();
    lastSuccessfulRefreshAt = 0;
  };

  onMounted(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
  });

  onUnmounted(() => {
    disposed = true;
    clearRefreshTimer();
    refreshController?.abort();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  return {
    error,
    refreshDashboard,
    setDashboardAuthenticated,
    snapshot,
    status,
  };
};
