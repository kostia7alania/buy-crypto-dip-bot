<script setup lang="ts">
import { logOperationalError } from "@buy-crypto-dip-bot/shared-types";
import { computed, onUnmounted, ref, watch, watchPostEffect } from "vue";
import {
  loginWithTelegram,
  logout,
  type MeResponse,
  type TelegramAuthPayload,
} from "~/entities/user";
import { isUnauthenticated } from "~/shared/lib/http-error";

const config = useRuntimeConfig();
const botUsername = config.public.telegramBotUsername.trim();

const {
  data: me,
  error: authError,
  status: authStatus,
  refresh,
} = await useFetch<MeResponse>("/api/auth/me", {
  key: "auth-me",
});
const authChecking = computed(
  () => authStatus.value === "idle" || authStatus.value === "pending",
);
const authUnavailable = computed(
  () => Boolean(authError.value) && !isUnauthenticated(authError.value),
);
const signedInUser = computed(() =>
  authChecking.value || authError.value ? null : me.value?.user,
);

const widgetHost = ref<HTMLDivElement | null>(null);
const widgetLoading = ref(false);
const widgetFailed = ref(false);
const widgetAttempt = ref(0);
const loginFailure = ref<
  "rejected" | "unavailable" | "rate-limited" | "failed" | null
>(null);
const logoutFailed = ref(false);
const changingSession = ref(false);

// The dashboard refresh owner cancels and clears its snapshot on identity changes.
// Clearing that key here would cancel the new account's initial request.
const clearPrivateData = () => {
  clearNuxtData(["strategies", "audit", "orders", "pnl", "performance"]);
};

// Invalidate successful entries and pending writes before the next account
// renders. Nuxt keeps these entries after the old panels are unmounted.
watch(() => signedInUser.value?.id, clearPrivateData, { flush: "sync" });

const retryWidget = () => {
  loginFailure.value = null;
  widgetAttempt.value += 1;
};

const onTelegramAuth = async (payload: TelegramAuthPayload) => {
  if (changingSession.value) return;
  changingSession.value = true;
  try {
    loginFailure.value = null;
    logoutFailed.value = false;
    const result = await loginWithTelegram(payload);
    clearPrivateData();
    me.value = result;
    await refresh();
  } catch (error) {
    logOperationalError({
      service: "WEB_CLIENT",
      event: "TELEGRAM_LOGIN_FAILED",
      error,
    });
    const status =
      typeof error === "object" && error !== null
        ? ((error as { statusCode?: number; status?: number }).statusCode ??
          (error as { status?: number }).status)
        : undefined;
    loginFailure.value = isUnauthenticated(error)
      ? "rejected"
      : status === 429
        ? "rate-limited"
        : status === undefined || status >= 500
          ? "unavailable"
          : "failed";
  } finally {
    changingSession.value = false;
  }
};

watchPostEffect((onCleanup) => {
  // A manual retry replaces this attempt and runs the same cleanup as logout.
  void widgetAttempt.value;
  if (
    !import.meta.client ||
    !botUsername ||
    authChecking.value ||
    authUnavailable.value ||
    signedInUser.value ||
    !widgetHost.value
  )
    return;
  const host = widgetHost.value;
  widgetLoading.value = true;
  widgetFailed.value = false;

  // The official widget calls a global function on successful auth.
  const authWindow = window as Window & {
    onTelegramAuth?: (payload: TelegramAuthPayload) => void;
  };
  authWindow.onTelegramAuth = onTelegramAuth;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/widgets/login.js?22";
  script.setAttribute("data-telegram-login", botUsername);
  script.setAttribute("data-size", "medium");
  script.setAttribute("data-radius", "8");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");
  const onLoad = () => {
    widgetLoading.value = false;
  };
  const onError = () => {
    widgetLoading.value = false;
    widgetFailed.value = true;
  };
  script.addEventListener("load", onLoad, { once: true });
  script.addEventListener("error", onError, { once: true });
  host.appendChild(script);

  onCleanup(() => {
    script.removeEventListener("load", onLoad);
    script.removeEventListener("error", onError);
    host.replaceChildren();
    if (authWindow.onTelegramAuth === onTelegramAuth) {
      delete authWindow.onTelegramAuth;
    }
  });
});

