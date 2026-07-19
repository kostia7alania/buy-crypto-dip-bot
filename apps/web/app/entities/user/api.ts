import type { MeResponse, TelegramAuthPayload } from "./types.js";

export const fetchMe = () => $fetch<MeResponse>("/api/auth/me");

export const loginWithTelegram = (payload: TelegramAuthPayload) =>
  $fetch<MeResponse>("/api/auth/telegram", { method: "POST", body: payload });

export const logout = () =>
  $fetch<MeResponse>("/api/auth/logout", { method: "POST" });
