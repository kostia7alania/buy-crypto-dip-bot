<script setup lang="ts">
// Minimal inline icon set (24x24, stroke = currentColor), lucide-flavored.
// No icon-library dependency: each name maps to SVG path data.
const props = defineProps<{
  name:
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
  size?: number;
}>();

const paths: Record<string, string[]> = {
  // shield-check
  shield: [
    "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z",
    "M9.5 12l2 2 3.5-3.5",
  ],
  // falling line that rebounds with an up arrow
  dip: ["M3 6l6 7 3 3 4-4 5-5", "M21 12V7h-5"],
  // paper plane (telegram)
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  // list with checks
  audit: [
    "M9 6h11",
    "M9 12h11",
    "M9 18h11",
    "M4 5.5l1 1 1.5-1.5",
    "M4 11.5l1 1 1.5-1.5",
    "M4 17.5l1 1 1.5-1.5",
  ],
  // balance scale
  scale: [
    "M12 3v18",
    "M8 21h8",
    "M4 7h16",
    "M6 7l-2.5 5a2.5 2.5 0 005 0L6 7z",
    "M18 7l-2.5 5a2.5 2.5 0 005 0L18 7z",
  ],
  // countdown timer
  timer: ["M12 8v4l2.5 2.5", "M12 21a8 8 0 100-16 8 8 0 000 16z", "M9 2h6"],
  // spark / zap
  spark: ["M13 2L4 14h6l-1 8 9-12h-6l1-8z"],
  // wallet
  wallet: [
    "M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
    "M16 12h.01",
    "M3 9h18",
  ],
  // pause (kill switch)
  pause: ["M12 21a9 9 0 100-18 9 9 0 000 18z", "M10 9v6", "M14 9v6"],
  // open source / branch
  open: [
    "M6 9a3 3 0 100-6 3 3 0 000 6z",
    "M18 15a3 3 0 100 6 3 3 0 000-6z",
    "M6 9v3a6 6 0 006 6h3",
  ],
};
</script>

<template>
  <svg
    :width="props.size ?? 24"
    :height="props.size ?? 24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[props.name]" :key="i" :d="d" />
  </svg>
</template>
