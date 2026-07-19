<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchMe,
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

onMounted(() => {
  if (!botUsername || me.value?.user || !widgetHost.value) return;

  // The official widget calls a global function on successful auth.
  (
    window as Window & {
      onTelegramAuth?: (payload: TelegramAuthPayload) => void;
    }
  ).onTelegramAuth = async (payload: TelegramAuthPayload) => {
    try {
      loginFailed.value = false;
      await loginWithTelegram(payload);
      await refresh();
    } catch (error) {
      console.error("Telegram login failed:", error);
      loginFailed.value = true;
    }
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/widgets/login.js?22";
  script.setAttribute("data-telegram-login", botUsername);
  script.setAttribute("data-size", "medium");
  script.setAttribute("data-radius", "8");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");
  widgetHost.value.appendChild(script);
});

const onLogout = async () => {
  await logout();
  await refresh();
};

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
      <button type="button" class="tg-login__logout" @click="onLogout">
        Sign out
      </button>
    </template>
    <template v-else-if="botUsername">
      <div ref="widgetHost" class="tg-login__widget"></div>
      <span v-if="loginFailed" class="tg-login__error">Login failed — try again</span>
    </template>
    <!-- No bot username configured: render nothing, the dashboard stays usable. -->
  </div>
</template>

<style scoped>
.tg-login {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tg-login__user {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text, #e2e8f0);
}

.tg-login__icon {
  width: 1.05rem;
  height: 1.05rem;
  color: #229ed9;
}

.tg-login__logout {
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  background: transparent;
  color: inherit;
  font-size: 0.75rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}

.tg-login__logout:hover {
  opacity: 1;
}

.tg-login__error {
  font-size: 0.75rem;
  color: #f87171;
}
</style>
