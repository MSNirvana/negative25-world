<script setup lang="ts">
import { ArrowLeft, LoaderCircle } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchAlbum, isApiConfigured } from '../api/client';
import PhotoGrid from '../components/PhotoGrid.vue';
import PublicFooter from '../components/PublicFooter.vue';
import { useGalleryStore, toGalleryPhoto, type GalleryPhoto } from '../stores/gallery';
import type { AlbumDetail } from '@negative25/contracts';
import { useLocale } from '../i18n';
import { usePublicViewerStore } from '../stores/public-viewer';

const route = useRoute();
const router = useRouter();
const gallery = useGalleryStore();
const album = ref<AlbumDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const albumId = computed(() => String(route.params.id ?? ''));
const photos = computed(() => album.value?.photos.map(toGalleryPhoto) ?? []);
const { t } = useLocale();
const publicViewer = usePublicViewerStore();

async function load(): Promise<void> {
  if (!isApiConfigured() || !albumId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const username = typeof route.query.user === 'string' ? route.query.user : null;
    const profile = username ? await publicViewer.load(username) : null;
    const spaceSlug = profile?.workspaceSlug ?? 'primary';
    gallery.setContext(spaceSlug, null);
    album.value = await fetchAlbum(spaceSlug, albumId.value);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('album.error'); } finally { loading.value = false; }
}
function open(photo: GalleryPhoto): void { gallery.openPhoto(photo); void router.push({ path: `/photo/${photo.id}`, query: route.query }); }
onMounted(load);
watch(albumId, load);
</script>

<template>
  <main class="album-page page-frame">
    <button class="back-link" @click="router.push({ path: '/albums', query: route.query })"><ArrowLeft :size="15" /> {{ t('album.back') }}</button>
    <div v-if="loading" class="empty-state"><LoaderCircle :size="16" class="spin" /> {{ t('album.loading') }}...</div>
    <p v-else-if="error" class="form-error" role="alert">{{ error }}</p>
    <template v-else-if="album">
      <section class="album-heading"><span class="eyebrow">{{ t('album.eyebrow', { count: album.photoCount }) }}</span><h1>{{ album.title }}</h1><p v-if="album.description">{{ album.description }}</p><time v-if="album.shootDate" :datetime="album.shootDate">{{ t('album.shootDate') }}：{{ album.shootDate }}</time></section>
      <PhotoGrid :photos="photos" @open="open" />
      <PublicFooter />
    </template>
  </main>
</template>

<style scoped>
.album-page { padding-bottom: 70px; }.back-link { align-items: center; background: transparent; color: var(--muted); display: inline-flex; font-size: 12px; gap: 6px; padding: 0; }.back-link:hover { color: var(--ink); }.album-heading { padding: 55px 0 40px; }.album-heading h1 { font-family: Georgia, ui-serif, serif; font-size: clamp(37px, 5vw, 58px); font-weight: 500; letter-spacing: -.04em; margin: 13px 0 10px; }.album-heading p { color: var(--muted); font-size: 15px; margin: 0; max-width: 580px; }.album-heading time { color: var(--muted); display: block; font-size: 12px; margin-top: 12px; }.empty-state { align-items: center; color: var(--muted); display: flex; gap: 8px; justify-content: center; padding: 100px 0; }.form-error { color: #d38c80; font-size: 12px; padding: 45px 0; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .album-heading { padding: 42px 0 32px; } }
</style>
