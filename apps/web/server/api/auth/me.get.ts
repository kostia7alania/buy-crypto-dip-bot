import { readAppPrincipal } from "../../utils/require-user.js";

export default defineEventHandler(async (event) => {
  const user = await readAppPrincipal(event);
  return { user };
});
