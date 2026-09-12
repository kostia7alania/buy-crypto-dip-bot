import { randomBytes } from "node:crypto";
import type { H3Event } from "h3";

export interface SessionUser {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
}

export interface AppSessionData {
  user?: SessionUser;
  // The API session token. It lives inside the sealed cookie and is replayed
  // server-side on every user-data call; the browser never receives it.
  apiSessionToken?: string;
}

// Without SESSION_SECRET (local dev) sessions still work but reset on every
// server restart. Production must set it — vps-bootstrap generates one.
let ephemeralSecret: string | null = null;
export const isNonLocalRuntime = (env: NodeJS.ProcessEnv = process.env) =>
  env.APP_RUNTIME === "non-local" ||
  (!env.APP_RUNTIME && env.NODE_ENV === "production");

export const getSessionCookiePolicy = (
  env: NodeJS.ProcessEnv = process.env,
) => ({
  name: isNonLocalRuntime(env) ? "__Host-dipbot_session" : "dipbot_session",
  secure: isNonLocalRuntime(env),
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/" as const,
});

const sessionPassword = () => {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (isNonLocalRuntime()) {
    // In production an ephemeral secret would silently log every user out on
    // each restart and make sessions unauditable. Fail loudly instead.
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters in production",
    );
  }
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
  }
  return ephemeralSecret;
};

// One place for the cookie contract so every auth route agrees on it.
export const useAppSession = (event: H3Event) => {
  const cookie = getSessionCookiePolicy();
  return useSession<AppSessionData>(event, {
    name: cookie.name,
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      sameSite: cookie.sameSite,
      httpOnly: cookie.httpOnly,
      path: cookie.path,
      secure: cookie.secure,
    },
  });
};

export interface AuthenticatedCaller {
  user: SessionUser;
  apiSessionToken: string;
}

/**
 * Gate for every BFF route that reads or writes user-owned data.
 *
 * Returns the caller or throws 401 — there is no third outcome, and in
 * particular no "carry on without a user" path, because that is exactly how a
 * dashboard ends up rendering someone else's trading history.
 */
export const requireCaller = async (
  event: H3Event,
): Promise<AuthenticatedCaller> => {
  const session = await useAppSession(event);
  const user = session.data.user;
  const apiSessionToken = session.data.apiSessionToken;

  if (!user || !apiSessionToken) {
    throw createError({ statusCode: 401, statusMessage: "UNAUTHENTICATED" });
  }

  return { user, apiSessionToken };
};
