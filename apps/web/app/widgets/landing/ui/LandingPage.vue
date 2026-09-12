<script setup lang="ts">
import { computed } from "vue";

interface Faq {
  q: string;
  a: string;
}

type IconName =
  | "shield"
  | "dip"
  | "send"
  | "audit"
  | "scale"
  | "timer"
  | "spark"
  | "wallet"
  | "pause"
  | "open";

const props = defineProps<{
  eyebrow: string;
  title: string;
  description: string;
  headline: string;
  subheadline: string;
  features: { title: string; body: string; icon?: IconName }[];
  steps: { title: string; body: string }[];
  faqs: Faq[];
}>();

// Pages that don't pick icons get a sensible rotation.
const fallbackIcons: IconName[] = [
  "shield",
  "dip",
  "send",
  "audit",
  "scale",
  "wallet",
];
const statusGlossary = [
  {
    term: "Detected",
    definition:
      "A configured market condition matched. No risk approval or order is implied.",
  },
  {
    term: "Approved",
    definition:
      "Risk checks passed for that recorded decision. This is not an exchange acceptance or fill.",
  },
  {
    term: "Rejected",
    definition:
      "A limit, cooldown or other policy blocked the proposed dry-run action.",
  },
  {
    term: "Simulated",
    definition:
      "A local DRY_RUN outcome. No exchange order, fill, fee or asset transfer occurred.",
  },
  {
    term: "Accepted / Filled",
    definition:
      "Reserved for future external evidence. The current product does not emit these exchange states.",
  },
  {
    term: "Unknown / Stale",
    definition:
      "Evidence is ambiguous or too old for a safe conclusion; the product must not present it as success.",
  },
];
const iconFor = (f: { icon?: IconName }, i: number) =>
  f.icon ?? fallbackIcons[i % fallbackIcons.length] ?? "shield";

const config = useRuntimeConfig();
const route = useRoute();
const url = computed(
  () => `${config.public.siteUrl}${route.path === "/" ? "" : route.path}`,
);

// Don't append the site-wide "· Buy Crypto Dip Bot" suffix when the page
// title already carries the brand (e.g. the homepage) — duplicated brand
// wastes SERP title width.
if (props.title.includes("Buy Crypto Dip Bot")) {
  useHead({ titleTemplate: null });
}

// Meta + Open Graph / Twitter cards for rich link previews and ranking.
useSeoMeta({
  title: props.title,
  description: props.description,
  ogTitle: props.title,
  ogDescription: props.description,
  ogType: "website",
  ogUrl: () => url.value,
  ogSiteName: "Buy Crypto Dip Bot",
  twitterCard: "summary_large_image",
  twitterTitle: props.title,
  twitterDescription: props.description,
});

// Structured data: FAQ rich results + SoftwareApplication. There is no Offer:
// this repository does not currently sell a hosted product or tariff.
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() =>
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: props.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      ),
    },
    {
      type: "application/ld+json",
      innerHTML: computed(() =>
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: props.title,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web, Telegram",
          description: props.description,
        }),
      ),
    },
  ],
});
</script>

