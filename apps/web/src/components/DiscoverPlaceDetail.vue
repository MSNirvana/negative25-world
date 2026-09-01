<script setup lang="ts">
import { ArrowLeft, MapPin } from 'lucide-vue-next';
import PhotoCard from './PhotoCard.vue';
import type { GalleryPhoto } from '../stores/gallery';
import type { DiscoverLocation } from '../lib/discover-map-data';
import { useLocale } from '../i18n';

const props = defineProps<{ location: DiscoverLocation }>();
const emit = defineEmits<{ (event: 'back'): void; (event: 'open-photo', photo: GalleryPhoto): void }>();
const { t } = useLocale();
const groupLabel = () => props.location.group === 'unlocated' ? t('discover.unlocated') : t(`discover.group.${props.location.group}`);
const descriptions = () => [...new Set(props.location.photos.map((photo) => photo.caption.trim()).filter(Boolean))].join(' · ');
</script>

<template>
  <section class="place-detail" :class="{ 'single-photo': location.photos.length === 1 }" :aria-label="t('discover.placeDetail', { name: location.name })">
    <div class="detail-topline">
      <button class="detail-back" type="button" :aria-label="t('discover.notFoundBack')" @click="emit('back')"><ArrowLeft :size="16" /> <span>{{ t('discover.backMap') }}</span></button>
      <span class="detail-group">{{ groupLabel() }}</span>
    </div>
    <header class="detail-heading">
      <div>
        <span class="eyebrow"><MapPin :size="12" /> {{ location.coordinates.latitude.toFixed(2) }}, {{ location.coordinates.longitude.toFixed(2) }}</span>
        <h1>{{ location.name }}</h1>
        <p v-if="descriptions()">{{ descriptions() }}</p>
      </div>
      <span class="detail-count">{{ location.photos.length.toString().padStart(2, '0') }}</span>
    </header>
    <div v-if="location.photos.length" class="detail-grid" :class="{ single: location.photos.length === 1 }">
      <PhotoCard v-for="photo in location.photos" :key="photo.id" :photo="photo" @open="emit('open-photo', $event)" />
    </div>
    <div v-else class="detail-empty"><MapPin :size="18" /><p>{{ t('discover.markedNoPhotos') }}</p></div>
  </section>
</template>

<style scoped>
.place-detail { background: var(--map-surface); border: 1px solid var(--map-line); border-radius: 14px; box-shadow: var(--shadow); color: var(--map-ink); display: flex; flex-direction: column; max-height: min(680px, calc(100svh - 124px)); overflow: hidden; padding: 17px 18px 18px; position: fixed; right: 24px; top: 104px; width: min(520px, calc(100vw - 480px)); z-index: 15; }
.place-detail.single-photo { width: min(420px, calc(100vw - 480px)); }
.detail-topline { align-items: center; display: flex; justify-content: space-between; }
.detail-back { align-items: center; background: transparent; color: var(--map-muted); display: inline-flex; font-size: 12px; gap: 7px; padding: 3px 0; }
.detail-back:hover { color: var(--map-ink); }
.detail-group { color: var(--map-muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.detail-heading { align-items: flex-start; border-bottom: 1px solid var(--map-line); display: flex; gap: 16px; justify-content: space-between; margin-top: 20px; padding-bottom: 14px; }
.eyebrow { align-items: center; color: var(--map-muted); display: inline-flex; font-size: 10px; gap: 5px; letter-spacing: .08em; }
.detail-heading h1 { font-family: Georgia, ui-serif, serif; font-size: 38px; font-weight: 500; letter-spacing: -.04em; line-height: 1; margin: 9px 0 8px; }
.detail-heading p { color: var(--map-muted); font-size: 12px; line-height: 1.5; margin: 0; max-width: 320px; }
.detail-count { color: var(--map-muted); font-size: 26px; line-height: 1; }
.detail-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: auto; padding: 15px 2px 2px; }
.detail-grid.single { grid-template-columns: minmax(0, 1fr); }
.detail-grid :deep(.image-wrap) { box-shadow: var(--shadow); }
.detail-empty { align-items: flex-start; color: var(--map-muted); display: flex; font-size: 12px; gap: 9px; line-height: 1.55; padding: 28px 3px 12px; }
.detail-empty p { margin: 0; }
@media (max-width: 900px) {
  .place-detail { right: 16px; width: min(500px, calc(100vw - 32px)); }
  .place-detail.single-photo { width: min(420px, calc(100vw - 32px)); }
}
@media (max-width: 680px) {
  .place-detail, .place-detail.single-photo { border: 0; border-radius: 0; box-shadow: none; display: block; inset: 0; max-height: none; overflow: auto; padding: 92px 16px 44px; position: absolute; width: 100%; z-index: 3; }
  .detail-heading h1 { font-size: 42px; }
  .detail-grid { gap: 15px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding-left: 0; padding-right: 0; }
  .detail-grid :deep(.image-wrap) { border-radius: 4px; }
}
</style>
