import { requireCaller } from "../../../utils/session.js";

export default defineEventHandler(async (event) => {
  const caller = await requireCaller(event);
  const body = await readBody(event);
  try {
    return await apiFetchAsForEvent(
      event,
      caller.apiSessionToken,
      "/auth/sessions/revoke",
      {
        method: "POST",
        body,
      },
    );
  } catch (error) {
    logWebError(event, "SESSION_REVOCATION_FAILED", error);
    throw upstreamError(error, "SESSION_REVOCATION_FAILED");
  }
});