<template>
  <div class="landing">
    <section class="landing__hero">
      <div class="landing__hero-copy">
        <p class="landing__eyebrow">{{ props.eyebrow }}</p>
        <h1 class="landing__headline">{{ props.headline }}</h1>
        <p class="landing__subheadline">{{ props.subheadline }}</p>
        <div class="landing__cta">
          <NuxtLink to="/dashboard" class="landing__btn landing__btn--primary">
            Open the dry-run console
          </NuxtLink>
          <a href="#how" class="landing__btn landing__btn--ghost">
            How it works
          </a>
        </div>
      </div>

      <figure class="landing__evidence" aria-labelledby="evidence-title">
        <figcaption class="landing__evidence-header">
          <span class="landing__evidence-kicker">Illustrative decision trace</span>
          <strong id="evidence-title" class="landing__evidence-title">
            A signal must leave evidence
          </strong>
        </figcaption>
        <ol class="landing__evidence-list">
          <li class="landing__evidence-step landing__evidence-step--detected">
            <span class="landing__evidence-icon" aria-hidden="true">
              <UiIcon name="dip" :size="18" />
            </span>
            <div class="landing__evidence-copy">
              <strong>Signal detected</strong>
              <span>24h drawdown crossed the strategy threshold.</span>
              <code>BTCUSDT · 14:32:08</code>
            </div>
            <span class="landing__evidence-status">Detected</span>
          </li>
          <li class="landing__evidence-step landing__evidence-step--approved">
            <span class="landing__evidence-icon" aria-hidden="true">
              <UiIcon name="shield" :size="18" />
            </span>
            <div class="landing__evidence-copy">
              <strong>RiskGuard checked</strong>
              <span>Daily cap, weekly cap and cooldown cleared.</span>
              <code>LIMITS · 14:32:09</code>
            </div>
            <span class="landing__evidence-status">Approved</span>
          </li>
          <li class="landing__evidence-step landing__evidence-step--simulated">
            <span class="landing__evidence-icon" aria-hidden="true">
              <UiIcon name="audit" :size="18" />
            </span>
            <div class="landing__evidence-copy">
              <strong>Dry-run order queued</strong>
              <span>20 USDT simulated. No exchange funds touched.</span>
              <code>DRY_RUN · 14:32:10</code>
            </div>
            <span class="landing__evidence-status">Simulated</span>
          </li>
        </ol>
        <p class="landing__evidence-note">
          Covered approvals, rejections and simulated orders stay on the record.
        </p>
      </figure>
    </section>

    <section class="landing__section">
      <h2 class="landing__section-title">What you get</h2>
      <div class="landing__bento">
        <div
          v-for="(f, i) in props.features"
          :key="f.title"
          class="landing__card"
          :class="{ 'landing__card--wide': i === 0 }"
        >
          <span class="landing__card-icon">
            <UiIcon :name="iconFor(f, i)" :size="22" />
          </span>
          <h3 class="landing__card-title">{{ f.title }}</h3>
          <p class="landing__card-body">{{ f.body }}</p>
        </div>
      </div>
    </section>

    <section class="landing__section" aria-labelledby="status-glossary-title">
      <h2 id="status-glossary-title" class="landing__section-title">
        Safety Ledger status glossary
      </h2>
      <dl class="landing__glossary">
        <div
          v-for="entry in statusGlossary"
          :key="entry.term"
          class="landing__glossary-entry"
        >
          <dt>{{ entry.term }}</dt>
          <dd>{{ entry.definition }}</dd>
        </div>
      </dl>
    </section>

    <section id="how" class="landing__section">
      <h2 class="landing__section-title">How it works</h2>
      <ol class="landing__steps">
        <li v-for="(s, i) in props.steps" :key="s.title" class="landing__step">
          <span class="landing__step-num">{{ i + 1 }}</span>
          <div class="landing__step-body">
            <h3 class="landing__card-title">{{ s.title }}</h3>
            <p class="landing__card-body">{{ s.body }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="landing__section">
      <h2 class="landing__section-title">Frequently asked questions</h2>
      <div class="landing__faqs">
        <details v-for="f in props.faqs" :key="f.q" class="landing__faq">
          <summary class="landing__faq-q">
            <span>{{ f.q }}</span>
            <svg class="landing__faq-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <p class="landing__faq-a">{{ f.a }}</p>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
  padding-block: var(--space-16) var(--space-20);
}

/* ---- Hero ---------------------------------------------------------- */

.landing__hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(25rem, 1.1fr);
  gap: clamp(var(--space-8), 5vw, var(--space-16));
  align-items: center;
}

.landing__hero-copy {
  display: grid;
  gap: var(--space-5);
  justify-items: start;
}

.landing__glossary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-3);
  margin: 0;
}

.landing__glossary-entry {
  padding: var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.landing__glossary dt {
  color: var(--color-text-primary);
  font-weight: 700;
}

.landing__glossary dd {
  max-inline-size: 70ch;
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  line-height: var(--line-body);
}

.landing__eyebrow {
  margin: 0;
  color: var(--color-action);
  font-size: var(--text-small);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  overflow-wrap: break-word;
}

.landing__headline {
  max-inline-size: 16ch;
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--text-display);
  line-height: var(--line-tight);
  font-weight: 800;
  letter-spacing: -0.045em;
  overflow-wrap: break-word;
  text-wrap: balance;
}

