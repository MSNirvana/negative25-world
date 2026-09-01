<script setup lang="ts">
import { GalleryHorizontal, Map } from 'lucide-vue-next';
import { useLocale } from '../i18n';
defineProps<{ active: 'gallery' | 'discover' }>();
defineEmits<{ (event: 'select', value: 'gallery' | 'discover'): void }>();
const { t } = useLocale();
</script>

<template>
  <div class="view-selector" role="tablist" :aria-label="t('view.tabs')">
    <button :class="{ active: active === 'gallery' }" role="tab" :aria-selected="active === 'gallery'" @click="$emit('select', 'gallery')"><GalleryHorizontal :size="15" /> {{ t('view.gallery') }}</button>
    <button :class="{ active: active === 'discover' }" role="tab" :aria-selected="active === 'discover'" @click="$emit('select', 'discover')"><Map :size="15" /> {{ t('view.discover') }}</button>
  </div>
</template>

<style scoped>
.view-selector { align-items: center; background: color-mix(in srgb, var(--surface) 78%, transparent); border: 1px solid var(--line); border-radius: 20px; display: inline-flex; gap: 4px; height: 42px; padding: 3px; }
.global-view-selector { position: fixed; right: 40px; top: 32px; z-index: 20; }
.global-view-selector.is-scrolled { top: 8px; }
.global-view-selector.is-discover { background: var(--map-control); border-color: var(--map-line); }
.global-view-selector.is-discover button { color: var(--map-muted); }
.global-view-selector.is-discover button:hover { color: var(--map-ink); }
.global-view-selector.is-discover button.active { background: var(--map-control-hover); color: var(--map-ink); }
button { align-items: center; background: transparent; border-radius: 16px; color: var(--muted); display: inline-flex; font-size: 12px; gap: 7px; height: 34px; line-height: 1; padding: 0 12px; }
button:hover { color: var(--ink); }
button.active { background: color-mix(in srgb, var(--ink) 14%, transparent); color: var(--ink); font-weight: 650; }
@media (max-width: 1180px) { .global-view-selector { right: 28px; } }
@media (max-width: 800px) { .global-view-selector { bottom: max(24px, env(safe-area-inset-bottom)); left: 50%; right: auto; top: auto; transform: translateX(-50%); } }
</style>
