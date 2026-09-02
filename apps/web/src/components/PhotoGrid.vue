<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PhotoCard from './PhotoCard.vue';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import { appendJustifiedRows, buildJustifiedRows, justifiedCellStyle, type JustifiedRow } from '../lib/justified-rows';

const props = defineProps<{ photos: GalleryPhoto[] }>();
const emit = defineEmits<{ (event: 'open', photo: GalleryPhoto): void }>();
const { t } = useLocale();
const root = ref<HTMLElement | null>(null);
const width = ref(0);
const gap = 12;
const rows = ref<JustifiedRow<GalleryPhoto>[]>([]);
let previousPhotos: GalleryPhoto[] = [];
let previousWidth = 0;

function updateRows(): void {
  rows.value = previousWidth === width.value
    ? appendJustifiedRows(rows.value, previousPhotos, props.photos, width.value, gap)
    : buildJustifiedRows(props.photos, width.value, gap);
  previousPhotos = [...props.photos];
  previousWidth = width.value;
}

function scheduleRows(): void { void nextTick(updateRows); }

function updateWidth(): void { width.value = root.value?.clientWidth ?? 0; }

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  updateWidth();
  scheduleRows();
  if (root.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(root.value);
  }
});
watch(() => props.photos.map((photo) => photo.id), scheduleRows, { flush: 'post' });
watch(width, scheduleRows, { flush: 'post' });
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <section ref="root" class="photo-grid" :aria-label="t('photo.gallery')">
      <div v-for="(row, rowIndex) in rows" :key="row.photos[0]?.id ?? rowIndex" class="photo-row" :class="{ 'is-last': row.isLast }" :style="{ '--row-height': `${row.height}px` }">
        <div v-for="photo in row.photos" :key="photo.id" class="photo-cell" :style="justifiedCellStyle(row, photo)">
        <PhotoCard :photo="photo" @open="emit('open', $event)" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.photo-grid { display: grid; gap: 12px; width: 100%; }
.photo-row { display: flex; gap: 12px; min-width: 0; width: 100%; }
.photo-row.is-last { min-height: var(--row-height); }
.photo-cell { min-width: 0; }
.photo-row.is-last .photo-cell { flex-basis: auto !important; width: auto; }
.photo-row.is-last :deep(.image-wrap) { height: var(--row-height); }
@media (max-width: 620px) { .photo-grid, .photo-row { gap: 6px; }.photo-row.is-last { min-height: var(--row-height); }.photo-row.is-last :deep(.image-wrap) { height: var(--row-height); } }
</style>