.landing__subheadline {
  max-inline-size: 40rem;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--text-body-lg);
  line-height: var(--line-body);
  overflow-wrap: break-word;
}

.landing__cta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-block-start: var(--space-1);
}

.landing__btn {
  min-block-size: var(--control-height);
  display: inline-flex;
  align-items: center;
  padding-inline: var(--space-5);
  border-radius: var(--radius-sm);
  font-weight: 700;
  text-decoration: none;
  transition:
    background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.landing__btn:active {
  transform: translateY(1px);
}

.landing__btn--primary {
  color: var(--color-canvas-deep);
  background: var(--color-action);
  border: 1px solid var(--color-action);
}

.landing__btn--primary:hover {
  background: var(--color-action-strong);
  border-color: var(--color-action-strong);
}

.landing__btn--ghost {
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.landing__btn--ghost:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}

/* ---- Evidence rail -------------------------------------------------- */

.landing__evidence {
  margin: 0;
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-2);
}

.landing__evidence-header {
  display: grid;
  gap: var(--space-1);
  padding-block-end: var(--space-4);
  border-block-end: 1px solid var(--color-border-subtle);
}

.landing__evidence-kicker {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.landing__evidence-title {
  color: var(--color-text-primary);
  font-size: var(--text-panel-title);
  line-height: var(--line-heading);
}

.landing__evidence-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.landing__evidence-step {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.landing__evidence-step:not(:last-child)::after {
  content: "";
  position: absolute;
  z-index: 1;
  inset-block-start: calc(100% + 1px);
  inset-inline-start: 2.05rem;
  inline-size: 1px;
  block-size: var(--space-2);
  background: var(--color-border-strong);
}

.landing__evidence-icon {
  inline-size: 2rem;
  block-size: 2rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-action-border);
  border-radius: var(--radius-sm);
  color: var(--color-action);
  background: var(--color-action-soft);
}

.landing__evidence-copy {
  min-inline-size: 0;
  display: grid;
  gap: var(--space-1);
}

.landing__evidence-copy strong {
  color: var(--color-text-primary);
  font-size: var(--text-small);
}

.landing__evidence-copy span {
  color: var(--color-text-muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.landing__evidence-copy code {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  letter-spacing: 0.035em;
}

.landing__evidence-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-action-border);
  border-radius: var(--radius-pill);
  color: var(--color-action);
  background: var(--color-action-soft);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.landing__evidence-status::before {
  content: "";
  inline-size: 0.375rem;
  block-size: 0.375rem;
  border-radius: 50%;
  background: currentColor;
}

.landing__evidence-step--approved .landing__evidence-icon,
.landing__evidence-step--approved .landing__evidence-status {
  color: var(--color-success);
  border-color: var(--color-success-border);
  background: var(--color-success-soft);
}

.landing__evidence-step--simulated .landing__evidence-icon,
.landing__evidence-step--simulated .landing__evidence-status {
  color: var(--color-simulation);
  border-color: var(--color-simulation-border);
  background: var(--color-simulation-soft);
}

.landing__evidence-note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-caption);
  line-height: 1.5;
  text-align: center;
}

@media (prefers-reduced-motion: no-preference) {
  .landing__evidence-step {
    opacity: 0;
    animation: evidence-in var(--duration-medium) var(--ease-standard) forwards;
  }

  .landing__evidence-step:nth-child(2) {
    animation-delay: 120ms;
  }

  .landing__evidence-step:nth-child(3) {
    animation-delay: 240ms;
  }

  @keyframes evidence-in {
    from {
      opacity: 0;
      translate: 0 var(--space-2);
    }

    to {
      opacity: 1;
      translate: 0 0;
    }
  }
}

/* ---- Sections -------------------------------------------------------- */

.landing__section-title {
  margin: 0 0 var(--space-6);
  font-size: var(--text-section-title);
  font-weight: 750;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  text-wrap: balance;
}

