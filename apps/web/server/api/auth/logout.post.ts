import { useAppSession } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  setPrivateResponseHeaders(event);
  const session = await useAppSession(event);
  await session.clear();
  deleteCookie(event, "dipbot_session");
  return { user: null };
});
