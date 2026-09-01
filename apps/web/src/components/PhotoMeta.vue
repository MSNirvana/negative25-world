<script setup lang="ts">
import { Camera, Focus, MapPin, MoreHorizontal, SlidersHorizontal, Star } from 'lucide-vue-next';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';

const props = defineProps<{ photo: GalleryPhoto; detailsOpen?: boolean }>();
defineEmits<{ (event: 'more'): void }>();
const { t } = useLocale();
const stars = Array.from({ length: 7 }, (_, index) => index + 1);
</script>

<template>
  <dl class="meta-row">
    <div class="meta-rating">
      <dt><Star :size="14" /> {{ t('meta.rating') }}</dt>
      <dd class="stars" role="img" :aria-label="t('meta.ratingValue', { rating: photo.rating ?? 0 })">
        <Star v-for="star in stars" :key="star" :size="13" :class="{ filled: photo.rating !== null && star <= photo.rating }" :fill="photo.rating !== null && star <= photo.rating ? 'currentColor' : 'none'" aria-hidden="true" />
      </dd>
    </div>
    <div class="meta-parameters">
      <dt><SlidersHorizontal :size="14" /> {{ t('meta.parameters') }}</dt>
      <dd>{{ photo.focalLength }} · {{ photo.aperture }} · {{ photo.shutterSpeed }} · {{ photo.iso }}</dd>
    </div>
    <div><dt><MapPin :size="14" /> {{ t('meta.place') }}</dt><dd>{{ photo.location }}</dd></div>
    <div><dt><Camera :size="14" /> {{ t('meta.camera') }}</dt><dd>{{ photo.camera }}</dd></div>
    <div class="meta-lens"><dt><Focus :size="14" /> {{ t('meta.lens') }}</dt><dd>{{ photo.lens }}</dd></div>
    <div class="meta-action"><button type="button" :aria-label="t('meta.more')" :title="t('meta.more')" :aria-expanded="props.detailsOpen ?? false" @click="$emit('more')"><MoreHorizontal :size="18" aria-hidden="true" /><span class="sr-only">{{ t('meta.more') }}</span></button></div>
  </dl>
</template>

<style scoped>
.meta-row { border-top: 1px solid var(--line); display: grid; gap: clamp(10px, 1.8vw, 24px); grid-template-columns: minmax(92px, .78fr) minmax(max-content, 1.75fr) minmax(92px, .78fr) minmax(106px, .92fr) minmax(max-content, 1.05fr) auto; margin: 0; min-width: 0; overflow-x: auto; padding-top: 18px; scrollbar-width: none; }
.meta-row::-webkit-scrollbar { display: none; }
.meta-row > div:not(.meta-action) { min-width: 0; text-align: center; }
.meta-parameters, .meta-lens { min-width: max-content; }
dt { align-items: center; color: var(--muted); display: flex; font-size: 11px; gap: 6px; justify-content: center; letter-spacing: .08em; text-transform: uppercase; }
dd { color: var(--ink); font-family: Georgia, ui-serif, serif; font-size: 13px; font-weight: 700; line-height: 1.4; margin: 7px 0 0; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.meta-parameters dd { overflow: visible; text-overflow: clip; }
.meta-lens dd { overflow: visible; text-overflow: clip; }
.stars { align-items: center; color: var(--muted); display: flex; gap: 2px; justify-content: center; }
.stars svg { flex: 0 0 auto; stroke-width: 1.35; }
.stars .filled { color: var(--accent); }
.meta-action { align-items: flex-end; display: flex; }
.meta-action button { align-items: center; background: transparent; color: var(--muted); display: inline-flex; height: 30px; justify-content: center; padding: 0; width: 30px; }
.meta-action button:hover { color: var(--ink); }
@media (max-width: 900px) { .meta-row { grid-template-columns: minmax(84px, .78fr) minmax(max-content, 1.7fr) minmax(84px, .78fr); }.meta-action { align-items: center; justify-content: center; } }
@media (max-width: 680px) { .meta-row { gap: 16px 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }.meta-parameters, .meta-lens { grid-column: 1 / -1; min-width: max-content; }.meta-action { grid-column: span 2; } .meta-action button { padding-top: 0; } }
</style>
