<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PhotoCard from './PhotoCard.vue';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import { appendMasonryColumns, buildMasonryColumns, masonryGapForWidth, type MasonryColumn } from '../lib/masonry-columns';

const props = defineProps<{ photos: GalleryPhoto[] }>();
const emit = defineEmits<{ (event: 'open', photo: GalleryPhoto): void }>();
const { t } = useLocale();
const root = ref<HTMLElement | null>(null);
const width = ref(0);
const columns = ref<MasonryColumn<GalleryPhoto>[]>([]);
let previousPhotos: GalleryPhoto[] = [];
let previousWidth = 0;

function updateColumns(): void {
  const gap = masonryGapForWidth(width.value);
  columns.value = previousWidth === width.value
    ? appendMasonryColumns(columns.value, previousPhotos, props.photos, width.value, gap)
    : buildMasonryColumns(props.photos, width.value, gap);
  previousPhotos = [...props.photos];
  previousWidth = width.value;
}

let rowsFrame = 0;
function scheduleRows(): void {
  if (rowsFrame) return;
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    rowsFrame = window.requestAnimationFrame(() => { rowsFrame = 0; updateColumns(); });
    return;
  }
  void nextTick(updateColumns);
}

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
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (rowsFrame && typeof window !== 'undefined') window.cancelAnimationFrame(rowsFrame);
});
</script>

<template>
  <section ref="root" class="photo-grid" :style="{ '--column-count': columns.length, '--grid-gap': `${masonryGapForWidth(width)}px` }" :aria-label="t('photo.gallery')">
    <div v-for="column in columns" :key="column.index" class="photo-column">
      <div v-for="photo in column.photos" :key="photo.id" class="photo-cell">
        <PhotoCard :photo="photo" @open="emit('open', $event)" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.photo-grid { align-items: start; display: grid; gap: var(--grid-gap); grid-template-columns: repeat(var(--column-count), minmax(0, 1fr)); width: 100%; }
.photo-column { display: grid; gap: var(--grid-gap); min-width: 0; }
.photo-cell { margin-inline: auto; min-width: 0; width: 70%; }
@media (max-width: 580px) { .photo-cell { width: 100%; } }
</style>
