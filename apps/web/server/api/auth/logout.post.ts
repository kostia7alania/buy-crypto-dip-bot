import { useAppSession } from "../../utils/session.js";

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event);
  await session.clear();
  return { user: null };
});
