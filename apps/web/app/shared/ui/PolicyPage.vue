<script setup lang="ts">
const props = defineProps<{
  eyebrow: string;
  title: string;
  lede: string;
}>();
</script>

<template>
  <article class="policy-page">
    <header>
      <p class="policy-page__eyebrow">{{ props.eyebrow }}</p>
      <h1>{{ props.title }}</h1>
      <p class="policy-page__lede">{{ props.lede }}</p>
    </header>
    <slot />
  </article>
</template>

<style scoped>
.policy-page {
  display: grid;
  max-inline-size: 48rem;
  gap: var(--space-8);
  padding-block: var(--space-12) var(--space-16);
}

.policy-page header,
.policy-page :deep(section) {
  display: grid;
  gap: var(--space-3);
}

.policy-page__eyebrow,
.policy-page h1,
.policy-page :deep(h2),
.policy-page :deep(p),
.policy-page :deep(ul) {
  margin: 0;
}

.policy-page__eyebrow {
  color: var(--color-action);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.policy-page h1 {
  font-size: var(--text-page-title);
  line-height: var(--line-tight);
  text-wrap: balance;
}

.policy-page :deep(h2) {
  font-size: var(--text-section-title);
  line-height: var(--line-heading);
}

.policy-page :deep(p),
.policy-page :deep(li) {
  color: var(--color-text-secondary);
  line-height: var(--line-body);
}

.policy-page__lede {
  font-size: var(--text-body-lg);
}

.policy-page :deep(a) {
  color: var(--color-action);
  text-underline-offset: 0.2em;
}

.policy-page :deep(code) {
  font-family: var(--font-mono);
  color: var(--color-simulation);
}
</style>
