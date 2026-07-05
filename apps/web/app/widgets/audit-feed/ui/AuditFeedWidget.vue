<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const { data: audit, refresh: refreshAudit } =
  await useFetch<AuditLog[]>("/api/audit");

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  pollingInterval = setInterval(() => {
    refreshAudit();
  }, 5000);
});

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval);
});

const formatTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
};
</script>

<template>
  <section class="audit-feed">
    <h2 class="audit-feed__title">Audit Engine Feed</h2>
    <div class="audit-feed__list">
      <p v-if="!audit || audit.length === 0" class="audit-feed__empty">No audit logs received yet.</p>
      <div v-for="log in audit" :key="log.id" class="audit-feed__item">
        <header class="audit-feed__item-header">
          <span class="audit-feed__action" :class="`audit-feed__action--${log.action.toLowerCase()}`">
            {{ log.action }}
          </span>
          <span class="audit-feed__time">{{ formatTime(log.createdAt) }}</span>
        </header>
        <div class="audit-feed__payload">
          <span class="audit-feed__payload-text">Entity: {{ log.entityType }} ({{ log.entityId.slice(0, 8) }}...)</span>
          <pre class="audit-feed__json">{{ JSON.stringify(log.payload, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.audit-feed {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
}

.audit-feed__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
}

.audit-feed__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 32rem;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.audit-feed__item {
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-feed__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audit-feed__action {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
}

.audit-feed__action--signal_approved {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.audit-feed__action--dry_run_order_completed {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.audit-feed__action--signal_rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.audit-feed__time {
  font-size: 0.75rem;
  color: #64748b;
}

.audit-feed__payload-text {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.audit-feed__json {
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #cbd5e1;
  overflow-x: auto;
  max-height: 8rem;
}

.audit-feed__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;
  font-style: italic;
}
</style>
