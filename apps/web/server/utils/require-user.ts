import { createError, type H3Event, setResponseHeaders } from "h3";
import {
  APP_SESSION_VERSION,
  normalizeSessionUser,
  type SessionUser,
  useAppSession,
} from "./session.js";

const principalCache = new WeakMap<H3Event, SessionUser>();

export const setPrivateResponseHeaders = (event: H3Event): void => {
  setResponseHeaders(event, {
    "cache-control": "private, no-store",
    vary: "Cookie",
  });
};

export const readAppPrincipal = async (
  event: H3Event,
): Promise<SessionUser | null> => {
  setPrivateResponseHeaders(event);

  const cached = principalCache.get(event);
  if (cached) return cached;

  const session = await useAppSession(event);
  const principal = normalizeSessionUser(session.data.user);
  if (session.data.version === APP_SESSION_VERSION && principal) {
    principalCache.set(event, principal);
    return principal;
  }

  if (session.data.version !== undefined || session.data.user !== undefined) {
    await session.clear();
  }
  return null;
};

export const requireAppPrincipal = async (
  event: H3Event,
): Promise<SessionUser> => {
  const principal = await readAppPrincipal(event);
  if (!principal) {
    throw createError({ statusCode: 401, statusMessage: "UNAUTHORIZED" });
  }

  return principal;
};