/* Bento: first card spans two tracks on wide screens */
.landing__bento {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
  gap: var(--space-3);
}

.landing__card {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  padding: var(--space-5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.landing__card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-2px);
}

@media (min-width: 48rem) {
  .landing__card--wide {
    grid-column: span 2;
    background:
      linear-gradient(
        90deg,
        var(--color-action-soft),
        transparent 65%
      ),
      var(--color-surface-raised);
  }
}

.landing__card-icon {
  display: grid;
  place-items: center;
  inline-size: 2.4rem;
  block-size: 2.4rem;
  border-radius: var(--radius-sm);
  background: var(--color-action-soft);
  color: var(--color-action);
}

.landing__card-title {
  margin: 0;
  font-size: var(--text-h3);
  font-weight: 700;
  color: var(--color-text-primary);
}

.landing__card-body {
  margin: 0;
  color: var(--color-text-muted);
  line-height: var(--line-body);
  overflow-wrap: break-word;
}

/* ---- Steps with a connecting rail ------------------------------------ */

.landing__steps {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  max-inline-size: 46rem;
}

.landing__step {
  position: relative;
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  padding-block: var(--space-4);
}

.landing__step:not(:last-child)::before {
  content: "";
  position: absolute;
  inset-inline-start: calc(1.25rem - 1px);
  inset-block-start: 3.4rem;
  inline-size: 2px;
  block-size: calc(100% - 2.9rem);
  background: linear-gradient(
    var(--color-action-border),
    var(--color-border-subtle)
  );
}

.landing__step-num {
  flex-shrink: 0;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-action-soft);
  border: 1px solid var(--color-action-border);
  color: var(--color-action);
  font-weight: 750;
  font-family: var(--font-mono);
}

.landing__step-body {
  display: grid;
  gap: var(--space-1);
  padding-block-start: var(--space-2);
}

/* ---- FAQ -------------------------------------------------------------- */

.landing__faqs {
  display: grid;
  gap: var(--space-3);
  max-inline-size: 52rem;
}

.landing__faq {
  padding: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.landing__faq[open] {
  border-color: var(--color-action-border);
}

.landing__faq-q {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text-secondary);
  list-style: none;
  transition: color var(--dur-fast) var(--ease-out);
}

.landing__faq-q::-webkit-details-marker {
  display: none;
}

.landing__faq-q:hover {
  color: var(--color-text-primary);
}

.landing__faq-chevron {
  flex-shrink: 0;
  color: var(--color-text-subtle);
  transition: rotate var(--dur-med) var(--ease-out);
}

.landing__faq[open] .landing__faq-chevron {
  rotate: 180deg;
  color: var(--color-action);
}

.landing__faq-a {
  margin: 0;
  padding: 0 1.25rem 1.15rem;
  color: var(--color-text-muted);
  line-height: var(--line-body);
  overflow-wrap: break-word;
}

/* Smooth expand where ::details-content is supported (progressive) */
@supports selector(::details-content) {
  .landing__faq::details-content {
    block-size: 0;
    overflow: clip;
    transition:
      block-size var(--dur-med) var(--ease-out),
      content-visibility var(--dur-med) allow-discrete;
  }

  .landing__faq[open]::details-content {
    block-size: auto;
  }
}

/* ---- Scroll reveal (progressive, motion-safe) ------------------------- */

@media (prefers-reduced-motion: no-preference) {
  @supports ((animation-timeline: view()) and (animation-range: entry)) {
    @keyframes rise-in {
      from {
        opacity: 0;
        translate: 0 22px;
      }
    }

    .landing__card,
    .landing__step,
    .landing__faq {
      animation: rise-in auto var(--ease-out) backwards;
      animation-timeline: view();
      animation-range: entry 0% entry 45%;
    }
  }
}

@media (max-width: 52rem) {
  .landing__hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 34rem) {
  .landing {
    padding-block-start: var(--space-10);
  }

  .landing__evidence {
    padding: var(--space-4);
  }

  .landing__evidence-step {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .landing__evidence-status {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
