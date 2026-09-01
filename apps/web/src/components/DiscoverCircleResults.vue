<script setup lang="ts">
import { ArrowLeft, ImageOff } from 'lucide-vue-next';
import type { GalleryPhoto } from '../stores/gallery';
import type { CirclePhotoSection } from '../lib/discover-map-data';
import { useLocale } from '../i18n';

defineProps<{
  sections: CirclePhotoSection[];
  count: number;
}>();

const emit = defineEmits<{
  (event: 'clear'): void;
  (event: 'select-photo', photo: GalleryPhoto): void;
}>();

const { t } = useLocale();
</script>

<template>
  <aside class="circle-results" :aria-label="t('discover.circleResults')">
    <header class="circle-header">
      <button class="circle-back" type="button" :aria-label="t('discover.circleClear')" :title="t('discover.circleClear')" @click="emit('clear')"><ArrowLeft :size="18" /></button>
      <div class="circle-heading">
        <span class="circle-eyebrow">{{ t('discover.circleEyebrow') }}</span>
        <h2>{{ t('discover.circleTitle') }}</h2>
      </div>
      <span class="circle-count" aria-live="polite">{{ count }}</span>
    </header>

    <div v-if="sections.length" class="circle-scroll">
      <section v-for="section in sections" :key="section.key" class="circle-section" :aria-labelledby="`circle-${section.key}`">
        <div class="circle-section-heading">
          <h3 :id="`circle-${section.key}`">{{ section.label }}</h3>
          <span>{{ section.photos.length }}</span>
        </div>
        <div class="circle-grid">
          <button v-for="photo in section.photos" :key="photo.id" class="circle-photo" type="button" :aria-label="t('photo.open', { title: photo.title })" @click="emit('select-photo', photo)">
            <img :src="photo.image" :alt="photo.title" loading="lazy" decoding="async" />
          </button>
        </div>
      </section>
    </div>
    <div v-else class="circle-empty"><ImageOff :size="18" /><p>{{ t('discover.circleEmpty') }}</p></div>
  </aside>
</template>

<style scoped>
.circle-results { background: var(--map-surface); border: 1px solid var(--map-line); border-radius: 12px; bottom: 18px; box-shadow: var(--shadow); color: var(--map-ink); display: flex; flex-direction: column; left: 18px; max-height: calc(100svh - 136px); overflow: hidden; position: absolute; top: 94px; width: min(456px, calc(100vw - 36px)); z-index: 9; }
.circle-header { align-items: center; border-bottom: 1px solid var(--map-line); display: flex; flex: 0 0 auto; gap: 12px; min-height: 70px; padding: 12px 16px; }
.circle-back { align-items: center; background: transparent; border: 0; color: var(--map-muted); display: inline-flex; justify-content: center; padding: 6px; }
.circle-back:hover { color: var(--map-ink); }
.circle-heading { display: grid; gap: 3px; min-width: 0; }
.circle-eyebrow { color: var(--map-muted); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.circle-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 23px; font-weight: 500; line-height: 1.1; margin: 0; }
.circle-count { color: var(--map-muted); font-size: 17px; margin-left: auto; }
.circle-scroll { min-height: 0; overflow-y: auto; padding: 9px 16px 24px; scrollbar-width: thin; }
.circle-section { padding: 14px 0 7px; }
.circle-section + .circle-section { border-top: 1px solid var(--map-line); }
.circle-section-heading { align-items: baseline; display: flex; gap: 8px; margin-bottom: 8px; }
.circle-section-heading h3 { font-family: Georgia, ui-serif, serif; font-size: 17px; font-weight: 500; line-height: 1.2; margin: 0; }
.circle-section-heading span { color: var(--map-muted); font-size: 10px; }
.circle-grid { display: grid; gap: 3px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.circle-photo { aspect-ratio: 1; background: var(--map-surface-soft); border: 0; display: block; overflow: hidden; padding: 0; }
.circle-photo img { display: block; height: 100%; object-fit: cover; transition: transform .35s ease, opacity .25s ease; width: 100%; }
.circle-photo:hover img, .circle-photo:focus-visible img { opacity: .82; transform: scale(1.035); }
.circle-photo:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: -2px; }
.circle-empty { align-items: center; color: var(--map-muted); display: flex; flex: 1; font-size: 12px; gap: 8px; justify-content: center; padding: 30px; text-align: center; }
.circle-empty p { margin: 0; }
@media (max-width: 680px) {
  .circle-results { border-radius: 15px 15px 0 0; bottom: 0; left: 0; max-height: 62svh; top: auto; width: 100%; }
  .circle-header { min-height: 62px; }
}
</style>
