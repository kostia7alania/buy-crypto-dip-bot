import { describe, expect, it } from "vitest";
import {
  hasVerifiedNotificationBinding,
  isEligibleCallerContext,
} from "./caller.js";

// A bot update may act on user data only when it is attributable to exactly
// one accountable person. Everything else — group chats, channel posts,
// actorless updates — is refused before any query runs.

describe("isEligibleCallerContext", () => {
  it("accepts a private chat with a known actor", () => {
    expect(
      isEligibleCallerContext({ from: { id: 42 }, chat: { type: "private" } }),
    ).toBe(true);
  });

  it("accepts an update with an actor and no chat (inline callback)", () => {
    expect(isEligibleCallerContext({ from: { id: 42 } })).toBe(true);
  });

  it.each([
    "group",
    "supergroup",
    "channel",
  ])("refuses a %s chat even with a known actor", (type) => {
    // A shared room has no single owner: anyone present could otherwise
    // pause or edit whoever's strategies happened to be reachable.
    expect(isEligibleCallerContext({ from: { id: 42 }, chat: { type } })).toBe(
      false,
    );
  });

  it("refuses an update with no actor", () => {
    expect(isEligibleCallerContext({ chat: { type: "private" } })).toBe(false);
  });

  it("refuses an update with neither actor nor chat", () => {
    expect(isEligibleCallerContext({})).toBe(false);
  });

  it("refuses an actor id of 0 rather than treating it as a user", () => {
    expect(
      isEligibleCallerContext({ from: { id: 0 }, chat: { type: "private" } }),
    ).toBe(false);
  });
});

describe("/start registration context", () => {
  // /start is the one command that cannot use requireCaller, because it is
  // what creates the user. It writes users.telegram_chat_id, which the runner
  // now uses as the delivery address for that person's order, risk and digest
  // notifications — so registering from a group would redirect their whole
  // trading activity into a shared room.
  it.each([
    "group",
    "supergroup",
    "channel",
  ])("must not be allowed to register a %s chat as a notification target", (type) => {
    expect(isEligibleCallerContext({ from: { id: 42 }, chat: { type } })).toBe(
      false,
    );
  });

  it("allows registration from a private chat", () => {
    expect(
      isEligibleCallerContext({ from: { id: 42 }, chat: { type: "private" } }),
    ).toBe(true);
  });
});

describe("notification binding", () => {
  it("requires both a private-chat destination and /start evidence", () => {
    expect(
      hasVerifiedNotificationBinding({
        telegramChatId: "42",
        notificationEnabledAt: new Date(),
      }),
    ).toBe(true);
    expect(
      hasVerifiedNotificationBinding({
        telegramChatId: "42",
        notificationEnabledAt: null,
      }),
    ).toBe(false);
    expect(
      hasVerifiedNotificationBinding({
        telegramChatId: null,
        notificationEnabledAt: new Date(),
      }),
    ).toBe(false);
  });
});
