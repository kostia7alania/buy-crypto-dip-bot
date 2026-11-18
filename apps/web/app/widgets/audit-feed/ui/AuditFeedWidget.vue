<script setup lang="ts">
import { computed } from "vue";
import { type AuditLog, describeAuditLog } from "~/entities/audit";
import { isUnauthenticated } from "~/shared/lib/http-error";

const props = defineProps<{
  audit?: readonly AuditLog[];
  omitted?: number;
  error?: unknown;
  status: "idle" | "pending" | "success" | "error";
  updatedAt?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const auditUnavailable = computed(
  () =>
    props.status === "error" ||
    Boolean(props.error) ||
    (props.status === "success" && !props.audit),
);
const auditLoading = computed(
  () =>
    props.status === "idle" ||
    (props.status === "pending" &&
      (auditUnavailable.value || !props.audit?.length)),
);
const errorMessage = computed(() =>
  isUnauthenticated(props.error)
    ? "Your session is no longer authorized. Sign in again before loading private decision evidence."
    : "Decision history is unavailable. Try again to load the records.",
);
const records = computed(() =>
  (props.audit ?? []).map((log) => ({ log, ...describeAuditLog(log) })),
);
</script>

<template>
  <section class="audit-feed">
    <h2 id="audit-feed-title" class="audit-feed__title">Decision history</h2>
    <p v-if="!auditUnavailable && (props.omitted ?? 0) > 0" class="audit-feed__notice" role="status">
      Some records could not be verified. The decision history may be incomplete.
    </p>
    <div
      class="audit-feed__scroller"
      role="region"
      aria-labelledby="audit-feed-title"
      :aria-busy="props.status === 'pending'"
      tabindex="0"
    >
      <p v-if="auditLoading" class="audit-feed__empty">Loading decision evidence…</p>
      <div v-else-if="auditUnavailable" class="audit-feed__empty audit-feed__error">
        <p role="alert">{{ errorMessage }}</p>
        <UiButton size="compact" @click="emit('refresh')">Retry decisions</UiButton>
      </div>
      <p v-else-if="records.length === 0" class="audit-feed__empty">
        No verified decision records to show for this account.
      </p>
      <ol v-else class="audit-feed__list" role="list">
        <li v-for="{ log, label, explanation } in records" :key="log.id" class="audit-feed__item">
          <header class="audit-feed__item-header">
            <span
              :id="`audit-event-${log.id}`"
              class="audit-feed__action"
              :class="`audit-feed__action--${log.type.toLowerCase()}`"
            >
              {{ label }}
            </span>
            <NuxtTime
              class="audit-feed__time"
              :datetime="log.createdAt"
              year="numeric"
              month="short"
              day="numeric"
              hour="2-digit"
              minute="2-digit"
              second="2-digit"
            />
          </header>
          <p v-if="explanation" class="audit-feed__explanation">{{ explanation }}</p>
          <details class="audit-feed__evidence">
            <summary :aria-describedby="`audit-event-${log.id}`">View audit record</summary>
            <pre class="audit-feed__json">{{ JSON.stringify(log, null, 2) }}</pre>
          </details>
        </li>
      </ol>
    </div>
    <p class="audit-feed__freshness">
      Last successful refresh:
      <NuxtTime
        v-if="props.updatedAt"
        :datetime="props.updatedAt"
        year="numeric"
        month="short"
        day="numeric"
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
  min-inline-size: 0;
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

.audit-feed__notice {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
}

.audit-feed__scroller {
  max-block-size: 32rem;
  overflow-y: auto;
  padding-inline-end: var(--space-2);
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.audit-feed__scroller:focus-visible,
.audit-feed__evidence summary:focus-visible {
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
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: space-between;
  align-items: center;
}

.audit-feed__action {
  overflow-wrap: anywhere;
  font-size: var(--text-caption);
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-xs);
}

.audit-feed__action--risk_decision_approved {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.audit-feed__action--dry_run_order_completed {
  background: var(--color-simulation-soft);
  color: var(--color-simulation);
}

.audit-feed__action--risk_decision_rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.audit-feed__time {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.audit-feed__explanation {
  margin: 0;
  color: var(--color-text-secondary);
}

.audit-feed__evidence summary {
  padding-block: var(--space-2);
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
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
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  .audit-feed__scroller:focus-visible,
  .audit-feed__evidence summary:focus-visible {
    outline: 3px solid Highlight;
    box-shadow: none;
  }
}
</style>
