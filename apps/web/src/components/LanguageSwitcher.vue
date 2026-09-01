<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale, type Locale } from '../i18n';

const { locale, setLocale, t } = useLocale();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
function toggle(): void { open.value = !open.value; }
function select(next: Locale): void {
  if (locale.value !== next) setLocale(next);
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
  <div ref="root" class="language-switcher">
    <button class="language-trigger" type="button" :aria-label="t('language.label')" :aria-expanded="open" aria-haspopup="menu" :title="t('language.label')" @click.stop="toggle">
      {{ locale === 'zh' ? '中' : 'EN' }}
    </button>
    <div v-if="open" class="language-menu" role="menu" :aria-label="t('language.label')">
      <button class="language-option" type="button" role="menuitemradio" :aria-checked="locale === 'zh'" @click="select('zh')">
        <span class="language-code" aria-hidden="true">中</span>
        <span>{{ t('language.zh') }}</span>
        <Check v-if="locale === 'zh'" class="language-check" :size="14" aria-hidden="true" />
      </button>
      <button class="language-option" type="button" role="menuitemradio" :aria-checked="locale === 'en'" @click="select('en')">
        <span class="language-code" aria-hidden="true">EN</span>
        <span>{{ t('language.en') }}</span>
        <Check v-if="locale === 'en'" class="language-check" :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-switcher { position: relative; }
.language-trigger { align-items: center; background: transparent; border-radius: 4px; color: var(--muted); display: inline-flex; font-size: 11px; font-weight: 650; height: 34px; justify-content: center; min-width: 34px; padding: 0 7px; }
.language-trigger:hover, .language-trigger[aria-expanded='true'] { background: var(--surface-soft); color: var(--ink); }
.language-menu { background: color-mix(in srgb, var(--surface) 97%, var(--paper)); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); display: grid; gap: 2px; min-width: 138px; padding: 6px; position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; }
.language-option { align-items: center; background: transparent; border-radius: 5px; color: var(--muted); display: flex; font-size: 12px; gap: 8px; min-height: 32px; padding: 7px 8px; text-align: left; white-space: nowrap; }
.language-option:hover, .language-option[aria-checked='true'] { background: var(--surface-soft); color: var(--ink); }
.language-code { align-items: center; color: var(--ink); display: inline-flex; font-size: 10px; font-weight: 700; justify-content: center; min-width: 24px; }
.language-check { color: var(--accent-deep); margin-left: auto; }
@media (max-width: 580px) {
  .language-menu { position: fixed; right: 16px; top: 112px; }
}
</style>
