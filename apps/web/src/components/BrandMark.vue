<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
  <span class="brand-lockup" :class="{ compact }">
    <img class="brand-symbol" src="/icons/negative25-mark.png" alt="" aria-hidden="true" />
    <span class="brand-type"><strong>negative25</strong><small>Find it</small></span>
  </span>
</template>

<style scoped>
.brand-lockup { align-items: center; display: inline-flex; gap: 10px; }
.brand-symbol { display: block; height: 34px; object-fit: contain; width: 34px; }
:global(:root:not([data-theme='paper']):not([data-theme='mist'])) .brand-symbol { filter: invert(1); }
.brand-type { display: grid; gap: 1px; text-align: left; }
.brand-type strong { font-size: 15px; font-weight: 650; letter-spacing: .015em; line-height: 1; }
.brand-type small { color: var(--muted); font-size: 7px; font-weight: 650; letter-spacing: .12em; line-height: 1; }
.compact .brand-symbol { height: 27px; width: 27px; }
.compact .brand-type strong { font-size: 13px; }
.compact .brand-type small { font-size: 6px; }
</style>
