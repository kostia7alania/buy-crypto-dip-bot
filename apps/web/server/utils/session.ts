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
}

// Without SESSION_SECRET (local dev) sessions still work but reset on every
// server restart. Production must set it — vps-bootstrap generates one.
let ephemeralSecret: string | null = null;
const sessionPassword = () => {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
  }
  return ephemeralSecret;
};

// One place for the cookie contract so every auth route agrees on it.
export const useAppSession = (event: H3Event) =>
  useSession<AppSessionData>(event, {
    name: "dipbot_session",
    password: sessionPassword(),
    maxAge: 60 * 60 * 24 * 30,
    cookie: { sameSite: "lax", httpOnly: true },
  });
