/**
 * Whether a failed request failed because nobody is signed in.
 *
 * Since ExecPlan 005 the BFF refuses user-data routes with `401` instead of
 * quietly returning an empty list. That is the honest behaviour, but it means
 * the UI has to tell "you are signed out" apart from "this genuinely failed" —
 * otherwise a signed-out dashboard looks identical to an empty portfolio.
 */
export const isUnauthenticated = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { statusCode?: number; status?: number }).statusCode;
  const legacyStatus = (error as { status?: number }).status;
  return status === 401 || legacyStatus === 401;
};
