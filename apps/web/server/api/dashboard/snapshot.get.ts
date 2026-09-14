import { apiFetchAsForEvent, upstreamError } from "../../utils/api-fetch.js";
import { logWebError } from "../../utils/operational-log.js";
import { requireCaller } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const { apiSessionToken } = await requireCaller(event);
  setResponseHeader(event, "cache-control", "private, no-store");
  setResponseHeader(event, "vary", "Cookie");
  try {
    const data = await apiFetchAsForEvent<Record<string, unknown>>(
      event,
      apiSessionToken,
      "/dashboard/snapshot",
    );
    return {
      ...data,
      risk: {
        ...(data.risk as Record<string, unknown>),
        apiReachable: true,
        observedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    logWebError(event, "DASHBOARD_SNAPSHOT_FAILED", error);
    throw upstreamError(error, "DASHBOARD_UNAVAILABLE");
  }
});
