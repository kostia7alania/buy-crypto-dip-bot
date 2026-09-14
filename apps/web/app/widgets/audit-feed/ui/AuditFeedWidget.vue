<script setup lang="ts">
import { computed } from "vue";
import type { AuditLog } from "~/entities/audit";
import { isUnauthenticated } from "~/shared/lib/http-error";

const props = defineProps<{
  audit?: readonly AuditLog[];
  error?: unknown;
  status: "idle" | "pending" | "success" | "error";
  updatedAt?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const errorMessage = computed(() =>
  isUnauthenticated(props.error)
    ? "Your session is no longer authorized. Sign in again before loading private decision evidence."
    : "Decision evidence could not be loaded. No empty or successful state is inferred.",
);
const visibleAudit = computed(() => (props.error ? [] : (props.audit ?? [])));
const retryAudit = () => emit("refresh");
</script>

<template>
  <section class="audit-feed">
    <h2 id="audit-feed-title" class="audit-feed__title">Audit Engine Feed</h2>
    <div
      class="audit-feed__scroller"
      role="region"
      aria-labelledby="audit-feed-title"
      :aria-busy="props.status === 'pending'"
      tabindex="0"
    >
      <p v-if="props.status === 'pending' && !props.audit" class="audit-feed__empty">
        Loading decision evidence…
      </p>
      <div v-else-if="props.error" class="audit-feed__empty audit-feed__error">
        <p>{{ errorMessage }}</p>
        <UiButton size="compact" @click="retryAudit">Retry decisions</UiButton>
      </div>
      <p v-else-if="!props.audit || props.audit.length === 0" class="audit-feed__empty">
        No decision records exist for this account yet.
      </p>
      <ol v-else class="audit-feed__list" role="list">
        <li v-for="log in visibleAudit" :key="log.id" class="audit-feed__item">
          <header class="audit-feed__item-header">
            <span class="audit-feed__action" :class="`audit-feed__action--${log.type.toLowerCase()}`">
              {{ log.type }}
            </span>
            <span class="audit-feed__time">
              <NuxtTime :datetime="log.createdAt" hour="2-digit" minute="2-digit" second="2-digit" />
            </span>
          </header>
          <div class="audit-feed__payload">
            <span class="audit-feed__payload-text">Subject: {{ log.subject.type }} ({{ log.subject.id.slice(0, 8) }}...)</span>
            <pre class="audit-feed__json">{{ JSON.stringify(log.payload, null, 2) }}</pre>
          </div>
        </li>
      </ol>
    </div>
    <p class="audit-feed__freshness">
      Last successful refresh:
      <NuxtTime
        v-if="props.updatedAt"
        :datetime="props.updatedAt"
        hour="2-digit"
        minute="2-digit"
        second="2-digit"
      />
      <span v-else>not available</span>
    </p>
  </section>
</template>

<style scoped>
.audit-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.audit-feed__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.audit-feed__scroller {
  max-block-size: 32rem;
  overflow-y: auto;
  padding-inline-end: var(--space-2);
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.audit-feed__scroller:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
  box-shadow: var(--focus-ring);
}

.audit-feed__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-feed__item {
  padding: var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.audit-feed__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audit-feed__action {
  font-size: var(--text-caption);
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-xs);
  text-transform: uppercase;
}

.audit-feed__action--signal_approved {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.audit-feed__action--dry_run_order_completed {
  background: var(--color-simulation-soft);
  color: var(--color-simulation);
}

.audit-feed__action--signal_rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.audit-feed__time {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.audit-feed__payload-text {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.audit-feed__json {
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  background: var(--color-canvas-deep);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
  overflow-x: auto;
  max-block-size: 8rem;
}

.audit-feed__empty {
  margin: 0;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-subtle);
}

.audit-feed__error {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
}

.audit-feed__error p,
.audit-feed__freshness {
  margin: 0;
}

.audit-feed__freshness {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

@media (max-width: 36rem) {
  .audit-feed {
    padding: var(--space-5);
  }
}

@media (forced-colors: active) {
  .audit-feed__scroller:focus-visible {
    outline: 3px solid Highlight;
    box-shadow: none;
  }
}
</style>
