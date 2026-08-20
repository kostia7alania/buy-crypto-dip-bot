import { randomBytes } from "node:crypto";
import { type H3Event, useSession } from "h3";

export const APP_SESSION_VERSION = 2 as const;

export interface SessionUser {
  id: string;
  tenantId: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
}

export interface AppSessionData {
  version?: typeof APP_SESSION_VERSION;
  user?: SessionUser;
}

// Without SESSION_SECRET (local dev) sessions still work but reset on every
// server restart. Production must set it — vps-bootstrap generates one.
let ephemeralSecret: string | null = null;
const sessionPassword = () => {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.trim().length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET_REQUIRED");
  }
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
  }
  return ephemeralSecret;
};

export const normalizeSessionUser = (value: unknown): SessionUser | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.trim().length === 0 ||
    typeof candidate.tenantId !== "string" ||
    candidate.tenantId.trim().length === 0 ||
    typeof candidate.telegramUserId !== "string" ||
    candidate.telegramUserId.trim().length === 0 ||
    (candidate.username !== null && typeof candidate.username !== "string") ||
    (candidate.firstName !== null && typeof candidate.firstName !== "string")
  ) {
    return null;
  }

  return {
    id: candidate.id,
    tenantId: candidate.tenantId,
    telegramUserId: candidate.telegramUserId,
    username: candidate.username,
    firstName: candidate.firstName,
  };
};

// One place for the cookie contract so every auth route agrees on it.
export const useAppSession = (event: H3Event) =>
  useSession<AppSessionData>(event, {
    // Versioned name intentionally invalidates pre-tenancy sessions.
    name: "dipbot_session_v2",
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  });
