const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const originOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

interface RequestOriginInput {
  method: string;
  origin?: string | undefined;
  referer?: string | undefined;
  allowedOrigin: string;
}

export const isTrustedRequestOrigin = (input: RequestOriginInput): boolean => {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;

  const allowedOrigin = originOf(input.allowedOrigin);
  if (!allowedOrigin) return false;
  const presentedOrigin = originOf(input.origin) ?? originOf(input.referer);
  return presentedOrigin === allowedOrigin;
};

export const resolveAllowedWebOrigin = (
  requestOrigin: string,
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const nonLocal =
    env.APP_RUNTIME === "non-local" ||
    (!env.APP_RUNTIME && env.NODE_ENV === "production");
  const configured = env.NUXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;
  if (nonLocal) return "https://buy-crypto-dip-bot.com";
  return requestOrigin;
};
