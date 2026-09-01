<script setup lang="ts">import { useLocale } from '../i18n'; defineProps<{ message: string }>(); const { t } = useLocale();</script>
<template><div class="error-state"><strong>{{ t('gallery.errorTitle') }}</strong><p>{{ message }}</p></div></template>
<style scoped>.error-state { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); margin: 48px 0; padding: 30px; text-align: center; }.error-state p { color: var(--muted); margin: 7px 0 0; }</style>
