<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type Consent = "granted" | "denied";

const CONSENT_STORAGE_KEY = "dipbot.analytics-consent.v1";
const SCRIPT_ID = "dipbot-ga4";

const config = useRuntimeConfig();
const consent = ref<Consent | null>(null);
const showSettings = ref(false);

const measurementId = computed(() => config.public.gaId.trim());
const analyticsConfigured = computed(
  () =>
    import.meta.env.PROD &&
    /^G-[A-Z0-9]+$/.test(measurementId.value) &&
    measurementId.value !== "G-XXXXXXXXXX",
);

const disableKey = () => `ga-disable-${measurementId.value}`;

const setCollectionDisabled = (disabled: boolean) => {
  (window as unknown as Record<string, unknown>)[disableKey()] = disabled;
};

const loadAnalytics = () => {
  if (!analyticsConfigured.value || consent.value !== "granted") return;

  setCollectionDisabled(false);
  if (document.getElementById(SCRIPT_ID)) return;

  const dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  const queue = dataLayer ?? [];
  (window as unknown as { dataLayer: unknown[] }).dataLayer = queue;
  const gtag = (...args: unknown[]) => queue.push(args);

  gtag("js", new Date());
  gtag("config", measurementId.value, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    anonymize_ip: true,
  });

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId.value)}`;
  document.head.append(script);
};

const saveConsent = (value: Consent) => {
  consent.value = value;
  localStorage.setItem(CONSENT_STORAGE_KEY, value);
  showSettings.value = false;

  if (value === "granted") {
    loadAnalytics();
    return;
  }

  setCollectionDisabled(true);
  document.getElementById(SCRIPT_ID)?.remove();
};

onMounted(() => {
  if (!analyticsConfigured.value) return;
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (stored === "granted" || stored === "denied") consent.value = stored;
  if (consent.value === "granted") loadAnalytics();
});
</script>

<template>
  <aside
    v-if="analyticsConfigured && (consent === null || showSettings)"
    class="analytics-consent"
    aria-labelledby="analytics-consent-title"
  >
    <strong id="analytics-consent-title">Optional anonymous analytics</strong>
    <p>
      Google Analytics stays off unless you allow it. We use page-level traffic
      only—not Telegram identity, strategies, orders, portfolio data or keys.
      You can change this choice at any time.
    </p>
    <div class="analytics-consent__actions">
      <button type="button" @click="saveConsent('denied')">Keep off</button>
      <button
        class="analytics-consent__allow"
        type="button"
        @click="saveConsent('granted')"
      >
        Allow analytics
      </button>
    </div>
  </aside>

  <button
    v-else-if="analyticsConfigured"
    class="analytics-consent__settings"
    type="button"
    @click="showSettings = true"
  >
    Analytics: {{ consent === "granted" ? "on" : "off" }}
  </button>
</template>

<style scoped>
.analytics-consent {
  position: fixed;
  z-index: 50;
  inset-inline: max(1rem, env(safe-area-inset-left))
    max(1rem, env(safe-area-inset-right));
  inset-block-end: max(1rem, env(safe-area-inset-bottom));
  display: grid;
  max-inline-size: 42rem;
  margin-inline: auto;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-2);
}

.analytics-consent p {
  max-inline-size: 70ch;
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.analytics-consent__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.analytics-consent button,
.analytics-consent__settings {
  min-block-size: 2.75rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.analytics-consent__allow {
  border-color: var(--color-action) !important;
  background: var(--color-action) !important;
  color: var(--color-canvas-deep) !important;
}

.analytics-consent__settings {
  position: fixed;
  z-index: 40;
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  inset-block-end: max(1rem, env(safe-area-inset-bottom));
  font-size: var(--text-small);
}

:where(.analytics-consent button, .analytics-consent__settings):focus-visible {
  outline: 3px solid var(--color-action);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .analytics-consent,
  .analytics-consent__settings {
    scroll-behavior: auto;
  }
}
</style>
