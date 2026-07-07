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
const iconFor = (f: { icon?: IconName }, i: number) =>
  f.icon ?? fallbackIcons[i % fallbackIcons.length]!;

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

// Structured data: FAQ rich results + SoftwareApplication.
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
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
            Watch it trade live
          </NuxtLink>
          <a href="#how" class="landing__btn landing__btn--ghost">
            How it works
          </a>
        </div>
      </div>

      <!-- Product visual: the dip, the buy, the rebound -->
      <figure class="landing__chart" aria-hidden="true">
        <svg viewBox="0 0 480 300" class="landing__chart-svg">
          <!-- grid -->
          <path
            class="landing__chart-grid"
            d="M0 60H480M0 120H480M0 180H480M0 240H480M60 0V300M120 0V300M180 0V300M240 0V300M300 0V300M360 0V300M420 0V300"
          />
          <!-- calendar DCA ghost line -->
          <path
            class="landing__chart-ghost"
            d="M0 150 L480 118"
          />
          <!-- price path: slide, dip, rebound -->
          <path
            class="landing__chart-price"
            d="M0 90 C60 95 90 110 130 150 C160 180 185 215 220 222 C250 227 270 205 300 175 C340 135 390 95 480 60"
          />
          <!-- buy marker at the dip -->
          <circle class="landing__chart-pulse" cx="220" cy="222" r="16" />
          <circle class="landing__chart-buy" cx="220" cy="222" r="7" />
          <g class="landing__chart-tag" transform="translate(196, 248)">
            <rect width="66" height="26" rx="7" />
            <text x="33" y="17.5" text-anchor="middle">BUY</text>
          </g>
          <!-- result badge -->
          <g class="landing__chart-badge" transform="translate(336, 26)">
            <rect width="118" height="30" rx="8" />
            <text x="59" y="20" text-anchor="middle">beats DCA ✓</text>
          </g>
        </svg>
        <figcaption class="landing__chart-caption">
          Dry-run simulation, benchmarked against calendar DCA
        </figcaption>
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
  gap: 4.5rem;
  padding-block: 3.5rem 5rem;
}

/* ---- Hero ---------------------------------------------------------- */

.landing__hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
  gap: 2.5rem;
  align-items: center;
}

.landing__hero-copy {
  display: grid;
  gap: 1.25rem;
  justify-items: start;
}

.landing__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-small);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  overflow-wrap: break-word;
}

.landing__headline {
  max-inline-size: 16ch;
  margin: 0;
  font-size: var(--text-hero);
  line-height: 1.04;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: break-word;
  background: linear-gradient(135deg, #ffffff 30%, #a5f3fc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.landing__subheadline {
  max-inline-size: 40rem;
  margin: 0;
  color: var(--text-2);
  font-size: 1.15rem;
  line-height: 1.65;
  overflow-wrap: break-word;
}

.landing__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.landing__btn {
  display: inline-block;
  padding: 0.8rem 1.5rem;
  border-radius: var(--radius-m);
  font-weight: 650;
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
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}

.landing__btn--primary:hover {
  background: rgba(103, 232, 249, 0.22);
}

.landing__btn--ghost {
  color: var(--text-3);
  border: 1px solid transparent;
}

.landing__btn--ghost:hover {
  color: var(--text-1);
  border-color: var(--border-2);
}

/* ---- Hero chart ----------------------------------------------------- */

.landing__chart {
  margin: 0;
  display: grid;
  gap: 0.6rem;
  padding: 1.25rem 1.25rem 1rem;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-l);
  background: var(--surface-2);
  box-shadow: var(--shadow-2);
}

.landing__chart-svg {
  inline-size: 100%;
  block-size: auto;
}

.landing__chart-grid {
  stroke: rgba(255, 255, 255, 0.045);
  stroke-width: 1;
  fill: none;
}

.landing__chart-ghost {
  stroke: var(--text-4);
  stroke-width: 2;
  stroke-dasharray: 6 7;
  fill: none;
  opacity: 0.6;
}

.landing__chart-price {
  stroke: var(--accent);
  stroke-width: 3.5;
  stroke-linecap: round;
  fill: none;
}

.landing__chart-buy {
  fill: var(--success);
}

.landing__chart-pulse {
  fill: var(--success);
  opacity: 0.18;
}

.landing__chart-tag rect {
  fill: var(--success-soft);
  stroke: rgba(74, 222, 128, 0.4);
}

