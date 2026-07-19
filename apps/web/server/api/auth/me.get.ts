import { useAppSession } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event);
  return { user: session.data.user ?? null };
});
