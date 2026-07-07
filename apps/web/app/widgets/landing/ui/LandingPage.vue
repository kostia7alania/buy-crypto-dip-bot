<script setup lang="ts">
import { computed } from "vue";

interface Faq {
  q: string;
  a: string;
}

const props = defineProps<{
  eyebrow: string;
  title: string;
  description: string;
  headline: string;
  subheadline: string;
  features: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faqs: Faq[];
}>();

const config = useRuntimeConfig();
const route = useRoute();
const url = computed(
  () => `${config.public.siteUrl}${route.path === "/" ? "" : route.path}`,
);

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
      <p class="landing__eyebrow">{{ props.eyebrow }}</p>
      <h1 class="landing__headline">{{ props.headline }}</h1>
      <p class="landing__subheadline">{{ props.subheadline }}</p>
      <div class="landing__cta">
        <NuxtLink to="/dashboard" class="landing__btn landing__btn--primary">
          Open the live dashboard
        </NuxtLink>
      </div>
    </section>

    <section class="landing__section">
      <h2 class="landing__section-title">What you get</h2>
      <div class="landing__grid">
        <div v-for="f in props.features" :key="f.title" class="landing__card">
          <h3 class="landing__card-title">{{ f.title }}</h3>
          <p class="landing__card-body">{{ f.body }}</p>
        </div>
      </div>
    </section>

    <section class="landing__section">
      <h2 class="landing__section-title">How it works</h2>
      <ol class="landing__steps">
        <li v-for="(s, i) in props.steps" :key="s.title" class="landing__step">
          <span class="landing__step-num">{{ i + 1 }}</span>
          <div>
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
          <summary class="landing__faq-q">{{ f.q }}</summary>
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
  gap: 4rem;
  padding-block: 4rem 5rem;
}

.landing__hero {
  display: grid;
  gap: 1.25rem;
}

.landing__eyebrow {
  margin: 0;
  color: #67e8f9;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  overflow-wrap: break-word;
}

.landing__headline {
  max-inline-size: 18ch;
  margin: 0;
  font-size: clamp(2rem, 8vw, 3.75rem);
  line-height: 1.05;
  font-weight: 800;
  overflow-wrap: break-word;
  background: linear-gradient(135deg, #ffffff 30%, #a5f3fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.landing__subheadline {
  max-inline-size: 44rem;
  margin: 0;
  color: #cbd5e1;
  font-size: 1.2rem;
  line-height: 1.6;
}

.landing__cta {
  margin-top: 0.5rem;
}

.landing__btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 0.6rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.landing__btn--primary {
  background: rgba(103, 232, 249, 0.12);
  color: #67e8f9;
  border: 1px solid rgba(103, 232, 249, 0.3);
}

.landing__btn--primary:hover {
  background: rgba(103, 232, 249, 0.22);
}

.landing__section-title {
  margin: 0 0 1.75rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: #f1f5f9;
}

.landing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1.25rem;
}

.landing__card {
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem;
  background: rgba(30, 41, 59, 0.25);
}

.landing__card-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #f8fafc;
}

.landing__card-body {
  margin: 0;
  color: #94a3b8;
  line-height: 1.6;
}

.landing__steps {
  display: grid;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.landing__step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.landing__step-num {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(103, 232, 249, 0.12);
  color: #67e8f9;
  font-weight: 700;
}

.landing__faqs {
  display: grid;
  gap: 0.75rem;
}

.landing__faq {
  padding: 1rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.4);
}

.landing__faq-q {
  cursor: pointer;
  font-weight: 600;
  color: #e2e8f0;
}

.landing__faq-a {
  margin: 0.75rem 0 0;
  color: #94a3b8;
  line-height: 1.6;
}

.landing__card-body,
.landing__faq-a,
.landing__subheadline {
  overflow-wrap: break-word;
}
</style>