const onLogout = async () => {
  if (changingSession.value) return;
  changingSession.value = true;
  logoutFailed.value = false;
  try {
    await logout();
    clearPrivateData();
    me.value = { user: null };
  } catch (error) {
    logOperationalError({
      service: "WEB_CLIENT",
      event: "LOGOUT_FAILED",
      error,
    });
    logoutFailed.value = true;
  } finally {
    changingSession.value = false;
  }
};

onUnmounted(clearPrivateData);

const displayName = (user: NonNullable<MeResponse["user"]>) =>
  user.username ? `@${user.username}` : (user.firstName ?? user.telegramUserId);
</script>

<template>
  <div class="tg-login">
    <span v-if="authChecking" class="tg-login__status" role="status">Checking sign-in...</span>
    <template v-else-if="authUnavailable">
      <span class="tg-login__error" role="alert">Sign-in status is unavailable. Try again.</span>
      <UiButton size="compact" :disabled="changingSession" @click="refresh()">Retry sign-in status</UiButton>
    </template>
    <template v-else-if="signedInUser">
      <span class="tg-login__user">
        <svg class="tg-login__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.944 0C5.347 0 0 5.347 0 11.944c0 6.598 5.347 11.945 11.944 11.945 6.598 0 11.945-5.347 11.945-11.945C23.889 5.347 18.542 0 11.944 0Zm5.792 8.157-1.96 9.243c-.145.653-.537.812-1.087.505l-3.005-2.214-1.45 1.396c-.16.16-.295.295-.605.295l.216-3.063 5.575-5.037c.242-.216-.053-.336-.376-.12l-6.892 4.34-2.968-.929c-.645-.201-.657-.645.135-.955l11.6-4.471c.537-.201 1.007.12.817 1.01Z" />
        </svg>
        {{ displayName(signedInUser) }}
      </span>
      <button type="button" class="tg-login__logout" :disabled="changingSession" @click="onLogout">
        {{ changingSession ? "Signing out..." : "Sign out" }}
      </button>
      <span v-if="logoutFailed" class="tg-login__error" role="alert">Sign out failed. Try again.</span>
    </template>
    <template v-else-if="botUsername">
      <div v-show="!widgetFailed" ref="widgetHost" class="tg-login__widget"></div>
      <span v-if="widgetLoading" class="tg-login__status" role="status">Loading Telegram sign-in...</span>
      <template v-if="widgetFailed || loginFailure === 'unavailable'">
        <span v-if="widgetFailed" class="tg-login__error" role="alert">Telegram sign-in could not load.</span>
        <span v-else class="tg-login__error" role="alert">Sign-in is temporarily unavailable. Your Telegram login could not be checked. Try again shortly.</span>
        <UiButton size="compact" :disabled="changingSession" @click="retryWidget">Retry Telegram sign-in</UiButton>
      </template>
      <span v-else-if="loginFailure === 'rejected'" class="tg-login__error" role="alert">Telegram sign-in was not accepted. Sign in again.</span>
      <span v-else-if="loginFailure === 'rate-limited'" class="tg-login__error" role="alert">Too many sign-in attempts. Wait before trying again.</span>
      <span v-else-if="loginFailure === 'failed'" class="tg-login__error" role="alert">Sign-in could not be completed. Try again.</span>
    </template>
    <span v-else class="tg-login__status" role="status">Sign-in unavailable: Telegram login is not configured.</span>
  </div>
</template>

<style scoped>
.tg-login {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.tg-login__user {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-small);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.tg-login__icon {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--color-telegram);
}

.tg-login__logout {
  min-block-size: var(--control-height-compact);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  padding-inline: var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.tg-login__logout:hover:not(:disabled) {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

.tg-login__error {
  font-size: 0.75rem;
  color: var(--color-danger);
}

.tg-login__status {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}
</style>
