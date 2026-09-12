<script setup lang="ts">
import { logOperationalError } from "@buy-crypto-dip-bot/shared-types";
import { onUnmounted, ref, watch, watchPostEffect } from "vue";
import {
  loginWithTelegram,
  logout,
  type MeResponse,
  type TelegramAuthPayload,
} from "~/entities/user";

const config = useRuntimeConfig();
const botUsername = config.public.telegramBotUsername;

const { data: me, refresh } = await useFetch<MeResponse>("/api/auth/me", {
  key: "auth-me",
});

const widgetHost = ref<HTMLDivElement | null>(null);
const loginFailed = ref(false);
const logoutFailed = ref(false);
const changingSession = ref(false);

const clearPrivateData = () => {
  clearNuxtData([
    "strategies",
    "audit",
    "orders",
    "pnl",
    "performance",
    "risk-status",
  ]);
};

// Invalidate successful entries and pending writes before the next account
// renders. Nuxt keeps these entries after the old panels are unmounted.
watch(() => me.value?.user?.id, clearPrivateData, { flush: "sync" });

const onTelegramAuth = async (payload: TelegramAuthPayload) => {
  if (changingSession.value) return;
  changingSession.value = true;
  try {
    loginFailed.value = false;
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
    loginFailed.value = true;
  } finally {
    changingSession.value = false;
  }
};

watchPostEffect((onCleanup) => {
  if (
    !import.meta.client ||
    !botUsername ||
    me.value?.user ||
    !widgetHost.value
  )
    return;
  const host = widgetHost.value;

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
  host.appendChild(script);

  onCleanup(() => {
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
    <template v-if="me?.user">
      <span class="tg-login__user">
        <svg class="tg-login__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.944 0C5.347 0 0 5.347 0 11.944c0 6.598 5.347 11.945 11.944 11.945 6.598 0 11.945-5.347 11.945-11.945C23.889 5.347 18.542 0 11.944 0Zm5.792 8.157-1.96 9.243c-.145.653-.537.812-1.087.505l-3.005-2.214-1.45 1.396c-.16.16-.295.295-.605.295l.216-3.063 5.575-5.037c.242-.216-.053-.336-.376-.12l-6.892 4.34-2.968-.929c-.645-.201-.657-.645.135-.955l11.6-4.471c.537-.201 1.007.12.817 1.01Z" />
        </svg>
        {{ displayName(me.user) }}
      </span>
      <button type="button" class="tg-login__logout" :disabled="changingSession" @click="onLogout">
        {{ changingSession ? "Signing out..." : "Sign out" }}
      </button>
      <span v-if="logoutFailed" class="tg-login__error" role="alert">Sign out failed. Try again.</span>
    </template>
    <template v-else-if="botUsername">
      <div ref="widgetHost" class="tg-login__widget"></div>
      <span v-if="loginFailed" class="tg-login__error" role="alert">Login failed. Try again.</span>
    </template>
    <!-- No bot username configured: render nothing, the dashboard stays usable. -->
  </div>
</template>

<style scoped>
.tg-login {
  display: flex;
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
</style>
