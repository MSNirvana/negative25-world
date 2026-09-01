<script setup lang="ts">
import { Check, Palette } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '../i18n';
import { useTheme, type Theme } from '../theme';

const { t } = useLocale();
const { theme, setTheme, themes } = useTheme();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle(): void { open.value = !open.value; }
function select(next: Theme): void {
  setTheme(next);
  open.value = false;
}
function closeOnOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
function closeOnEscape(event: KeyboardEvent): void { if (event.key === 'Escape') open.value = false; }

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside);
  document.addEventListener('keydown', closeOnEscape);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside);
  document.removeEventListener('keydown', closeOnEscape);
});
</script>

<template>
  <div ref="root" class="theme-switcher">
    <button
      class="theme-trigger"
      type="button"
      :aria-label="t('theme.label')"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="t('theme.label')"
      @click.stop="toggle"
    >
      <Palette :size="15" aria-hidden="true" />
    </button>
    <div v-if="open" class="theme-menu" role="menu" :aria-label="t('theme.label')">
      <button v-for="option in themes" :key="option" class="theme-option" type="button" role="menuitemradio" :aria-checked="theme === option" @click="select(option)">
        <span class="theme-swatch" :class="`swatch-${option}`" aria-hidden="true"></span>
        <span>{{ t(`theme.${option}`) }}</span>
        <Check v-if="theme === option" class="theme-check" :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.theme-switcher { position: relative; }
.theme-trigger { align-items: center; background: transparent; border-radius: 4px; color: var(--muted); display: inline-flex; height: 34px; justify-content: center; padding: 0; width: 34px; }
.theme-trigger:hover, .theme-trigger[aria-expanded='true'] { background: var(--surface-soft); color: var(--ink); }
.theme-menu { background: color-mix(in srgb, var(--surface) 97%, var(--paper)); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); display: grid; gap: 2px; min-width: 142px; padding: 6px; position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; }
.theme-option { align-items: center; background: transparent; border-radius: 5px; color: var(--muted); display: flex; font-size: 12px; gap: 8px; min-height: 32px; padding: 7px 8px; text-align: left; white-space: nowrap; }
.theme-option:hover, .theme-option[aria-checked='true'] { background: var(--surface-soft); color: var(--ink); }
.theme-swatch { border: 1px solid var(--line); border-radius: 50%; display: inline-block; flex: 0 0 auto; height: 14px; width: 14px; }
.swatch-night { background: #171719; }
.swatch-paper { background: #f6f5f1; }
.swatch-mist { background: #e9eef0; }
.theme-check { color: var(--accent-deep); margin-left: auto; }
@media (max-width: 580px) {
  .theme-menu { position: fixed; right: 16px; top: 112px; }
}
</style>
