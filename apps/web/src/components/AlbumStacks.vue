<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { AlbumDetail } from '@negative25/contracts';
import { toGalleryPhoto, type GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import { buildJustifiedRows, justifiedCellStyle, type JustifiedRow } from '../lib/justified-rows';
import { sortAlbumPhotos } from '../lib/album-layout';

const props = defineProps<{ albums: AlbumDetail[]; expandedAlbumId: string | null }>();
const emit = defineEmits<{
  (event: 'expand', albumId: string): void;
  (event: 'collapse'): void;
  (event: 'open-photo', photo: GalleryPhoto): void;
}>();

const { t } = useLocale();
const expandedAlbum = computed(() => props.albums.find((album) => album.id === props.expandedAlbumId) ?? null);
const layoutRoot = ref<HTMLElement | null>(null);
const layoutWidth = ref(0);
const layoutGap = 13;
const expandedPhotos = computed(() => expandedAlbum.value ? albumPhotos(expandedAlbum.value) : []);
const expandedRows = computed<JustifiedRow<GalleryPhoto>[]>(() => buildJustifiedRows(expandedPhotos.value, layoutWidth.value, layoutGap));

function albumPhotos(album: AlbumDetail): GalleryPhoto[] { return sortAlbumPhotos(album.photos).map(toGalleryPhoto); }
function stackPhotos(album: AlbumDetail): GalleryPhoto[] {
  const photos = albumPhotos(album);
  const coverIndex = album.cover ? photos.findIndex((photo) => photo.id === album.cover?.id) : -1;
  if (coverIndex > 0) photos.unshift(photos.splice(coverIndex, 1)[0]!);
  return photos.slice(0, 3);
}
function collapseOnBlank(event: MouseEvent): void {
  if (!(event.target as HTMLElement).closest('.album-photo')) emit('collapse');
}
function updateLayoutWidth(): void { layoutWidth.value = layoutRoot.value?.clientWidth ?? 0; }

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  updateLayoutWidth();
  if (layoutRoot.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateLayoutWidth);
    resizeObserver.observe(layoutRoot.value);
  }
});
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <section ref="layoutRoot" class="album-stacks" :aria-label="t('albums.photoAlbums')">
    <div v-if="!expandedAlbum" class="album-stack-grid">
      <article v-for="album in albums" :key="album.id" class="album-stack-card">
        <button class="album-stack" type="button" :aria-label="t('albums.openStack', { title: album.title })" @click="emit('expand', album.id)">
          <span class="stack-canvas" :class="{ empty: !stackPhotos(album).length }">
            <span v-for="(photo, index) in stackPhotos(album)" :key="photo.id" class="stack-photo" :style="{ '--stack-index': index }">
              <img :src="photo.image" :alt="index === 0 ? album.title : ''" :style="{ backgroundColor: photo.tone }" />
            </span>
            <span v-if="!stackPhotos(album).length" class="stack-empty">{{ t('albums.emptyStack') }}</span>
          </span>
        </button>
        <div class="album-stack-copy"><h2>{{ album.title }}</h2><time v-if="album.shootDate" :datetime="album.shootDate">{{ album.shootDate }}</time></div>
      </article>
    </div>

    <section v-else class="album-expanded" :aria-label="expandedAlbum.title" @click="collapseOnBlank">
      <div class="album-expanded-title"><h2>{{ expandedAlbum.title }}</h2><span>{{ t('albums.count', { count: expandedAlbum.photoCount }) }}</span></div>
      <div class="album-spread">
        <div v-for="row in expandedRows" :key="row.startIndex" class="album-photo-row" :class="{ 'is-last': row.isLast }" :style="{ '--row-height': `${row.height}px` }">
          <button v-for="(photo, photoIndex) in row.photos" :key="photo.id" class="album-photo" type="button" :style="{ ...justifiedCellStyle(row, photo), '--photo-delay': `${(row.startIndex + photoIndex) * 55}ms`, '--photo-ratio': photo.aspectRatio, backgroundColor: photo.tone }" :aria-label="t('photo.open', { title: photo.title })" @click.stop="emit('open-photo', photo)">
            <img :src="photo.image" :alt="photo.title" loading="lazy" decoding="async" />
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.album-stacks { min-height: 54vh; width: 100%; }
.album-stack-grid { display: grid; gap: 42px 32px; grid-template-columns: repeat(auto-fill, minmax(200px, 220px)); padding: 30px 0 68px 20px; }
.album-stack-card { min-width: 0; width: 220px; }
.album-stack { background: transparent; display: block; padding: 0; text-align: left; width: 100%; }
.stack-canvas { aspect-ratio: 4 / 3; display: block; position: relative; width: 100%; }
.stack-photo { background: var(--surface-soft); box-shadow: 0 17px 31px rgba(0, 0, 0, .22), 0 3px 8px rgba(0, 0, 0, .16); inset: 0; overflow: hidden; position: absolute; transform: translate(calc(var(--stack-index) * -11px), calc(var(--stack-index) * 8px)) rotate(calc(var(--stack-index) * -1.6deg)); transition: transform .42s cubic-bezier(.2,.7,.2,1), box-shadow .42s ease; z-index: calc(4 - var(--stack-index)); }
.stack-photo img { display: block; height: 100%; object-fit: cover; width: 100%; }
.album-stack:hover .stack-photo, .album-stack:focus-visible .stack-photo { box-shadow: 0 22px 36px rgba(0, 0, 0, .3), 0 5px 12px rgba(0, 0, 0, .2); transform: translate(calc(var(--stack-index) * -18px), calc(var(--stack-index) * 12px)) rotate(calc(var(--stack-index) * -2.2deg)); }
.stack-canvas.empty { align-items: center; background: var(--surface-soft); color: var(--muted); display: flex; justify-content: center; }.stack-empty { font-size: 12px; }
.album-stack-copy { align-items: baseline; display: flex; gap: 16px; justify-content: space-between; padding-top: 40px; position: relative; z-index: 5; }.album-stack-copy h2, .album-expanded-title h2 { font-family: Georgia, ui-serif, serif; font-size: 18px; font-weight: 500; margin: 0; }.album-stack-copy time, .album-expanded-title span { color: var(--muted); flex: 0 0 auto; font-size: 11px; }
.album-expanded { animation: expanded-in .34s ease both; min-height: 64vh; padding: 21px 0 86px; }.album-expanded-title { align-items: baseline; display: flex; gap: 16px; justify-content: space-between; padding-bottom: 25px; }.album-spread { display: grid; gap: 13px; width: 100%; }.album-photo-row { display: flex; gap: 13px; min-width: 0; width: 100%; }.album-photo-row.is-last { min-height: var(--row-height); }
.album-photo { animation: photo-spread-in .56s cubic-bezier(.2,.75,.25,1) both; animation-delay: var(--photo-delay); aspect-ratio: var(--photo-ratio); display: block; min-width: 0; overflow: hidden; padding: 0; transform-origin: center center; }.album-photo-row.is-last .album-photo { flex-basis: auto !important; height: var(--row-height); width: auto; }.album-photo img { display: block; height: 100%; object-fit: cover; transition: transform .45s ease; width: 100%; }.album-photo:hover img, .album-photo:focus-visible img { transform: scale(1.025); }
@keyframes expanded-in { from { opacity: 0; } to { opacity: 1; } } @keyframes photo-spread-in { from { opacity: 0; transform: translateY(34px) rotate(-2deg) scale(.94); } to { opacity: 1; transform: translateY(0) rotate(0) scale(1); } }
@media (max-width: 580px) { .album-stack-grid { gap: 30px 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 24px 0 68px; }.album-stack-card { width: 100%; }.stack-photo { transform: translate(calc(var(--stack-index) * -7px), calc(var(--stack-index) * 6px)) rotate(calc(var(--stack-index) * -1.3deg)); }.album-stack:hover .stack-photo, .album-stack:focus-visible .stack-photo { transform: translate(calc(var(--stack-index) * -10px), calc(var(--stack-index) * 8px)) rotate(calc(var(--stack-index) * -1.7deg)); }.album-stack-copy { gap: 8px; padding-top: 28px; }.album-stack-copy h2, .album-expanded-title h2 { font-size: 17px; }.album-stack-copy h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.album-expanded { padding-top: 10px; }.album-expanded-title { gap: 10px; padding-bottom: 18px; }.album-expanded-title h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.album-spread, .album-photo-row { gap: 6px; } }
@media (prefers-reduced-motion: reduce) { .album-expanded, .album-photo { animation: none; }.stack-photo, .album-photo img { transition: none; } }
</style>