.landing__chart-tag text {
  fill: var(--success);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.landing__chart-badge rect {
  fill: var(--surface-3);
  stroke: var(--border-2);
}

.landing__chart-badge text {
  fill: var(--text-2);
  font-size: 13.5px;
  font-weight: 650;
}

.landing__chart-caption {
  color: var(--text-4);
  font-size: var(--text-tiny);
  text-align: center;
}

@media (prefers-reduced-motion: no-preference) {
  .landing__chart-price {
    stroke-dasharray: 720;
    stroke-dashoffset: 720;
    animation: draw-price 1.6s var(--ease-out) 0.2s forwards;
  }

  .landing__chart-buy,
  .landing__chart-tag {
    opacity: 0;
    animation: pop-in 0.4s var(--ease-out) 1.1s forwards;
  }

  .landing__chart-badge {
    opacity: 0;
    animation: pop-in 0.4s var(--ease-out) 1.7s forwards;
  }

  .landing__chart-pulse {
    transform-origin: 220px 222px;
    animation: pulse-ring 2.4s ease-out 1.6s infinite;
  }

  @keyframes draw-price {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      translate: 0 6px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes pulse-ring {
    0% {
      scale: 0.45;
      opacity: 0.35;
    }
    70% {
      scale: 1.15;
      opacity: 0;
    }
    100% {
      scale: 1.15;
      opacity: 0;
    }
  }
}

/* ---- Sections -------------------------------------------------------- */

.landing__section-title {
  margin: 0 0 1.75rem;
  font-size: var(--text-h2);
  font-weight: 750;
  letter-spacing: -0.015em;
  color: var(--text-1);
}

/* Bento: first card spans two tracks on wide screens */
.landing__bento {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
  gap: 1.1rem;
}

.landing__card {
  display: grid;
  gap: 0.6rem;
  align-content: start;
  padding: 1.4rem;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-m);
  background: var(--surface-1);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.landing__card:hover {
  border-color: var(--border-2);
  transform: translateY(-2px);
}

@media (min-width: 48rem) {
  .landing__card--wide {
    grid-column: span 2;
    background:
      radial-gradient(
        120% 140% at 100% 0%,
        rgba(103, 232, 249, 0.08),
        transparent 55%
      ),
      var(--surface-1);
  }
}

.landing__card-icon {
  display: grid;
  place-items: center;
  inline-size: 2.4rem;
  block-size: 2.4rem;
  border-radius: var(--radius-s);
  background: var(--accent-soft);
  color: var(--accent);
}

.landing__card-title {
  margin: 0;
  font-size: var(--text-h3);
  font-weight: 700;
  color: var(--text-1);
}

.landing__card-body {
  margin: 0;
  color: var(--text-3);
  line-height: 1.6;
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
  gap: 1.1rem;
  align-items: flex-start;
  padding-block: 1.1rem;
}

.landing__step:not(:last-child)::before {
  content: "";
  position: absolute;
  inset-inline-start: calc(1.25rem - 1px);
  inset-block-start: 3.4rem;
  inline-size: 2px;
  block-size: calc(100% - 2.9rem);
  background: linear-gradient(var(--accent-border), var(--border-1));
}

.landing__step-num {
  flex-shrink: 0;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  font-weight: 750;
  font-family: var(--font-mono);
}

.landing__step-body {
  display: grid;
  gap: 0.35rem;
  padding-top: 0.45rem;
}

/* ---- FAQ -------------------------------------------------------------- */

.landing__faqs {
  display: grid;
  gap: 0.7rem;
  max-inline-size: 52rem;
}

.landing__faq {
  padding: 0;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-m);
  background: var(--surface-2);
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.landing__faq[open] {
  border-color: var(--accent-border);
}

.landing__faq-q {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-2);
  list-style: none;
  transition: color var(--dur-fast) var(--ease-out);
}

.landing__faq-q::-webkit-details-marker {
  display: none;
}

.landing__faq-q:hover {
  color: var(--text-1);
}

.landing__faq-chevron {
  flex-shrink: 0;
  color: var(--text-4);
  transition: rotate var(--dur-med) var(--ease-out);
}

.landing__faq[open] .landing__faq-chevron {
  rotate: 180deg;
  color: var(--accent);
}

.landing__faq-a {
  margin: 0;
  padding: 0 1.25rem 1.15rem;
  color: var(--text-3);
  line-height: 1.65;
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
</style>
