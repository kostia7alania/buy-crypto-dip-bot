<script setup lang="ts">
interface RiskStatus {
  mode: string;
  liveTradingEnabled: boolean;
  orderLikeActionsRequireApproval: boolean;
}

const { data: risk } = await useFetch<RiskStatus>("/api/risk-status", {
  key: "risk-status",
});
</script>

<template>
  <section class="risk-guard">
    <h2 class="risk-guard__title">Risk Guard Posture</h2>
    <dl class="risk-guard__grid">
      <div class="risk-guard__card">
        <dt class="risk-guard__label">System Mode</dt>
        <dd class="risk-guard__value risk-guard__value--cyan">{{ risk?.mode ?? 'DRY_RUN' }}</dd>
      </div>
      <div class="risk-guard__card">
        <dt class="risk-guard__label">Live Trading Status</dt>
        <dd
          class="risk-guard__value"
          :class="risk?.liveTradingEnabled ? 'risk-guard__value--green' : 'risk-guard__value--red'"
        >
          {{ risk?.liveTradingEnabled ? 'ENABLED' : 'DISABLED' }}
        </dd>
      </div>
      <div class="risk-guard__card">
        <dt class="risk-guard__label">Order Approval Gate</dt>
        <dd class="risk-guard__value risk-guard__value--cyan">
          {{ risk?.orderLikeActionsRequireApproval === false ? 'BYPASSED' : 'REQUIRED' }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.risk-guard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.risk-guard__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #cbd5e1;
  letter-spacing: -0.02em;
}

.risk-guard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1.25rem;
  margin: 0;
}

.risk-guard__card {
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem;
  background: rgba(30, 41, 59, 0.3);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.25s, transform 0.25s;
}

.risk-guard__card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}

.risk-guard__label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.risk-guard__value {
  margin: 0;
  color: #f1f5f9;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.risk-guard__value--cyan {
  color: #67e8f9 !important;
}

.risk-guard__value--green {
  color: #4ade80 !important;
}

.risk-guard__value--red {
  color: #f87171 !important;
}
</style>
