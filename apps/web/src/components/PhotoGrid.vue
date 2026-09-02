<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PhotoCard from './PhotoCard.vue';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';

const props = defineProps<{ photos: GalleryPhoto[] }>();
const emit = defineEmits<{ (event: 'open', photo: GalleryPhoto): void }>();
const { t } = useLocale();
const root = ref<HTMLElement | null>(null);
const width = ref(0);
const gap = 12;

type PhotoRow = { photos: GalleryPhoto[]; height: number; isLast: boolean };

const targetHeight = computed(() => {
  if (width.value < 620) return 160;
  if (width.value < 1000) return 195;
  if (width.value < 1500) return 235;
  return 270;
});
const maxPhotosPerRow = computed(() => {
  if (width.value < 620) return 5;
  if (width.value < 1000) return 7;
  if (width.value < 1500) return 8;
  // Keep wide desktop rows from turning a small set of portraits into oversized tiles.
  return 10;
});

const rows = computed<PhotoRow[]>(() => {
  const availableWidth = Math.max(width.value, 720);
  const nextRows: GalleryPhoto[][] = [];
  let current: GalleryPhoto[] = [];
  let ratioSum = 0;

  const flush = (): void => {
    if (current.length) nextRows.push(current);
    current = [];
    ratioSum = 0;
  };

  for (const photo of props.photos) {
    const ratio = Math.max(photo.aspectRatio || 1, 0.45);
    const projectedCount = current.length + 1;
    const projectedRatio = ratioSum + ratio;
    const projectedHeight = (availableWidth - gap * (projectedCount - 1)) / projectedRatio;
    const currentHeight = current.length ? (availableWidth - gap * (current.length - 1)) / ratioSum : Infinity;
    const shouldBreak = current.length >= 1 && current.length >= maxPhotosPerRow.value;
    const wouldBeTooShort = current.length >= 1 && projectedHeight < targetHeight.value * 0.76;
    const currentIsCloser = Math.abs(currentHeight - targetHeight.value) <= Math.abs(projectedHeight - targetHeight.value);

    if (shouldBreak || (wouldBeTooShort && currentIsCloser)) flush();
    current.push(photo);
    ratioSum += ratio;
  }
  flush();

  return nextRows.map((items, index) => {
    const ratio = items.reduce((sum, photo) => sum + Math.max(photo.aspectRatio || 1, 0.45), 0);
    const fullWidthHeight = (availableWidth - gap * (items.length - 1)) / ratio;
    // Constrain the only row too, so a single filtered photo keeps the same thumbnail scale.
    const isLast = index === nextRows.length - 1;
    return { photos: items, height: isLast ? Math.min(targetHeight.value, fullWidthHeight) : fullWidthHeight, isLast };
  });
});

function cellStyle(row: PhotoRow, photo: GalleryPhoto): Record<string, string> {
  if (!row.isLast) return { flex: `${Math.max(photo.aspectRatio || 1, 0.45)} 1 0` };
  return { flex: `0 1 ${Math.max(row.height * Math.max(photo.aspectRatio || 1, 0.45), 1)}px` };
}

function updateWidth(): void { width.value = root.value?.clientWidth ?? 0; }

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  updateWidth();
  if (root.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(root.value);
  }
});
watch(() => props.photos.length, () => void nextTick(updateWidth));
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <section ref="root" class="photo-grid" :aria-label="t('photo.gallery')">
    <div v-for="(row, rowIndex) in rows" :key="row.photos[0]?.id ?? rowIndex" class="photo-row" :class="{ 'is-last': row.isLast }" :style="{ '--row-height': `${row.height}px` }">
      <div v-for="photo in row.photos" :key="photo.id" class="photo-cell" :style="cellStyle(row, photo)">
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
